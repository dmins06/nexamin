# Dữ liệu mô hình giải phẫu

Nexamin dùng **BodyParts3D 4.0**, không dùng mô hình tạo bằng hình khối để trình bày giải phẫu trong bản phát hành. Nguồn gốc: [trang tải chính thức](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html), [mô tả cơ sở dữ liệu](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/desc.html), [trang giấy phép hiện hành](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html). Tác giả/cơ quan được trang nguồn ghi nhận: Kousaku Okubo và Database Center for Life Science (DBCLS). Tải ngày **2026-09-30** từ hai gói `partof_BP3D_4.0_obj_99.zip` và `isa_BP3D_4.0_obj_99.zip` cùng các bảng tên/quan hệ đi kèm. Dữ liệu gốc không được đưa vào Git; chỉ các GLB đã chọn lọc được phân phối.

## Giấy phép và ghi nhận

Trang giấy phép chính thức hiện ghi **Creative Commons Attribution 4.0 International (CC BY 4.0)**, cho phép sao chép, phân phối và sửa đổi với ghi công. Câu ghi công do nguồn yêu cầu:

> BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.

Các tệp OBJ trong bản lưu trữ 4.0 vẫn chứa dòng giấy phép cũ **CC Attribution-Share Alike 2.1 Japan**. Chúng tôi giữ nguyên thông tin này trong tài liệu để không che mất lịch sử quyền sử dụng. Câu ghi công theo header gốc:

> BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan.

Các GLB là bản chuyển đổi/cắt gọn của dữ liệu trên; hãy giữ ghi công và liên kết tới [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) **cùng** [thông báo CC BY-SA 2.1 JP gốc](https://creativecommons.org/licenses/by-sa/2.1/jp/) khi tái sử dụng, và nêu rõ các thay đổi. Vì thông báo trong OBJ và trang web hiện hành khác nhau, bên tái sử dụng nên kiểm tra lại điều khoản tại nguồn trước khi phối lại/phân phối tiếp. Nexamin đặt ghi công trong mục “Nguồn mô hình 3D và giấy phép” ngay dưới Lab. Không có dữ liệu bệnh nhân, ảnh CT/MRI, texture ngoài, script hay tham chiếu mạng trong các GLB.

## Tệp đã dùng

Mỗi hàng dưới đây là một bản phái sinh từ **cùng nguồn, tác giả và hai thông báo giấy phép ở trên**. “OBJ chọn lọc” là tổng kích thước văn bản OBJ *không nén* thực sự đưa vào nhóm; không phải dung lượng toàn bộ ZIP tải về. Dung lượng GLB lấy từ `scripts/inspect-anatomy-assets.mjs` (MiB, làm tròn). Bảng tên thật và mã FMA/FJ được giữ trong `node.extras` của từng mesh, có thể kiểm tra bằng script. Mỗi mesh có tên ID ổn định trùng `anatomyData.ts`; không gộp các cấu trúc với nhau.

| Tệp GLB | Nhóm/cấu trúc chọn lọc | OBJ chọn lọc | GLB | Tam giác trước → sau |
| --- | --- | ---: | ---: | ---: |
| `circulatory.glb` | Tim, động/tĩnh mạch chủ, phổi, cảnh, quay, đùi, vành | 15.13 | 6.02 | 244,570 → 244,570 |
| `skeletal.glb` | Hộp sọ, cột sống, lồng ngực, chậu, xương tay/chân và bàn tay/chân | 52.01 | 13.00 | 793,334 → 500,338 |
| `muscular.glb` | Cơ nhị đầu, delta, ngực lớn, tứ đầu đùi | 5.16 | 2.02 | 72,224 → 72,224 |
| `respiratory.glb` | Hai phổi | 3.56 | 1.45 | 57,042 → 57,042 |
| `digestive.glb` | Gan, dạ dày, ruột non, ruột già | 18.24 | 4.92 | 268,486 → 181,580 |
| `nervous.glb` | Não, tủy sống | 20.70 | 7.80 | 322,990 → 322,990 |
| `urinary.glb` | Hai thận, bàng quang | 0.32 | 0.13 | 5,518 → 5,518 |
| `lymphatic.glb` | Lách | 0.08 | 0.03 | 1,330 → 1,330 |
| `integumentary.glb` | Da | 13.80 | 2.58 | 203,382 → 111,858 |
| **Tổng** | **37 cấu trúc tương tác** | **128.98** | **37.94** | — |

Hai ZIP nguồn nén có kích thước xấp xỉ 62 MiB (`partof`) và 137 MiB (`isa`); không tải chúng về trình duyệt. Các GLB được chia theo hệ và chỉ tải khi hệ đó hiển thị. Mặc định chỉ tải hệ xương (~13.00 MiB); toàn bộ 37.94 MiB không tải trước khi người dùng mở Phòng Lab/Anatomy. Mô hình vẫn tương đối nặng trên mạng di động; không nên bật “Toàn bộ cơ thể” khi đường truyền yếu.

## Chuyển đổi và kiểm tra

`scripts/build-anatomy-assets.mjs` tái tạo các GLB từ hai ZIP và bốn bảng metadata chính thức trong `.cache/anatomy-source/`. Script chọn các FMA cụ thể, đọc các OBJ/FJ tương ứng, đưa tất cả về cùng hệ tọa độ Y-up và tỷ lệ web, giữ tên cấu trúc, FMA/FJ, tô màu giáo dục cho hệ cơ quan, loại những OBJ không cần thiết, và giản lược một số mesh lớn *riêng từng OBJ* bằng Meshoptimizer. Không thêm camera, đèn, animation, texture hoặc liên kết ngoài. Chất liệu PBR thô, dùng hai mặt cho các mặt cắt mở; động mạch hiển thị đỏ, tĩnh mạch xanh bằng logic viewer. GLB không cần decoder/CDN bên ngoài.

Để tái tạo, tải đúng sáu tệp `isa_BP3D_4.0_obj_99.zip`, `partof_BP3D_4.0_obj_99.zip`, `isa_parts_list_e.txt`, `partof_parts_list_e.txt`, `isa_element_parts.txt`, `partof_element_parts.txt` từ [thư mục phát hành chính thức](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/) vào `.cache/anatomy-source/`, giữ nguyên tên tệp, rồi chạy `node scripts/build-anatomy-assets.mjs`. `--inspect` chỉ liệt kê các FMA/FJ đã chọn và không ghi GLB. Bộ chọn xương bàn tay/chân dựa trên tên tiếng Anh trong bảng FMA chính thức; mọi ID nguồn được ghi trong GLB để kiểm chứng.

Chạy `node scripts/inspect-anatomy-assets.mjs` để xác nhận header/chunk GLB, mesh names, lineage, số đỉnh/tam giác, index hợp lệ, giới hạn hữu hạn, không có ảnh/animation/camera/extension bắt buộc và không có buffer ngoài. Chạy tiếp `npm test`, `npm run build` và browser QA thực tế. Mô hình BodyParts3D là atlas cơ thể nam trưởng thành tham chiếu, **không phải dữ liệu y khoa cá nhân, không đầy đủ mọi cấu trúc và không dùng cho chẩn đoán**. Hệ sinh dục và nội tiết chưa có mô hình được tích hợp, được đánh dấu “Đang bổ sung”; hệ khác cũng chỉ có các cấu trúc liệt kê ở trên.
