# Global Workflow Rule

## Quy tắc bắt buộc trước khi bắt đầu flow

1. Nhận yêu cầu và lập kế hoạch chi tiết ngay.
2. Chờ người yêu cầu xác nhận kế hoạch trước khi triển khai.
3. Chỉ thực hiện đúng phạm vi đã được yêu cầu và xác nhận.

## Quy tắc triển khai chung

- Không chỉnh sửa file, luồng, hoặc module không liên quan.
- Khi viết code, thêm comment ngắn bằng tiếng Việt mô tả mục đích của từng hàm.
- Comment của hàm phải luôn có 2 dòng rõ ràng: `Input:` và `Output:`.
- Khi triển khai tính năng mới, không tạo file docs mới; nếu cần tài liệu thì cập nhật vào file docs hiện có.
- Khi thêm/bớt/sửa file hoặc thêm/bớt/sửa hàm, phải cập nhật docs liên quan để đồng bộ với trạng thái thực tế của hệ dự án.

## Quy tắc build và xác nhận hoàn tất

- Chỉ build các phần có thay đổi mã nguồn.
- Không chạy build toàn repo nếu không có yêu cầu rõ ràng.
- Chỉ báo hoàn tất khi phạm vi build bắt buộc đã chạy qua.
- Nếu verify thất bại, báo trạng thái chưa hoàn tất và liệt kê lỗi còn lại.

## Quy trình bàn giao

1. Nhận yêu cầu -> viết kế hoạch chi tiết.
2. Chờ xác nhận.
3. Triển khai đúng phạm vi.
4. Cập nhật docs nếu thực sự cần theo quy tắc tài liệu.
5. Build đúng phạm vi thay đổi.
6. Báo cáo trạng thái hoàn tất dựa trên kết quả verify thực tế; phần kết quả trả về chỉ cần mô tả luồng thành công nếu không có yêu cầu khác.
