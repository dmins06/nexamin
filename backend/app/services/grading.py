from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Course, User


@dataclass(frozen=True)
class GradeBand:
    minimum: float
    letter: str
    points: float


@dataclass(frozen=True)
class GradingPolicy:
    id: str
    name: str
    source_url: str
    bands: tuple[GradeBand, ...]


MOET = GradingPolicy(
    id="moet-08-2021",
    name="Khung tín chỉ Bộ GD&ĐT",
    source_url="https://vanban.chinhphu.vn/default.aspx?docid=203159&pageid=27160",
    bands=(
        GradeBand(8.5, "A", 4.0),
        GradeBand(7.0, "B", 3.0),
        GradeBand(5.5, "C", 2.0),
        GradeBand(4.0, "D", 1.0),
        GradeBand(0.0, "F", 0.0),
    ),
)

HUST = GradingPolicy(
    id="hust-credit",
    name="Đại học Bách khoa Hà Nội",
    source_url="https://www.hust.edu.vn/uploads/sys/quality-assurance/2019/04/tme-10-02-11-qcdttc2014-quy-che-dao-tao-tin-chi2014.397247.16724.pdf",
    bands=(
        GradeBand(9.5, "A+", 4.0),
        GradeBand(8.5, "A", 4.0),
        GradeBand(8.0, "B+", 3.5),
        GradeBand(7.0, "B", 3.0),
        GradeBand(6.5, "C+", 2.5),
        GradeBand(5.5, "C", 2.0),
        GradeBand(5.0, "D+", 1.5),
        GradeBand(4.0, "D", 1.0),
        GradeBand(0.0, "F", 0.0),
    ),
)

VNU_HANOI = GradingPolicy(
    id="vnu-hanoi-credit",
    name="Đại học Quốc gia Hà Nội",
    source_url="https://student.ulis.vnu.edu.vn/files/modules/pdfjs-viewer-shortcode/pdfjs/web/viewer.php?file=https%3A%2F%2Fstudent.ulis.vnu.edu.vn%2Ffiles%2Fuploads%2F2025%2F09%2F3626_21.10.2022.-Quy-che-dao-tao-dai-hoc-tai-DHQGHN-ap-dung-tu-khoa-QH2022-5.pdf",
    bands=(
        GradeBand(9.0, "A+", 4.0),
        GradeBand(8.5, "A", 3.7),
        GradeBand(8.0, "B+", 3.5),
        GradeBand(7.0, "B", 3.0),
        GradeBand(6.5, "C+", 2.5),
        GradeBand(5.5, "C", 2.0),
        GradeBand(5.0, "D+", 1.5),
        GradeBand(4.0, "D", 1.0),
        GradeBand(0.0, "F", 0.0),
    ),
)


def policy_for(official_code: str | None) -> GradingPolicy:
    code = (official_code or "").upper()
    if code == "BKA":
        return HUST
    if code.startswith("QH"):
        return VNU_HANOI
    return MOET


def convert_score(score: float, policy: GradingPolicy) -> GradeBand:
    return next(band for band in policy.bands if score >= band.minimum)


def degree_classification(gpa: float | None) -> str:
    if gpa is None:
        return "Chưa đủ dữ liệu"
    if gpa >= 3.6:
        return "Xuất sắc"
    if gpa >= 3.2:
        return "Giỏi"
    if gpa >= 2.5:
        return "Khá"
    if gpa >= 2.0:
        return "Trung bình"
    return "Chưa đạt"


async def academic_summary(session: AsyncSession, user: User) -> dict[str, object]:
    policy = policy_for(user.university.official_code if user.university else None)
    courses = list((await session.scalars(select(Course).where(Course.owner_id == user.id))).all())
    grades: list[dict[str, object]] = []
    weighted_points = 0.0
    graded_credits = 0
    completed_credits = 0
    for course in courses:
        if not course.is_completed or course.final_score is None:
            continue
        band = convert_score(course.final_score, policy)
        weighted_points += band.points * course.credits
        graded_credits += course.credits
        if band.points > 0:
            completed_credits += course.credits
        grades.append(
            {
                "course_id": course.id,
                "score10": course.final_score,
                "grade4": band.points,
                "letter": band.letter,
                "passed": band.points > 0,
                "credits": course.credits,
            }
        )
    gpa = round(weighted_points / graded_credits, 2) if graded_credits else None
    return {
        "policy": {
            "id": policy.id,
            "name": policy.name,
            "source_url": policy.source_url,
            "is_school_specific": policy is not MOET,
            "bands": [band.__dict__ for band in policy.bands],
        },
        "gpa": gpa,
        "completed_credits": completed_credits,
        "graded_credits": graded_credits,
        "degree_classification": degree_classification(gpa),
        "grades": grades,
    }
