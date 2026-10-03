# Phase 1 bảo mật — file riêng tư và dependency, 03/10/2026

Tiếp nối [hardening đầu tiên](security-hardening.md). Chủ project đã chọn: tài liệu chỉ chủ sở hữu mở được; file tin nhắn chỉ sender/recipient mở được, **không cấp quyền đọc file riêng tư cho admin**.

## Trạng thái và điều kiện hoàn tất

Code và kiểm tra cục bộ đã đạt. Blob Private và public media store riêng đã được tạo, token đã được kiểm tra đúng access mode. Theo yêu cầu tiếp tục hoàn thiện Phase 1 của chủ project, đang triển khai bảo mật và giữ nguyên bản ghi DB dù 8 file nguồn đã mất trước rollout. **Không thể khôi phục hoặc chứng minh bảo toàn bytes của 8 file này nếu chưa có backup.** Không đổi schema, tài khoản hiện có, Gemini key, branding hoặc CosmicBackdrop. Chưa bắt đầu Phase 2.

GitHub `main` kiểm tra lại qua kết nối GitHub vẫn là `b95e3fcd7649fbfb2e8c883aa2486ac3fcdcd2dd` (Anatomy). Git CLI local chưa có `gh`; không reset worktree, không gom các thay đổi cũ vào commit mới. Trong lượt tiếp tục, Render OAuth đã được kết nối; Vercel CLI đã được chủ project xác thực. Hai CLI và credentials chỉ được lưu trong `.cache` của project, đã Git-ignore. Vercel plugin đọc được team nhưng các truy vấn project/deployment không hoạt động đúng; CLI và REST API đã xác minh đúng project. Chi tiết cloud và hạn chế bảo toàn nguồn ở phần cuối.

Phase 1 chỉ hoàn tất khi: private store được cấu hình, bản backend/frontend được deploy và xác minh cùng đợt, mọi private object cũ được copy/verify và public copy được retire, thử nghiệm synthetic owner/participant/outsider trên môi trường triển khai đạt. Đọc file qua API an toàn không tự vô hiệu hóa một Blob URL public cũ.

## Đã sửa trong repository

- `/media` chỉ còn phục vụ avatar/post image đúng namespace và extension. Chặn mọi đường dẫn tài liệu/tin nhắn cũ, kể cả file local thực sự tồn tại; không redirect chúng sang public Blob.
- `GET /api/v1/documents/{id}/download`: kiểm tra chủ sở hữu bằng quyền DB hiện có; không có quyền hoặc không tồn tại trả 404.
- `GET /api/v1/social/messages/{id}/attachment`: chỉ sender/recipient; không có admin bypass. Lấy storage key từ message đã lưu, kiểm tra namespace uploader và allowlist nguồn Nexamin hiện tại/legacy; **không fetch URL do client cung cấp**, không cho HTML/traversal/key người khác.
- Khi gửi message mới, từ chối attachment không thuộc sender. Không rewrite hoặc xóa message cũ.
- Response file có `Cache-Control: private, no-store`, `Content-Disposition: attachment` với tên UTF-8 được quote, và `nosniff`. Không gửi key storage/token trong redirect.
- Frontend tải bytes theo message ID bằng Authorization header, dùng local Blob URL và revoke khi unmount/chuyển message. File không phải ảnh chỉ tải khi bấm; ảnh có preview. Có abort, lỗi và retry, không dùng public link làm fallback. Giữ nguyên thiết kế; Impeccable chỉ cải thiện tên file dài, focus và vùng bấm tối thiểu 44px bằng semantic tokens.
- Khi `STORAGE_PROVIDER=blob`, documents/message uploads luôn dùng **store Private riêng**, SDK `access="private"`; thiếu token trả 503, không fallback upload public. Avatar/post dùng public adapter riêng. SDK Python 0.11 trả bytes qua `GetBlobResult.content`; clients đóng sau khi đọc xong. Token Private chưa tự chuyển provider `local` đang chạy sang Blob.
- Trong giai đoạn chuyển đổi, authenticated download/worker có thể đọc legacy public copy nếu private object chưa tồn tại. **Không fallback khi private store bị lỗi quyền hoặc mạng.** Strict private read được dùng để verify migration, không thể xác nhận nhầm bằng dữ liệu fallback.
- Thêm `PRIVATE_FILE_WRITES_PAUSED`: tạm chặn upload/delete tài liệu và upload đính kèm trong migration; không xóa file/DB và không chặn đọc hoặc nhắn văn bản.

