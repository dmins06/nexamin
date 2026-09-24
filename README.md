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
- Mạng xã hội học tập: bảng tin thật, status/ảnh, quyền công khai/bạn bè/riêng tư, thích, bình luận, đăng lại, tìm người dùng và xem hồ sơ.
- Kết bạn, trạng thái online/lần hoạt động gần nhất, nhắn tin trực tiếp, gửi ảnh/tệp và chấm đỏ khi có tin nhắn chưa đọc.
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

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fdmins06%2FStudyHubAI)

Project có `Dockerfile` full-stack và `render.yaml`. Sau khi repo private đã có trên GitHub, tạo **New Blueprint** trong Render và chọn repo. Blueprint tạo một domain HTTPS `*.onrender.com`, PostgreSQL và Key Value. JWT được Render tự sinh; không cần commit `.env`.

Ứng dụng đang hoạt động tại **https://studyhubai-bar8.onrender.com**. Production khởi động bằng `alembic upgrade head` trước Uvicorn; Alembic là nguồn duy nhất quản lý schema PostgreSQL.

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
- Migration `0002` nhập danh mục 426 trường, `0003` đồng bộ logo, `0004` hỗ trợ tên chương trình dài và `0005` thêm kết bạn/tin nhắn, `0008` thêm trạng thái hiện diện và `0009` thêm bảng tin xã hội.

Xem [backend/ARCHITECTURE.md](backend/ARCHITECTURE.md), [DESIGN.md](DESIGN.md)
và [AGENTS.md](AGENTS.md) để biết thêm quy ước kiến trúc và giao diện.

## Chạy Emin AI với Ollama

Emin AI mặc định dùng `LLM_PROVIDER=auto`: ưu tiên Ollama; nếu Ollama chưa chạy hoặc chưa có model, chat chuyển sang chế độ trả lời dựa trên tài liệu đã tải. Chế độ dự phòng không thể tự giảng kiến thức ngoài tài liệu. Để có câu trả lời AI đầy đủ trên máy:

```bash
ollama pull qwen3:4b
ollama serve
npm run dev:full
```

Nếu Ollama đã chạy thì không cần gọi lại `ollama serve`. Script `dev:full` kết nối `http://127.0.0.1:11434`. Với Docker Compose, chạy service Ollama và tải model vào container:

```bash
docker compose -f backend/docker-compose.yml --profile ai up -d ollama
docker compose -f backend/docker-compose.yml exec ollama ollama pull qwen3:4b
```

Khi backend chạy trong Docker, đặt `OLLAMA_BASE_URL=http://ollama:11434` và `LLM_PROVIDER=auto` hoặc `ollama` trong `backend/.env`. `EMBEDDING_PROVIDER=local` là mặc định: tài liệu được truy xuất bằng từ khóa, không cần tải thêm model embedding. Muốn dùng vector, đặt `EMBEDDING_PROVIDER=ollama`, tải `nomic-embed-text` và xử lý lại tài liệu; hệ thống sẽ tự dùng truy xuất từ khóa cho tài liệu cũ hoặc khi embedding không sẵn sàng.

Render không thể gọi Ollama đang chạy trên máy cá nhân qua `localhost`. Blueprint hiện giữ chế độ local để không phụ thuộc dịch vụ ngoài. Nếu muốn Emin AI dùng mô hình trên Render, cần một Ollama endpoint HTTPS có thể truy cập từ Render, cấu hình `LLM_PROVIDER=ollama` (hoặc `auto`), `OLLAMA_BASE_URL` và nếu có thì `OLLAMA_API_KEY` trong Render Environment; không đưa khóa vào Git.

## Frontend trên Vercel

`vercel.json` build ứng dụng Vite từ thư mục gốc, chuyển tiếp `/api/*` và `/media/*` tới backend Render, đồng thời phục vụ `index.html` cho đường dẫn SPA. Không đặt `VITE_API_BASE_URL` thành `localhost` trong môi trường Production. WebSocket thời gian thực kết nối trực tiếp qua WSS tới backend Render; có thể đổi bằng `VITE_REALTIME_BASE_URL` nếu chuyển backend.

Khi kết nối GitHub với Vercel, chọn repository `dmins06/StudyHubAI`, Root Directory là thư mục gốc, Production Branch là `main`. Sau khi tạo project, thêm `nexamin.id.vn` và `www.nexamin.id.vn` trong Project Settings → Domains; đặt `www` chuyển hướng tới domain chính nếu muốn dùng `nexamin.id.vn` làm URL chuẩn. Xem bản ghi DNS cụ thể trong mục Domains của chính project trước khi chỉnh DNS tại P.A Việt Nam; giữ nguyên mọi MX/TXT dùng cho email.
