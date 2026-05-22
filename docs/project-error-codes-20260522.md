# Mã lỗi dự án

## 1. Mục tiêu tài liệu
- Chuẩn hóa hệ thống mã lỗi cho toàn dự án.

## 2. Quy ước đặt mã lỗi
- Format đề xuất: `<DOMAIN>_<NNN>`
- Ví dụ: `AUTH_001`, `USER_002`, `SYS_001`

## 3. Danh sách mã lỗi
| Mã lỗi | HTTP Status | Thông điệp chuẩn | Ý nghĩa | Hướng xử lý |
|---|---|---|---|---|
| <AUTH_001> | <401> | <Message> | <Mô tả> | <Action> |
| <SYS_001> | <500> | <Message> | <Mô tả> | <Action> |

## 4. Mapping exception -> mã lỗi
| Nguồn lỗi | Điều kiện | Mã lỗi |
|---|---|---|
| Validation | <Điều kiện> | <CODE> |
| Business rule | <Điều kiện> | <CODE> |
| System | <Điều kiện> | <CODE> |

## 5. Quy trình bổ sung mã lỗi mới
1. Kiểm tra trùng mã hiện có.
2. Bổ sung vào bảng mã lỗi.
3. Cập nhật logic mapping trong code.
4. Cập nhật test và tài liệu liên quan.
