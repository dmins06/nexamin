import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.models import University, User
from app.models.curriculum import (
    AcademicProgram,
    CatalogCourse,
    CatalogCourseSkill,
    CurriculumCourse,
    CurriculumVersion,
    ElectiveGroup,
)
from app.services.electives import ElectiveRecommendationService


async def make_catalog(
    session: AsyncSession, user: User
) -> tuple[CurriculumVersion, ElectiveGroup, CatalogCourse]:
    university = University(
        name="Trường Đại học Giao thông vận tải TP.HCM",
        short_name="UTH",
        official_code="UTH",
    )
    session.add(university)
    await session.flush()
    user.university_id = university.id
    user.university = university
    user.major = "Logistics và Quản lý chuỗi cung ứng"
    program = AcademicProgram(
        university_id=university.id,
        major_name=user.major,
        specialization_name="Logistics",
        program_code="TEST-UTH",
    )
    session.add(program)
    await session.flush()
    version = CurriculumVersion(
        program_id=program.id,
        cohort=2024,
        source_file="chuong-trinh.pdf",
        source_url="https://ut.edu.vn/chuong-trinh.pdf",
        source_sha256="a" * 64,
        approved=True,
    )
    session.add(version)
    await session.flush()
    group = ElectiveGroup(
        curriculum_version_id=version.id,
        group_code="TC01",
        raw_label="TC01 (chọn 3 TC)",
        required_credits=3,
    )
    course = CatalogCourse(
        university_id=university.id,
        code="L001",
        name="Quản trị chuỗi cung ứng",
        normalized_key="test-supply-chain",
    )
    session.add_all([group, course])
    await session.flush()
    session.add_all([
        CurriculumCourse(
            curriculum_version_id=version.id,
            catalog_course_id=course.id,
            elective_group_id=group.id,
            course_type="Tự chọn",
            credits=3,
            source_row=21,
        ),
        CatalogCourseSkill(
            catalog_course_id=course.id,
            skill_code="supply_chain",
            mapping_source="name_rule_v1",
        ),
    ])
    await session.commit()
    return version, group, course


@pytest.mark.asyncio
async def test_advisor_requires_uth_and_matching_program(
    session: AsyncSession, users: tuple[User, User]
) -> None:
    first, second = users
    assert ElectiveRecommendationService(session, first).availability().status == "missing_university"
    version, _, _ = await make_catalog(session, first)
    service = ElectiveRecommendationService(session, first)
    assert service.availability().status == "supported"
    assert [item.id for item in await service.curricula()] == [version.id]
    assert "supply_chain_planner" in [item.code for item in await service.career_paths(version.id)]
    assert "ai_engineer" not in [item.code for item in await service.career_paths(version.id)]
    second.university = University(
        name="Trường khác", short_name="KHAC", official_code="OTHER"
    )
    assert ElectiveRecommendationService(session, second).availability().status == "unsupported"
    assert (await ElectiveRecommendationService(session, second).resolve()).status == "unsupported_university"
    with pytest.raises(AppError, match="chỉ khả dụng"):
        await ElectiveRecommendationService(session, second).recommend(version.id, "ai_engineer")
    first.major = "Ngành không liên quan"
    assert (await service.resolve()).status == "program_not_mapped"
    assert await service.curricula() == []
    with pytest.raises(AppError, match="không phù hợp"):
        await service.recommend(version.id, "ai_engineer")


@pytest.mark.asyncio
async def test_exact_credit_plan_and_missing_credit_is_partial(
    session: AsyncSession, users: tuple[User, User]
) -> None:
    first, _ = users
    version, group, _ = await make_catalog(session, first)
    service = ElectiveRecommendationService(session, first)
    plan = await service.recommend(version.id, "supply_chain_planner")
    assert plan.status == "valid_known_rules"
    assert plan.selected_credits == plan.required_credits == 3
    assert len(plan.courses) == 1
    assert plan.courses[0].relevance_score > 0
    assert plan.career.evidence_url.startswith("https://")
    with pytest.raises(AppError, match="không phù hợp với chuyên ngành"):
        await service.recommend(version.id, "ai_engineer")
    assert any("tiên quyết" in warning for warning in plan.warnings)
    group.required_credits = 4
    await session.commit()
    partial = await service.recommend(version.id, "supply_chain_planner")
    assert partial.status == "partial"
    assert partial.courses == []
    assert partial.exploratory_courses[0].name == "Quản trị chuỗi cung ứng"
    assert partial.required_credits is None


@pytest.mark.asyncio
async def test_unknown_curriculum_is_rejected(
    session: AsyncSession, users: tuple[User, User]
) -> None:
    first, _ = users
    await make_catalog(session, first)
    with pytest.raises(AppError, match="không phù hợp"):
        await ElectiveRecommendationService(session, first).recommend(uuid.uuid4(), "ai_engineer")


@pytest.mark.asyncio
async def test_curriculum_and_electives_missing_have_distinct_reasons(
    session: AsyncSession, users: tuple[User, User]
) -> None:
    first, _ = users
    version, _, _ = await make_catalog(session, first)
    service = ElectiveRecommendationService(session, first)
    version.approved = False
    await session.commit()
    assert (await service.resolve()).status == "curriculum_not_found"
    version.approved = True
    for course in (await session.scalars(select(CurriculumCourse))).all():
        course.course_type = "Bắt buộc"
    await session.commit()
    assert (await service.resolve()).status == "electives_not_found"
