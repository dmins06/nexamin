# Dữ liệu mô hình giải phẫu

Nexamin dùng **BodyParts3D 4.0**, không dùng mô hình tạo bằng hình khối để trình bày giải phẫu trong bản phát hành. Nguồn gốc: [trang tải chính thức](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html), [mô tả cơ sở dữ liệu](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/desc.html), [trang giấy phép hiện hành](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html). Tác giả/cơ quan được trang nguồn ghi nhận: Kousaku Okubo và Database Center for Life Science (DBCLS). Tải ngày **2026-09-30** từ hai gói `partof_BP3D_4.0_obj_99.zip` và `isa_BP3D_4.0_obj_99.zip` cùng các bảng tên/quan hệ đi kèm. Dữ liệu gốc không được đưa vào Git; chỉ các GLB đã chọn lọc được phân phối.

## Giấy phép và ghi nhận

Trang giấy phép chính thức hiện ghi **Creative Commons Attribution 4.0 International (CC BY 4.0)**, cho phép sao chép, phân phối và sửa đổi với ghi công. Câu ghi công do nguồn yêu cầu:

> BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.

Các tệp OBJ trong bản lưu trữ 4.0 vẫn chứa dòng giấy phép cũ **CC Attribution-Share Alike 2.1 Japan**. Chúng tôi giữ nguyên thông tin này trong tài liệu để không che mất lịch sử quyền sử dụng. Câu ghi công theo header gốc:

> BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan.

