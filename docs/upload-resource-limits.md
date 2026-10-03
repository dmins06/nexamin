# Phase 2 bảo mật — upload và giới hạn tài nguyên

Tiếp nối [Phase 1](private-files.md), theo ưu tiên upload/giới hạn tài nguyên đã chọn. Phạm vi: nhận multipart và đọc PDF/DOCX/PPTX/TXT; không triển khai Phase 3, không đổi schema, provider AI hoặc chính sách file riêng tư.

## Hành vi mới

Upload tài liệu được kiểm tra và trích xuất trong tiến trình con trước khi ghi Blob/DB. File lỗi hoặc vượt giới hạn trả lỗi rõ ràng; không lưu bản ghi/file mới. API chờ tiến trình con bất đồng bộ, không chạy parser trên event loop. Nội dung đã kiểm tra được dùng lại khi lập chunks; không tải và parse lần hai trong luồng Blob/local.

| Giới hạn mặc định | Giá trị |
| --- | --- |
| File tài liệu | 25 MiB |
| Request multipart | File cap + 64 KiB framing; kiểm cả Content-Length và bytes nhận thực tế |
| Attachment / post image / avatar | 10 / 5 / 5 MiB, thêm 64 KiB framing |
| Upload đồng thời | 2 request mỗi API process; vượt ngưỡng trả 503 + Retry-After 5 |
| Nhận body | 120 giây tổng cộng; timeout trả 408 |
| Parser đồng thời | 1 mỗi Python process; bận trả 503, không queue file trong RAM |
| Parser address space / CPU / thời gian thực | 256 MiB / 15 giây / 20 giây |
| OOXML giải nén | 48 MiB tổng, 16 MiB/member, 2048 entries, ratio ≤200 |
| ZIP central directory | 1 MiB; từ chối ZIP64 |
| Pages / extracted UTF-8 text / chunks | 500 / 1 MiB / 4000 |

Các biến tương ứng nằm trong `backend/.env.example`, được validate khi khởi động. Multipart có nhiều field/file vẫn phải nằm trong tổng body cap. Kiểm archive bao gồm tên trùng/path bất thường, encryption, compression method, required parts và decompression/CRC thực tế. PDF mã hóa bị từ chối; decoded page stream có cap 16 MiB. Lỗi định dạng/mã hóa trả 422; vượt tài nguyên trả 413. Thông báo không chứa nội dung file hoặc lỗi parser thô.

Child chạy bằng Python `-I -B`, không nhận môi trường chứa JWT/DB/Blob/Gemini secrets. OS áp dụng `RLIMIT_AS`, `RLIMIT_CPU`, `RLIMIT_CORE=0`, `RLIMIT_FSIZE=0`; parent giới hạn output, timeout, kill và reap khi hủy. Đây là giới hạn tài nguyên trên Unix, không phải sandbox filesystem/network hoặc quét malware. Xem [Python resource](https://docs.python.org/3/library/resource.html).

Concurrency áp dụng theo process, không phải toàn cluster. Celery prefork cần chọn pool phù hợp RAM; worker legacy/S3 vẫn tải object bằng storage adapter hiện có trước bước parser có giới hạn. Chưa có quota tổng dung lượng theo user, distributed admission hoặc timeout riêng cho mọi thao tác Blob/DB. Không nâng gói Render.

## Kiểm chứng trước deploy

- Regression trước sửa: DOCX hợp lệ chứa 2 MiB text lặp, nén dưới 100 KiB, được lưu; sau sửa bị từ chối trước storage/DB. Upload body chậm trước sửa không có deadline; sau sửa trả 408 và giải phóng slot.
- Backend: **154 tests đạt**, gồm valid TXT/PDF/DOCX/PPTX, archive malformed/ratio/entries/size/ZIP64, text/page/chunk caps, lỗi an toàn, overload, streaming không Content-Length, body timeout, cancel/reap, giới hạn OS RAM/CPU thật và permission Private của Phase 1. Fixtures tấn công chỉ chạy cục bộ.
- Frontend: lint/typecheck/build đạt; **146 tests đạt**, 24 files. Vitest chỉ tìm test trong `src`, tránh chạy bản sao/cache kiểm chứng. Warning chunk lớn và Starlette/AnyIO deprecation còn tồn tại.
- Ruff và mypy cho code liên quan đạt; `pip check` đạt. npm audit và pip-audit (107 packages trong venv): 0 advisory; pattern secret scan: 0 findings. Bandit có một B105 LOW ở guard so sánh development JWT marker có sẵn, không phải credential thật. Chưa có Semgrep/Gitleaks hoặc Docker/OS SBOM đầy đủ.

## Rollout

Bản release chỉ chồng các file thuộc Phase 2 lên GitHub main đã hoàn tất Phase 1; không đưa các thay đổi khác trong worktree vào deploy. Snapshot trước rollout: 11 users, 1 document, 32 direct messages, 2 posts, 36 courses, schema `0012`. Render env giữ nguyên, sử dụng defaults được version-control ở trên.

**Đã triển khai và kiểm chứng Phase 2 trên production**, code [`6be4609`](https://github.com/dmins06/nexamin/commit/6be4609c8184bf6c6b00f3281b3f9d9f7edcba78).

| Thành phần | Kết quả |
| --- | --- |
| Render | `dep-db0aevlg1s2s738haj6g`, live, code `6be4609`; auto-deploy `commit` |
| Vercel | `dpl_P9i5eGrnUirFxr14C9DHg9dvanV8`, READY, production, code `6be4609`; [nexamin.id.vn](https://nexamin.id.vn) |
| Frontend build | React/Vite, build Vercel khoảng 43 giây; homepage HTTP 200 |
| Upload smoke | TXT/PDF/DOCX/PPTX nhỏ đều 202, `ready`, page count 1; download đúng bytes trên Vercel và Render |
| Private access | Owner đọc được; outsider 404, anonymous 401; response `private, no-store` |
| Compatibility | Message attachment Private và avatar public vẫn upload được; anonymous provider HEAD không đọc được attachment; avatar tải theo redirect public Blob đúng bytes |
| Cleanup | Xóa 2 accounts/course synthetic, 5 Private keys và 1 public avatar key; cả hai store không còn fixture objects |
| Bảo toàn dữ liệu | Mọi hash của users/documents/messages/posts/courses có trước đều giữ nguyên trong lượt Phase 2; 8 file references và schema `0012` giữ nguyên; toàn bộ Render env values giữ nguyên |

Vercel Git build và một lượt deploy REST cùng commit đều READY; production cuối dùng ID trong bảng. Backend release chính xác đã chạy lại 154 tests đạt, frontend release chính xác chạy lint/typecheck/146 tests/build đạt. Không gửi fixtures gây quá tải lên production, không gọi Gemini/email. Render log query từ 06:59:33 UTC sau rollout: 0 error, không còn trang logs; không cấu hình observability drains mới.

Artifacts trong `.cache/phase2`, Git-ignore: snapshot, release manifest, test/audit logs, cloud verification và cleanup. Fixture credentials đã loại khỏi manifest sau cleanup. Tám file lịch sử thiếu nguồn từ Phase 1 vẫn giữ nguyên references; Phase 2 không phục hồi bytes đó.
