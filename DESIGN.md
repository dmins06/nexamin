---
name: StudyHubAI
description: Orbit to Surface — không gian học tập AI hai môi trường, dữ liệu thật và có chiều sâu.
colors:
  dark-background: "#050914"
  light-background: "#dceefa"
  dark-surface: "rgba(10, 19, 37, .88)"
  light-surface: "rgba(250, 254, 255, .86)"
  primary: "#5265e8"
  accent-dark: "#36d8ff"
  accent-light: "#087f9c"
typography:
  display: "Space Grotesk, Manrope, sans-serif"
  body: "Manrope, sans-serif"
---

# Design System: StudyHubAI

## Creative direction

**Orbit to Surface** là một thế giới xuyên suốt hai theme. Dark mode đặt người học tại trạm quan sát Trái Đất trong không gian; light mode hạ xuống bầu khí quyển với trời xanh, mây và địa hình xanh. Cả hai dùng cùng cấu trúc spatial glass, cùng phân cấp và cùng dữ liệu thật.

## Brand

Tên hiển thị luôn là **StudyHubAI**; trợ lý là **Emin AI**. Biểu tượng chữ S cyan–indigo–violet luôn có thể đưa người dùng về Trang chủ. Không dùng branding UTH, emoji hoặc slogan cũ.

## Color and depth

- Dark: nền navy/black, Trái Đất xanh sáng, cyan cho focus/AI và violet cho hành động chính.
- Light: bầu trời xanh, mây trắng, đồng cỏ xanh; text xanh đen và surface trắng bán trong suốt.
- Surface chính dùng blur có kiểm soát, viền 1px và bán kính 18–24px. Field, popover trường/ngành và trạng thái disabled luôn lấy semantic token của theme.
- Không dùng glass thiếu tương phản hoặc khối đặc che kín toàn bộ cảnh nền.

## Typography

Space Grotesk dùng cho heading/số liệu, Manrope dùng cho nội dung và điều khiển. Tiêu đề dashboard gọn; copy UI tiếng Việt ngắn, trực tiếp. Kicker uppercase chỉ là nhãn ngữ cảnh.

## Layout

- Desktop: sidebar cố định 236px và workspace co giãn; không còn right rail riêng.
- Dashboard: 4 stat card; hàng Lịch hôm nay + Emin AI; hàng Tiến độ + Mục tiêu.
- Tablet: sidebar 88px, card chuyển 2 cột rồi 1 cột.
- Mobile ≤760px: một cột, bottom nav 5 mục, điều hướng phụ trong menu; touch target tối thiểu 44px.
- Hỗ trợ 360–1600px, tuyệt đối không cuộn ngang.

## Navigation and account

Desktop giữ Trang chủ, Lịch học, Học phần, Kế hoạch, Ghi chú, AI Assistant, Cộng đồng, Tin nhắn và Cài đặt. Badge chỉ hiển thị từ unread count thực. Đăng xuất nằm trong Cài đặt để thao tác được trên mobile; không đặt nút đăng xuất rời ở sidebar.

## Authentication and pickers

Đăng nhập/đăng ký dùng cùng nền orbit-to-surface và có toggle dark/light trước khi xác thực; lựa chọn được lưu tại `studyhub.theme.v1`. University/Major picker giữ combobox semantics, keyboard flow, logo thật và dữ liệu ngành theo trường. Trigger, kết quả, selected và disabled state dùng token theme. Mật khẩu đăng ký tối thiểu 6 ký tự.

## Data integrity

Không hiển thị chỉ số giả. Số học phần, tín chỉ, GPA, lịch, tiến độ, mục tiêu và notification đều đến từ state/API hiện có. Emin AI quick action chỉ chuyển câu hỏi sang luồng chat thật và ưu tiên tài liệu đã tải lên.

## Motion and accessibility

Background drift/orbit và pointer parallax chỉ chạy nhẹ trên thiết bị phù hợp. Theme chuyển mềm; card hover nâng tối đa vài pixel. `prefers-reduced-motion` tắt animation; mọi control có focus-visible, keyboard access và tương phản WCAG AA.

## Do / Don't

- Do giữ nền Trái Đất/thiên nhiên nhìn thấy rõ và surface nhất quán giữa mọi feature.
- Do dùng token semantic và Lucide icon đồng nhất.
- Do QA dark/light tại desktop và mobile.
- Don't dùng dữ liệu giả, emoji, gradient text, hiệu ứng nặng hoặc hard-code màu tối trong light mode.
- Don't thay đổi API contract hay logic backend chỉ để phục vụ visual.
