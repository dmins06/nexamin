# StudyHubAI Completion Plan

## Goal

Hoàn thiện nền tảng học tập responsive có xác thực, dữ liệu trường/ngành, lịch học, tiến độ, tài liệu, Emin AI, hồ sơ và kết nối bạn bè; kiểm thử và triển khai private repo lên server preview miễn phí.

## Completed scope

- [x] React + TypeScript + Vite và FastAPI + SQLAlchemy async.
- [x] Đăng ký/đăng nhập JWT, mật khẩu tối thiểu 6 ký tự.
- [x] 426 trường có ảnh cục bộ và 6.783 chương trình đào tạo theo trường.
- [x] Môn học, lịch theo ngày, thêm/xóa/hoàn thành buổi học và tiến độ từ dữ liệu thật.
- [x] Upload/xóa PDF, DOCX, PPTX, TXT; local storage và S3/MinIO.
- [x] Emin AI trả lời ngay ở local và trích dẫn chunk tài liệu.
- [x] Hồ sơ riêng, chỉnh sửa thông tin và ảnh đại diện; hồ sơ khách giới hạn trường/ngành/tên.
- [x] Kết bạn, chấp nhận/từ chối, chat và thông báo chấm đỏ cho tin chưa đọc.
- [x] Responsive 360–1600px, keyboard focus, empty/error/loading state.
- [x] `.env.example`, Docker, Render Blueprint và tài liệu chạy/deploy.
- [ ] Đẩy GitHub private và kích hoạt Render Blueprint (cần người dùng xác thực tài khoản ngoài).

## Definition of Done

- Lint, TypeScript, Vitest, production build, Ruff, mypy và pytest đều pass.
- E2E đăng ký/đăng nhập, upload, Emin AI, profile/avatar, chat/unread pass.
- Không có secret hoặc `.env` thật trong Git.
- Không tràn ngang trên viewport 360px và 1440px.
- Có URL HTTPS public từ nền tảng free sau khi xác thực GitHub/Render.
