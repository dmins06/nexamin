# Điều hướng URL của Nexamin

Nexamin dùng React Router (Declarative `BrowserRouter`). `src/routing/paths.ts` là bản đồ URL/tiêu đề, `src/routing/AppRoutes.tsx` khai báo route, còn `src/App.tsx` giữ shell và dữ liệu dùng chung. URL là nguồn duy nhất cho trang hiện tại và trạng thái active của sidebar/mobile navigation; không còn `ViewId` hay `setView`.

| URL | Trang |
| --- | --- |
| `/` | Chuyển sang `/dashboard` sau khi xác thực |
| `/dashboard` | Trang chủ |
| `/courses` | Học phần |
| `/schedule` | Lịch học |
| `/planner` | Kế hoạch/tiến độ |
| `/exams` | Luyện đề |
| `/labs` | Phòng Lab |
| `/labs/anatomy` | Giải phẫu người 3D |
| `/electives` | Môn tự chọn |
| `/notes` | Ghi chú |
| `/assistant` | Emin AI |
| `/community`, `/messages` | Cộng đồng, tin nhắn |
| `/profile`, `/settings` | Hồ sơ, cài đặt |
| `/admin` | Quản trị viên đã xác thực |

Các URL khác hiển thị trang 404 trong shell hiện tại. Phòng Lab chỉ đưa vào router những mô phỏng đã phát hành; thêm một lab sau này bằng cách đăng ký module và route con trong `/labs`. Không có đường dẫn `/anatomy` độc lập.

`AuthGate` vẫn bao ngoài App. Khi chưa đăng nhập, truy cập thẳng một URL được bảo vệ hiển thị form đăng nhập **tại chính URL đó**; đăng nhập xong App mở lại trang yêu cầu. Luồng đặt lại mật khẩu qua `reset_token` vẫn giữ nguyên. Hiện sản phẩm chưa có OTP hay các trang `/login`, `/register` riêng, nên migration không tạo quy trình xác thực giả.

`vercel.json` của frontend đã có rewrite cuối `/(.*) → /index.html` sau `/api` và `/media`; vì vậy Vercel phục vụ SPA entry point khi tải trực tiếp hoặc F5 ở `/labs/anatomy` và các route khác. Vite dev/preview cũng có SPA fallback. Mô hình 3D không được tải ở Dashboard hay Lab Hub; Anatomy vẫn tách bundle và tải GLB khi mở route con.

Kiểm tra: `npm test`, `npm run build`, `node scripts/qa-routing.cjs` với `QA_BASE_URL` trỏ tới preview hoặc tên miền triển khai. QA browser thử mở trực tiếp, F5, Back/Forward, mobile, 404 và protected deep link mà không cần tài khoản thật.
