# Nexamin — kiểm tra và hardening, 02/10/2026

Trạng thái: đã sửa và kiểm tra trên repository/localhost; **chưa triển khai các thay đổi này lên production**. Đây không phải chứng nhận hệ thống hoàn toàn an toàn.

Cập nhật tiếp theo 03/10/2026: chủ project đã chọn file riêng tư; adapter/API/UI/migration và Python dependency audit đã được bổ sung. Xem [trạng thái Phase 1 hiện tại](private-files.md); các số liệu và giới hạn bên dưới ghi lại lần kiểm tra 02/10, không thay thế báo cáo mới.

## Phạm vi và phương pháp

Chỉ thử nghiệm Nexamin bằng tài khoản/dữ liệu synthetic, SQLite thử nghiệm, mock Redis/provider và trình duyệt localhost. Không khai thác website production, gọi Gemini bằng key thật, đọc dữ liệu người dùng hoặc thay đổi cloud storage. Không migration/xóa DB, không đổi branding, CosmicBackdrop, navigation hay thiết kế Lab.

Áp dụng Dmin Workflow/Efficient Coding để khoanh vùng thay đổi trong worktree đang có nhiều thay đổi từ trước. Backend inspector, test inspector, AI inventory và security inventory được chạy trước khi sửa. Dmin Backend + Security xác định vòng đời session và thứ tự khóa giao dịch; Dmin Testing dùng bằng chứng test thất bại trước sửa, sau đó chạy regression. Dmin AI Engineer kiểm tra provider thực tế, retrieval và quota. Impeccable harden được dùng để giữ nguyên giao diện, bảo toàn fallback và trạng thái lỗi; không có thay đổi component/CSS chỉ vì thẩm mỹ. Không có skill frontend riêng được cài: phần adapter React/TypeScript theo quy ước project và Efficient Coding.

## Phát hiện và xử lý

| Vấn đề | Bằng chứng / mức độ trong phạm vi kiểm tra | Xử lý |
| --- | --- | --- |
| Access JWT vẫn dùng được sau logout, đổi/reset mật khẩu hoặc lock → unlock | Regression REST tái hiện trước sửa; mức High khi token đã bị đánh cắp | JWT gắn `sid` vào refresh family; mỗi request kiểm tra family còn sống và user còn active bằng một truy vấn `EXISTS`. Logout thu hồi cả family, recovery/lock thu hồi mọi family của user. |
| WebSocket bỏ qua thu hồi session sau khi kết nối | Regression kết nối và gửi sự kiện riêng tư tái hiện trước sửa; High với session bị chiếm | Dùng chung xác thực HTTP; kiểm tra trước mỗi private push và tối đa mỗi 15 giây khi idle. Auth/DB lỗi không cho gửi private event. |
| JWT nằm trong URL WebSocket | Test adapter/handshake tái hiện URL chứa credential; Medium do URL có thể vào log | Bỏ query token; client gửi hai subprotocol `nexamin`, `bearer.<JWT>`. Server chỉ chọn/echo `nexamin`, từ chối kiểu URL cũ. Header vẫn là credential: không log header handshake. |
| Production chấp nhận development JWT secret / CORS `*` | Test settings xác nhận trước sửa; rủi ro cấu hình, **không chứng minh Render hiện dùng cấu hình này** | Settings từ chối khởi động production với default secret đã công khai hoặc CORS wildcard. |
| Một số trường auth không có giới hạn độ dài | Test input bất thường thất bại trước sửa; Low/resource hardening, không phải DoS production đã chứng minh | Giới hạn password 128, refresh 256, Google code/reset token 4096 ký tự trước xử lý credential. Không coi đây là giới hạn toàn bộ HTTP body. |
| Thiếu security headers | Probe localhost trước/sau và test ASGI | Thêm `nosniff`, `no-referrer`, `DENY` cho backend, Vercel, Vite dev/preview. Java iframe vẫn chạy qua browser QA. |
| Các npm advisory của dev toolchain | npm audit trước sửa có 5 advisory; tác động phụ thuộc môi trường dev/UI server | Nâng Vitest lên 4.1.11, giữ Vite 6 tương thích. Full npm audit sau sửa: 0 advisory, cả dev. |

