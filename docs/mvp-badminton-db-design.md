# MVP Database Design --- Quản lý hội nhóm & trận cầu

## 1. Phạm vi MVP

Hệ thống tập trung vào các chức năng chính:

- Đăng nhập bằng Google.
- Một người có thể tham gia nhiều tổ chức.
- Tổ chức có `ADMIN` và `MEMBER`.
- Mời thành viên bằng link. MVP không làm mời qua email.
- Admin cấu hình lịch đánh cầu định kỳ.
- Hệ thống sinh các trận thực tế từ lịch mặc định.
- Thành viên vote tham gia / không tham gia. Không có waitlist.
- Vote bị khóa trước trận một khoảng thời gian cấu hình sẵn.
- Khi trận full, thành viên mới không thể vào danh sách `GOING`; ai bỏ
  vote thì slot trống ra ngay cho người khác.
- Khi đã tới thời gian khóa hoặc trận bắt đầu, member không thể tự
  thay đổi vote.
- Mỗi trận có địa điểm và giá sân riêng.
- Các chi phí phát sinh ít truy vấn riêng được lưu bằng `JSONB`.
- Sau trận, admin xác nhận người thực sự tham gia và hoàn tất trận.
- Hệ thống chia chi phí thành khoản phải trả của từng thành viên.
- Theo dõi payment và cho phép một payment thanh toán nhiều khoản nợ.

Quy ước chung:

- Mọi mốc thời gian lưu `timestamptz` (UTC). Mọi diễn giải ngày/giờ
  nghiệp vụ dùng múi giờ cố định `Asia/Ho_Chi_Minh` với offset hằng số
  `+07:00` — Việt Nam không có DST từ 1975 nên không cần thư viện
  timezone.
- Mọi cột tiền là số nguyên `Int`, đơn vị VND (đồng). Trần khoảng 2,147
  tỷ mỗi dòng là quá đủ, đổi lại tránh kiểu `BigInt` của Prisma vốn
  không `JSON.stringify` được.

---

## 2. ERD

```text
users
  │
  ├──< organization_members >── organizations
  │                                │
  │                                ├──< organization_invites
  │                                │
  │                                ├──< event_templates
  │                                │
  │                                └──< events
  │                                       │
  │                                       ├──< event_attendances
  │                                       │
  │                                       └──< event_settlements
  │                                                │
  │                                                └──< payment_allocations
  │                                                         │
  └──────────────────────────────────────────────────────< payments
```

Luồng nghiệp vụ chính:

```text
Organization
    │
    ├── Members / Invites
    │
    ├── Event Templates
    │        │
    │        └── generate
    │
    └── Event
         │
         ├── Attendance
         │
         ├── court_cost + extra_costs
         │
         └── Finalize
                │
                └── Settlements
                        │
                        └── Payment Allocations
                                  │
                                  └── Payments
```

---

## 3. `users`

Tài khoản người dùng. Chỉ đăng nhập bằng Google.

Field Type Mô tả

---

`id` uuid PK ID nội bộ
`provider` varchar Nhà cung cấp OAuth, mặc định `google`
`provider_user_id` varchar UNIQUE ID tài khoản bên provider
`email` varchar UNIQUE Email
`email_verified` boolean Provider đã xác thực email chưa
`full_name` varchar nullable Tên hiển thị
`avatar_url` text nullable Avatar
`last_login_at` timestamptz nullable Lần đăng nhập gần nhất
`status` varchar Trạng thái tài khoản, mặc định `active`
`created_at` timestamptz Ngày tạo
`updated_at` timestamptz Ngày cập nhật
`is_deleted` boolean Cờ soft-delete
`deleted_by` uuid nullable Người xóa
`deleted_at` timestamptz nullable Thời điểm xóa

Constraint:

```text
UNIQUE (provider, provider_user_id)
```

Bảng dựng theo hướng đa provider ngay từ đầu (`provider` +
`provider_user_id`) thay vì cột `google_id` riêng, dù MVP chỉ bật
Google. `users` là bảng duy nhất có soft-delete; các bảng nghiệp vụ
bên dưới không có.

---

## 4. `organizations`

Hội nhóm/CLB.

Field Type Mô tả

---

`id` uuid PK ID tổ chức
`name` varchar Tên tổ chức
`avatar_url` text nullable Logo/avatar
`created_by` uuid FK → users.id Người tạo
`created_at` timestamptz Ngày tạo
`updated_at` timestamptz Ngày cập nhật

