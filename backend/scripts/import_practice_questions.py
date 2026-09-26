"""Import a local, licensed JSON question package (questions remain pending).

Usage: python -m scripts.import_practice_questions ./questions.json
"""

import argparse
import asyncio
import json
from pathlib import Path

from app.database import SessionFactory
from app.services.practice_import import QuestionPackage, import_package


async def main(package: QuestionPackage) -> None:
    async with SessionFactory() as session:
        added, skipped = await import_package(session, package)
    print(f"Imported {added} pending questions; skipped {skipped} duplicates.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path, help="Local JSON package")
    args = parser.parse_args()
    package = QuestionPackage.model_validate(json.loads(args.path.read_text(encoding="utf-8")))
    asyncio.run(main(package))
