#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

cleanup() {
  if [ -n "${backend_pid:-}" ]; then
    kill "$backend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

sh "$project_dir/scripts/dev-backend.sh" &
backend_pid=$!

cd "$project_dir"
npm run dev
