# Quy ước chung

## 1. Mục tiêu tài liệu
- Tập trung toàn bộ quy ước chung cho dự án.
- Chuẩn hóa cấu trúc dữ liệu trả về từ API.

## 2. Chuẩn đầu ra dữ liệu

### 2.1 Success response (object)
```json
{
  "success": true,
  "message": "ok | custom message",
  "data": {}
}
```

### 2.2 Error response
```json
{
  "success": false,
  "code": "AUTH_001 | AUTH_002 | VALIDATION_001 | SYS_404 | SYS_001 | SYS_002 | SYS_003 | SYS_004 | SYS_005 | SYS_006 | SYS_007 | SYS_008 | UNKNOWN_001",
  "details": {},
  "message": "string"
}
```

### 2.3 Success response (array/list)
```json
{
  "success": true,
  "message": "ok | custom message",
  "data": [],
  "meta": {}
}
```

### 2.4 Quy ước áp dụng trong NestJS
- Dùng `ResponseInterceptor` global để tự wrap success response nếu handler chưa trả format chuẩn.
- Dùng `HttpExceptionFilter` global để map lỗi về format chuẩn và gán mã lỗi thống nhất.
- Dùng `AppException` cho business rule cần chỉ định rõ `error code object` và `HTTP status`.

## 3. Quy ước chung cho database

### 3.1 Trường chuẩn bắt buộc cho bảng nghiệp vụ
- `created_at`: thời điểm tạo bản ghi.
- `updated_at`: thời điểm cập nhật gần nhất.
- `is_deleted`: cờ xóa mềm (`false`: chưa xóa, `true`: đã xóa).
- `deleted_by`: định danh người thao tác xóa.
- `deleted_at`: thời điểm thực hiện xóa mềm.

### 3.2 Quy ước xóa dữ liệu (soft delete)
- Không xóa vật lý bản ghi trong luồng nghiệp vụ thông thường.
- Khi xóa:
  - set `is_deleted = true`
  - set `deleted_by = <id người thao tác>`
  - set `deleted_at = <thời điểm xóa>`
  - cập nhật lại `updated_at`

### 3.3 Quy ước truy vấn dữ liệu
- Mặc định các truy vấn nghiệp vụ chỉ lấy bản ghi `is_deleted = false`.
- Chỉ các luồng quản trị/khôi phục mới truy cập bản ghi đã xóa mềm.
