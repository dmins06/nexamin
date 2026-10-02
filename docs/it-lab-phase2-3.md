# CNTT Lab — báo cáo Phase 2/3

Tiếp nối Phase 1 hiện có, không dựng lại Anatomy hoặc thay hệ thống giao diện, tài khoản, dữ liệu backend hay cấu hình Gemini. Đây là các **bản thử nghiệm giáo dục**, không phải công cụ mô phỏng đầy đủ cho doanh nghiệp.

## 1. Chức năng thực sự hoàn thành

| Lab | Có thể đổi | Kết quả tính thật / điều học được |
| --- | --- | --- |
| Computer Architecture | LOAD/ADD/STORE/HALT, RAM ban đầu | Fetch/decode/execute từng lệnh, PC, bốn thanh ghi, RAM 16 ô, cache direct-mapped bốn dòng, hit/miss; trạng thái trước/sau |
| Operating System | Arrival/burst/priority, quantum, chính sách | FCFS/SJF/SRTF/RR/Priority; Gantt, waiting/turnaround/response; RR xử lý arrival trước requeue |
| Memory / Deadlock | Khối trống/yêu cầu, First/Best/Worst Fit; cạnh P→R/R→P | Tách khối RAM động, phân mảnh ngoài; phát hiện chu trình chờ cho tài nguyên single-instance |
| Database | SQL CRUD/JOIN/GROUP BY/ORDER BY, loại JOIN | SQLite WASM thật, bảng kết quả, số dòng thay đổi, DDL, EXPLAIN QUERY PLAN; ghép đúng khóa trùng và NULL mở rộng |
| Network | Thiết bị, IP/mask/gateway, links, nguồn/đích | Topology SVG và packet trace HTTP/TCP/IPv4/Ethernet, hai subnet trực tiếp qua một router; giải thích duplicate IP/missing gateway/wrong subnet/unreachable |
| AI / ML | 2–30 điểm, model/K/learning rate, hidden layers/neurons/activation, query | Linear Regression GD, KNN vote, KMeans cập nhật tâm, CART Gini depth 3, dense MLP full-batch backprop; loss và prediction thật |
| Security | Chuỗi demo, bài học; role/ownership/action giả lập | SHA-256, PBKDF2-SHA256/salt, AES-GCM mã hóa/giải mã/từ chối sửa ciphertext; phân biệt authn/authz, parameter binding và escaped text |

CPU/network/ML dùng snapshot bất biến, phát/tạm dừng/trước/sau/khởi động lại và tốc độ. OS tính lại ngay theo input. Các lab hoạt động không cần AI. Hỏi Emin AI chỉ soạn câu hỏi có giới hạn vào luồng tutor hiện có; Security không có nút chia sẻ để tránh gửi chuỗi nhạy cảm.

Theo lựa chọn người dùng, SQL DB được nhớ trên **thiết bị hiện tại**, không đồng bộ tài khoản. Khôi phục dữ liệu mẫu cần xác nhận. Lỗi, Stop hoặc timeout không ghi đè bản DB đã lưu; hết quota có thông báo và giữ trong tab.

## 2. Chuẩn bị nhưng chưa triển khai

Các mục dưới đây là hướng mở rộng, không được gắn nhãn đã hoạt động: máy tính 3D kỹ thuật chính xác/GPU/pipeline; paging/page replacement/Banker; ERD kéo-thả/generate SQL và B-tree tương tác; multi-router routing tables, ARP/TCP handshake thật/IPv6; CNN/Transformer/RAG, train/test split tự động; khai thác lỗ hổng hoặc môi trường pentest. SQL JOIN là mô hình hàng đọc được, chưa có animation ghép từng cặp.

## 3–5. Code Lab / cách chạy / lý do

Giữ nguyên Python, C, C++, Java, JavaScript đã hoàn thành Phase 1. WASI chạy Python/C/C++/QuickJS và Java 8 chạy qua Doppio trong Worker/iframe opaque-origin. Cách chạy cục bộ phù hợp frontend Vercel miễn phí, không thêm executor vào FastAPI, không đòi Docker quyền cao hoặc dịch vụ trả phí. Xem [kiến trúc](it-lab.md) và [mô hình isolation](code-execution-security.md).

## 6. An toàn và isolation

Student SQL chỉ đi vào Worker SQLite, không vào API/DB Nexamin và không được đánh giá như JavaScript. DB trên mỗi lượt là bản sao; chỉ batch thành công được export/lưu. Transaction thủ công bị từ chối vì export có thể rollback lệnh chưa commit. SQL tối đa 32 KiB, 20 câu, 32 cột, 200 hàng hiển thị/kết quả, output 64 KiB, snapshot 512 KiB, tải 20 giây/chạy 3 giây và WASM memory 256 MiB. PRAGMA có thể thay đổi giới hạn SQLite nội bộ, không thay giới hạn Worker/memory/output/snapshot bên ngoài. Không bảo đảm tổng RAM browser hay chống mọi lỗi trình duyệt/WASM.

