# Tính năng MVP --- Quản lý nhóm đánh cầu

## 1. Đăng nhập Google

- Chỉ đăng nhập bằng Google.
- Lưu email, tên và avatar người dùng.

## 2. Quản lý tổ chức

- Tạo tổ chức.
- Một người dùng có thể tham gia nhiều tổ chức.
- Xem danh sách tổ chức đang tham gia.
- Hai vai trò: `ADMIN`, `MEMBER`.
- Một tổ chức có thể có nhiều admin.
- Thành viên có thể rời tổ chức.

## 3. Mời thành viên

- MVP chỉ mời qua link. Không làm mời qua email.
- Link có thể có thời gian hết hạn.
- Link có thể giới hạn số lượt sử dụng.
- Admin có thể thu hồi link.
- Người dùng đăng nhập Google và chấp nhận lời mời để tham gia tổ
  chức.

Bảng invite vẫn giữ cột `type` (`EMAIL`, `LINK`) và `email` để bật mời
qua email sau này mà không phải migrate; MVP luôn tạo invite `LINK`.

## 4. Lịch chơi mặc định

Admin tạo lịch đánh cầu định kỳ với: - Tên lịch. - Thứ trong tuần. - Giờ
bắt đầu/kết thúc. - Tên và địa chỉ sân. - Giá sân mặc định. - Số người
tối đa. - Thời gian khóa vote trước trận. - Trạng thái hoạt động.

Hệ thống dùng lịch mặc định để sinh các trận thực tế. Sau khi sinh, mỗi
trận hoạt động độc lập.

Toàn hệ thống dùng một múi giờ cố định `Asia/Ho_Chi_Minh`, offset hằng
số `+07:00` (Việt Nam không có DST từ 1975). Thứ trong tuần và giờ bắt
đầu/kết thúc của lịch được hiểu theo múi giờ này rồi đổi sang UTC khi
sinh trận.

## 5. Quản lý trận

Admin có thể tạo, chỉnh sửa, hủy và hoàn tất trận.

Mỗi trận gồm: - Tên trận. - Ngày giờ bắt đầu/kết thúc. - Tên và địa chỉ
sân. - Giá sân. - Số người tối đa. - Thời điểm khóa vote. - Chi phí phát
sinh. - Trạng thái: `OPEN`, `COMPLETED`, `CANCELLED`.

Trận sinh từ lịch định kỳ có thêm `source_template_id` và
`occurrence_date`. Hai trường này chỉ để cron sinh trận không đẻ trùng
(idempotency), không có nghiệp vụ nào đọc ngược từ trận về lịch.

## 6. Vote tham gia

Thành viên có thể chọn: - `GOING`: tham gia. - `NOT_GOING`: không tham
gia.

Không có danh sách chờ. Trận đã đủ người thì không vote `GOING` được
nữa; ai bỏ vote thì slot trống ra ngay cho người khác vote vào.

Một thành viên chỉ có một trạng thái vote trong một trận.

## 7. Giới hạn số người

Mỗi trận có `max_participants`.

Ví dụ:

```text
12 / 12 GOING
→ trận full
→ người tiếp theo không vote GOING được nữa

Một người đổi sang NOT_GOING
→ 11 / 12 GOING
→ slot trống ra ngay, ai vote trước thì được
```

Không có hàng đợi, không auto-promote.

Backend phải đảm bảo nhiều người đăng ký cùng lúc không làm số `GOING`
vượt giới hạn.

## 8. Khóa vote

Mỗi trận có `vote_locked_at`.

Ví dụ:

```text
Bắt đầu:  19:00
Khóa vote: 16:00
```

Trước thời điểm khóa, thành viên được đổi vote. Từ thời điểm khóa hoặc
khi trận đã bắt đầu, thành viên không được tự thay đổi vote.

## 9. Xác nhận người thực sự tham gia

`GOING` là trạng thái đăng ký. Sau trận, admin xác nhận `attended`.

```text
An:   GOING + attended = true
Bình: GOING + attended = false
```

Danh sách thực sự tham gia được dùng khi chia chi phí.

## 10. Chi phí trận

Giá sân lưu trực tiếp trên trận:

```text
court_cost = 300000
```

Chi phí phát sinh lưu bằng `JSONB`:

```json
[
  { "name": "Cầu", "amount": 120000 },
  { "name": "Nước", "amount": 30000 }
]
```

Tổng:

```text
total_cost = court_cost + SUM(extra_costs.amount)
```

Mọi cột tiền là số nguyên `Int`, đơn vị VND (đồng). Trần khoảng 2,147 tỷ
mỗi dòng là quá đủ cho một buổi cầu, đổi lại tránh được kiểu `BigInt`
của Prisma vốn không `JSON.stringify` được.

## 11. Hoàn tất và chia tiền

Sau trận admin: 1. Xác nhận người thực sự tham gia. 2. Kiểm tra giá sân. 3. Nhập chi phí phát sinh. 4. Kiểm tra tổng tiền. 5. Kiểm tra số tiền
mỗi người. 6. Hoàn tất trận.

Ví dụ:

```text
Tổng:       450.000đ
Người chơi: 5
Mỗi người:   90.000đ
```

Khi tổng tiền không chia hết, hệ thống chia theo largest-remainder:

```text
base      = floor(total / n)
remainder = total % n
```

`remainder` người đầu tiên (sắp theo `attendances.created_at`, rồi
`user_id` cho tất định) trả `base + 1`, còn lại trả `base`.

```text
Tổng:       451.000đ
Người chơi: 5
→ base = 90.200, remainder = 0
```

```text
Tổng:       450.002đ
Người chơi: 5
→ 2 người trả 90.001đ, 3 người trả 90.000đ
```

Bất biến: tổng các settlement luôn khớp tổng chi phí tuyệt đối — không
làm tròn nghìn, không dư đồng nào.

Hệ thống tạo settlement cho từng người để lưu số tiền phải trả.

## 12. Công nợ thành viên

Thành viên xem được: - Các trận phải thanh toán. - Số tiền phải trả từng
trận. - Đã thanh toán bao nhiêu. - Còn lại bao nhiêu. - Tổng số tiền còn
phải thanh toán.

Ví dụ:

```text
13/08      90.000đ
06/08      80.000đ
30/07     100.000đ
──────────────────
Tổng      270.000đ
```

## 13. Thanh toán

Phương thức: - `CASH` - `BANK_TRANSFER`

Trạng thái: - `PENDING` - `CONFIRMED` - `REJECTED`

Luồng:

```text
User thanh toán
      ↓
PENDING
      ↓
Admin xác nhận
      ↓
CONFIRMED
```

## 14. Thanh toán nhiều khoản cùng lúc

Một payment có thể thanh toán nhiều settlement.

Ví dụ:

```text
Trận A    100k
Trận B     80k
Trận C    120k
──────────────
Tổng      300k

Payment P1 = 300k

P1 ──100k──> Trận A
P1 ── 80k──> Trận B
P1 ──120k──> Trận C
```

Một settlement cũng có thể được thanh toán qua nhiều payment.

## 15. Luồng tổng thể

```text
Google Login
    ↓
Organization
    ↓
Members / Invite link
    ↓
Event Template
    ↓
Event
    ↓
Vote
    ↓
Full / Lock vote
    ↓
Trận diễn ra
    ↓
Xác nhận người tham gia
    ↓
Court Cost + Extra Costs
    ↓
Finalize
    ↓
Settlement / Công nợ
    ↓
Payment
    ↓
Payment Allocation
    ↓
Admin xác nhận
```
