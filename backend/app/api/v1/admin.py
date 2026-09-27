"""Server-enforced administrative actions; no password hash or reset token is exposed."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Query
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import or_, select, update

from app.core.exceptions import AppError
from app.dependencies import AdminUser, DBSession
from app.models import RefreshToken, Role, User
from app.models.practice import (
    PracticeExam,
    PracticeExamQuestion,
    PracticeQuestion,
    PracticeQuestionOption,
    VerificationStatus,
)
from app.services.password_recovery import mail_enabled, send_reset_link
from app.services.practice_import import QuestionPackage, import_package

router = APIRouter(prefix="/admin", tags=["Admin"])


class AdminUserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: Role
    is_active: bool
    is_verified: bool
    created_at: datetime


class AdminCapabilities(BaseModel):
    mail_enabled: bool


class AdminMessage(BaseModel):
    message: str


class ImportResult(BaseModel):
    imported: int
    duplicates: int


class PendingQuestion(BaseModel):
    id: uuid.UUID
    subject_id: uuid.UUID
    question_text: str
    source_name: str
    source_url: str | None
    source_license: str
    explanation: str
    options: list[dict[str, str | bool]]


class PublishExamRequest(BaseModel):
    subject_id: uuid.UUID
    title: str = Field(min_length=3, max_length=250)
    question_ids: list[uuid.UUID] = Field(min_length=1, max_length=100)


@router.get("/capabilities", response_model=AdminCapabilities)
async def capabilities(admin: AdminUser) -> AdminCapabilities:
    return AdminCapabilities(mail_enabled=mail_enabled())


@router.get("/users", response_model=list[AdminUserSummary])
async def users(
    session: DBSession, admin: AdminUser, q: str = Query(default="", max_length=100),
) -> list[AdminUserSummary]:
    statement = select(User).order_by(User.created_at.desc()).limit(50)
    if q.strip():
        pattern = f"%{q.strip()}%"
        statement = statement.where(or_(User.email.ilike(pattern), User.full_name.ilike(pattern)))
    rows = (await session.scalars(statement)).all()
    return [AdminUserSummary.model_validate(row) for row in rows]


@router.post("/users/{user_id}/lock", response_model=AdminUserSummary)
async def lock_user(user_id: uuid.UUID, session: DBSession, admin: AdminUser) -> AdminUserSummary:
    target = await session.get(User, user_id)
    if target is None:
        raise AppError("USER_NOT_FOUND", "Không tìm thấy tài khoản.", 404)
    if target.id == admin.id or target.role == Role.ADMIN:
        raise AppError("ADMIN_LOCK_FORBIDDEN", "Không thể khóa tài khoản quản trị.", 403)
    target.is_active = False
    await session.execute(update(RefreshToken).where(
        RefreshToken.user_id == target.id, RefreshToken.revoked_at.is_(None)
    ).values(revoked_at=datetime.now(UTC)))
    await session.commit()
    return AdminUserSummary.model_validate(target)


@router.post("/users/{user_id}/unlock", response_model=AdminUserSummary)
async def unlock_user(user_id: uuid.UUID, session: DBSession, admin: AdminUser) -> AdminUserSummary:
    target = await session.get(User, user_id)
    if target is None:
        raise AppError("USER_NOT_FOUND", "Không tìm thấy tài khoản.", 404)
    if target.role == Role.ADMIN:
        raise AppError("ADMIN_UNLOCK_FORBIDDEN", "Không thay đổi trạng thái quản trị viên tại đây.", 403)
    target.is_active = True
    await session.commit()
    return AdminUserSummary.model_validate(target)


@router.post("/users/{user_id}/reset-help", response_model=AdminMessage)
async def reset_help(user_id: uuid.UUID, session: DBSession, admin: AdminUser) -> AdminMessage:
    target = await session.get(User, user_id)
    if target is None:
        raise AppError("USER_NOT_FOUND", "Không tìm thấy tài khoản.", 404)
    await send_reset_link(target)
    return AdminMessage(message="Đã gửi liên kết đặt lại tới email của người dùng.")


@router.post("/practice/import", response_model=ImportResult)
async def import_questions(
    payload: QuestionPackage, session: DBSession, admin: AdminUser
) -> ImportResult:
    added, skipped = await import_package(session, payload)
    return ImportResult(imported=added, duplicates=skipped)


@router.get("/practice/pending", response_model=list[PendingQuestion])
async def pending_questions(session: DBSession, admin: AdminUser) -> list[PendingQuestion]:
    return await _question_summaries(session, VerificationStatus.PENDING)


@router.get("/practice/verified", response_model=list[PendingQuestion])
async def verified_questions(session: DBSession, admin: AdminUser) -> list[PendingQuestion]:
    return await _question_summaries(session, VerificationStatus.VERIFIED)


async def _question_summaries(session: DBSession, status: VerificationStatus) -> list[PendingQuestion]:
    rows = (await session.scalars(select(PracticeQuestion).where(
        PracticeQuestion.verification_status == status
    ).order_by(PracticeQuestion.created_at.desc()).limit(100))).all()
    result = []
    for question in rows:
        options = (await session.scalars(select(PracticeQuestionOption).where(
            PracticeQuestionOption.question_id == question.id
        ).order_by(PracticeQuestionOption.order_index))).all()
        result.append(PendingQuestion(
            id=question.id, subject_id=question.subject_id,
            question_text=question.question_text, source_name=question.source_name,
            source_url=question.source_url, source_license=question.source_license,
            explanation=question.explanation,
            options=[{"key": item.option_key, "text": item.option_text,
                      "correct": item.is_correct} for item in options],
        ))
    return result


@router.post("/practice/questions/{question_id}/verify", response_model=AdminMessage)
async def verify_question(
    question_id: uuid.UUID, session: DBSession, admin: AdminUser
) -> AdminMessage:
    question = await session.get(PracticeQuestion, question_id)
    if question is None or question.verification_status != VerificationStatus.PENDING:
        raise AppError("QUESTION_NOT_PENDING", "Không tìm thấy câu hỏi đang chờ duyệt.", 404)
    options = (await session.scalars(select(PracticeQuestionOption).where(
        PracticeQuestionOption.question_id == question.id
    ))).all()
    correct_count = sum(option.is_correct for option in options)
    if len(options) < 2 or correct_count < 1 or (
        question.question_type.value != "multiple_choice" and correct_count != 1
    ):
        raise AppError("ANSWER_NOT_VERIFIED", "Cần đáp án hợp lệ trước khi duyệt.", 422)
    if not question.source_license or not question.source_name:
        raise AppError("SOURCE_MISSING", "Cần ghi rõ nguồn và quyền sử dụng.", 422)
    question.verification_status = VerificationStatus.VERIFIED
    await session.commit()
    return AdminMessage(message="Đã duyệt câu hỏi.")


@router.post("/practice/questions/{question_id}/reject", response_model=AdminMessage)
async def reject_question(
    question_id: uuid.UUID, session: DBSession, admin: AdminUser
) -> AdminMessage:
    question = await session.get(PracticeQuestion, question_id)
    if question is None or question.verification_status != VerificationStatus.PENDING:
        raise AppError("QUESTION_NOT_PENDING", "Không tìm thấy câu hỏi đang chờ duyệt.", 404)
    question.verification_status = VerificationStatus.REJECTED
    await session.commit()
    return AdminMessage(message="Đã từ chối câu hỏi.")


@router.post("/practice/exams", response_model=AdminMessage)
async def publish_exam(
    payload: PublishExamRequest, session: DBSession, admin: AdminUser
) -> AdminMessage:
    if len(set(payload.question_ids)) != len(payload.question_ids):
        raise AppError("DUPLICATE_QUESTIONS", "Danh sách câu hỏi bị trùng.", 422)
    questions = (await session.scalars(select(PracticeQuestion).where(
        PracticeQuestion.id.in_(payload.question_ids)
    ))).all()
    if len(questions) != len(payload.question_ids) or any(
        item.subject_id != payload.subject_id or item.verification_status != VerificationStatus.VERIFIED
        for item in questions
    ):
        raise AppError("QUESTIONS_NOT_VERIFIED", "Mọi câu hỏi phải cùng môn và đã duyệt.", 422)
    exam = PracticeExam(subject_id=payload.subject_id, owner_id=admin.id,
                        title=payload.title, kind="curated", is_published=True)
    session.add(exam)
    await session.flush()
    session.add_all(PracticeExamQuestion(exam_id=exam.id, question_id=item,
                                         order_index=index)
                    for index, item in enumerate(payload.question_ids))
    await session.commit()
    return AdminMessage(message=f"Đã xuất bản đề {exam.id}.")