Normal refresh giữ family sống: access token chưa hết hạn vẫn hợp lệ sau một rotation bình thường. Replay refresh token cũ thu hồi family. Logout bằng ancestor đã rotate cũng thu hồi family đó, không làm mất session độc lập khác. Server lấy role từ DB, không tin role tự gửi từ client/JWT.

Các thao tác issuance/refresh/logout/change/reset/lock theo thứ tự khóa User rồi RefreshToken, tránh thứ tự khóa ngược. Regression chạy SQLite; **chưa chạy tải đồng thời PostgreSQL**, không tuyên bố đã chứng minh hết race/deadlock trên production.

Các advisory upstream chỉ mô tả điều kiện khai thác cụ thể, không chứng minh website Vercel bị RCE: [Vitest UI advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-5xrq-8626-4rwp), [mock redirect advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9).

## Điểm còn cần quyết định: file công khai

`backend/app/main.py` phục vụ local `/media` không xác thực; BlobStorage upload dùng `access="public"`. Điều này áp dụng cả tài liệu và đính kèm tin nhắn, dù API danh sách/nội dung môn học có kiểm tra quyền.

Probe tạo **một file synthetic mới** trong local media, truy cập không đăng nhập trả 200 với đúng marker; sau đó xóa chính fixture bằng patch. Không đọc/xóa file đang có. Đây là hành vi anonymous-link đã xác nhận, **không phải bằng chứng liệt kê toàn bộ bucket hay BOLA của API**. Nếu tài liệu/tin nhắn phải riêng tư thì có rủi ro confidentiality Medium khi link bị lộ.

Đã hỏi chủ project chọn file riêng tư hay giữ link công khai; chưa nhận quyết định tại thời điểm báo cáo. Chưa đổi cloud ACL hoặc di chuyển file. Nếu chọn riêng tư, cần delivery có kiểm tra owner/participant, phương án giữ và migrate file cũ; chỉ bảo vệ route `/media` không đủ vì public Blob URL cũ vẫn tồn tại.

## AI, upload và scanner

