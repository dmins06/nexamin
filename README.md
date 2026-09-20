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
- Lịch học thật theo ngày: thêm, hoàn thành và xóa buổi học; tiến độ được tính từ dữ liệu người dùng và lưu cục bộ.
- Hồ sơ riêng đầy đủ, chỉnh sửa tên/năm học/giới thiệu và tải ảnh đại diện PNG, JPEG hoặc WebP.
- Hồ sơ công khai tối giản, kết bạn, nhắn tin trực tiếp và chấm đỏ khi có tin nhắn chưa đọc.
- Quản lý môn học; tải, kiểm tra và xử lý PDF, DOCX, PPTX, TXT bằng local storage hoặc S3/MinIO.
- Emin AI hoạt động ngay ở chế độ local, dùng tài liệu đã tải để trả lời có trích dẫn; có thể đổi sang Ollama hoặc API OpenAI-compatible.
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

### Chạy không cần Docker

Sau khi đã tạo môi trường Python và cài backend một lần:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
cd ..
npm run dev:full
```

Lệnh `dev:full` tự khởi tạo schema trên SQLite cục bộ, khởi động API tại cổng
`8010` và frontend tại cổng `5173`. Dữ liệu phát triển được lưu trong
`backend/studyhub-dev.db` và không được commit.

Nếu chỉ phát triển backend không qua Docker:

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -e '.[dev]'
cd ..
npm run dev:backend
```

## Triển khai miễn phí trên Render

Project có `Dockerfile` full-stack và `render.yaml`. Sau khi repo private đã có trên GitHub, tạo **New Blueprint** trong Render và chọn repo. Blueprint tạo một domain HTTPS `*.onrender.com`, PostgreSQL và Key Value. JWT được Render tự sinh; không cần commit `.env`.

> Gói miễn phí phù hợp bản preview: web service ngủ khi không hoạt động, PostgreSQL miễn phí hết hạn sau 30 ngày và file upload local có thể mất khi service restart. Muốn lưu file lâu dài, đặt `STORAGE_PROVIDER=s3` và khai báo secret S3 trong Render.

## Kiểm tra chất lượng

```bash
npm run lint
npm run typecheck
npm test
npm run build

cd backend
.venv/bin/ruff check .
.venv/bin/mypy app scripts
.venv/bin/pytest -q
```

## Cấu hình

- Frontend đọc `VITE_API_BASE_URL` từ `.env`.
- Backend đọc PostgreSQL, Redis, MinIO, JWT, OAuth và cấu hình mô hình AI từ
  `backend/.env`.
- Chỉ sao chép từ các file `.env.example`; không commit secret thật.
- Migration `0002` nhập danh mục 426 trường, `0003` đồng bộ logo, `0004` hỗ trợ tên chương trình dài và `0005` thêm kết bạn/tin nhắn.

Xem [backend/ARCHITECTURE.md](backend/ARCHITECTURE.md), [DESIGN.md](DESIGN.md)
và [AGENTS.md](AGENTS.md) để biết thêm quy ước kiến trúc và giao diện.
