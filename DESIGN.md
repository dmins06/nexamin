---
name: StudyHubAI
description: Learning Observatory — không gian học tập AI tối, rõ ràng và có chiều sâu.
colors:
  background: "#070b14"
  surface: "#0d1422"
  raised: "#121c2d"
  text: "#f5f7ff"
  muted: "#9aa7bd"
  primary: "#7c6cff"
  accent: "#36d8ff"
typography:
  display: "Space Grotesk, Manrope, sans-serif"
  body: "Manrope, sans-serif"
---

# Design System: StudyHubAI

## Creative direction

**Learning Observatory** biến dashboard thành một trạm quan sát học tập: sidebar là trục điều hướng, workspace trung tâm dành cho công việc đang làm, right rail là telemetry từ dữ liệu thật. Hình ảnh quỹ đạo và lõi S thể hiện AI đồng hành quanh mục tiêu học tập, không dùng hình trường cụ thể hay dữ liệu giả.

## Brand

Tên hiển thị luôn là **StudyHubAI**. Biểu tượng là chữ S dạng dải không gian với cyan–indigo–violet; favicon chỉ dùng biểu tượng. Không dùng branding UTH, emoji hoặc slogan cũ.

## Color and depth

Nền #070b14, surface #0d1422, raised surface #121c2d. Indigo là hành động chính; cyan báo focus/AI; success, warning và danger chỉ dùng cho trạng thái. Viền trắng xanh ở opacity thấp phân tách bề mặt. Glass chỉ dành cho sidebar, bottom nav và lớp nổi; card dữ liệu mặc định phẳng.

## Typography

Space Grotesk cho display/heading, Manrope cho nội dung và điều khiển. Hero dùng clamp 38–67px, line-height .98; page title 28–46px. Copy UI là tiếng Việt ngắn, trực tiếp. Kicker uppercase chỉ dùng cho hero hoặc nhãn ngữ cảnh.

## Layout

- Desktop ≥1281px: sidebar cố định 236px, workspace co giãn, right rail 286px.
- Tablet 761–1280px: sidebar thu gọn 88px, ẩn right rail.
- Mobile ≤760px: bỏ sidebar, bottom nav 5 mục cố định: Trang chủ, Môn học, EminAI, Thông báo, Hồ sơ.
- Lịch học, Tài liệu, Tiến độ và Cộng đồng vẫn truy cập theo ngữ cảnh/điều hướng phụ.
- Hỗ trợ 360–1600px, tuyệt đối không cuộn ngang.

## Components

### Hero and orbit

Hero chứa đúng kicker LEARN · PLAN · GROW, headline, hai CTA và mô hình quỹ đạo CSS 3D. Orbit là authored visual duy nhất có chuyển động liên tục; tắt ngay với reduced-motion.

### Navigation

Desktop có 6 mục chính: Trang chủ, Môn học, Lịch học, EminAI, Tài liệu, Cộng đồng. Active dùng nền indigo mờ, cyan indicator và luôn có aria-current. Red dot chỉ xuất hiện khi có unread message thực.

### Forms and pickers

Field tối thiểu 44px, focus ring cyan rõ ràng. University/Major picker giữ combobox semantics, keyboard flow, logo thật và dữ liệu ngành theo trường. Mật khẩu đăng ký tối thiểu 6 ký tự.

### Data integrity

Không hiển thị chỉ số hoặc dịch vụ giả. Tiến độ, kế hoạch, buổi sắp tới và unread count đều tính từ state/API thật. Không hiển thị timer/countdown.

## Motion and accessibility

Transition 180–380ms, chỉ animate opacity/transform. Mobile splash kết thúc trong 1.15s và không chặn tương tác sau đó. prefers-reduced-motion tắt animation/transition. Mọi control phải keyboard accessible, có focus-visible cyan và tương phản văn bản tối thiểu WCAG AA.

## Do / Don't

- Do giữ visual hierarchy rõ, surface có chủ đích và copy gắn với hành động.
- Do dùng token semantic và icon Lucide nét đồng nhất.
- Do QA desktop/mobile ở 1440, 1024, 390 và 360px.
- Don't dùng timer, dữ liệu giả, emoji, gradient text, UTH imagery hoặc card-grid trang trí.
- Don't thay đổi API contract, auth, local-storage schema hay logic dữ liệu chỉ để phục vụ visual.