---

## 5. `organization_members`

Quan hệ nhiều-nhiều giữa user và organization.

Field Type Mô tả

---

`id` uuid PK ID membership
`organization_id` uuid FK Tổ chức
`user_id` uuid FK Thành viên
`role` enum `ADMIN`, `MEMBER`
`status` enum `ACTIVE`, `LEFT`
`joined_at` timestamptz Thời điểm tham gia
`created_at` timestamptz Ngày tạo
`updated_at` timestamptz Ngày cập nhật

Constraint:

```text
UNIQUE (organization_id, user_id)
```

Index: `(user_id, status)`.

Một organization phải luôn còn ít nhất một `ADMIN` đang `ACTIVE`.

Rời nhóm không xóa row mà đặt `status = LEFT` — giữ lịch sử điểm danh và
công nợ, và cho phép join lại bằng chính row cũ.

---

## 6. `organization_invites`

Mời thành viên vào tổ chức.

MVP chỉ tạo invite `type = LINK`. Cột `type` và `email` vẫn giữ trong
bảng để bật `EMAIL` sau này mà không phải migrate.

Field Type Mô tả

---

`id` uuid PK ID invite
`organization_id` uuid FK Tổ chức
`type` enum `EMAIL`, `LINK`; MVP luôn là `LINK`
`email` varchar nullable Email nếu là email invite; MVP luôn null
`token_hash` varchar UNIQUE Hash SHA-256 của invite token
`expires_at` timestamptz nullable Thời điểm hết hạn
`max_uses` int nullable Số lượt sử dụng tối đa
`used_count` int Số lượt đã sử dụng
`revoked_at` timestamptz nullable Admin thu hồi invite
`created_by` uuid FK Admin tạo invite
`created_at` timestamptz Ngày tạo
`updated_at` timestamptz Ngày cập nhật

Index: `(organization_id, revoked_at)`.

Token thô chỉ xuất hiện đúng một lần trong response lúc tạo, DB chỉ giữ
SHA-256.

Invite còn hiệu lực khi:

```text
revoked_at IS NULL
AND (expires_at IS NULL OR now < expires_at)
AND (max_uses IS NULL OR used_count < max_uses)
```

---

## 7. `event_templates`

Cấu hình lịch chơi định kỳ.

Ví dụ: cầu tối thứ 3, 19:00--21:00, sân ABC, tối đa 12 người, khóa vote
trước 3 giờ.

Field Type Mô tả

---

`id` uuid PK ID template
`organization_id` uuid FK Tổ chức
`name` varchar Tên lịch
`day_of_week` smallint Thứ trong tuần, ISO-8601 1--7 (1 = thứ Hai)
`start_time` time Giờ bắt đầu, hiểu theo `+07:00`
`end_time` time Giờ kết thúc, hiểu theo `+07:00`
`location_name` varchar nullable Tên sân mặc định
`location_address` text nullable Địa chỉ
`court_cost` int Giá sân mặc định, đơn vị VND
`max_participants` int Số người tối đa
`vote_lock_minutes_before` int Khóa vote trước bao nhiêu phút
`active` boolean Có tiếp tục sinh event hay không
`created_by` uuid FK Admin tạo
`created_at` timestamptz Ngày tạo
`updated_at` timestamptz Ngày cập nhật

Index: `(organization_id, active)`.

`event_templates` chỉ dùng để sinh event. Event sau khi được sinh hoạt
động độc lập: sửa template không ảnh hưởng trận đã sinh.

Event vẫn giữ `source_template_id` + `occurrence_date`, nhưng chỉ để cron
sinh trận idempotent — xem mục `events`.

---

## 8. `events`

Một trận/buổi chơi thực tế.

Field Type Mô tả

---

`id` uuid PK ID trận
`organization_id` uuid FK Tổ chức
`title` varchar Tên trận
`start_at` timestamptz Thời gian bắt đầu
`end_at` timestamptz Thời gian kết thúc
`location_name` varchar nullable Tên sân
`location_address` text nullable Địa chỉ
`court_cost` int Tiền sân, đơn vị VND
`extra_costs` jsonb Các chi phí phát sinh, mặc định `[]`
`max_participants` int Số người tối đa
`vote_locked_at` timestamptz Thời điểm khóa vote
`status` enum `OPEN`, `COMPLETED`, `CANCELLED`
`source_template_id` uuid FK nullable Template đã sinh ra trận, `ON DELETE SET NULL`
`occurrence_date` date nullable Ngày của lượt sinh
`created_by` uuid FK Admin tạo
`completed_at` timestamptz nullable Thời điểm hoàn tất
`cancelled_at` timestamptz nullable Thời điểm hủy
`created_at` timestamptz Ngày tạo
`updated_at` timestamptz Ngày cập nhật

