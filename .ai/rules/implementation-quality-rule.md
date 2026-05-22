# Quy Tắc Chất Lượng Triển Khai

## Mục tiêu
Đảm bảo thay đổi nhỏ gọn, dễ review, dễ verify.

## Quy tắc khi triển khai
- Ưu tiên pattern đã có trong module đang sửa.
- Tránh thay đổi kiến trúc nếu yêu cầu không đề cập.
- Giữ diff tối thiểu, tập trung đúng mục tiêu.
- Không để mã chết hoặc import không dùng.
- Với tính năng mới, phải thêm test phù hợp (unit/integration/e2e) trong phạm vi thay đổi.
- Khi thêm hoặc sửa hàm, comment tiếng Việt của hàm phải có đủ `Input:` và `Output:`.

## Quy tắc verify theo module
- Với `api`: ưu tiên chạy `pnpm lint`, `pnpm test`, và kiểm tra build trong `api` khi phạm vi thay đổi cần.
- Với `ui`: ưu tiên chạy `pnpm lint` và `pnpm build` trong `ui` khi phạm vi thay đổi cần.
- Với `docs`: chỉ chạy build docs khi có thay đổi docs/config docs.

## Quy tắc báo cáo verify
- Ghi rõ lệnh đã chạy.
- Ghi rõ pass/fail theo từng lệnh.
- Nếu là tính năng mới, báo rõ test mới đã thêm và hành vi chính được bao phủ.
