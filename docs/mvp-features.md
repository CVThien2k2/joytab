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

- Mời qua email.
- Mời qua link.
- Link có thể có thời gian hết hạn.
- Link có thể giới hạn số lượt sử dụng.
- Admin có thể thu hồi link.
- Người dùng đăng nhập Google và chấp nhận lời mời để tham gia tổ
  chức.

## 4. Lịch chơi mặc định

Admin tạo lịch đánh cầu định kỳ với: - Tên lịch. - Thứ trong tuần. - Giờ
bắt đầu/kết thúc. - Tên và địa chỉ sân. - Tọa độ sân. - Giá sân mặc
định. - Số người tối đa. - Thời gian khóa vote trước trận. - Trạng thái
hoạt động.

Hệ thống dùng lịch mặc định để sinh các trận thực tế. Sau khi sinh, mỗi
trận hoạt động độc lập.

## 5. Quản lý trận

Admin có thể tạo, chỉnh sửa, hủy và hoàn tất trận.

Mỗi trận gồm: - Tên trận. - Ngày giờ bắt đầu/kết thúc. - Tên, địa chỉ và
tọa độ sân. - Giá sân. - Số người tối đa. - Thời điểm khóa vote. - Chi
phí phát sinh. - Trạng thái: `OPEN`, `COMPLETED`, `CANCELLED`.

## 6. Vote tham gia

Thành viên có thể chọn: - `GOING`: tham gia. - `NOT_GOING`: không tham
gia. - `WAITLIST`: danh sách chờ khi đã đủ người.

Một thành viên chỉ có một trạng thái vote trong một trận.

## 7. Giới hạn số người

Mỗi trận có `max_participants`.

Ví dụ:

```text
12 / 12 GOING
→ trận full
→ người đăng ký tiếp theo vào WAITLIST
```

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

## 11. Hoàn tất và chia tiền

Sau trận admin: 1. Xác nhận người thực sự tham gia. 2. Kiểm tra giá sân. 3. Nhập chi phí phát sinh. 4. Kiểm tra tổng tiền. 5. Kiểm tra số tiền
mỗi người. 6. Hoàn tất trận.

Ví dụ:

```text
Tổng:       450.000đ
Người chơi: 5
Mỗi người:   90.000đ
```

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
Members / Invite
    ↓
Event Template
    ↓
Event
    ↓
Vote
    ↓
Full / Waitlist / Lock vote
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
