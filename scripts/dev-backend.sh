#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
backend_dir="$project_dir/backend"
python_bin="$backend_dir/.venv/bin/python"

if [ ! -x "$python_bin" ]; then
  echo "Chưa có backend/.venv. Hãy chạy:"
  echo "  cd backend && python3 -m venv .venv && .venv/bin/pip install -e '.[dev]'"
  exit 1
fi

cd "$backend_dir"

# Local development works without Docker. Explicit environment values still win.
: "${APP_ENV:=development}"
: "${DATABASE_URL:=sqlite+aiosqlite:///./studyhub-dev.db}"
: "${REDIS_URL:=redis://localhost:6379/0}"
: "${CORS_ORIGINS:=http://localhost:5173}"
: "${RATE_LIMIT_ENABLED:=false}"
: "${OLLAMA_BASE_URL:=http://127.0.0.1:11434}"
export APP_ENV DATABASE_URL REDIS_URL CORS_ORIGINS RATE_LIMIT_ENABLED OLLAMA_BASE_URL

"$python_bin" scripts/init_dev_db.py
exec "$python_bin" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
