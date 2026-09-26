"""Review imported questions and publish a curated exam from the server CLI.

Examples:
  python -m scripts.review_practice_questions pending
  python -m scripts.review_practice_questions verify QUESTION_UUID
  python -m scripts.review_practice_questions reject QUESTION_UUID
  python -m scripts.review_practice_questions publish SUBJECT_UUID "Đề cơ bản" QUESTION_UUID ...
"""

import argparse
import asyncio
import uuid

from sqlalchemy import select

from app.database import SessionFactory
from app.models.practice import (
    PracticeExam,
    PracticeExamQuestion,
    PracticeQuestion,
    PracticeQuestionOption,
    VerificationStatus,
)


async def pending() -> None:
    async with SessionFactory() as session:
        questions = list((await session.scalars(
            select(PracticeQuestion)
            .where(PracticeQuestion.verification_status == VerificationStatus.PENDING)
            .order_by(PracticeQuestion.created_at)
            .limit(100)
        )).all())
        for question in questions:
            options = list((await session.scalars(
                select(PracticeQuestionOption)
                .where(PracticeQuestionOption.question_id == question.id)
                .order_by(PracticeQuestionOption.order_index)
            )).all())
            print(f"\n{question.id} · {question.question_type.value} · {question.difficulty}")
            print(f"Subject {question.subject_id}: {question.question_text}")
            for option in options:
                print(f"  {option.option_key}. {option.option_text} {'[correct]' if option.is_correct else ''}")
            print(f"Explanation: {question.explanation}")
            print(f"Source: {question.source_name} | {question.source_url or '-'} | {question.source_license}")
        print(f"\nShowing {len(questions)} pending questions (maximum 100).")


async def set_status(question_id: uuid.UUID, status: VerificationStatus) -> None:
    async with SessionFactory() as session:
        question = await session.get(PracticeQuestion, question_id)
        if question is None:
            raise ValueError("Question not found.")
        if question.verification_status != VerificationStatus.PENDING:
            raise ValueError("Only pending questions can be reviewed.")
        options = list((await session.scalars(
            select(PracticeQuestionOption)
            .where(PracticeQuestionOption.question_id == question.id)
        )).all())
        if len(options) < 2 or not any(option.is_correct for option in options):
            raise ValueError("Question has invalid options.")
        question.verification_status = status
        await session.commit()
        print(f"{status.value}: {question.id}")


async def publish(subject_id: uuid.UUID, title: str, question_ids: list[uuid.UUID]) -> None:
    if not question_ids or len(question_ids) != len(set(question_ids)):
        raise ValueError("Provide one or more distinct question IDs.")
    async with SessionFactory() as session:
        questions = list((await session.scalars(
            select(PracticeQuestion).where(PracticeQuestion.id.in_(question_ids))
        )).all())
        if len(questions) != len(question_ids) or any(
            question.subject_id != subject_id
            or question.verification_status != VerificationStatus.VERIFIED
            for question in questions
        ):
            raise ValueError("Every question must belong to the subject and be verified.")
        exam = PracticeExam(
            subject_id=subject_id,
            title=title,
            kind="curated",
            is_published=True,
        )
        session.add(exam)
        await session.flush()
        session.add_all([
            PracticeExamQuestion(exam_id=exam.id, question_id=question_id, order_index=index)
            for index, question_id in enumerate(question_ids)
        ])
        await session.commit()
        print(f"Published exam: {exam.id}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("pending")
    for action in ("verify", "reject"):
        commands.add_parser(action).add_argument("question_id", type=uuid.UUID)
    publish_parser = commands.add_parser("publish")
    publish_parser.add_argument("subject_id", type=uuid.UUID)
    publish_parser.add_argument("title")
    publish_parser.add_argument("question_ids", nargs="+", type=uuid.UUID)
    args = parser.parse_args()
    if args.command == "pending":
        asyncio.run(pending())
    elif args.command == "verify":
        asyncio.run(set_status(args.question_id, VerificationStatus.VERIFIED))
    elif args.command == "reject":
        asyncio.run(set_status(args.question_id, VerificationStatus.REJECTED))
    else:
        asyncio.run(publish(args.subject_id, args.title, args.question_ids))


if __name__ == "__main__":
    main()
