# Kỹ Năng Phát Hành Tài Liệu

## Mục đích
Dùng khi có thay đổi docs cần chuẩn bị cho publish.

## Luồng thực hiện
1. Xác định file docs bị ảnh hưởng trong `docs/`.
2. Kiểm tra trùng lặp nội dung với file hiện có.
3. Nếu có file mới, cập nhật `docs/index.md` và điều hướng `zensical.toml`.
4. Kiểm tra link, heading, code block.
5. Chạy build docs bằng lệnh phù hợp môi trường.
6. Ghi nhận kết quả verify trước khi bàn giao.

## Lưu ý
- Không commit thư mục output `site/`.
- Chỉ báo hoàn tất khi build docs trong phạm vi thay đổi chạy qua.
