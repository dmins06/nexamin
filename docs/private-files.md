# Phase 1 bảo mật — file riêng tư và dependency, 03/10/2026

Tiếp nối [hardening đầu tiên](security-hardening.md). Chính sách đã chọn: tài liệu chỉ chủ sở hữu mở được; file tin nhắn chỉ sender/recipient mở được. Admin không có quyền đọc file riêng tư của người khác.

## Kết quả và ngoại lệ dữ liệu

**Đã triển khai và kiểm chứng phần bảo mật Phase 1 trên production; upload/delete đã mở lại.** Backend/frontend dùng bản sửa `b54b0a6c71f298aece5843db53938c6e9a40abfb`. Phase 2 upload/giới hạn tài nguyên được theo dõi riêng trong [báo cáo Phase 2](upload-resource-limits.md).

**Phần bảo toàn bytes cũ còn thiếu nguồn:** inventory trước rollout xác nhận 1 tài liệu, 4 file tin nhắn và 3 avatars trên Render local đều trả 404. Không có backup trùng key/filename trong project. Giữ nguyên cả 8 tham chiếu DB; không tạo file rỗng hoặc rewrite URL. Không thể phục hồi nội dung các file này chỉ từ metadata. Cần backup để hoàn tất phục hồi dữ liệu lịch sử; không báo 8 file này đã được migrate thành công.

SSH Render bị từ chối publickey nên chưa inventory được orphan files trên filesystem cũ. Render Free không có maintenance mode; không nâng gói. Nguồn trước rollout không có public Blob store/token, nên không có public Blob cũ để copy/retire. Các file synthetic chỉ kiểm chứng luồng mới.

## Deployment và storage

