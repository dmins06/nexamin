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

# Reuse an already running local API; otherwise start and wait for it.
if curl --silent --fail --max-time 2 http://127.0.0.1:8010/health/live >/dev/null 2>&1; then
  echo "Backend đã sẵn sàng tại http://127.0.0.1:8010"
else
  sh "$project_dir/scripts/dev-backend.sh" &
  backend_pid=$!
  attempt=0
  until curl --silent --fail --max-time 2 http://127.0.0.1:8010/health/live >/dev/null 2>&1; do
    if ! kill -0 "$backend_pid" 2>/dev/null; then
      echo "Backend không khởi động được. Xem lỗi phía trên hoặc chạy npm run dev:backend."
      wait "$backend_pid" || true
      exit 1
    fi
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 100 ]; then
      echo "Backend chưa sẵn sàng trên cổng 8010 sau 30 giây."
      exit 1
    fi
    sleep 0.3
  done
fi

cd "$project_dir"
if command -v npm >/dev/null 2>&1; then
  npm run dev:frontend
elif [ -f "$project_dir/dist/index.html" ]; then
  echo "Không tìm thấy npm. Mở bản web đã build tại http://127.0.0.1:8010"
  if [ -n "${backend_pid:-}" ]; then
    wait "$backend_pid"
  fi
else
  echo "Chưa có npm và dist/index.html. Hãy cài Node.js/npm để build frontend."
  exit 1
fi