Constraint:

```text
UNIQUE (source_template_id, occurrence_date)
```

Index: `(organization_id, start_at)`.

`source_template_id` và `occurrence_date` **chỉ** phục vụ idempotency của
cron sinh event: UNIQUE chặn sinh trùng khi cron chạy lại hoặc chạy trên
nhiều instance. Không có logic nghiệp vụ nào đọc ngược từ event về
template; trận tạo lẻ để cả hai cột null.

`start_at`/`end_at` khi sinh từ template = `occurrence_date` +
`start_time`/`end_time` diễn giải ở `+07:00` rồi đổi sang UTC.

Ví dụ `extra_costs`:

```json
[
  {
    "name": "Cầu",
    "amount": 120000
  },
  {
    "name": "Nước",
    "amount": 30000
  }
]
```

Tổng chi phí:

```text
total_cost = court_cost + SUM(extra_costs[].amount)
```

Không lưu `is_full` hay `is_locked`.

```text
is_full = COUNT(attendance.status = GOING) >= max_participants

is_locked =
    now >= vote_locked_at
    OR now >= start_at
    OR status != OPEN
```

---

## 9. `event_attendances`

Vote và kết quả tham gia của thành viên.

Field Type Mô tả

---

`id` uuid PK ID attendance
`event_id` uuid FK Trận
`user_id` uuid FK Thành viên
`status` enum `GOING`, `NOT_GOING`
`attended` boolean nullable Sau trận xác nhận có thực sự chơi
`created_at` timestamptz Lần đầu tạo vote
`updated_at` timestamptz Lần cuối thay đổi

Constraint:

```text
UNIQUE (event_id, user_id)
```

Index: `(event_id, status)`.

Cố tình không có `WAITLIST`. Trận đủ người thì không vote `GOING` được
nữa; ai bỏ vote thì slot trống ra ngay cho người khác. Không hàng đợi,
không auto-promote.

Rule:

```text
Trước vote_locked_at:
- GOING ↔ NOT_GOING được phép.
- Chuyển sang GOING chỉ khi còn slot, full thì bị từ chối.
- GOING → NOT_GOING luôn được phép, slot trống ra ngay.

Từ vote_locked_at:
- Member không được tự thay đổi.

Từ start_at:
- Member không được thay đổi.

Admin có thể chỉnh attendance khi cần trước khi finalize.
```

Khi nhiều user tranh slot cuối, backend phải xử lý bằng
transaction/locking để không vượt `max_participants`.

---

## 10. `event_settlements`

Snapshot số tiền từng thành viên phải chịu khi admin hoàn tất trận.

Field Type Mô tả

---

`id` uuid PK ID settlement
`event_id` uuid FK Trận
`user_id` uuid FK Thành viên phải trả
`amount` int Tổng số tiền phải trả, đơn vị VND
`paid_amount` int Số tiền đã được thanh toán, đơn vị VND
`created_at` timestamptz Ngày tạo
`updated_at` timestamptz Ngày cập nhật

Constraint:

```text
UNIQUE (event_id, user_id)
```

Index: `(user_id)`.

Ví dụ:

```text
court_cost  = 300k
extra_costs = 100k
total       = 400k

4 người ATTENDED

An      100k
Bình    100k
Cường   100k
Dũng    100k
```

Khi `total` không chia hết cho số người, chia theo largest-remainder:

```text
base      = floor(total / n)
remainder = total % n

remainder người đầu tiên trả base + 1
những người còn lại trả base
```

Thứ tự "người đầu tiên" lấy theo `event_attendances.created_at`, hòa thì
theo `user_id`, để kết quả tất định.

```text
total = 400.002, n = 4

An      100.001
Bình    100.001
Cường   100.000
Dũng    100.000
```

Bất biến: `SUM(settlements.amount) === total` tuyệt đối — không làm tròn
nghìn, không để dư đồng nào.

