"""Import user-approved UTH curricula into university-neutral catalog tables.

Revision ID: 0011
Revises: 0010
"""

import gzip
import hashlib
import json
import uuid
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

from alembic import op
from app.services.career_map_v1 import course_skill_codes

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

IMPORT_NAMESPACE = uuid.UUID("ea93270b-4029-45fa-9f34-98b124b4e067")
DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "uth_curricula.json.gz"


def _id(*parts: object) -> uuid.UUID:
    return uuid.uuid5(IMPORT_NAMESPACE, "|".join(str(part) for part in parts))


def _chunks(rows: list[dict[str, object]], size: int = 500) -> list[list[dict[str, object]]]:
    return [rows[index:index + size] for index in range(0, len(rows), size)]


def upgrade() -> None:
    op.create_table(
        "academic_programs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("university_id", sa.Uuid(), sa.ForeignKey("universities.id"), nullable=False),
        sa.Column("major_name", sa.String(250), nullable=False),
        sa.Column("specialization_name", sa.String(300), nullable=False),
        sa.Column("program_code", sa.String(40), nullable=False),
        sa.UniqueConstraint("university_id", "major_name", "specialization_name", "program_code"),
    )
    op.create_index("ix_academic_programs_university_id", "academic_programs", ["university_id"])
    op.create_table(
        "curriculum_versions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("program_id", sa.Uuid(), sa.ForeignKey("academic_programs.id"), nullable=False),
        sa.Column("cohort", sa.Integer(), nullable=False),
        sa.Column("source_file", sa.String(300), nullable=False),
        sa.Column("source_url", sa.String(1000)),
        sa.Column("program_url", sa.String(1000)),
        sa.Column("source_sha256", sa.String(64), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("approved", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("program_id", "cohort", "source_file"),
    )
    op.create_index("ix_curriculum_versions_program_id", "curriculum_versions", ["program_id"])
    op.create_table(
        "catalog_courses",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("university_id", sa.Uuid(), sa.ForeignKey("universities.id"), nullable=False),
        sa.Column("code", sa.String(40)),
        sa.Column("name", sa.String(350), nullable=False),
        sa.Column("normalized_key", sa.String(64), nullable=False),
        sa.UniqueConstraint("university_id", "normalized_key"),
    )
    op.create_table(
        "elective_groups",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("curriculum_version_id", sa.Uuid(), sa.ForeignKey("curriculum_versions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("group_code", sa.String(30)),
        sa.Column("raw_label", sa.String(300), nullable=False),
        sa.Column("required_credits", sa.Integer()),
        sa.UniqueConstraint("curriculum_version_id", "raw_label"),
    )
    op.create_index("ix_elective_groups_curriculum_version_id", "elective_groups", ["curriculum_version_id"])
    op.create_table(
        "curriculum_courses",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("curriculum_version_id", sa.Uuid(), sa.ForeignKey("curriculum_versions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("catalog_course_id", sa.Uuid(), sa.ForeignKey("catalog_courses.id"), nullable=False),
        sa.Column("elective_group_id", sa.Uuid(), sa.ForeignKey("elective_groups.id")),
        sa.Column("course_type", sa.String(30), nullable=False),
        sa.Column("credits", sa.Integer()),
        sa.Column("academic_year", sa.String(50)),
        sa.Column("semester", sa.String(50)),
        sa.Column("prerequisite_raw", sa.Text()),
        sa.Column("note", sa.Text()),
        sa.Column("source_page", sa.Integer()),
        sa.Column("source_row", sa.Integer(), nullable=False),
        sa.UniqueConstraint("curriculum_version_id", "source_row"),
    )
    op.create_index("ix_curriculum_courses_curriculum_version_id", "curriculum_courses", ["curriculum_version_id"])
    op.create_table(
        "catalog_course_skills",
        sa.Column("catalog_course_id", sa.Uuid(), sa.ForeignKey("catalog_courses.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("skill_code", sa.String(60), primary_key=True),
        sa.Column("mapping_source", sa.String(40), nullable=False),
        sa.UniqueConstraint("catalog_course_id", "skill_code"),
    )

    document = json.loads(gzip.decompress(DATA_FILE.read_bytes()))
    if document.get("university_code") != "UTH" or document.get("approved") is not True:
        raise RuntimeError("UTH source is missing approval or has an unexpected university code")
    source_sha = document.get("source_sha256")
    source_rows = document.get("rows")
    if not isinstance(source_sha, str) or not isinstance(source_rows, list) or len(source_rows) != 6971:
        raise RuntimeError("UTH source is incomplete")
    university_id = op.get_bind().execute(
        sa.text("SELECT id FROM universities WHERE official_code = 'UTH'")
    ).scalar_one_or_none()
    if university_id is None:
        raise RuntimeError("UTH university is missing; seed universities before curriculum import")

    program_rows: dict[uuid.UUID, dict[str, object]] = {}
    version_rows: dict[uuid.UUID, dict[str, object]] = {}
    course_rows: dict[uuid.UUID, dict[str, object]] = {}
    group_rows: dict[uuid.UUID, dict[str, object]] = {}
    membership_rows: list[dict[str, object]] = []
    for item in source_rows:
        if not isinstance(item, dict):
            raise RuntimeError("Invalid UTH row")
        major = str(item["major"])
        specialization = str(item["specialization"])
        program_code = str(item["program_code"])
        cohort = int(item["cohort"])
        source_file = str(item["source_file"])
        program_id = _id("program", major, specialization, program_code)
        version_id = _id("version", program_id, cohort, source_file)
        course_name = str(item["course_name"])
        course_code = str(item["course_code"]) if item["course_code"] is not None else None
        normalized_name = " ".join(course_name.casefold().split())
        normalized_key = hashlib.sha256(
            f"{course_code or ''}|{normalized_name}".encode()
        ).hexdigest()
        course_id = _id("course", normalized_key)
        group_label = str(item["group_label"]) if item["group_label"] is not None else None
        group_id = _id("group", version_id, group_label) if group_label else None
        program_rows[program_id] = {
            "id": program_id,
            "university_id": university_id,
            "major_name": major,
            "specialization_name": specialization,
            "program_code": program_code,
        }
        version_rows[version_id] = {
            "id": version_id,
            "program_id": program_id,
            "cohort": cohort,
            "source_file": source_file,
            "source_url": item["source_url"],
            "program_url": item["program_url"],
            "source_sha256": source_sha,
            "approved": True,
        }
        course_rows[course_id] = {
            "id": course_id,
            "university_id": university_id,
            "code": course_code,
            "name": course_name,
            "normalized_key": normalized_key,
        }
        if group_id is not None and group_label is not None:
            group_rows[group_id] = {
                "id": group_id,
                "curriculum_version_id": version_id,
                "group_code": item["group_code"],
                "raw_label": group_label,
                "required_credits": item["group_required_credits"],
            }
        membership_rows.append({
            "id": _id("membership", version_id, item["source_row"]),
            "curriculum_version_id": version_id,
            "catalog_course_id": course_id,
            "elective_group_id": group_id,
            "course_type": item["course_type"],
            "credits": item["credits"],
            "academic_year": item["academic_year"],
            "semester": item["semester"],
            "prerequisite_raw": item["prerequisite"],
            "note": item["note"],
            "source_page": item["source_page"],
            "source_row": item["source_row"],
        })
    tables = (
        ("academic_programs", list(program_rows.values())),
        ("curriculum_versions", list(version_rows.values())),
        ("catalog_courses", list(course_rows.values())),
        ("elective_groups", list(group_rows.values())),
        ("curriculum_courses", membership_rows),
    )
    for table_name, rows in tables:
        table = sa.Table(table_name, sa.MetaData(), autoload_with=op.get_bind())
        for chunk in _chunks(rows):
            if op.get_bind().dialect.name == "sqlite":
                # SQLite reflection sees UUID columns as CHAR, unlike PostgreSQL.
                chunk = [
                    {key: value.hex if isinstance(value, uuid.UUID) else value for key, value in row.items()}
                    for row in chunk
                ]
            op.bulk_insert(table, chunk)
    skill_rows = [
        {
            "catalog_course_id": course_id,
            "skill_code": skill_code,
            "mapping_source": "name_rule_v1",
        }
        for course_id, course in course_rows.items()
        for skill_code in course_skill_codes(str(course["name"]))
    ]
    skill_table = sa.Table("catalog_course_skills", sa.MetaData(), autoload_with=op.get_bind())
    for chunk in _chunks(skill_rows):
        if op.get_bind().dialect.name == "sqlite":
            chunk = [
                {key: value.hex if isinstance(value, uuid.UUID) else value for key, value in row.items()}
                for row in chunk
            ]
        op.bulk_insert(skill_table, chunk)


def downgrade() -> None:
    for table in (
        "catalog_course_skills",
        "curriculum_courses",
        "elective_groups",
        "catalog_courses",
        "curriculum_versions",
        "academic_programs",
    ):
        op.drop_table(table)