Các GLB là bản chuyển đổi/cắt gọn của dữ liệu trên; hãy giữ ghi công và liên kết tới [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) **cùng** [thông báo CC BY-SA 2.1 JP gốc](https://creativecommons.org/licenses/by-sa/2.1/jp/) khi tái sử dụng, và nêu rõ các thay đổi. Vì thông báo trong OBJ và trang web hiện hành khác nhau, bên tái sử dụng nên kiểm tra lại điều khoản tại nguồn trước khi phối lại/phân phối tiếp. Nexamin đặt ghi công trong mục “Nguồn mô hình 3D và giấy phép” ngay dưới Lab. Không có dữ liệu bệnh nhân, ảnh CT/MRI, texture ngoài, script hay tham chiếu mạng trong các GLB.

## Tệp đã dùng

Mỗi hàng dưới đây là một bản phái sinh từ **cùng nguồn, tác giả và hai thông báo giấy phép ở trên**. Dung lượng GLB lấy từ `scripts/inspect-anatomy-assets.mjs` (MiB, làm tròn); số tam giác tính sau bước giản lược OBJ có sẵn và không đổi khi nén. Mã FMA/FJ được giữ trong `node.extras` của từng mesh, có thể kiểm tra bằng script. Mỗi mesh có tên ID ổn định trùng `anatomyData.ts`; các cấu trúc chọn được không bị gộp khi nén. Cặp trái/phải hoặc nhóm xương là một mục học tập theo danh mục.

| Tệp GLB | Nhóm/cấu trúc chọn lọc | GLB (MiB) | Tam giác xuất |
| --- | --- | ---: | ---: |
| `skeletal.glb` | 14: thêm xương đòn, vai, bánh chè, móng; tách nhóm “Các xương khác” | 5.94 | 403,088 |
| `muscular.glb` | 27: cơ cổ, vai, thân, hoành, mông, đùi, cẳng chân | 9.47 | 651,998 |
| `respiratory.glb` | 5: phổi, khí quản, phế quản chính, sụn mũi, sụn giáp | 1.03 | 75,346 |
| `digestive.glb` | 9: thêm thực quản, tụy, túi mật, lưỡi, tuyến dưới hàm | 3.12 | 202,496 |
| `urinary.glb` | 4: thận, niệu quản, bàng quang, niệu đạo nam | 0.14 | 9,944 |
| `reproductive.glb` | 5: tinh hoàn, mào tinh, ống dẫn tinh, túi tinh, tuyến tiền liệt | 0.07 | 3,962 |
| `endocrine.glb` | 2: tuyến yên, tuyến thượng thận | 0.10 | 7,454 |
| `lymphatic.glb` | 2: lách, tuyến ức | 0.05 | 3,410 |
| `nervous.glb` | 4: não, tủy sống, nhãn cầu, dây thần kinh thị giác | 6.89 | 529,224 |
| `circulatory.glb` | 11: tim, động/tĩnh mạch chủ, phổi, cảnh, quay, đùi, vành | 3.26 | 244,570 |
| `integumentary.glb` | 1: da | 1.47 | 111,858 |
| **Tổng** | **84 cấu trúc tương tác / 11 hệ** | **31.55** | — |

Hai ZIP nguồn nén có kích thước xấp xỉ 62 MiB (`partof`) và 137 MiB (`isa`); không tải chúng về trình duyệt. Các GLB được chia theo hệ và chỉ tải khi hệ đó hiển thị. Mặc định chỉ tải hệ xương (~5.94 MiB, trước đây ~13.00 MiB). Tổng tăng từ 37 lên 84 cấu trúc nhưng giảm từ 37.94 xuống 31.55 MiB (33,078,620 byte). Bản mở rộng trước nén là 56.72 MiB; codec lossless giảm khoảng 44.4% dung lượng bản đó. Đây là số byte tệp, không phải benchmark FPS, độ trễ hay tốc độ tải trên điện thoại. “Toàn bộ cơ thể” vẫn nặng về bộ nhớ/GPU; ưu tiên mở từng hệ trên mạng yếu.

## Chuyển đổi và kiểm tra

`scripts/build-anatomy-assets.mjs` tái tạo các GLB từ hai ZIP và bốn bảng metadata chính thức trong `.cache/anatomy-source/`. Script chọn các FMA cụ thể, đọc các OBJ/FJ tương ứng, đưa tất cả về cùng hệ tọa độ Y-up và tỷ lệ web, giữ tên cấu trúc, FMA/FJ, tô màu giáo dục cho hệ cơ quan, loại những OBJ không cần thiết, và giản lược một số mesh lớn *riêng từng OBJ* bằng Meshoptimizer. Không thêm camera, đèn, animation, texture hoặc liên kết ngoài. Chất liệu PBR thô, dùng hai mặt cho các mặt cắt mở; động mạch hiển thị đỏ, tĩnh mạch xanh bằng logic viewer. GLB không cần decoder/CDN bên ngoài.

Để tái tạo, tải đúng sáu tệp `isa_BP3D_4.0_obj_99.zip`, `partof_BP3D_4.0_obj_99.zip`, `isa_parts_list_e.txt`, `partof_parts_list_e.txt`, `isa_element_parts.txt`, `partof_element_parts.txt` từ [thư mục phát hành chính thức](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/) vào `.cache/anatomy-source/`, giữ nguyên tên tệp, rồi chạy `node scripts/build-anatomy-assets.mjs`. `--inspect` chỉ liệt kê các FMA/FJ đã chọn và không ghi GLB. Bộ chọn xương bàn tay/chân dựa trên tên tiếng Anh trong bảng FMA chính thức; mọi ID nguồn được ghi trong GLB để kiểm chứng.

GLB dùng extension bắt buộc `EXT_meshopt_compression`, giải nén bằng MeshoptDecoder đã đóng gói trong Drei, không gọi CDN. `scripts/anatomy-glb-codec.mjs` so sánh từng byte thuộc đỉnh, normal và index trước/sau giải nén trước khi ghi tệp. Nén này không thay đổi hình học đã xuất; bước giản lược chọn lọc OBJ có sẵn vẫn được ghi riêng, không gọi toàn bộ pipeline là lossless. Bản mở rộng giữ toàn bộ 898 ID nguồn duy nhất từ các GLB trước đó; tách nhóm xương còn lại và thêm mục học tập không đồng nghĩa với atlas đầy đủ mọi cấu trúc.

Chạy `node --test scripts/check-anatomy-glb-codec.mjs` và `node scripts/inspect-anatomy-assets.mjs` để xác nhận header/chunk, mesh names, lineage, số đỉnh/tam giác, từng index/đỉnh sau giải nén, ngân sách giải nén 64 MiB/tệp, chỉ extension được cho phép, không ảnh/animation/camera/buffer ngoài. Chạy tiếp `npm test`, `npm run build` và `node scripts/qa-anatomy-expanded.cjs` với frontend đang chạy (hoặc `QA_BASE_URL=http://127.0.0.1:4173` khi preview). Mô hình BodyParts3D là atlas cơ thể nam trưởng thành tham chiếu, **không phải dữ liệu y khoa cá nhân, không đầy đủ mọi cấu trúc và không dùng cho chẩn đoán**. Cả 11 hệ có cấu trúc chọn lọc, nhưng không có giải phẫu nữ, tuyến giáp hoặc mọi cơ, dây thần kinh, hạch bạch huyết. Sụn giáp là bộ phận thanh quản, không được gắn nhãn tuyến giáp. Cặp trái/phải và một số nhóm xương vẫn được chọn chung.