Network không gửi packet thật. Security chỉ dùng Web Crypto và pure policy demo; không nhận URL mục tiêu, chạy payload, lưu chuỗi/hash/key/ciphertext hay thay quyền thật. AES key không export và chỉ ở RAM. Tài khoản admin vẫn **không được xem mật khẩu gốc** trong bài học. [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) giải thích vì sao SHA-256 nhanh không phù hợp để lưu mật khẩu; PBKDF2 ở đây minh họa cơ chế, không thay cấu hình đăng nhập Nexamin.

## 7. Routes

Sáu route đã tồn tại nay lazy-load lab thật: `/labs/it/computer`, `/labs/it/os`, `/labs/it/database`, `/labs/it/network`, `/labs/it/ai`, `/labs/it/security`. Giữ `/labs/it`, `/labs/it/code`, `/labs/it/algorithms`, router/auth/breadcrumb và history hiện có. Hub không tải các engine/editor/WASM trước khi mở lab.

## 8. Files

- Feature: các cặp `ComputerLab/cpuEngine`, `OSLab/osEngine`, `DatabaseLab/sqlEngine/sql.worker/sqlStorage`, `NetworkLab/networkEngine`, `MLLab/mlEngine`, `SecurityLab/securityEngine` trong `src/features/labs/it/`.
- Shared: `input`, `useLabSettings`, `usePlayback`, `LabIntro`, `LabExplain`; scoped `it.css`, typed registry và domain contracts.
- Routing: `src/routing/AppRoutes.tsx` và regression tests.
- Kiểm thử: `phase2.test.ts`, `phase3.test.ts`, `database/sql.test.ts`, `Simulations.test.tsx`; cập nhật hub test và `scripts/qa-it.cjs`, thêm `scripts/qa-it-phases.cjs`.
- Dependency/notice/docs: `package.json`, `package-lock.json`, `scripts/prepare-code-runtimes.mjs`, các tài liệu IT/security/runtime và surface briefs. Không đưa các thay đổi backend/unrelated sẵn có vào bản triển khai này.

## 9. Dependencies

Mới: `sql.js@1.14.2` (runtime), `@types/sql.js@1.4.11` (dev). WASM được Vite bundle thành asset hash, chỉ tải khi chạy SQL. sql.js dùng MIT, SQLite public domain; [notice/source](code-runtime-notices.md) và `SQLJS-LICENSE` đi cùng bản build. Không thêm model/dịch vụ AI hay key mới.

## 10–11. Kiểm thử và build

- Lint/typecheck: đạt. Full suite: **23 test files, 131 tests đạt**.
- Engine tests dùng SQLite và Web Crypto thật; component tests giả lập vòng đời Worker, không giả lập kết quả phép tính ở engine tests.
- Browser checks: SQL thật CRUD/persist/reload/failed-batch/reset/JOIN/query-plan; CPU/OS/network/ML/crypto và responsive 360–1600px. Authentication/profile là fixture để không sửa dữ liệu hoặc lấy thông tin đăng nhập thật. Local resource probes không chạy trên production.
- Production build đạt; mỗi lab lazy chunk riêng (~3–7 KiB gzip), SQLite WASM ~658 KiB raw. Cảnh báo bundle lớn CodeMirror/Anatomy là hiện trạng đã lazy-load, không được che bằng sửa ngưỡng.
- `npm audit --omit=dev`: 0 advisory. Năm advisory dev-tool có từ trước vẫn là giới hạn được ghi nhận. Bandit/Semgrep/Gitleaks/pip-audit không có trong môi trường, không báo là đã pass.
- Visual finish review độc lập: **ship**, không có material fix. Đã mở đủ 24 captures của sáu màn hình mặc định × desktop/mobile × dark/light; các tab/model khác có kiểm tra chức năng, không nằm trong verdict hình ảnh. Giữ thiết kế hiện có; cải thiện độ đọc trong light mode, bảng và playback trên mobile theo Impeccable.

## 12. Triển khai

Vercel theo GitHub `main` với `npm ci`/`npm run build`; tiếp tục build/download/verify runtime Phase 1. Không cần đổi Render, DB, biến môi trường, Gemini key hoặc đăng nhập. Web Crypto cần HTTPS (hoặc localhost). Không commit WASM/binaries; giữ license và npm lock. Phải giữ Vercel SPA rewrite cho deep refresh.

## 13. Giới hạn

Mô hình nhỏ để học, không phải microarchitecture/routing/optimizer/framework đầy đủ. ML chỉ báo loss training, không chứng minh generalization; dữ liệu/chỉ số synthetic. SQL là SQLite, không phải PostgreSQL; chỉ main practice DB được lưu, attached files tạm thời. Local storage không mã hóa/không đồng bộ và có thể bị trình duyệt xóa. Không nhập key, mật khẩu hoặc dữ liệu cá nhân vào lab. Public tests client-side không phải chấm điểm tin cậy.

## 14. Bước tiếp theo

Ưu tiên chiều sâu có kiểm thử: paging/LRU, JOIN matching theo từng bước, ERD/B-tree tương tác, hold-out metrics cho ML, rồi routing table nhiều router. Chỉ thêm 3D nếu có asset chính xác và giấy phép rõ. Duy trì isolation và các bài hiện có; không đánh đổi Phase 1 để tăng số hiệu ứng.
