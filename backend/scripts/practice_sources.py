"""Reviewable offline practice-source workflow (never publishes questions).

Examples:
  python -m scripts.practice_sources discover-seed
  python -m scripts.practice_sources list
  python -m scripts.practice_sources approve SOURCE_UUID 'CC BY 3.0' https://voer.edu.vn/
  python -m scripts.practice_sources import SOURCE_UUID --file ./review.html
  python -m scripts.practice_sources import SOURCE_UUID --fetch
"""

import argparse
import asyncio
import json
import uuid
from pathlib import Path

from sqlalchemy import select

from app.database import SessionFactory
from app.models.practice import QuestionSource
from app.services.practice_acquisition import (
    extract_questions_detailed,
    extract_text,
    fetch_approved,
)
from app.services.practice_import import QuestionPackage, SourcePackage, import_package
from app.services.practice_sources import SourceCandidate, approve_source, register_candidate
from app.services.practice_subjects import INITIAL_SUBJECTS, resolve_subject

SEED_PATH = Path(__file__).resolve().parents[1] / "data" / "practice_source_candidates.json"


async def run(args: argparse.Namespace) -> None:
    async with SessionFactory() as session:
        if args.command == "discover-seed":
            for name in INITIAL_SUBJECTS:
                await resolve_subject(session, name)
            candidates = json.loads(SEED_PATH.read_text(encoding="utf-8"))
            for item in candidates:
                source = await register_candidate(session, SourceCandidate.model_validate(item))
                print(f"{source.id} | {source.import_status} | {source.name}")
            return
        if args.command == "list":
            for source in (await session.scalars(select(QuestionSource).order_by(QuestionSource.name))).all():
                print(f"{source.id} | {source.import_status} | {source.subject_hint or '-'} | {source.url}")
            return
        source = await session.get(QuestionSource, args.source_id)
        if source is None:
            raise ValueError("Source not found.")
        if args.command == "approve":
            await approve_source(session, source, args.license, args.rights_url)
            print(f"approved: {source.id}")
            return
        if args.command == "reject":
            source.import_status = "rejected"
            source.notes = args.reason
            await session.commit()
            print(f"rejected: {source.id}")
            return
        if source.import_status not in {"approved", "imported"} or not source.license:
            raise ValueError("Source must be approved with documented reuse rights before import.")
        if args.fetch:
            data, suffix = await fetch_approved(source)
        else:
            data = args.file.read_bytes()
            suffix = args.file.suffix
        extraction = extract_questions_detailed(extract_text(data, f"source{suffix}"))
        if not extraction.questions:
            print(f"candidates={extraction.candidate_count} rejected={extraction.rejected_count} imported=0")
            return
        package = QuestionPackage(
            subject_name=source.subject_hint or "",
            source=SourcePackage(
                name=source.name, url=source.url, license=source.license,
                source_type="open_educational", reuse_confirmed=True, source_id=source.id,
            ),
            questions=extraction.questions,
        )
        added, duplicates = await import_package(session, package, extraction.rejected_count)
        print(
            f"candidates={extraction.candidate_count} parsed={len(extraction.questions)} "
            f"imported_pending={added} duplicates={duplicates} "
            f"rejected={extraction.rejected_count} verified=0"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("discover-seed")
    commands.add_parser("list")
    approve = commands.add_parser("approve")
    approve.add_argument("source_id", type=uuid.UUID)
    approve.add_argument("license")
    approve.add_argument("rights_url")
    reject = commands.add_parser("reject")
    reject.add_argument("source_id", type=uuid.UUID)
    reject.add_argument("reason")
    importing = commands.add_parser("import")
    importing.add_argument("source_id", type=uuid.UUID)
    selection = importing.add_mutually_exclusive_group(required=True)
    selection.add_argument("--file", type=Path)
    selection.add_argument("--fetch", action="store_true")
    asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    main()
