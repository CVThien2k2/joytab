# Quy ước chung

## 1. Mục tiêu tài liệu
- Tập trung toàn bộ quy ước chung cho dự án.
- Chuẩn hóa cấu trúc dữ liệu trả về từ API.

## 2. Chuẩn đầu ra dữ liệu

### 2.1 Success response (object)
```json
{
  "success": true,
  "message": "ok",
  "data": {}
}
```

### 2.2 Error response
```json
{
  "success": false,
  "code": "string",
  "details": {},
  "retryable": false,
  "message": "string"
}
```

### 2.3 Success response (array/list)
```json
{
  "success": true,
  "message": "ok",
  "data": [],
  "meta": {}
}
```

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
