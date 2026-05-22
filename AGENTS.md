# AGENTS

## Phạm vi dự án

- Repository này phục vụ dự án Joytab.
- Nguồn tài liệu chính thức nằm trong `docs/`, render bằng Zensical qua `zensical.toml`.

## Quy tắc bắt buộc trước khi bắt đầu flow

1. Nhận yêu cầu và lập kế hoạch chi tiết ngay.
2. Chờ người yêu cầu xác nhận kế hoạch trước khi triển khai.
3. Chỉ thực hiện đúng phạm vi đã được yêu cầu và xác nhận.

## Quy tắc triển khai chung

- Không chỉnh sửa file, luồng, hoặc module không liên quan.
- Khi viết code, thêm comment ngắn bằng tiếng Việt mô tả mục đích của từng hàm.
- Comment của hàm phải luôn có 2 dòng rõ ràng: `Input:` và `Output:`.
- Khi phát triển tính năng mới, nếu phạm vi thay đổi có thể kiểm thử được thì phải bổ sung test tương ứng trong cùng phạm vi.
- Khi thêm/bớt/sửa file hoặc thêm/bớt/sửa hàm, phải cập nhật docs liên quan để đồng bộ với trạng thái thực tế của hệ dự án.

## Quy tắc build/test và xác nhận hoàn tất

- Chỉ build/test các phần có thay đổi mã nguồn.
- Không chạy build/test toàn repo nếu không có yêu cầu rõ ràng.
- Chỉ báo hoàn tất khi phạm vi build/test bắt buộc đã chạy qua.
- Nếu verify thất bại, báo trạng thái chưa hoàn tất và liệt kê lỗi còn lại.

## Quy trình bàn giao

1. Nhận yêu cầu -> viết kế hoạch chi tiết.
2. Chờ xác nhận.
3. Triển khai đúng phạm vi.
4. Cập nhật docs nếu thực sự cần theo quy tắc tài liệu.
5. Build/test đúng phạm vi thay đổi.
6. Báo cáo trạng thái hoàn tất dựa trên kết quả verify thực tế.
