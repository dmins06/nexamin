"""Check or grant a precisely identified account; never print DB credentials.

Usage: python -m scripts.grant_owner_admin --database-url-file PATH --email EMAIL --name NAME --check
       python -m scripts.grant_owner_admin --database-url-file PATH --email EMAIL --name NAME --apply
"""

import argparse
import asyncio
import unicodedata
from pathlib import Path

import asyncpg


def normalized_name(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.lower().replace("đ", "d"))
    return " ".join("".join(character for character in decomposed
                            if not unicodedata.combining(character)).split())


async def run(url: str, email: str, name: str, apply: bool) -> None:
    connection = await asyncpg.connect(url, timeout=15)
    try:
        async with connection.transaction():
            row = await connection.fetchrow(
                "SELECT id, full_name, role, is_active, is_verified "
                "FROM users WHERE lower(email) = $1 FOR UPDATE", email.lower(),
            )
            if row is None:
                raise ValueError("Owner account not found; no change made.")
            print(f"account_name={row['full_name']}")
            print(f"role={row['role']} active={row['is_active']} verified={row['is_verified']}")
            if normalized_name(row["full_name"]) != normalized_name(name):
                raise ValueError("Account name does not match the requested owner; no change made.")
            if not row["is_active"]:
                raise ValueError("Owner account is locked; no change made.")
            if apply:
                await connection.execute(
                    "UPDATE users SET role = 'ADMIN', is_verified = true, updated_at = now() "
                    "WHERE id = $1", row["id"],
                )
                print("owner_admin_granted=true")
            else:
                print("check_only=true")
    finally:
        await connection.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url-file", required=True, type=Path)
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    asyncio.run(run(args.database_url_file.read_text().strip(), args.email, args.name, args.apply))


if __name__ == "__main__":
    main()
