# Luyện đề và gợi ý môn tự chọn

## Luyện đề

Kho đề dùng bảng riêng cho môn, chương, chủ đề, câu hỏi, phương án và đề thi. Một câu hỏi có thể thuộc nhiều đề. Backend chụp nội dung câu hỏi lúc bắt đầu bài làm, giữ đáp án đúng kín cho tới khi nộp, chấm điểm tại máy chủ và lưu kết quả lịch sử. Đề ngẫu nhiên chỉ lấy câu đã duyệt. Không có câu hỏi minh họa giả được đưa vào production.

Nhập bộ câu hỏi JSON đã xác nhận quyền sử dụng:

```json
{
  "subject_name": "Tên môn học",
  "subject_code": "MA_MON",
  "source": {
    "name": "Tên nguồn hoặc người cung cấp",
    "url": null,
    "license": "Giấy phép hoặc văn bản cho phép dùng lại",
    "source_type": "user_provided",
    "reuse_confirmed": true
  },
  "questions": [
    {
      "chapter": "Tên chương",
      "topic": "Tên chủ đề",
      "text": "Nội dung câu hỏi đủ rõ ràng?",
      "type": "single_choice",
      "difficulty": "easy",
      "explanation": "Giải thích đáp án dựa trên tài liệu đã được kiểm tra.",
      "options": [
        { "key": "A", "text": "Phương án A", "correct": true },
        { "key": "B", "text": "Phương án B", "correct": false }
      ]
    }
  ]
}
```

Trên backend sau khi chạy migration:

```sh
python -m scripts.import_practice_questions /path/to/questions.json
python -m scripts.review_practice_questions pending
python -m scripts.review_practice_questions verify QUESTION_UUID
python -m scripts.review_practice_questions publish SUBJECT_UUID "Tên đề" QUESTION_UUID
```

Importer kiểm tra cấu trúc, quyền tái sử dụng, đáp án và trùng lặp. Mọi câu nhập vào đều ở trạng thái `pending`; người quản trị cần tự xem nội dung, đáp án, giải thích và giấy phép trước khi `verify`. AI-generated cũng không được tự động duyệt. Không lấy câu hỏi từ trang cần đăng nhập, CAPTCHA, paywall hoặc nguồn không cho phép tái sử dụng.

## Gợi ý môn tự chọn UTH

Nguồn đã được người dùng duyệt: `UTH_CTDT_danh_sach_mon_de_duyet.xlsx`. Bản chuẩn hóa nén lossless nằm ở `backend/data/uth_curricula.json.gz`, kèm SHA-256 của file nguồn và URL PDF theo từng CTĐT. Migration `0011` thêm dữ liệu UTH vào mô hình catalog dùng chung, không sửa dữ liệu tài khoản, môn học hoặc tài liệu hiện có.

Chỉ tài khoản có mã trường `UTH` và ngành/chuyên ngành khớp CTĐT mới được yêu cầu gợi ý. Hệ thống ghép đúng số tín chỉ từng nhóm bằng dữ liệu đã biết, xếp ưu tiên theo bản đồ kỹ năng nghề nghiệp `career_map_v1.py`. Điểm liên quan chỉ là suy luận từ tên môn, không phải đánh giá chính thức. Nhóm thiếu hoặc mâu thuẫn số tín chỉ được đánh dấu chưa giải quyết; học kỳ và tiên quyết trống được cảnh báo, không suy đoán.

Trước khi triển khai vào database đang dùng: sao lưu PostgreSQL, thử migration trên bản sao, sau đó mới chạy trên production. Bản dữ liệu này không thay thế tư vấn học vụ của UTH.