Private Blob cần store Private riêng; không thể đổi access mode của store Public đang có. Đây là giới hạn nhà cung cấp, không phải lựa chọn triển khai tùy ý. [Vercel Blob](https://vercel.com/docs/vercel-blob), [private storage và cách tạo](https://vercel.com/docs/vercel-blob/private-storage).

## Dependency và scanner

Đã cài scanner vào `.cache/security-tools` của project, không cài global. Bandit scan `backend/app` + `api`: không có scanner error, một B105 candidate ở phép so sánh development JWT marker; đây là guard từ chối marker public trong production, không phải secret thật. Không tắt rule hoặc giấu candidate.

`pip-audit` trên venv backend ban đầu báo 90 records ở 4 packages (có record trùng; **không gọi là 90 lỗi khai thác được của website**): pypdf, PyJWT, pytest, pip. Đã nâng:

| Package | Venv sau sửa | Constraint/build |
| --- | --- | --- |
| pypdf | 6.19.0 | `>=6.19.0,<7` |
| PyJWT | 2.15.1 | `>=2.15.0,<3` |
| pytest | 9.1.1 | `>=9.0.3,<10` |
| pytest-asyncio | 1.4.0 | `>=1,<2`, để tương thích pytest mới |
| pip | 26.2.1 | Hai Dockerfile yêu cầu `>=26.2,<27` khi build |

Đối chiếu [pypdf release/security](https://github.com/py-pdf/pypdf/releases/tag/6.19.0) và [PyJWT advisory](https://github.com/jpadilla/pyjwt/security/advisories/GHSA-42vr-xj54-vc7v). Advisory PyJWT liên quan pre-verification parsing; Nexamin dùng signed decoding, chưa chứng minh khai thác advisory này qua API hiện tại. Có compatibility regression cho extraction PDF thật, page numbering, PDF lỗi và UTF-8; session tests chạy lại trên phiên bản mới.

Audit sau nâng: **106 dependency được kiểm tra, 0 advisory**; distribution Nexamin editable được bỏ qua vì không phải package công khai (source được review/Bandit riêng). `pip check` đạt. Đây là venv local, không phải inventory gói đang chạy trên Render hoặc chứng nhận tất cả phiên bản nằm trong range đều an toàn mãi mãi. Các constraints khác chưa được lock toàn bộ; cần audit build thực tế khi triển khai.

npm audit vẫn 0 advisory; pattern scan worktree không phát hiện candidate. Semgrep/Gitleaks chưa có, không giả báo pass; scanner không bao phủ Git history, entropy, binary/vendored JDK, prompt quality hoặc mọi browser exploit.

## Quy trình chuyển đổi giữ dữ liệu

**Inventory thực tế 03/10 cho thấy Render dùng local và không có public Blob store/token cũ.** Quy trình public-Blob → Private bên dưới chỉ áp dụng nếu nguồn là public Blob; chưa chạy quy trình này trên production. Với nguồn local phải sao lưu và verify những bytes còn đọc được trước khi đổi provider. Inventory hiện tại không có file đọc được; 8 references thiếu bytes được giữ nguyên và ghi nhận như ngoại lệ dữ liệu chưa giải quyết. Không tạo file rỗng để thay thế. Không dùng migration public như cách chứng minh đã chuyển các file local đang trả 404.

1. Tạo **một Blob store Private mới** trong Vercel project Nexamin → Storage → Create Database → Blob → Continue → Private. Không xóa hoặc thay visibility store cũ.
2. Trên Render backend Environment, thêm `PRIVATE_BLOB_READ_WRITE_TOKEN` từ store mới; giữ `BLOB_READ_WRITE_TOKEN` cũ cho public avatars/posts và đọc legacy. Khi chuẩn bị migration đặt `PRIVATE_FILE_WRITES_PAUSED=true`. Không gửi token vào chat hoặc commit `.env`; frontend không cần token nào.
3. Deploy backend và frontend cùng đợt, theo một cửa sổ bảo trì có thông báo. Frontend cũ còn dùng raw URLs sẽ cần reload; realtime cũng cần subprotocol mới của [đợt hardening](security-hardening.md). Kiểm tra health/auth/readiness và không chạy reset DB.
4. Chạy CLI mới với **cả hai token trong môi trường server**, từ thư mục backend. Render Shell nếu gói cho phép; nếu chạy local, đặt token vào `backend/.env` được Git ignore, nhưng public token còn cần được nạp vào process environment theo SDK. Không in/gửi giá trị. Script không cần DB credentials:

```sh
# Inventory trước: chỉ list, không đọc nội dung/copy/delete.
.venv/bin/python -m scripts.migrate_private_blob
# Copy và đọc lại strict Private; giữ toàn bộ public source.
.venv/bin/python -m scripts.migrate_private_blob --apply
# Chỉ sau khi đọc được bản Private và đã review inventory:
.venv/bin/python -m scripts.migrate_private_blob --apply --retire-public
```

Script preflight toàn bộ listing trước mutation; chọn đúng private namespaces, kể cả orphan uploads, không chọn avatars/posts. Có giới hạn số file/kích thước. Không overwrite private target khác nội dung; verify SHA-256 + byte count trước mỗi public delete; lỗi thiếu file/outage/copy hỏng giữ nguyên source của file đó và dừng. Bản Private đã verify là bản có thể phục hồi sau retire; CLI không có transaction cho toàn bucket, nên có thể đã hoàn tất một số file trước khi một file sau lỗi. Script không chứng minh mọi kiểu legacy pathname lạ đã được chuyển: review inventory bắt buộc.

5. Xác minh store cũ không còn các object riêng tư trong inventory và HEAD của các public URL cũ bị từ chối/không tồn tại sau propagation cache. Không tải nội dung người dùng để thử anonymous. Thử bằng **một fixture synthetic mới**: owner/recipient đọc được, outsider/admin/anonymous không đọc được; logout/lock thu hồi phiên thì download bị chặn. Không claim privacy hoàn tất chỉ vì CLI hết lỗi.
6. Chỉ khi các bước trên đạt, đặt `PRIVATE_FILE_WRITES_PAUSED=false`, mở lại upload/delete và ghi commit/deployment ID vào báo cáo. Thực trạng cloud được ghi riêng ở phần rollout cuối tài liệu.

Giới hạn: S3 cần bucket policy riêng tư thực tế; local media/server backup có thể vẫn chứa bytes, nhưng không còn public route cho chúng. Backend dùng key riêng không có nghĩa có thể thu hồi bản file mà một người đã tải/copy trước đó. Avatar/post image privacy là phạm vi khác, chưa thay trong lượt này.

## Kiểm chứng cục bộ

- Frontend: 24 files / **146 tests** đạt; lint, typecheck, build đạt. Warning chunk Anatomy/CodeLab lớn vẫn được giữ.
- Backend: full suite cuối **125 tests** đạt sau dependency upgrade và các regression private-file/migration/PDF, maintenance pause, public avatar/post compatibility và từ chối download khi phiên đã bị thu hồi. Có một deprecation warning từ Starlette/AnyIO; không có test thất bại.
- Ruff các file backend thay đổi và mypy trên 5 source files liên quan đạt; `pip check` đạt. Bandit candidate được triage như trên.
- `scripts/qa-private-attachments.cjs` chỉ cho localhost: real Authorization header, file on-demand, 403 → keyboard retry → Blob URL, AbortSignal ở unit tests; ảnh PNG synthetic decode thật; widths 360/900/1440/1600 × dark/light, không overflow/page error. Bốn captures cuối đã được mở và xem: `.impeccable/review/private-files-{360,1440}-{dark,light}.png`. Theme fixture ban đầu dùng encoding sai đã được sửa và assert actual `data-theme` trước khi chấp nhận captures; không coi lượt fixture sai là xác minh light mode.
- Các tests cục bộ dùng dữ liệu giả/in-memory storage; kiểm tra token thật và deployment được ghi riêng bên dưới. Không bắt đầu Phase 2 khi các điều kiện rollout Phase 1 còn thiếu.

## Kiểm tra cloud trong lượt tiếp tục 03/10/2026

- Render: workspace `tea-dankavv40ujc73c80250`, service `srv-dankek3tqb8s73c7ef1g` (`studyhubai`, Singapore, Free). Bản live là `ebbb8a93964134aea9103ec710c4168d1d2a9639`; ba deploy mới nhất đều `build_failed`. Log build xác nhận Dockerfile chưa copy script `prepare-code-runtimes.mjs`. Đã sửa Dockerfile để có script, runtime lock, notices và curl; chưa build/deploy Docker trên Render. Readiness production trả 200. SSH thử đọc source bị từ chối publickey; chưa inventory được file local orphan. Maintenance mode chỉ có trên web service trả phí theo [Render docs](https://render.com/docs/maintenance-mode); không nâng gói.
- Vercel: team `team_dXzuGSLx5l9jNh5xsnLC5P43` (`dmin3`), project `prj_EU8F5EYsprgnBJv4kRncOhJ3M5Xx` (`nexamin`). Deployment production hiện có `dpl_6fnnfoDEMxncVfsYmUGikiwy3CHV` đã READY; đây là bản trước Phase 1. CLI/REST xác minh đúng project sau khi chủ project đăng nhập CLI. Trước thao tác, team không có Blob stores và project không có env vars. Đã tạo `nexamin-private-files`, ID `store_gzkAR8O3X4vc17mP`, **Private**, region `sin1`, liên kết production. Token mặc định được nhà cung cấp thêm vào Vercel production; không expose dưới tên `VITE_*`.
- Trên Render đã thêm và đọc lại xác minh `PRIVATE_BLOB_READ_WRITE_TOKEN` và `PRIVATE_FILE_WRITES_PAUSED=true`; mọi giá trị env có trước giữ nguyên, gồm Gemini/JWT/database. **`STORAGE_PROVIDER` vẫn là `local`** để chưa đổi nguồn khi bytes cũ chưa được bảo toàn. Pause chỉ có hiệu lực khi code mới được deploy. Không chạy public-Blob inventory với token Private. Render auto-deploy tạm tắt để bảo vệ nguồn trong lúc chuẩn bị và đã khôi phục về `commit` khi dừng chờ quyết định dữ liệu.
- Private store đã thử bằng fixture text synthetic mới qua SDK thật: put/read đúng **54 bytes**, HEAD anonymous **403**, xóa riêng fixture sau kiểm tra. Đây là kiểm chứng storage, chưa phải kiểm chứng quyền owner/participant qua backend deployed.
- Inventory DB chỉ đọc metadata file liên quan, không đổi DB: **1 tài liệu, 4 message attachments, 3 avatars**, tổng 8 keys. GET đúng `/media` trên origin Render của cả 8 đều **404**; không có backup trùng key/filename trong `backend/media`, `migration-data` hoặc `.cache`. Nội dung tin nhắn không được in/log. Không xóa bản ghi hoặc tự thay attachment URL. Manifest nguồn được giữ tại `.cache/phase1/source-inventory.json` (Git-ignore); không khôi phục được bytes chỉ từ DB metadata. Thời điểm các bytes mất trước đó chưa được xác định.
- Đã hỏi chủ project về backup hoặc tiếp tục triển khai giữ nguyên bản ghi DB và công bố thiếu 8 file cũ. **Chưa copy/retire file production, chưa sửa GitHub ref/commit, chưa deploy frontend/backend và chưa mở lại private writes.** Phase 1 còn thiếu migration/rollout và kiểm chứng quyền trên môi trường triển khai; Phase 2 chưa bắt đầu.

## Sửa và kiểm tra trước rollout

- Sửa hai sai lệch với SDK thực tế: `await AsyncBlobClient.iter_objects()` trước khi `async for`; đọc `GetBlobResult.content` dạng bytes cho cả Private và public legacy, không đọc thuộc tính `stream` không tồn tại. Hai lỗi đều được tái hiện bằng tests thất bại trước khi sửa. Tests dùng kiểu kết quả thật của SDK; CLI tests kiểm tra dry-run không mutation, preflight listing trước copy/retire và giữ source khi preflight lỗi.
- Thêm `.cache`, `.vercel`, `migration-data` vào `.dockerignore` để cache credentials/backup không đi vào Docker context. Không commit token hoặc backup.
- Chuẩn bị bản source tách biệt tại `.cache/phase1/release` từ **807 blob files** của remote tree đã đối chiếu Git SHA, chỉ overlay **45 files** của hardening/Phase 1 và sửa Docker build. Không overlay các sửa tài liệu Anatomy/IT khác, không thay alembic/schema. Manifest tại `.cache/phase1/release-paths.json`; đây là staging local, chưa phải remote commit hay deployment.
- Bản staging: lint/typecheck frontend đạt; **146/146 frontend tests** đạt với `--maxWorkers=2`; build đạt, còn warning chunk CodeLab/Anatomy lớn. Lượt chạy mặc định ban đầu có ba timeout do tải song song; không tăng timeout hoặc giảm assertions.
- Bản staging cuối: **125/125 backend tests** đạt; Ruff các source/tests Phase 1 và mypy bốn source/migration files đạt; `pip check` đạt. `pip-audit` không có advisory (editable source Nexamin không thuộc PyPI được bỏ qua), npm audit 0, pattern secret scan 0 candidate. Bandit không có scanner error, vẫn một B105 LOW ở guard development JWT marker như đã triage. Không coi các kiểm tra này là kiểm chứng deployment hoặc bảo đảm bao phủ mọi lỗ hổng.

## Chuẩn bị rollout theo yêu cầu hoàn thiện Phase 1

- Tạo public store `nexamin-public-media` (`store_g1ZA6tiupYC24lYJ`, Public, `sin1`) cho avatar/post mới; tách token khỏi Private store. Nguồn cũ không có public Blob store để retire.
- Kiểm tra lại ngay trước rollout: 5 private references và 3 public references vẫn 404; không có bytes khả dụng để copy. Không xóa/rewrite các references này, không coi inventory rỗng của store mới là chứng cứ đã migrate dữ liệu cũ.
- Chụp hash theo từng bản ghi users/documents/direct_messages/social_posts/courses và revision Alembic để đối chiếu sau rollout; chỉ metadata hash được lưu trong cache riêng, không log nội dung người dùng.
- Render chuyển sang `STORAGE_PROVIDER=blob`, public/private tokens riêng và `PRIVATE_FILE_WRITES_PAUSED=true`; giữ nguyên mọi env khác. Tạm tắt auto-deploy trong cửa sổ rollout để kiểm soát đúng commit.
- Kiểm chứng production dùng tài khoản/file synthetic riêng; sau kiểm tra read authorization mới mở writes và thử upload/download/delete thực tế. Dọn riêng fixtures, không sửa/xóa tài khoản hoặc dữ liệu có trước.

## Kiểm chứng và sửa lỗi rollout đầu tiên

- Commit code đầu tiên `9bdb001906e8e569a7b3091a5cd4085d3077b653`: Render `dep-db09enc9v7es73afqq40` live và Vercel `dpl_2mXS7NCUt1A6vQTPkAXFPRfSyFQR` READY. Docker build trên Render đã qua; Vercel build đã verify runtime assets và compile TypeScript.
- Synthetic registration phát hiện lỗi PostgreSQL `FOR UPDATE cannot be applied to the nullable side of an outer join`. SQLite suite không phát hiện vì không thực hiện row locks. Giới hạn `FOR UPDATE OF users` cho login, issuance/refresh lock, password recovery và admin lock/unlock; giữ thứ tự khóa user trước refresh rows. PostgreSQL `EXPLAIN` read-only đã chấp nhận câu SQL sau sửa. Một registration fixture chưa nhận token đã được dọn đúng ID/email mới, không chạm tài khoản có trước.
- Public avatar/post Blob không tồn tại cần trả 404; thêm chuyển `BlobNotFoundError` sang `FileNotFoundError`, catch ở route và regression test đóng client. Không đổi route allowlist hoặc policy public media.
- Chưa mở writes: phải deploy các sửa này và chạy lại kiểm chứng owner/participant/logout/lock trước.
