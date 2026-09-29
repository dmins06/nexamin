import gzip
import json
from pathlib import Path

from app.services.career_map_v2 import (
    SKILL_LABELS,
    careers_for_program,
    course_skill_codes,
    is_career_relevant_course,
)


def test_every_approved_uth_elective_program_has_careers() -> None:
    source = Path(__file__).resolve().parents[1] / "data" / "uth_curricula.json.gz"
    with gzip.open(source, "rt", encoding="utf-8") as handle:
        rows = json.load(handle)["rows"]
    programs = {(row["major"], row["specialization"]) for row in rows if row["course_type"] == "Tự chọn"}
    assert len(programs) >= 45
    for major, specialization in programs:
        careers = careers_for_program(major, specialization)
        assert careers, (major, specialization)
        for career in careers:
            assert career.evidence_url.startswith("https://")
            assert all(skill in SKILL_LABELS for skill, _ in career.skill_weights)


def test_careers_are_specific_to_program() -> None:
    english = {item.code for item in careers_for_program("Ngôn ngữ Anh", "Tiếng anh thương mại, Logistics và vận tải quốc tế")}
    civil = {item.code for item in careers_for_program("Kỹ thuật xây dựng", "Xây dựng dân dụng và công nghiệp")}
    ai = {item.code for item in careers_for_program("Công nghệ thông tin", "Khoa học dữ liệu và AI")}
    assert "ai_engineer" not in english | civil
    assert "technical_translation" in english
    assert "construction_site" in civil
    assert "ai_engineer" in ai


def test_skill_rules_do_not_treat_generic_courses_as_career_evidence() -> None:
    assert "supply_chain" in course_skill_codes("Quản trị chuỗi cung ứng")
    assert "electric" in course_skill_codes("Lưới điện thông minh")
    assert "structural" in course_skill_codes("Kết cấu công trình")
    assert not is_career_relevant_course("Bóng đá")
    assert not is_career_relevant_course("Theo quy định của Trường")
    assert is_career_relevant_course("Kỹ thuật đóng tàu")
