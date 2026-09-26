"""Versioned, deterministic career and course-name skill mappings.

Rules only classify courses that exist in the imported curriculum. They do not
create courses or infer credits, prerequisites, semesters, or eligibility.
"""

import re
import unicodedata
from dataclasses import dataclass


def fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text.casefold())
    return " ".join("".join(char for char in decomposed if not unicodedata.combining(char)).split())


@dataclass(frozen=True)
class SkillRule:
    code: str
    label: str
    pattern: str


SKILL_RULES: tuple[SkillRule, ...] = (
    SkillRule("python", "Python", r"\bpython\b"),
    SkillRule("ml", "Machine Learning", r"machine learning|hoc may|khai pha du lieu"),
    SkillRule("dl", "Deep Learning", r"deep learning|hoc sau|mang no ron|neural network"),
    SkillRule("cv", "Computer Vision", r"thi giac may tinh|computer vision"),
    SkillRule("image", "Image Processing", r"xu ly anh|image processing"),
    SkillRule("nlp", "NLP", r"xu ly ngon ngu|ngon ngu tu nhien|nlp|xu ly giong noi"),
    SkillRule("llm", "LLM", r"mo hinh ngon ngu lon|large language model|\bllm\b"),
    SkillRule("rag", "RAG", r"retrieval.augmented|\brag\b"),
    SkillRule("backend", "Backend/API", r"backend|back.end|api|lap trinh web|web programming|cong nghe phan mem"),
    SkillRule("frontend", "Frontend", r"frontend|front.end|thiet ke web|giao dien web"),
    SkillRule("cloud", "Cloud", r"dien toan dam may|cloud computing|ha tang dam may"),
    SkillRule("docker", "Docker", r"\bdocker\b|container"),
    SkillRule("devops", "DevOps", r"devops|cicd|ci/cd|trien khai phan mem"),
    SkillRule("data", "Data Analysis", r"phan tich du lieu|data analysis|khoa hoc du lieu"),
    SkillRule("sql", "SQL/Database", r"co so du lieu|database|\bsql\b|he quan tri co so du lieu"),
    SkillRule("etl", "ETL/Pipeline", r"etl|data pipeline|duong ong du lieu|tich hop du lieu"),
    SkillRule("warehouse", "Data Warehouse", r"kho du lieu|data warehouse"),
    SkillRule("distributed", "Distributed Systems", r"he phan tan|distributed system|big data|du lieu lon"),
    SkillRule("statistics", "Statistics", r"thong ke|statistics|xac suat|probability"),
    SkillRule("visualization", "Visualization", r"truc quan hoa|visualization"),
    SkillRule("timeseries", "Time Series", r"chuoi thoi gian|time series|du bao"),
    SkillRule("experimentation", "Experimentation", r"thiet ke thi nghiem|experimental design|a/b testing"),
    SkillRule("features", "Feature Engineering", r"feature engineering|trich chon dac trung"),
    SkillRule("mlops", "MLOps", r"mlops|van hanh mo hinh|model serving"),
    SkillRule("security", "Security", r"an toan thong tin|bao mat|security|cyber"),
    SkillRule("network", "Networking", r"mang may tinh|networking|thiet ke mang|truyen thong du lieu"),
    SkillRule("os", "Operating Systems", r"he dieu hanh|operating system"),
    SkillRule("cryptography", "Cryptography", r"mat ma|cryptography"),
    SkillRule("linux", "Linux", r"\blinux\b|\bunix\b"),
    SkillRule("software", "Software Engineering", r"cong nghe phan mem|ky thuat phan mem|software engineering|lap trinh"),
    SkillRule("mobile", "Mobile", r"thiet bi di dong|mobile application"),
    SkillRule("web", "Web", r"\bweb\b|ung dung web"),
    SkillRule("infra", "Infrastructure", r"ha tang|infrastructure|quan tri he thong"),
)

SKILL_LABELS = {rule.code: rule.label for rule in SKILL_RULES}


@dataclass(frozen=True)
class CareerPath:
    code: str
    label: str
    skill_weights: tuple[tuple[str, int], ...]


CAREER_PATHS: tuple[CareerPath, ...] = (
    CareerPath("ai_engineer", "AI Engineer", (("python", 2), ("ml", 3), ("dl", 3), ("cv", 2), ("nlp", 2), ("llm", 2), ("rag", 2), ("backend", 2), ("cloud", 1), ("docker", 1), ("mlops", 2), ("data", 1))),
    CareerPath("ml_engineer", "Machine Learning Engineer", (("python", 2), ("ml", 3), ("dl", 3), ("features", 2), ("mlops", 3), ("backend", 1), ("cloud", 1), ("data", 2), ("statistics", 2))),
    CareerPath("data_scientist", "Data Scientist", (("statistics", 3), ("data", 3), ("sql", 2), ("ml", 2), ("visualization", 2), ("timeseries", 2), ("experimentation", 2), ("python", 1))),
    CareerPath("data_engineer", "Data Engineer", (("sql", 3), ("etl", 3), ("distributed", 2), ("cloud", 2), ("warehouse", 3), ("data", 1), ("python", 1), ("infra", 1))),
    CareerPath("backend_engineer", "Backend Engineer", (("backend", 3), ("sql", 2), ("software", 2), ("cloud", 1), ("security", 1), ("distributed", 2), ("docker", 1), ("web", 1))),
    CareerPath("fullstack_developer", "Full-stack Developer", (("frontend", 3), ("backend", 3), ("web", 2), ("sql", 2), ("software", 2), ("cloud", 1), ("security", 1))),
    CareerPath("cybersecurity", "Cybersecurity", (("security", 3), ("network", 2), ("os", 2), ("cryptography", 2), ("software", 1), ("cloud", 1), ("linux", 1))),
    CareerPath("cloud_devops", "Cloud / DevOps", (("cloud", 3), ("docker", 2), ("devops", 3), ("network", 2), ("infra", 2), ("linux", 2), ("security", 1), ("backend", 1))),
)

CAREER_BY_CODE = {career.code: career for career in CAREER_PATHS}


def course_skill_codes(course_name: str) -> list[str]:
    normalized = fold(course_name)
    return [rule.code for rule in SKILL_RULES if re.search(rule.pattern, normalized)]
