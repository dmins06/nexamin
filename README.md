# StudyHubAI

StudyHubAI là không gian học tập tiếng Việt dành cho sinh viên: quản lý môn học
và tài liệu, hỏi gia sư AI có trích dẫn, lập kế hoạch, học tập trung và theo dõi
tiến độ trong một giao diện responsive.

## Chức năng chính

- Đăng ký, đăng nhập, làm mới phiên và đăng xuất bằng JWT.
- Chọn trường khi đăng ký từ danh mục 426 cơ sở tuyển sinh; tìm được cả khi bỏ
  dấu tiếng Việt hoặc backend chưa chạy.
- Chọn ngành từ snapshot 6.783 chương trình tuyển sinh của 303 trường có dữ liệu công khai; không nhập tay.
- 426/426 trường có tài nguyên hình ảnh cục bộ. Logo từ website chính thức được
  ưu tiên; đơn vị không công bố favicon dùng con dấu mã trường riêng để không
  hiển thị sai thương hiệu.
- Mật khẩu đăng ký tối thiểu 6 ký tự.
- Dashboard, lịch học, Pomodoro, công việc và thống kê tiến độ có lưu cục bộ.
- Quản lý môn học, tải tài liệu, xử lý nền và thư viện học tập.
- Gia sư RAG theo môn học, câu trả lời kèm trích dẫn nguồn.
- Quiz, chấm bài, mức độ thành thạo và gợi ý kế hoạch học.

## Công nghệ

- Frontend: React 18, TypeScript, Vite, Vitest, Testing Library.
- Backend: FastAPI, SQLAlchemy async, Alembic, PostgreSQL/pgvector, Redis,
  Celery và MinIO.
- Hạ tầng phát triển: Docker Compose.

## Chạy nhanh

Yêu cầu: Node.js 20+, Python 3.12+, Docker và Docker Compose.

```bash
cp .env.example .env
cp backend/.env.example backend/.env
npm install
docker compose -f backend/docker-compose.yml up --build -d
npm run dev
```

- Frontend: `http://localhost:5173`
- API docs: `http://localhost:8010/docs`

Nếu chỉ phát triển backend không qua Docker:

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -e '.[dev]'
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload
```

## Kiểm tra chất lượng

```bash
npm run lint
npm run typecheck
npm test
npm run build

cd backend
.venv/bin/ruff check .
.venv/bin/mypy app --ignore-missing-imports
.venv/bin/pytest -q
```

## Cấu hình

- Frontend đọc `VITE_API_BASE_URL` từ `.env`.
- Backend đọc PostgreSQL, Redis, MinIO, JWT, OAuth và cấu hình mô hình AI từ
  `backend/.env`.
- Chỉ sao chép từ các file `.env.example`; không commit secret thật.
- Migration `0002` nhập danh mục 426 trường, `0003` đồng bộ metadata logo và `0004` hỗ trợ tên chương trình đào tạo dài.

Xem [backend/ARCHITECTURE.md](backend/ARCHITECTURE.md), [DESIGN.md](DESIGN.md)
và [AGENTS.md](AGENTS.md) để biết thêm quy ước kiến trúc và giao diện.
