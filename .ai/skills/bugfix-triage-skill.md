# Kỹ Năng Phân Loại Và Sửa Lỗi

## Mục đích
Dùng khi nguyên nhân gốc của lỗi chưa rõ, cần triage trước khi sửa.

## Quy trình triage
1. Tái hiện lỗi bằng bước cụ thể.
2. Ghi nhận kỳ vọng và kết quả thực tế.
3. Khoanh vùng ảnh hưởng (`api`, `ui`, `docs`, hoặc liên module).
4. Tìm điểm nghi vấn bằng truy vết/log/tìm kiếm có mục tiêu.
5. Chốt giả thuyết nguyên nhân gốc.
6. Triển khai bản sửa nhỏ nhất nhưng an toàn.
7. Bổ sung test hồi quy cho lỗi đã sửa (nếu có thể test trong phạm vi).
8. Đảm bảo các hàm mới/chỉnh sửa có comment tiếng Việt kèm `Input:` và `Output:`.
9. Verify lại đúng phạm vi lỗi.

## Mẫu báo cáo
- Nguyên nhân gốc: 1-3 dòng.
- Input/Output tái hiện lỗi: nêu rõ dữ liệu vào và kết quả ra mong đợi/sai lệch.
- File đã đổi: liệt kê cụ thể.
- Test hồi quy đã thêm: liệt kê ngắn gọn.
- Verify: lệnh + kết quả pass/fail.
