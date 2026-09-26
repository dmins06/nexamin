"""University-neutral curriculum catalog used by the elective advisor."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.entities import UUIDMixin


class AcademicProgram(UUIDMixin, Base):
    __tablename__ = "academic_programs"
    __table_args__ = (
        UniqueConstraint("university_id", "major_name", "specialization_name", "program_code"),
    )

    university_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("universities.id"), index=True)
    major_name: Mapped[str] = mapped_column(String(250))
    specialization_name: Mapped[str] = mapped_column(String(300))
    program_code: Mapped[str] = mapped_column(String(40))


class CurriculumVersion(UUIDMixin, Base):
    __tablename__ = "curriculum_versions"
    __table_args__ = (UniqueConstraint("program_id", "cohort", "source_file"),)

    program_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("academic_programs.id"), index=True
    )
    cohort: Mapped[int] = mapped_column(Integer)
    source_file: Mapped[str] = mapped_column(String(300))
    source_url: Mapped[str | None] = mapped_column(String(1000))
    program_url: Mapped[str | None] = mapped_column(String(1000))
    source_sha256: Mapped[str] = mapped_column(String(64))
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    approved: Mapped[bool] = mapped_column(default=True)


class CatalogCourse(UUIDMixin, Base):
    __tablename__ = "catalog_courses"
    __table_args__ = (UniqueConstraint("university_id", "normalized_key"),)

    university_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("universities.id"))
    code: Mapped[str | None] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(350))
    normalized_key: Mapped[str] = mapped_column(String(64))


class ElectiveGroup(UUIDMixin, Base):
    __tablename__ = "elective_groups"
    __table_args__ = (UniqueConstraint("curriculum_version_id", "raw_label"),)

    curriculum_version_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("curriculum_versions.id", ondelete="CASCADE"), index=True
    )
    group_code: Mapped[str | None] = mapped_column(String(30))
    raw_label: Mapped[str] = mapped_column(String(300))
    required_credits: Mapped[int | None] = mapped_column(Integer)


class CurriculumCourse(UUIDMixin, Base):
    __tablename__ = "curriculum_courses"
    __table_args__ = (UniqueConstraint("curriculum_version_id", "source_row"),)

    curriculum_version_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("curriculum_versions.id", ondelete="CASCADE"), index=True
    )
    catalog_course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("catalog_courses.id"))
    elective_group_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("elective_groups.id"))
    course_type: Mapped[str] = mapped_column(String(30))
    credits: Mapped[int | None] = mapped_column(Integer)
    academic_year: Mapped[str | None] = mapped_column(String(50))
    semester: Mapped[str | None] = mapped_column(String(50))
    prerequisite_raw: Mapped[str | None] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    source_page: Mapped[int | None] = mapped_column(Integer)
    source_row: Mapped[int] = mapped_column(Integer)


class CatalogCourseSkill(Base):
    __tablename__ = "catalog_course_skills"
    __table_args__ = (UniqueConstraint("catalog_course_id", "skill_code"),)

    catalog_course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("catalog_courses.id", ondelete="CASCADE"), primary_key=True
    )
    skill_code: Mapped[str] = mapped_column(String(60), primary_key=True)
    mapping_source: Mapped[str] = mapped_column(String(40), default="name_rule")
