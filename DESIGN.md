---
name: StudyHubAI
description: Không gian học tập số mang tinh thần sổ tay thực vật điềm tĩnh.
colors:
  paper: "#f2efe5"
  paper-raised: "#faf8f1"
  paper-deep: "#e7e2d4"
  ink: "#15251e"
  ink-muted: "#5d675f"
  forest: "#234c36"
  forest-deep: "#173727"
  sage: "#8ea38c"
  sage-pale: "#d9e0d2"
  amber: "#b98431"
  amber-pale: "#eadfc5"
  clay: "#985d45"
typography:
  display:
    fontFamily: "Lora, Georgia, serif"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "12px"
    fontWeight: 700
rounded:
  control: "10px"
  surface: "14px"
  pill: "99px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.paper-raised}"
    rounded: "{rounded.control}"
    height: "50px"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "48px"
  selected-record:
    backgroundColor: "{colors.sage-pale}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "58px"
---

# Design System: StudyHubAI

## Overview

**Creative North Star: "Sổ tay thực vật"**

StudyHubAI là một không gian học tập tĩnh, ấm và có trật tự, lấy chất liệu từ giấy ngà, mực xanh rừng, nhãn mẫu thực vật và những đường kẻ mảnh. Giao diện phải cho cảm giác như một cuốn sổ được biên tập cẩn thận: đủ cá tính để đáng nhớ nhưng không lấn át công việc học.

Luồng xác thực dùng bố cục editorial: câu chuyện thương hiệu trên nền rừng sâu ở một phía, biểu mẫu sáng và tập trung ở phía còn lại. Dữ liệu trường và ngành được trình bày như một danh mục tra cứu, không phải trường văn bản tự do.

**Key Characteristics:**

- Nền giấy ấm, xanh rừng làm trục và hổ phách chỉ làm điểm nhấn.
- Tiêu đề serif có chất biên tập; nội dung sans-serif rõ ràng, gọn và dễ quét.
- Viền mảnh, bóng đổ khuếch tán và chuyển động tiết chế.
- Icon nét mảnh nhất quán; không dùng emoji làm icon giao diện.

## Colors

Bảng màu mô phỏng giấy, mực và mẫu thực vật khô, với độ tương phản đủ rõ cho các luồng thao tác.

### Primary

- **Forest Ink:** hành động chính, trạng thái đã chọn, icon và viền focus trong biểu mẫu.
- **Deep Forest:** mảng nền kể chuyện của auth và hover của hành động chính.

### Secondary

- **Pressed Sage:** nền cho mục active, kết quả combobox đang nhắm tới và bản ghi trường/ngành đã chọn.
- **Library Amber:** tín hiệu phụ, chi tiết thương hiệu và vòng focus toàn cục.

### Neutral

- **Warm Paper:** nền chính của ứng dụng.
- **Raised Paper:** bề mặt thẻ và panel biểu mẫu.
- **Botanical Ink:** nội dung chính; mực xám xanh dùng cho mô tả, mã và trạng thái phụ.

**The Quiet Accent Rule.** Màu hổ phách và đất nung không cạnh tranh với xanh rừng trong cùng một hành động chính.

## Typography

**Display Font:** Lora, với Georgia là fallback.
**Body Font:** DM Sans, với sans-serif hệ thống là fallback.

**Character:** Lora mang nhịp của tiêu đề sách và ghi chú học thuật; DM Sans giữ nhãn, trường nhập và danh sách dữ liệu sáng, gọn.

### Hierarchy

- **Display** (500, `clamp(48px, 5vw, 82px)`, line-height `.98`): thông điệp lớn trên mảng kể chuyện auth.
- **Headline** (500, `clamp(31px, 3.2vw, 43px)`, line-height `1.08`): tiêu đề biểu mẫu auth.
- **Body** (400, `15px`, line-height `1.5`): nội dung ứng dụng; phần mô tả auth giảm xuống `13px`.
- **Label** (700, `12px`): nhãn trường nhập; folio và tóm tắt kết quả dùng cỡ nhỏ hơn, uppercase và tracking rộng.

**The Editorial Split Rule.** Serif dành cho tiêu đề và trích dẫn; sans-serif dành cho dữ liệu, điều khiển và nội dung cần quét nhanh.

## Layout

Auth dùng hai cột từ `921px`: cột câu chuyện rộng tối thiểu `360px`, cột biểu mẫu rộng tối thiểu `560px`; thẻ auth giới hạn `550px`. Từ `920px` trở xuống, hai cột xếp dọc và lược bớt copy phụ. Từ `520px` trở xuống, cặp Ngành học/Năm học thành một cột, tab auth giãn hết bề ngang và padding co lại.

Toàn bộ sản phẩm phải hoạt động trong dải `360–1600px` mà không cuộn ngang. Kết quả combobox là lớp nổi nằm trong bề ngang trường nhập, cao tối đa `300px` và cuộn dọc nội bộ.

