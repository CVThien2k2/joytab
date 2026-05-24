# Backend Implementation Rule

## Quy tắc tổ chức hàm dùng chung

- Hàm dùng chung nhưng chỉ dùng trong một folder/module thì khai báo trực tiếp trong file util ở tầng module (ví dụ: `auth/auth.utils.ts`), không tạo thêm thư mục `utils`.
- Hàm dùng chung cho toàn dự án thì khai báo trong `common/utils` (hoặc util cấp dự án tương đương).
- Không tạo file tên riêng chỉ để chứa duy nhất 1 hàm; ưu tiên gom theo nhóm chức năng trong file util hiện có.
