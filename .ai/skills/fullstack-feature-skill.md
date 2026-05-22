# Kỹ Năng Triển Khai Tính Năng Fullstack

## Mục đích
Dùng khi một yêu cầu chạm đồng thời `api` và `ui`.

## Đầu vào
- Mục tiêu tính năng.
- Tiêu chí nghiệm thu.
- Route/service backend và page/component frontend bị ảnh hưởng.

## Luồng thực hiện đề xuất
1. Rà nhanh pattern đang dùng trong `api/src` và `ui/src`.
2. Chốt contract backend trước (DTO, validation, response shape).
3. Triển khai backend theo contract.
4. Tích hợp frontend theo contract đã chốt.
5. Xác định test case chính cho tính năng mới (happy path, lỗi chính, edge quan trọng).
6. Bổ sung/điều chỉnh test cần thiết trong phạm vi thay đổi.
7. Đảm bảo các hàm mới/chỉnh sửa có comment tiếng Việt kèm `Input:` và `Output:`.
8. Rà và cập nhật docs liên quan nếu có thay đổi file/hàm để đồng bộ với trạng thái dự án.
9. Chạy verify đúng module bị tác động.
10. Báo cáo thay đổi tách theo nhóm `api` và `ui`.

## Kết quả đầu ra
- Danh sách file đã sửa.
- Danh sách docs đã cập nhật để đồng bộ thay đổi file/hàm.
- Danh sách lệnh verify đã chạy và trạng thái.
- Tóm tắt `Input/Output` của API hoặc hàm chính vừa thay đổi.
- Danh sách test mới cho tính năng (kèm phạm vi bao phủ chính).
- Ghi chú rủi ro còn lại (nếu có).