- Gemini key vẫn chỉ ở backend, không thêm key vào source/frontend. Đã đối chiếu provider OpenAI-compatible với [Google documentation](https://ai.google.dev/gemini-api/docs/openai) và model catalog chính thức; không đổi model theo phỏng đoán, không chứng minh quyền/quota của key thật.
- Test SQLite retrieval thật chứng minh lexical RAG không lấy chunk của chủ/môn khác. Test Redis outage production chứng minh quota trả 503, không bỏ qua giới hạn. Provider/error/quota tests có fixture; không gọi Gemini thật, không báo điểm groundedness, latency hoặc kết quả chống prompt injection chưa đo.
- Prompt coi retrieved text là dữ liệu không tin cậy, không có tool/code execution từ output model; điều này không đảm bảo model luôn chống được prompt injection.
- Đăng ký hiện chưa có email verification/OTP; `is_verified` không phải bằng chứng sở hữu email. Quota theo tài khoản có thể bị lách bằng nhiều tài khoản: cần chính sách chống lạm dụng riêng, không tự bổ sung OTP trong lượt hardening này.
- Upload kiểm tra size/extension/signature không phải malware scan hoặc quota giải nén DOCX/PPTX. Các giới hạn browser Lab không phải quota RAM/CPU cấp OS. Vendored Java/JDK và browser/WASM implementation chưa được pentest đầy đủ.
- Thêm `npm run security:scan`: quét pattern provider key/private key trong text tracked + non-ignored của worktree, giới hạn file 4 MiB, bảo vệ realpath. Chỉ in vị trí/loại, **không in credential hoặc upload source**. Không quét entropy, Git history, binary hay vendored runtime; 0 candidate không có nghĩa chắc chắn không có secret.
- Ruff `--select S` đã chạy trên `backend/app` và `api`: 3 S105 candidate được triage là development-secret marker/so sánh marker và `token_type="bearer"`, không phải credential thật. Đây là [Ruff security rules](https://docs.astral.sh/ruff/rules/#flake8-bandit-s), không gọi là đã chạy Bandit độc lập.
- Bandit/Semgrep/Gitleaks/pip-audit chưa có. Cài Bandit/pip-audit trong venv tạm của project thất bại vì PyPI timeout; **Python dependency advisory audit chưa hoàn tất**, không báo pass. Không sửa dependency Python dựa trên kết quả chưa có.
- Chưa áp CSP global nghiêm ngặt vì Java legacy runtime cần đánh giá riêng `eval`/blob worker. Giữ CSP sandbox sẵn có; thiếu global CSP và `Server: uvicorn` là hardening residual, không tự suy ra exploit.

## Kiểm chứng cuối

- Backend: **94 tests đạt**, gồm REST lifecycle/replay/admin/recovery, WebSocket ASGI handshake thật, idle revocation, private-push denial, auth validation, quota và RAG. Có 1 Starlette/AnyIO deprecation warning.
- Frontend: **23 files / 140 tests đạt** với Vitest 4.1.11. Một lần chạy cùng pytest và browser QA bị timeout 5 giây trong Anatomy; chạy lại toàn suite khi các job đó đã kết thúc đạt, không tăng timeout/bỏ assertion. Error-boundary tests chủ động tạo exception nên có stderr dự kiến.
- `npm run lint`, `npm run typecheck`, `npm run build`: đạt. Ruff trên các file backend sửa: đạt. Build vẫn có cảnh báo lazy chunk Anatomy/CodeLab lớn; không che bằng đổi ngưỡng.
- Full `npm audit`: 0 advisory. Node secret-scanner regression: 3 tests đạt. Pattern scan cuối: 367 text files được quét, 455 files bỏ qua, 0 candidate; số file có thể thay đổi khi thêm tài liệu.
- Trình duyệt localhost: chạy thật Python/C/C++/Java/JavaScript stdin/stdout, public tests và thuật toán; lỗi syntax, escaped XSS text, Stop/timeout, output cap, Java bridge/EOF và local-only socket denial đã được kiểm tra. Lần smoke cuối bỏ isolation probes theo flag, không thay thế kết quả isolation run trước đó.
- SQL SQLite thật: CRUD, persistence/reload, atomic failed batch, JOIN, query plan, reset và bounds. CPU/OS/memory/deadlock/network, 5 mô hình ML, Web Crypto và widths 360–1600 đạt. Auth/profile trong browser là fixture, **không phải login production**.
- HTTP probe localhost trước/sau: ba header đã có; global CSP còn thiếu. `/` của API-only server trả 404, `/docs` và `/openapi.json` mở trong `APP_ENV=test`: không kết luận production mở docs.

Chạy lại các gates frontend từ root; backend dùng temp dir **trong project**, không ghi fixture ra ngoài:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run security:scan
node --test scripts/check-security-secret-scan.mjs
npm audit
# Từ root, tạo thư mục test riêng mới bên trong .cache đã có:
security_test_dir=$(mktemp -d "$PWD/.cache/security-pytest.XXXXXX")
cd backend
.venv/bin/python -m pytest -q --basetemp="$security_test_dir"
```

`--basetemp` là thư mục riêng của lần test và có thể được pytest làm sạch; không chỉ nó vào thư mục dữ liệu/user có sẵn. Browser QA dùng preview localhost và `QA_BASE_URL`; không chạy attack probes lên domain thật.

## Rollout và phạm vi thay đổi

Deploy backend và frontend **cùng đợt**: subprotocol handshake thay đổi. Client cũ dùng query token sẽ không có realtime cho đến reload; REST/authenticated polling vẫn là fallback. Access JWT cũ thiếu `sid` nhận 401; frontend single-flight refresh có thể dùng refresh token còn hợp lệ để nhận JWT mới. Không cần migration/reset DB hay nhập lại Gemini key.

Code sửa trong lượt này: auth security/dependencies/service, admin lock và recovery lock, config/schema/input, realtime/social handshake, backend headers; frontend `workspaceApi` và regression; Vite/Vercel headers; Vitest + lockfile; secret scan scripts và tài liệu. Các thay đổi AI/Anatomy/IT khác có sẵn trong worktree không được gom vào bản hardening này hoặc coi là do lượt này tạo ra. Chưa commit/push/deploy.