## Elevation & Depth

Hệ thống phẳng theo mặc định: viền xanh trong suốt và chênh lệch tông giấy tạo phân tầng. Bóng đổ chỉ xuất hiện ở bề mặt cần nổi lên: danh sách combobox, nút chính và card nội dung.

- **Surface shadow** (`0 18px 50px rgba(37, 47, 39, .09)`): card lớn.
- **Picker shadow** (`0 18px 42px rgba(21, 37, 30, .16)`): danh sách trường/ngành đang mở.
- **Focus halo** (`0 0 0 3px rgba(35, 76, 54, .1)`): nhóm input đang có focus.

**The Flat-by-Default Rule.** Không thêm bóng cho từng hàng dữ liệu; trạng thái được phân biệt bằng nền sage và viền.

## Shapes

Góc bo mềm nhưng không phồng: field và nút auth dùng bán kính `10px`, card lớn dùng `14px`. Khi combobox mở, hai góc dưới của input và hai góc trên của danh sách ghép thành một khối liên tục. Hình tròn và dáng lá chỉ dùng làm dấu hiệu thực vật, không biến mọi container thành pill.

## Components

### Auth shell

- **Desktop:** mảng xanh rừng sticky cao toàn viewport bên trái; form nền giấy nâng ở bên phải.
- **Mobile:** xếp dọc; giữ brand, tiêu đề và thông tin 426 cơ sở, ẩn copy/trích dẫn phụ để giảm chiều cao.

### Buttons and tabs

- Nút chính cao `50px`, nền forest, chữ trắng, hover chuyển sang deep forest.
- Tab có vùng chạm tối thiểu `44px`; tab đang chọn dùng nền forest và chữ paper.
- Mọi button/link có `:focus-visible` hổ phách dày `3px`, offset `3px`.

### Inputs / Fields

- Field cao tối thiểu `48px`, nền trắng, viền mảnh, icon nét ở đầu trường.
- Focus đổi viền sang forest và hiện halo; lỗi dùng copy tiếng Việt cấp hành động và `role="alert"`.
- Nút hiện/ẩn mật khẩu duy trì vùng chạm `44×44px` và có accessible name thay đổi theo trạng thái.

### University picker

- Combobox tìm theo tên, tên rút gọn hoặc mã tuyển sinh; tìm kiếm không phụ thuộc dấu tiếng Việt và debounce `260ms` khi có truy vấn.
- Danh mục gồm 426 trường; mỗi kết quả hiển thị tên, mã và ảnh nhận diện. 426 tệp ảnh cục bộ là nguồn ưu tiên; ảnh từ dữ liệu là fallback, sau đó mới dùng con dấu mã trường. Không thay bằng logo không liên quan.
- Ảnh dùng `object-fit: contain` trong khung `38×38px` trung tính để không cắt logo.

### Major picker

- Bị khóa cho tới khi người dùng chọn trường; đổi trường sẽ xóa ngành đã chọn.
- Nguồn cục bộ gồm 6.783 chương trình, phân theo đúng 426 trường. Combobox chỉ hiển thị ngành của trường đã chọn, tìm theo mã hoặc tên không phụ thuộc dấu và giới hạn 50 kết quả hiển thị.
- Bản ghi đã chọn dùng nền sage pale, hiển thị cả tên và mã ngành. Nếu trường chưa có dữ liệu ngành, hiển thị giải thích và vẫn cho phép tạo tài khoản.

### Combobox accessibility

- Dùng ngữ nghĩa `combobox`, `listbox`, `option` cùng `aria-expanded`, `aria-controls`, `aria-activedescendant` và `aria-selected`.
- Hỗ trợ Arrow Up/Down để di chuyển, Enter để chọn, Escape để đóng; hover và keyboard active dùng cùng một tín hiệu màu.
- Tóm tắt số kết quả dùng `aria-live="polite"`; loading và error có nhãn hỗ trợ phù hợp.

## Do's and Don'ts

### Do:

- **Do** giữ copy tiếng Việt ngắn, trực tiếp và giải thích cách khắc phục khi có lỗi.
- **Do** lấy danh sách ngành theo trường đã chọn; không yêu cầu sinh viên tự gõ ngành nếu dữ liệu có sẵn.
- **Do** giữ đủ keyboard flow, focus hiển thị, vùng chạm tối thiểu `44px` và reduced-motion.
- **Do** kiểm tra giao diện từ `360px` đến `1600px` mà không cuộn ngang.

### Don't:

- **Don't** thay picker trường hoặc ngành bằng input văn bản tự do.
- **Don't** cắt, kéo giãn logo hoặc dùng logo của đơn vị khác làm fallback.
- **Don't** dùng emoji làm icon, gradient trang trí rực hoặc animation liên tục làm mất nhịp tĩnh của sổ tay.
- **Don't** dùng bóng đổ nặng cho mọi hàng dữ liệu hoặc biến mọi container thành pill.
