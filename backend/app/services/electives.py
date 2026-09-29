"""Deterministic elective plans using imported curriculum constraints only."""

import re
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.models import User
from app.models.curriculum import (
    AcademicProgram,
    CatalogCourse,
    CatalogCourseSkill,
    CurriculumCourse,
    CurriculumVersion,
    ElectiveGroup,
)
from app.schemas.electives import (
    AdvisorAvailability,
    AdvisorResolution,
    CareerComparison,
    CareerSummary,
    CurriculumSummary,
    ElectiveGroupPlan,
    ElectivePlan,
    RecommendedCourse,
)
from app.services.career_map_v1 import fold
from app.services.career_map_v2 import (
    CAREER_BY_CODE,
    SKILL_LABELS,
    CareerPath,
    careers_for_program,
    course_skill_codes,
    is_career_relevant_course,
)

SUPPORTED_UNIVERSITY_CODES = frozenset({"UTH"})


@dataclass(frozen=True)
class Candidate:
    membership: CurriculumCourse
    course: CatalogCourse
    skills: frozenset[str]
    score: float


def canonical_name(value: str) -> str:
    normalized = fold(value.replace("đ", "d").replace("Đ", "D")).replace("&", " va ")
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized).strip()
    return re.sub(r"\bcntt\b", "cong nghe thong tin", normalized)


def comparable_specialization(value: str) -> frozenset[str]:
    normalized = canonical_name(value).replace("block chain", "blockchain")
    normalized = re.sub(r"\buas\b", "", normalized).strip()
    words = normalized.split()
    if words[:2] == ["cong", "nghe"] and "blockchain" in words:
        words = words[2:]
    return frozenset(word for word in words if word != "va")


def profile_matches_program(major: str, program: AcademicProgram) -> bool:
    """Match public UTH admission labels, including cohorts and multi-specialty labels."""
    profile = fold(major.replace("đ", "d").replace("Đ", "D")).replace("&", " va ")
    profile = re.sub(r"[^a-z0-9;]+", " ", profile).strip()
    profile = re.sub(r"\bcntt\b", "cong nghe thong tin", profile)
    parent, separator, specialization = profile.partition(" chuyen nganh ")
    program_major = canonical_name(program.major_name)
    program_specialization = canonical_name(program.specialization_name)
    if separator:
        details = re.split(r"\bchuong trinh\b|\bcampus\b", specialization, maxsplit=1)[0]
        options = [option.strip() for option in details.split(";") if option.strip()]
        parent = parent.removeprefix("nganh ").strip()
        same_major = parent == program_major
        grouped_program = parent.startswith(("nhom chuong trinh ", "nhom nganh "))
        if not same_major and not grouped_program:
            return False
        return any(
            comparable_specialization(option) == comparable_specialization(program_specialization)
            for option in options
        )
    profile = re.split(r"\bchuong trinh\b|\bcampus\b", profile, maxsplit=1)[0].strip()
    profile = profile.removeprefix("nganh ").strip()
    if profile in {program_major, program_specialization, canonical_name(program.program_code)}:
        return True
    if profile.startswith("nhom nganh "):
        names = profile.removeprefix("nhom nganh ")
        return bool(re.search(rf"\b{re.escape(program_major)}\b", names))
    return False


def relevance(skills: frozenset[str], career: CareerPath) -> float:
    weights = dict(career.skill_weights)
    matched = sum(weights.get(skill, 0) for skill in skills)
    return round(min(1.0, matched / 8), 2)


def choose_exact(
    candidates: list[Candidate], required: int, used_courses: set[uuid.UUID]
) -> list[Candidate] | None:
    """Exact-credit 0/1 knapsack, optimizing relevance with deterministic ties."""
    states: dict[int, tuple[float, list[Candidate]]] = {0: (0.0, [])}
    for candidate in sorted(candidates, key=lambda row: (row.course.name, str(row.course.id))):
        if candidate.course.id in used_courses or candidate.membership.credits is None:
            continue
        credits = candidate.membership.credits
        if credits <= 0 or credits > required:
            continue
        for total in sorted(states, reverse=True):
            next_total = total + credits
            if next_total > required:
                continue
            old_score, old_items = states[total]
            if any(item.course.id == candidate.course.id for item in old_items):
                continue
            score = old_score + candidate.score
            current = states.get(next_total)
            if current is None or score > current[0]:
                states[next_total] = (score, [*old_items, candidate])
    solution = states.get(required)
    return solution[1] if solution is not None else None


