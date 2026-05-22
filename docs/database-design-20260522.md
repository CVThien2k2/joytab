# Thiết kế database

## 1. Mục tiêu tài liệu
- Mô tả mô hình dữ liệu, thực thể chính, quan hệ, và ràng buộc.

## 2. Công nghệ và chiến lược lưu trữ
- DB engine: <Ví dụ: PostgreSQL/MySQL>
- Chiến lược migration: <Tool + quy trình>
- Chiến lược backup/restore: <Mô tả>

## 3. Danh sách bảng/thực thể chính
| Bảng/Entity | Mục đích | Khóa chính | Quan hệ chính |
|---|---|---|---|
| <table_a> | <Mô tả> | <PK> | <Quan hệ> |
| <table_b> | <Mô tả> | <PK> | <Quan hệ> |

## 4. Mô tả chi tiết từng bảng
### 4.1 `<table_name>`
| Cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa |
|---|---|---|---|
| <column_a> | <type> | <constraint> | <Mô tả> |

## 5. Chỉ mục và tối ưu truy vấn
- Index bắt buộc: <Danh sách>
- Truy vấn trọng điểm: <Danh sách>

## 6. Quy ước dữ liệu
- Quy ước đặt tên bảng/cột.
- Quy ước audit fields:
  - `created_at`: thời điểm tạo bản ghi.
  - `updated_at`: thời điểm cập nhật gần nhất.
- Quy ước soft delete:
  - `is_deleted`: cờ xóa mềm (`false`: bản ghi còn hiệu lực, `true`: bản ghi đã xóa mềm).
  - `deleted_by`: lưu người thao tác xóa.
  - `deleted_at`: lưu thời điểm xóa.
  - Truy vấn nghiệp vụ mặc định lọc `is_deleted = false`.

## 7. Rủi ro và điểm cần theo dõi
- <Danh sách rủi ro dữ liệu/hiệu năng>
