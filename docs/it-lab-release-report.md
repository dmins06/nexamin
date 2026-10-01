# CNTT Lab — báo cáo Phase 1

1. **Đã hoàn thành:** Hub, Code Lab với editor thật, stdin/stdout/stderr, Run/Stop, thời gian, khôi phục code mẫu, lưu nháp, test công khai; Algorithm Lab với 10 thuật toán, dữ liệu chỉnh được, Play/Pause/Previous/Next/Restart, mã giả đồng bộ và chỉ số. Có nút gửi câu hỏi sang Emin AI hiện có; lab không phụ thuộc AI.
2. **Mới chuẩn bị:** cấu trúc dữ liệu riêng và trang lộ trình cho Computer Architecture, Network, OS, Database, AI/ML, Security. Chưa có CPU/SQL/network/ML/security simulator hoạt động.
3. **Ngôn ngữ:** Python 3.11, C, C++, Java 8, JavaScript QuickJS. JavaScript không phải Node.js; Python không hỗ trợ cài pip.
4. **Cách chạy:** Python/C/C++/JavaScript qua WASI trong Worker; Java qua Doppio JVM trong Worker thuộc iframe khác origin, hệ thống tệp BrowserFS tạm trong RAM.
5. **Lý do chọn:** miễn phí, mã nguồn mở, chạy với frontend Vercel hiện tại, không cần API chạy mã, Docker đặc quyền, server trả phí hay key mới. CodeMirror 6 đáp ứng nhu cầu editor với tải theo route.
6. **Cách ly:** không chạy code sinh viên trong FastAPI/production DB; không xuất khóa, host filesystem hay guest network. Có giới hạn source/input/output/tệp tạm, thời gian và WASM memory; Stop hủy môi trường. Java heap/browser overhead chưa có giới hạn RAM cứng, vẫn có thể làm tab trên thiết bị người dùng bị hết bộ nhớ. Chi tiết ở `code-execution-security.md`.
7. **Routes:** `/labs/it`, `/labs/it/code`, `/labs/it/algorithms`, `/labs/it/computer`, `/labs/it/network`, `/labs/it/os`, `/labs/it/database`, `/labs/it/ai`, `/labs/it/security`. Dùng router hiện có, vẫn yêu cầu đăng nhập.
8. **Files:** thêm `src/features/labs/it/**`, script chuẩn bị runtime + manifest SHA-256 + QA và ba tài liệu kiến trúc/an toàn/license; cập nhật registry/card Lab Hub, routing, tests, `package.json`, lockfile và ignore runtime. Không sửa Anatomy implementation, backend, dữ liệu hay cấu hình Gemini trong tính năng này.
9. **Dependencies:** CodeMirror 6 và grammar Python/C++/Java/JS; `@codemirror/state/view/language`, `@lezer/highlight`; `@runno/wasi@0.10.0`, `fflate@0.8.3`. Doppio/BrowserFS/JCL là runtime asset tải tại build, có checksum và license/source notices.
10. **Tests:** 96/96 test, 19 files; lint/typecheck đạt. Chromium kiểm tra chạy thật cả 5 ngôn ngữ, test case, lỗi, Stop/timeout/output cap, Java bridge denial/EOF, thuật toán và routing cũ/Anatomy. Auth/profile dùng tài khoản QA giả lập, compiler/interpreter không mock. Production npm audit: 0 lỗ hổng; 5 cảnh báo dev-tool có sẵn được ghi rõ, không coi vendored JVM là đã được npm audit chứng nhận.
11. **Build:** production build thành công. Code Lab khoảng 249 KB gzip và Algorithm Lab 8.3 KB gzip, lazy-load theo route; runtime chỉ tải khi Run/Test. Có warning chunk lớn cho Code Lab và Anatomy Viewer, không phải lỗi build. Rà soát giao diện độc lập: `disposition: ship` trên 12 capture desktop/mobile dark/light; Impeccable giữ thiết kế hiện có, không đổi global theme.
12. **Triển khai:** build trên Vercel theo cấu hình hiện có, có `curl`, network đến nguồn runtime được ghim và đủ dung lượng tạm. Không cần migration/key/backend mới. Generated runtime không commit; build tải và kiểm tra checksum. Giữ license cùng bản phân phối. Kết quả triển khai và kiểm tra website được báo riêng sau khi rollout.
13. **Giới hạn:** Java 8/JVM giáo dục cũ, nặng và chậm hơn native, nhất là điện thoại; lần đầu tải khoảng 40 MB. Runtime đầy đủ build khoảng 165 MB. Test công khai tại thiết bị, không chấm điểm tin cậy/hidden tests. Không debugger đầy đủ, đa file, package manager hoặc tự động trực quan hóa code bất kỳ. Mô phỏng là trace thuật toán định nghĩa sẵn, không giả vờ quan sát mã người dùng.
14. **Bước tiếp:** Phase 2: CPU Fetch–Decode–Execute có ghi rõ mô hình đơn giản; OS Scheduling + kiểm thử phép tính; SQLite WASM riêng trong Worker, không nối SQL sinh viên với DB thật. Sau đó Phase 3 network/ML/security sandbox.

Hướng dẫn mở rộng: `it-lab.md`. Nguồn và license runtime: `code-runtime-notices.md`.

## Kết quả website

Feature commit `fa4bd5ac9d9db227db2d5d7a64317e801b5a2ed9`: Vercel báo `success`, deployment `CDd7xznmNF7fDAS85Rsx8pKxLTNb`. Đã kiểm tra tại `https://nexamin.id.vn`:

- Code Lab chạy thật Python, C, C++, Java và JavaScript, cùng stdin/stdout; test tổng hai số đạt 3/3.
- Algorithm Lab: 10 lựa chọn, bước trước/sau, mã giả đồng bộ, Play/Pause, dữ liệu không hợp lệ và sáu trang lộ trình.
- Routes cũ: direct link + refresh, browser history, mobile navigation, 404 và yêu cầu đăng nhập ở deep link; có hồi quy Giải phẫu 3D.
- Runtime source/license notices đã được phục vụ tại `/runtimes/code/SOURCES.md`.

Compiler/runtime trên website **không mock**; session/profile API vẫn dùng fixture QA, không chứng nhận đã đăng nhập bằng tài khoản người dùng thật. Các probe cách ly chỉ chạy localhost, **không chạy trên production**. Đây là smoke test và hồi quy, không phải chứng nhận hệ thống không có lỗ hổng. Commit tài liệu/QA kế tiếp không đổi frontend/runtime.