class ElectiveRecommendationService:
    def __init__(self, session: AsyncSession, user: User) -> None:
        self.session = session
        self.user = user

    def availability(self) -> AdvisorAvailability:
        university = self.user.university
        if university is None:
            return AdvisorAvailability(
                status="missing_university",
                university_code=None,
                message="Vui lòng cập nhật trường đại học trong hồ sơ để sử dụng chức năng này.",
            )
        code = university.official_code
        if code not in SUPPORTED_UNIVERSITY_CODES:
            return AdvisorAvailability(
                status="unsupported",
                university_code=code,
                message="Chức năng này hiện chỉ khả dụng cho sinh viên Trường Đại học Giao thông vận tải TP.HCM (UTH) và sẽ sớm được cập nhật cho các trường khác.",
            )
        if not self.user.major:
            return AdvisorAvailability(
                status="missing_major",
                university_code=code,
                message="Vui lòng cập nhật ngành hoặc chuyên ngành trong hồ sơ để chọn đúng chương trình đào tạo.",
            )
        return AdvisorAvailability(
            status="supported",
            university_code=code,
            message="Chọn chương trình đào tạo và định hướng nghề nghiệp để xem kế hoạch môn tự chọn.",
        )

    def _require_supported(self) -> None:
        availability = self.availability()
        if availability.status != "supported":
            raise AppError(availability.status.upper(), availability.message, 403)

    async def resolve(self) -> AdvisorResolution:
        availability = self.availability()
        if availability.status != "supported":
            status = "unsupported_university" if availability.status == "unsupported" else availability.status
            return AdvisorResolution(status=status, message=availability.message, curricula=[])
        programs = (await self.session.scalars(
            select(AcademicProgram).where(AcademicProgram.university_id == self.user.university_id)
        )).all()
        matched_programs = [program for program in programs if profile_matches_program(self.user.major or "", program)]
        if not matched_programs:
            return AdvisorResolution(
                status="program_not_mapped",
                message="Chưa có CTĐT môn tự chọn đã duyệt khớp ngành/chuyên ngành này. Nếu hồ sơ đã đúng, cần bổ sung CTĐT từ UTH trước khi có thể gợi ý môn chính xác.",
                curricula=[],
            )
        rows = (await self.session.execute(
            select(CurriculumVersion, AcademicProgram)
            .join(AcademicProgram, CurriculumVersion.program_id == AcademicProgram.id)
            .where(
                CurriculumVersion.program_id.in_([program.id for program in matched_programs]),
                CurriculumVersion.approved.is_(True),
            )
            .order_by(AcademicProgram.specialization_name, CurriculumVersion.cohort.desc())
        )).all()
        if not rows:
            return AdvisorResolution(
                status="curriculum_not_found",
                message="Chưa tìm thấy CTĐT đã duyệt cho ngành này. Vui lòng liên hệ quản trị viên.",
                curricula=[],
            )
        counts: dict[uuid.UUID, int] = {
            version_id: count for version_id, count in (await self.session.execute(
                select(CurriculumCourse.curriculum_version_id, func.count(CurriculumCourse.id))
                .where(
                    CurriculumCourse.course_type == "Tự chọn",
                    CurriculumCourse.curriculum_version_id.in_([version.id for version, _ in rows]),
                )
                .group_by(CurriculumCourse.curriculum_version_id)
            )).all()
        }
        curricula = [
            CurriculumSummary(
                id=version.id,
                program_id=program.id,
                major=program.major_name,
                specialization=program.specialization_name,
                cohort=version.cohort,
                source_file=version.source_file,
                source_url=version.source_url,
                imported_at=version.imported_at,
                elective_count=counts.get(version.id, 0),
            )
            for version, program in rows if counts.get(version.id, 0) > 0
        ]
        if not curricula:
            return AdvisorResolution(
                status="electives_not_found",
                message="CTĐT của ngành này chưa có môn tự chọn trong dữ liệu đã duyệt.",
                curricula=[],
            )
        return AdvisorResolution(
            status="ready",
            message="Chọn khóa học và định hướng nghề nghiệp để xem môn tự chọn phù hợp.",
            curricula=curricula,
        )

    async def curricula(self) -> list[CurriculumSummary]:
        return (await self.resolve()).curricula

    async def _verified_curriculum(self, curriculum_id: uuid.UUID) -> tuple[CurriculumVersion, AcademicProgram]:
        self._require_supported()
        version = await self.session.get(CurriculumVersion, curriculum_id)
        program = await self.session.get(AcademicProgram, version.program_id) if version else None
        if (
            version is None or program is None or not version.approved
            or program.university_id != self.user.university_id
            or not profile_matches_program(self.user.major or "", program)
        ):
            raise AppError("CURRICULUM_NOT_FOUND", "Chương trình không phù hợp với hồ sơ của bạn.", 404)
        return version, program

    @staticmethod
    def _career_summary(path: CareerPath) -> CareerSummary:
        return CareerSummary(
            code=path.code,
            label=path.label,
            skills=[SKILL_LABELS[code] for code, _ in path.skill_weights],
            evidence_label=path.evidence_label,
            evidence_url=path.evidence_url,
        )

    async def career_paths(self, curriculum_id: uuid.UUID) -> list[CareerSummary]:
        _, program = await self._verified_curriculum(curriculum_id)
        return [
            self._career_summary(path)
            for path in careers_for_program(program.major_name, program.specialization_name)
        ]

    async def recommend(self, curriculum_id: uuid.UUID, career_code: str) -> ElectivePlan:
        self._require_supported()
        if not career_code:
            raise AppError("CAREER_NOT_SELECTED", "Vui lòng chọn định hướng nghề nghiệp.", 422)
        career = CAREER_BY_CODE.get(career_code)
        if career is None:
            raise AppError("CAREER_NOT_FOUND", "Không tìm thấy định hướng nghề nghiệp.", 422)
        version, program = await self._verified_curriculum(curriculum_id)
        if career not in careers_for_program(program.major_name, program.specialization_name):
            raise AppError("CAREER_NOT_APPLICABLE", "Định hướng nghề này không phù hợp với chuyên ngành đã chọn.", 422)
        memberships = (await self.session.execute(
            select(CurriculumCourse, CatalogCourse)
            .join(CatalogCourse, CatalogCourse.id == CurriculumCourse.catalog_course_id)
            .where(
                CurriculumCourse.curriculum_version_id == version.id,
                CurriculumCourse.course_type == "Tự chọn",
            )
        )).all()
        groups = list((await self.session.scalars(
            select(ElectiveGroup)
            .where(ElectiveGroup.curriculum_version_id == version.id)
            .order_by(ElectiveGroup.group_code, ElectiveGroup.raw_label)
        )).all())
        catalog_ids = [course.id for _, course in memberships]
        mapped: dict[uuid.UUID, set[str]] = defaultdict(set)
        if catalog_ids:
            for course_id, skill in (await self.session.execute(
                select(CatalogCourseSkill.catalog_course_id, CatalogCourseSkill.skill_code)
                .where(CatalogCourseSkill.catalog_course_id.in_(catalog_ids))
            )).all():
                mapped[course_id].add(skill)
        grouped: dict[uuid.UUID, list[Candidate]] = defaultdict(list)
        all_candidates: list[Candidate] = []
        skipped_unmapped = 0
        for membership, course in memberships:
            if not is_career_relevant_course(course.name):
                continue
            skills = frozenset(mapped[course.id] | course_skill_codes(course.name))
            candidate = Candidate(membership, course, skills, relevance(skills, career))
            all_candidates.append(candidate)
            if membership.elective_group_id is None:
                skipped_unmapped += 1
                continue
            if candidate.score > 0:
                grouped[membership.elective_group_id].append(candidate)
        group_codes = Counter(group.group_code for group in groups if group.group_code)
        used_courses: set[uuid.UUID] = set()
        selected: list[tuple[Candidate, ElectiveGroup]] = []
        plans: list[ElectiveGroupPlan] = []
        warnings: list[str] = []
        unresolved = False
        for group in groups:
            required = group.required_credits
            if group.group_code and group_codes[group.group_code] > 1:
                warnings.append(f"Nhóm {group.group_code} xuất hiện với nhiều quy tắc trong tài liệu nguồn; cần kiểm tra thủ công.")
                required = None
            if required is None:
                unresolved = True
                plans.append(ElectiveGroupPlan(
                    name=group.raw_label, required_credits=None,
                    selected_credits=0, status="unresolved",
                ))
                continue
            choice = choose_exact(grouped[group.id], required, used_courses)
            if choice is None:
                unresolved = True
                warnings.append(f"Không thể ghép đúng {required} tín chỉ cho {group.raw_label} từ các môn có số tín chỉ rõ ràng.")
                plans.append(ElectiveGroupPlan(
                    name=group.raw_label, required_credits=required,
                    selected_credits=0, status="unresolved",
                ))
                continue
            selected.extend((candidate, group) for candidate in choice)
            used_courses.update(candidate.course.id for candidate in choice)
            plans.append(ElectiveGroupPlan(
                name=group.raw_label, required_credits=required,
                selected_credits=sum(candidate.membership.credits or 0 for candidate in choice),
                status="satisfied",
            ))
        if skipped_unmapped:
            unresolved = True
            warnings.append(f"{skipped_unmapped} môn tự chọn thiếu nhóm, chưa thể đưa vào kế hoạch hợp lệ.")
        if not groups:
            unresolved = True
            warnings.append("Chương trình chưa có quy tắc nhóm tự chọn rõ ràng.")
        if not any(candidate.score > 0 for candidate in all_candidates):
            unresolved = True
            warnings.append("Dữ liệu môn tự chọn hiện có của chuyên ngành này chưa có môn chuyên môn liên quan rõ ràng đến hướng nghề; không tự tạo môn hoặc coi môn thể chất/quốc phòng là phù hợp nghề.")
        if any(member.prerequisite_raw is None for member, _ in memberships):
            warnings.append("Tài liệu nguồn không cung cấp đầy đủ môn tiên quyết; kế hoạch chưa kiểm chứng điều kiện này.")
        if any(member.semester is None for member, _ in memberships):
            warnings.append("Tài liệu nguồn không cung cấp học kỳ; thứ tự học cần được đối chiếu với nhà trường.")
        course_results: list[RecommendedCourse] = []
        career_weights = dict(career.skill_weights)
        def describe(candidate: Candidate, group_name: str, exploratory: bool = False) -> RecommendedCourse:
            matched = [
                SKILL_LABELS[skill] for skill in candidate.skills
                if skill in career_weights and skill in SKILL_LABELS
            ]
            matched.sort()
            return RecommendedCourse(
                catalog_course_id=candidate.course.id,
                curriculum_course_id=candidate.membership.id,
                code=candidate.course.code,
                name=candidate.course.name,
                credits=candidate.membership.credits or 0,
                group=group_name,
                semester=candidate.membership.semester,
                academic_year=candidate.membership.academic_year,
                prerequisite=candidate.membership.prerequisite_raw,
                relevance_score=candidate.score,
                matched_skills=matched,
                reasons=[
                    ("Môn tự chọn thuộc đúng CTĐT; chưa đủ quy tắc để xác nhận kế hoạch tín chỉ."
                     if exploratory else f"Môn có trong nhóm tự chọn {group_name} của đúng chương trình và khóa đã chọn."),
                    f"Tên môn liên quan đến: {', '.join(matched)}." if matched
                    else "Chọn để đáp ứng tín chỉ nhóm; chưa có kỹ năng nghề nghiệp được ánh xạ từ tên môn.",
                ],
                source_url=version.source_url,
            )
        for candidate, group in sorted(selected, key=lambda pair: (-pair[0].score, pair[0].course.name)):
            course_results.append(describe(candidate, group.raw_label))
        selected_ids = {candidate.course.id for candidate, _ in selected}
        exploratory: list[RecommendedCourse] = []
        seen = set(selected_ids)
        for candidate in sorted(all_candidates, key=lambda item: (-item.score, item.course.name)):
            if candidate.score <= 0 or candidate.course.id in seen:
                continue
            seen.add(candidate.course.id)
            candidate_group = next((item for item in groups if item.id == candidate.membership.elective_group_id), None)
            exploratory.append(describe(candidate, candidate_group.raw_label if candidate_group else "Chưa có nhóm", True))
            if len(exploratory) == 5:
                break
        covered = set().union(*(candidate.skills for candidate, _ in selected)) if selected else set()
        coverage = {
            SKILL_LABELS[skill]: 100.0 if skill in covered else 0.0
            for skill, _ in career.skill_weights
        }
        summary = next(
            (item for item in await self.curricula() if item.id == version.id),
            None,
        )
        if summary is None:
            raise AppError("CURRICULUM_NOT_FOUND", "Chương trình không phù hợp với hồ sơ.", 404)
        return ElectivePlan(
            curriculum=summary,
            career=self._career_summary(career),
            status="partial" if unresolved else "valid_known_rules",
            selected_credits=sum(course.credits for course in course_results),
            required_credits=sum(group.required_credits or 0 for group in groups)
            if not unresolved else None,
            courses=course_results,
            exploratory_courses=exploratory,
            groups=plans,
            skill_coverage=coverage,
            warnings=warnings,
            explanation=(
                f"Kế hoạch ưu tiên các môn có kỹ năng liên quan tới {career.label}, "
                "nhưng chỉ kiểm tra những quy tắc tín chỉ và nhóm có trong tài liệu UTH đã nhập. "
                "Điểm phù hợp là ước tính từ tên môn, không phải đánh giá chính thức của nhà trường."
            ),
        )

    async def compare(
        self, curriculum_id: uuid.UUID, first_code: str, second_code: str
    ) -> CareerComparison:
        if first_code == second_code:
            raise AppError("SAME_CAREER", "Hãy chọn hai định hướng khác nhau để so sánh.", 422)
        return CareerComparison(
            first=await self.recommend(curriculum_id, first_code),
            second=await self.recommend(curriculum_id, second_code),
        )