| Thành phần | Trạng thái đã kiểm chứng |
| --- | --- |
| GitHub code | [`b54b0a6`](https://github.com/dmins06/nexamin/commit/b54b0a6c71f298aece5843db53938c6e9a40abfb), trên `main`; tiếp nối commit Phase 1 `9bdb001` |
| Render backend | `srv-dankek3tqb8s73c7ef1g`, `studyhubai`, Singapore, Free; [origin](https://studyhubai-bar8.onrender.com) |
| Render build bản sửa | `dep-db09iqvavr4c73ennngg` đã live trước bước mở writes |
| Render kích hoạt writes | `dep-db09lns9v7es73agogu0` live, redeploy existing build bằng `deploy_only`, cùng code `b54b0a6` |
| Vercel frontend | `dpl_ZzWhs41pNi9TDTzhjBqRcgtnK9fV`, READY, cùng code `b54b0a6`; [production](https://nexamin.id.vn) |
| Private Blob | `nexamin-private-files`, `store_gzkAR8O3X4vc17mP`, **Private**, `sin1`, linked production |
| Public media Blob | `nexamin-public-media`, `store_g1ZA6tiupYC24lYJ`, **Public**, `sin1`, avatar/post images |
| Render storage config | `STORAGE_PROVIDER=blob`, `MEDIA_BASE_URL=/media`, `PRIVATE_FILE_WRITES_PAUSED=false` |

Render dùng `PRIVATE_BLOB_READ_WRITE_TOKEN` cho Private và `BLOB_READ_WRITE_TOKEN` cho public media. Hai token đã đối chiếu với store metadata, khác nhau. Vercel project có token Private dưới tên mặc định `BLOB_READ_WRITE_TOKEN`; token public media mang tên `PUBLIC_MEDIA_READ_WRITE_TOKEN`. Vì vậy **không dùng nguyên env export từ Vercel làm public token cho migration CLI**. Frontend không nhận token qua `VITE_*`.

Đã merge và đọc lại Render env để xác minh mọi giá trị khác được giữ nguyên, gồm Gemini/JWT/database/Redis. Không đổi DB schema hoặc credentials. Alembic vẫn `0012`. [Render env API](https://api-docs.render.com/reference/update-env-vars-for-service) yêu cầu deploy riêng để kích hoạt env; đã kiểm chứng upload thực tế sau deploy mở writes.

Vercel plugin đọc được team nhưng truy vấn project/deployment lỗi; dùng CLI/REST sau khi chủ project đăng nhập. Render plugin/CLI đã kết nối. CLI credentials, source inventory và audit artifacts được lưu trong `.cache` của project, Git-ignore; Docker context loại `.cache`, `.vercel`, `migration-data`.

## Thay đổi bảo mật

- `/media` chỉ phục vụ avatar/post image đúng namespace và extension. URL tài liệu/tin nhắn cũ trả GET 404; HEAD bị từ chối 405 vì route không hỗ trợ HEAD. Không redirect private namespace sang public Blob.
- `GET /api/v1/documents/{id}/download` kiểm tra chủ sở hữu theo DB. File không tồn tại hoặc người dùng không có quyền trả 404.
- `GET /api/v1/social/messages/{id}/attachment` chỉ sender/recipient; không có admin bypass. Lấy key từ message đã lưu, kiểm tra namespace uploader và allowlist nguồn Nexamin hiện tại/legacy. Không fetch URL do client cung cấp, không cho HTML/traversal/key người khác. Message mới từ chối attachment không thuộc sender.
- File response có `Cache-Control: private, no-store`, `Content-Disposition: attachment` với filename UTF-8 được quote, và `nosniff`. Không đưa storage token/key vào redirect.
- Frontend tải theo message ID bằng Authorization header, dùng Blob URL và revoke khi unmount/chuyển message. Ảnh có preview; file khác tải khi bấm. Có abort, lỗi và retry, keyboard focus, vùng bấm tối thiểu 44px, xử lý tên dài.
- Documents/message uploads dùng Private store và `access="private"`; thiếu token trả 503, không fallback upload public. Avatar/post dùng public adapter riêng. SDK Python trả bytes qua `GetBlobResult.content`; clients được đóng sau thao tác.
- Trong migration, authorized read/worker có thể đọc legacy public copy nếu Private object chưa tồn tại. Không fallback khi Private bị lỗi quyền/mạng. Verify migration dùng strict Private read.
- `PRIVATE_FILE_WRITES_PAUSED` chặn upload/delete tài liệu và upload attachment bằng 503; giữ authenticated reads và nhắn văn bản. Đã thử pause rồi mở lại trên production.
- Session hardening gắn access JWT với refresh family, kiểm tra thu hồi phía server và dùng WebSocket subprotocol thay query token; chi tiết ở [báo cáo trước](security-hardening.md).

Private Blob yêu cầu store Private riêng và authentication ở provider; xem [Vercel Private Storage](https://vercel.com/docs/vercel-blob/private-storage). API authorization không tự thu hồi public URL cũ hoặc bản sao người khác đã tải trước đó.

## Sửa lỗi phát hiện trong rollout

Ba deploy Render gần nhất trước Phase 1 đều build_failed; bản live cũ là `ebbb8a9`. Root Dockerfile thiếu script build runtime. Đã copy script, runtime lock, notices và cài curl; Docker build trên Render và Vercel build đã đạt, runtime assets được verify bằng hash.

Đối chiếu SDK thật phát hiện hai lỗi, có regression thất bại trước sửa: `iter_objects()` cần await trước async iteration; `get()` dùng `.content`, không có `.stream`. CLI tests xác minh preflight toàn bộ listing trước mutation, dry-run và không copy/retire khi listing lỗi.

Kiểm tra synthetic registration trên PostgreSQL phát hiện `FOR UPDATE cannot be applied to the nullable side of an outer join`, vốn không xuất hiện trong SQLite suite. Đã dùng `FOR UPDATE OF users` cho login, issuance/refresh lock, password recovery và admin lock/unlock; giữ thứ tự khóa user trước refresh rows. PostgreSQL EXPLAIN read-only chấp nhận câu SQL sau sửa; login/register/logout/admin lock thực tế đều đạt.

Public Blob image bị thiếu từng trả 500. Đã chuyển `BlobNotFoundError` sang `FileNotFoundError` và trả route 404, có test kiểm tra đóng client. Ba avatar references cũ trả 404 sau sửa.

## Dependency và kiểm tra cục bộ

Đã nâng pypdf `>=6.19.0,<7`, PyJWT `>=2.15.0,<3`, pytest `>=9.0.3,<10`, pytest-asyncio `>=1,<2`; Docker build nâng pip `>=26.2,<27`. Build Render ghi nhận pypdf 6.19.0, PyJWT 2.15.1, pip 26.2.1 và vercel 0.11.4. Có compatibility tests PDF thật, page numbering, PDF lỗi, UTF-8 và session regression.

- Frontend staging: lint, typecheck, build đạt; **146/146 tests**, 24 files, với `--maxWorkers=2`. Lượt mặc định từng timeout do tải song song; không tăng timeout hay giảm assertions. Cloud Vercel cũng build/compile đạt. Warning chunk Anatomy/CodeLab lớn còn tồn tại.
- Backend sau các sửa rollout: **127/127 tests**; một Starlette/AnyIO deprecation warning. Ruff source/tests Phase 1 và mypy liên quan đạt; `pip check` đạt.
- npm audit: 0 advisory. `pip-audit` venv: 0 advisory, editable Nexamin không thuộc PyPI được bỏ qua.
- Audit **94 package versions lấy từ log install build Render**: 0 advisory. Đây không phải toàn bộ Docker/OS SBOM hoặc inventory runtime qua SSH; package có sẵn trong base image mà không nằm trong log chưa được inventory đầy đủ.
- Bandit: không có scanner error, một B105 LOW ở phép so sánh development JWT marker; triage là guard production, không phải secret thật. Pattern secret scan cuối: 0 candidate. Không claim bao phủ Git history/entropy/binary hoặc mọi exploit; Semgrep/Gitleaks chưa có.
- QA localhost: widths 360/900/1440/1600 × dark/light, real header với fixture, retry bằng keyboard, PNG decode, Blob URL lifecycle; không overflow/page error. Captures đã được xem.

Xem [pypdf release](https://github.com/py-pdf/pypdf/releases/tag/6.19.0) và [PyJWT advisory](https://github.com/jpadilla/pyjwt/security/advisories/GHSA-42vr-xj54-vc7v). Advisory audit phản ánh thời điểm kiểm tra, không bảo đảm mọi phiên bản tương lai trong range luôn an toàn.

## Kiểm chứng production và dọn fixtures

Dùng bốn tài khoản synthetic owner/recipient/outsider/admin, course/friendship riêng, text UTF-8 và PNG 1px. Tạo admin fixture bằng update đúng ID/email mới; không nâng quyền tài khoản có trước. Không gọi Gemini hoặc gửi email.

- Trên cả Render origin và Vercel production: document owner nhận đúng bytes; recipient/outsider/admin 404, anonymous 401. Message sender/recipient nhận đúng bytes; outsider/admin 404, anonymous 401. Response authorized có `private, no-store`; raw media GET/HEAD không trả private bytes.
- Anonymous HEAD trên URLs Private của fixtures bị provider từ chối. Public store inventory không có namespace tài liệu/tin nhắn synthetic.
- Logout làm access token hiện có không đọc được document/message ngay. Admin lock recipient fixture thu hồi session; login tài khoản bị khóa bị từ chối. Unlock rồi login mới đạt.
- Khi pause: upload document/attachment và delete document trả 503, authorized reads vẫn đạt. Sau mở writes: document upload → Private → processing `ready` → download đúng bytes; message upload/send → participant download đạt; outsider/admin vẫn bị từ chối. Delete document trả 204 rồi download 404. Public avatar upload/anonymous image read đạt.
- Browser production 360px/1440px dùng API thật: Authorization header đúng; TXT tải theo yêu cầu bằng keyboard và đúng nội dung; PNG private decode 1px qua Blob URL; không direct-fetch Private provider URL, không overflow, không page error. Hai captures đã được mở xem.
- Đã xóa đúng keys synthetic ở hai stores và đúng ID/email của bốn tài khoản; DB cascade chỉ dọn fixtures. Registration fixture của lượt lỗi ban đầu cũng đã được dọn. SDK listings xác nhận không còn object synthetic. Không xóa object/bản ghi người dùng có trước.
- Sau dọn: 11 users, 1 document, 32 direct_messages, 2 social_posts, 36 courses; schema `0012`. Hash từng document/message/post/course có trước giữ nguyên, mọi user ID và 8 file references giữ nguyên. **Một full-row user hash đổi**: timestamp hiện diện ở thời điểm deploy đầu. Thời điểm và code disconnect WebSocket phù hợp với cập nhật presence; đây là suy luận từ log/timestamps, không claim toàn bộ user rows byte-identical. Các thao tác quản trị/cleanup của lượt này đều giới hạn vào fixture IDs/emails.

Artifacts chi tiết trong `.cache/phase1`: source inventory, DB baseline/final counts, cloud verification, browser verification/captures, build package audit và release manifest. Chỉ báo cáo này được commit; credentials và nội dung file người dùng không được đưa vào repo. Trang đang mở từ trước có thể cần reload để dùng frontend/session/WebSocket mới.

## CLI chuyển public Blob nếu có backup/nguồn legacy sau này

Quy trình này chỉ áp dụng khi có public Blob source thật; chưa dùng nó để giả xác nhận migration của 8 local files đang thiếu.

1. Inventory nguồn/backup, xác minh đúng namespaces và giữ bản phục hồi. Đặt `PRIVATE_FILE_WRITES_PAUSED=true` và deploy để pause có hiệu lực.
2. Chạy trên backend với `BLOB_READ_WRITE_TOKEN` **public source** và `PRIVATE_BLOB_READ_WRITE_TOKEN` **Private target**, giữ secrets trong môi trường được Git-ignore:

```sh
.venv/bin/python -m scripts.migrate_private_blob
.venv/bin/python -m scripts.migrate_private_blob --apply
# Sau khi review inventory và strict Private read/SHA-256/byte count đều đạt:
.venv/bin/python -m scripts.migrate_private_blob --apply --retire-public
```

Script preflight toàn bộ listing; chọn private namespaces kể cả orphan uploads; loại avatars/posts; giới hạn file count/size. Không overwrite Private target khác nội dung. Chỉ xóa public source của mỗi file sau verify strict Private SHA-256/byte count; lỗi giữ source và dừng. Không có transaction toàn bucket, nên có thể một số file đã hoàn tất trước khi file sau lỗi. Pathnames legacy lạ cần review riêng.

3. Xác minh public URLs/inventory không còn private objects sau cache propagation, thử quyền bằng synthetic fixtures, rồi mở writes và deploy. Với backup local, copy nguyên bytes theo key đã lưu, verify hash/size và giữ DB references; chưa có backup nên bước phục hồi này chưa thực hiện.
