import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class AdvisorAvailability(BaseModel):
    status: Literal["supported", "unsupported", "missing_university", "missing_major"]
    university_code: str | None
    message: str


class CurriculumSummary(BaseModel):
    id: uuid.UUID
    program_id: uuid.UUID
    major: str
    specialization: str
    cohort: int
    source_file: str
    source_url: str | None
    imported_at: datetime
    elective_count: int


class AdvisorResolution(BaseModel):
    status: Literal[
        "ready", "missing_university", "unsupported_university", "missing_major",
        "program_not_mapped", "curriculum_not_found", "electives_not_found",
    ]
    message: str
    curricula: list[CurriculumSummary]


class CareerSummary(BaseModel):
    code: str
    label: str
    skills: list[str]
    evidence_label: str
    evidence_url: str


class RecommendationRequest(BaseModel):
    curriculum_id: uuid.UUID
    career_code: str


class ComparisonRequest(BaseModel):
    curriculum_id: uuid.UUID
    first_career_code: str
    second_career_code: str


class RecommendedCourse(BaseModel):
    catalog_course_id: uuid.UUID
    curriculum_course_id: uuid.UUID
    code: str | None
    name: str
    credits: int
    group: str
    semester: str | None
    academic_year: str | None
    prerequisite: str | None
    relevance_score: float
    matched_skills: list[str]
    reasons: list[str]
    source_url: str | None


class ElectiveGroupPlan(BaseModel):
    name: str
    required_credits: int | None
    selected_credits: int
    status: Literal["satisfied", "unresolved"]


class ElectivePlan(BaseModel):
    curriculum: CurriculumSummary
    career: CareerSummary
    status: Literal["valid_known_rules", "partial"]
    selected_credits: int
    required_credits: int | None
    courses: list[RecommendedCourse]
    exploratory_courses: list[RecommendedCourse]
    groups: list[ElectiveGroupPlan]
    skill_coverage: dict[str, float]
    warnings: list[str]
    explanation: str


class CareerComparison(BaseModel):
    first: ElectivePlan
    second: ElectivePlan
