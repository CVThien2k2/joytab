# Quy Tắc Biên Soạn Tài Liệu

## Khi nào cần cập nhật docs
- Chỉ cập nhật hoặc thêm markdown khi thay đổi liên quan business flow hoặc phần code cần tài liệu hóa.
- Tự đánh giá tính cần thiết trước khi viết tài liệu mới.
- Khi có thay đổi file hoặc hàm trong codebase, bắt buộc rà và cập nhật docs liên quan để đồng bộ với trạng thái thực tế.

## Nguyên tắc nội dung
- Tài liệu dự án phải viết bằng tiếng Việt.
- Tránh trùng lặp: luôn rà nội dung hiện có trước khi thêm mới.
- Nếu phần tương đương đã tồn tại, ưu tiên cập nhật file cũ thay vì tạo file mới.

## Quy tắc tạo file docs mới
- Chỉ tạo file mới khi việc nhét vào file cũ làm giảm độ rõ ràng.
- Tên file mới theo mẫu: `slug-YYYYMMDD.md`.
- Khi thêm file mới, bắt buộc cập nhật:
  - `docs/index.md`
  - điều hướng trong `zensical.toml`

## Quy tắc đồng bộ theo thay đổi code
- Nếu thêm/bớt/sửa file, cập nhật tài liệu cấu trúc dự án tương ứng.
- Nếu thêm/bớt/sửa hàm hoặc contract trả về, cập nhật tài liệu kỹ thuật/liên quan tương ứng.

## Verify docs
- Chỉ chạy build docs khi docs thay đổi:
  - `./.venv/bin/zensical build -f zensical.toml`
- Nếu không có `.venv`, dùng:
  - `zensical build -f zensical.toml`
