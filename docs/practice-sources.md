# Nguồn câu hỏi Luyện đề

Nexamin tách **khám phá nguồn** khỏi **nhập câu hỏi**. Một URL công khai không đồng nghĩa với quyền sao chép. Công cụ này chỉ chạy thủ công ở backend; lúc sinh viên mở đề, ứng dụng chỉ đọc các câu đã lưu và đã duyệt trong PostgreSQL.

## Quy trình nội bộ

1. `python -m scripts.practice_sources discover-seed` tạo 5 môn khởi đầu và đăng ký 5 trang VOER dưới trạng thái `candidate`. Chạy lại không tạo bản sao.
2. `python -m scripts.practice_sources list` xem trạng thái. Người duyệt kiểm tra URL gốc, giấy phép cụ thể, ngoại lệ, quyền tái sử dụng và robots.txt. VOER công bố mặc định CC BY 3.0 **trừ khi ghi chú ngoại lệ**; không tự phê duyệt chỉ vì thấy trang công khai.
3. Chỉ sau khi có bằng chứng, chạy `python -m scripts.practice_sources approve SOURCE_UUID 'CC BY 3.0' https://voer.edu.vn/`. Dùng `reject SOURCE_UUID 'lý do'` nếu quyền không rõ hoặc nội dung không phù hợp.
4. `python -m scripts.practice_sources import SOURCE_UUID --fetch` hoặc `--file ./document.html` chỉ nhận nguồn đã duyệt. Fetcher chỉ dùng HTTPS công khai, kiểm tra robots.txt, không theo redirect và giới hạn 8 MB. Parser đọc HTML, PDF, DOCX, XLSX, CSV, JSON; chỉ nhận cấu trúc câu hỏi mà nó hiểu, bỏ phần không chắc chắn.
5. Mọi câu vừa nhập ở `pending`; câu không có đáp án không được tự đoán. Xem `python -m scripts.review_practice_questions pending`. Dùng `verify QUESTION_UUID` sau khi kiểm tra đáp án và nguồn; `reject QUESTION_UUID` nếu sai. `publish SUBJECT_UUID 'Tên đề' QUESTION_UUID ...` chỉ chấp nhận câu đã verified. Không gắn nhãn “đề chính thức” nếu nguồn không xác nhận.

`practice_import_runs` ghi hash tài liệu và các số parsed/imported/duplicate/rejected/pending. Import lại cùng gói không tạo thêm câu. `question_sources` giữ tên, URL, loại nguồn, cơ sở, giấy phép, bằng chứng quyền và trạng thái; `practice_questions.source_id` nối câu với nguồn. Môn được chuẩn hóa tên trước khi tạo để không nhân đôi biến thể dấu/ký tự, và được liên kết với học phần UTH cùng tên nếu có.

## Nguồn khám phá ban đầu

Danh sách ứng viên nằm ở `backend/data/practice_source_candidates.json`. Ba trang đầu có câu hỏi tự luận không kèm đáp án; hai nguồn sau là học liệu cần kiểm tra tiếp, chưa xác nhận có ngân hàng câu hỏi:

- [Lý luận nhận thức — VOER](https://voer.edu.vn/m/ly-luan-nhan-thuc/98816473) — Triết học Mác – Lênin.
- [Đối tượng và phương pháp kinh tế chính trị Mác-Lênin — VOER](https://voer.edu.vn/m/doi-tuong-phuong-phap-va-chuc-nang-cua-kinh-te-chinh-tri-mac-lenin/952fc977).
- [Vị trí, đối tượng của chủ nghĩa xã hội khoa học — VOER](https://voer.edu.vn/m/vi-tri-doi-tuong-phuong-phap-va-chuc-nang-cua-chu-nghia-xa-hoi-khoa-hoc/c9a76cb8).
- [Giáo trình Tư tưởng Hồ Chí Minh — VOER](https://voer.edu.vn/public/c/i-tu-tuong-ho-chi-minh-van-de-ve-dan-toc/c8f4f956).
- [Giáo trình Lịch sử Đảng Cộng sản Việt Nam — VOER](https://voer.edu.vn/c/giao-trinh-lich-su-dang-cong-san-viet-nam/f402b395/6c338aac).

[Tuyên bố giấy phép chung của VOER](https://voer.edu.vn/) ghi CC BY 3.0 trừ ngoại lệ. Người duyệt vẫn phải kiểm tra từng trang. Chưa có câu hỏi trắc nghiệm kèm đáp án xác thực trong năm nguồn trên, nên chưa xuất bản đề từ chúng. Với môn chưa có câu đã duyệt, giao diện phải tiếp tục báo ngân hàng đang cập nhật.
