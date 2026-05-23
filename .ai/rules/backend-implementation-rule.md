# Backend Implementation Rule

## Quy tắc API docs

- Chỉ bắt buộc cập nhật API docs trên Swagger/OpenAPI cho các route BE được FE gọi trực tiếp.
- Không dùng tài liệu Markdown trong `docs/*.md` để thay thế cho API docs của các endpoint FE sử dụng.

## Quy tắc tổ chức hàm dùng chung

- Hàm dùng chung nhưng chỉ dùng trong một folder/module thì khai báo trực tiếp trong file util ở tầng module (ví dụ: `auth/auth.utils.ts`), không tạo thêm thư mục `utils`.
- Hàm dùng chung cho toàn dự án thì khai báo trong `common/utils` (hoặc util cấp dự án tương đương).
- Không tạo file tên riêng chỉ để chứa duy nhất 1 hàm; ưu tiên gom theo nhóm chức năng trong file util hiện có.

## Quy tắc unit test theo module

- 1 module chỉ có 1 file `*.spec.ts` để bao phủ unit test cho toàn module đó.