`paid_amount` là dữ liệu dẫn xuất nhưng vẫn lưu vì màn công nợ đọc nhiều
hơn ghi rất nhiều. Bất biến giữ nó khỏi lệch: `paid_amount` chỉ đổi bên
trong transaction đổi trạng thái payment, không có đường ghi nào khác.

Trạng thái công nợ không cần lưu riêng:

```text
paid_amount = 0
→ UNPAID

0 < paid_amount < amount
→ PARTIAL

paid_amount >= amount
→ PAID
```

---

## 11. `payments`

Một lần thành viên thực sự thanh toán.

Field Type Mô tả

---

`id` uuid PK ID payment
`organization_id` uuid FK Tổ chức
`user_id` uuid FK Người thanh toán
`amount` int Tổng số tiền thanh toán, đơn vị VND
`method` enum `CASH`, `BANK_TRANSFER`
`status` enum `PENDING`, `CONFIRMED`, `REJECTED`
`note` text nullable Ghi chú
`created_by` uuid FK Người tạo payment
`confirmed_by` uuid FK nullable Admin xác nhận
`confirmed_at` timestamptz nullable Thời gian xác nhận
`created_at` timestamptz Ngày tạo
`updated_at` timestamptz Ngày cập nhật

Index: `(organization_id, status)`, `(user_id, status)`.

Ví dụ một user nợ:

```text
Trận A: 100k
Trận B:  80k
Trận C: 120k

Tổng:   300k
```

User có thể chuyển một lần `300k`, tạo một payment.

---

## 12. `payment_allocations`

Phân bổ một payment vào một hoặc nhiều settlement.

Field Type Mô tả

---

`id` uuid PK ID allocation
`payment_id` uuid FK Payment
`settlement_id` uuid FK Khoản nợ được thanh toán
`amount` int Số tiền phân bổ, đơn vị VND
`created_at` timestamptz Ngày tạo

Constraint:

```text
UNIQUE (payment_id, settlement_id)
```

Ví dụ:

```text
Payment P1 = 300k

P1 ──100k──> Settlement trận A
P1 ── 80k──> Settlement trận B
P1 ──120k──> Settlement trận C
```

Một payment có thể thanh toán nhiều settlement và một settlement cũng có
thể được thanh toán qua nhiều payment.

Chỉ các allocation thuộc payment `CONFIRMED` mới được tính vào số tiền
đã thanh toán.

---

## 13. Luồng hoàn chỉnh của một trận

```text
Event Template
      │
      └── generate
             ↓
           Event
             │
             ├── Member vote
             │       ↓
             │   Attendances
             │
             ├── court_cost
             └── extra_costs
                     │
                     ↓
              Admin xác nhận
              người thực sự chơi
                     │
                     ↓
                Finalize Event
                     │
                     ↓
                 Settlements
                     │
                     ↓
             User thanh toán
                     │
                     ↓
                  Payment
                     │
                     ↓
            Payment Allocations
                     │
                     ↓
             Cập nhật paid_amount
```

Ví dụ:

```text
Cầu tối thứ 5

Tiền sân       300k
Cầu            120k
Nước            30k
────────────────────
Tổng            450k

5 người thực sự chơi
→ 90k/người
```

Sinh 5 settlement:

```text
An       90k
Bình     90k
Cường    90k
Dũng     90k
Minh     90k
```

Nếu An đang còn nợ thêm hai trận trước:

```text
Trận hiện tại     90k
Trận trước        80k
Trận trước nữa   100k
────────────────────
Tổng             270k
```

An chuyển một lần `270k`:

```text
Payment P1 = 270k

Allocations:
P1 → Settlement hiện tại    90k
P1 → Settlement trước       80k
P1 → Settlement trước nữa  100k
```

Khi admin xác nhận payment, các khoản tương ứng được tính là đã thanh
toán.

---

## 14. Các bảng MVP

```text
1. users
2. organizations
3. organization_members
4. organization_invites
5. event_templates
6. events
7. event_attendances
8. event_settlements
9. payments
10. payment_allocations
```

Tổng cộng **10 bảng** nghiệp vụ cho MVP hiện tại.

Ngoài ra có `refresh_tokens` phục vụ riêng cho auth (lưu SHA-256 của
refresh token, xoay vòng và thu hồi), không thuộc mô hình nghiệp vụ ở
trên.
