# Thiết kế MVP — Lịch thi đấu, vote và chia tiền

Ngày chốt: 2026-08-28 · Phạm vi: `api/` (NestJS + Prisma) và `ui/` (Next.js App Router)

---

## 1. Bài toán

Chủ tổ chức (owner) tạo lịch thi đấu. Thành viên vote tham gia. Sau trận, owner nhập chi
phí, hệ thống chia tiền theo hệ số nam/nữ. Mỗi người thấy số tiền của mình, thanh toán và
tải ảnh chuyển khoản; owner đối soát và duyệt.

Ba khối tách rời nhau, làm được độc lập:

1. **Lịch + vote** — tạo/sửa/huỷ trận, vote, huỷ vote, lịch sử.
2. **Chốt chi phí** — nhập chi phí, chia tiền, xác nhận.
3. **Thanh toán** — gom nhiều trận vào một lần trả, owner duyệt.

## 2. Những quyết định đã chốt

| Vấn đề | Chốt | Vì sao |
|---|---|---|
| "Không được trùng lịch" | Chặn ở tầng **vote**: một user không vote được hai trận giao giờ, xuyên mọi tổ chức | Ràng buộc thật nằm ở con người, không ở cái sân. Hai tổ chức khác nhau vẫn là cùng một người, cùng một buổi tối |
| Ai bị chia tiền | Người **còn vote lúc trận bắt đầu** | Huỷ vote đã bị chặn trong 2h cuối, nên danh sách này chính là những người đã cam kết |
| QR thanh toán | Chỉ ở **tổ chức**, trận không giữ bản sao | Tiền được gom nhiều trận vào một lần trả (§7) nên QR vốn đã là của tổ chức; để mỗi trận một QR thì một lần chuyển khoản sẽ không biết quét cái nào |
| Giới tính `other` / chưa khai | Tính hệ số **như nam** (`k`) | Mốc 1 là nữ; thiếu thông tin thì nghiêng về phía không thất thu quỹ |
| Ô "chi phí" trong dòng chi | Là **đơn giá**, hệ thống nhân với số lượng | Mua 10 chai nước thì nhập giá một chai là tự nhiên; cột thành tiền hiện ngay cạnh để soát |
| Làm tròn | **Làm tròn lên 1.000đ**, phần dư vào quỹ và hiện rõ một dòng | Số tiền chuyển khoản đẹp, tổng thu luôn ≥ tổng chi, không ai phải bù |
| Sửa sau khi chốt | Chốt lại được khi **mọi khoản của trận đó còn `unpaid`** | Xem §7 — một ảnh thanh toán có thể đang treo cho nhiều trận |
| Thanh toán | Gom **nhiều trận, một lần trả, một ảnh** | Người chơi 3-4 buổi mới chuyển khoản một lần |

**Giả định**: "admin" = `OrganizationMember.role = 'owner'`, không thêm bảng quyền mới.
Form nhập **giờ bắt đầu + giờ kết thúc** — cần `end_at` mới định nghĩa được thế nào là
trùng giờ.

## 3. Mô hình dữ liệu

Tiền dùng `Int`, đơn vị **đồng**. VND không có phần lẻ, và số nguyên thì không có chuyện
hai lần cộng ra hai kết quả.

### 3.1 Mở rộng `Organization`

```prisma
model Organization {
  // ...các cột hiện có
  /// Ảnh QR chuyển khoản. Nguồn duy nhất — trận KHÔNG giữ bản sao (xem §2).
  payment_qr_url String?
  /// Hệ số nam mặc định (nữ luôn là mốc 1). Trận copy lúc tạo, sửa riêng được.
  male_ratio     Decimal @default(1.0) @db.Decimal(4, 2)
}
```

### 3.2 `Match`

```prisma
model Match {
  id              String    @id @default(uuid()) @db.Uuid
  organization_id String    @db.Uuid
  court_name      String    @db.VarChar(120)
  start_at        DateTime  @db.Timestamptz(6)
  end_at          DateTime  @db.Timestamptz(6)
  max_players     Int       @db.SmallInt
  /// Chụp lại từ tổ chức lúc tạo. Đổi hệ số của tổ chức KHÔNG làm đổi trận đã tạo.
  male_ratio      Decimal   @db.Decimal(4, 2)
  note            String?
  /// 'open' | 'settled' | 'canceled'. Xem §4 — "đóng vote" cố tình KHÔNG nằm ở đây.
  status          String    @default("open") @db.VarChar(20)
  created_by      String    @db.Uuid
  settled_at      DateTime? @db.Timestamptz(6)
  settled_by      String?   @db.Uuid
  created_at      DateTime  @default(now()) @db.Timestamptz(6)
  updated_at      DateTime  @updatedAt @db.Timestamptz(6)

  @@index([organization_id, start_at])
}
```

### 3.3 Vote: trạng thái và lịch sử tách đôi

```prisma
/// Một row = một người đang tham gia. Huỷ vote là XOÁ row, không phải đánh dấu.
model MatchVote {
  id       String   @id @default(uuid()) @db.Uuid
  match_id String   @db.Uuid
  user_id  String   @db.Uuid
  voted_at DateTime @default(now()) @db.Timestamptz(6)

  @@unique([match_id, user_id])
  /// Truy vấn nóng: "user này đang vote những trận nào" — dùng để kiểm trùng giờ.
  @@index([user_id])
}

/// Append-only. Đây mới là lịch sử; không bao giờ sửa hay xoá row ở đây.
model MatchVoteEvent {
  id         String   @id @default(uuid()) @db.Uuid
  match_id   String   @db.Uuid
  user_id    String   @db.Uuid
  /// 'join' | 'cancel'
  action     String   @db.VarChar(10)
  created_at DateTime @default(now()) @db.Timestamptz(6)

  @@index([match_id, created_at])
}
```

Vì sao hai bảng chứ không một bảng có cột `canceled_at`: vote → huỷ → vote lại là chuyện
bình thường. Với một bảng, lần huỷ trước bị đè mất — mà đó đúng là thứ cần tra khi có
tranh cãi.

### 3.4 Chi phí và khoản phải trả

```prisma
model MatchExpense {
  id         String @id @default(uuid()) @db.Uuid
  match_id   String @db.Uuid
  name       String @db.VarChar(120)
  quantity   Int    @db.SmallInt
  /// ĐƠN GIÁ, đơn vị đồng. Thành tiền = quantity × unit_price, không lưu.
  unit_price Int
  position   Int    @db.SmallInt

  @@index([match_id, position])
}

/// Snapshot chia tiền, sinh ra lúc chốt. Không tính lại khi đọc.
model MatchCharge {
  id               String    @id @default(uuid()) @db.Uuid
  match_id         String    @db.Uuid
  user_id          String    @db.Uuid
  /// Giới tính TẠI THỜI ĐIỂM chốt. User đổi giới tính sau không làm đổi tiền đã chia.
  gender_at_settle String?   @db.VarChar(10)
  ratio            Decimal   @db.Decimal(4, 2)
  amount           Int
  /// 'unpaid' | 'submitted' | 'confirmed'
  payment_status   String    @default("unpaid") @db.VarChar(20)
  /// NULL = chưa gửi thanh toán. Trỏ tới lần gửi tiền đã gom khoản này vào.
  payment_id       String?   @db.Uuid

  @@unique([match_id, user_id])
  @@index([user_id, payment_status])
}
```

### 3.5 `Payment` — một lần trả tiền, nhiều trận

```prisma
model Payment {
  id              String    @id @default(uuid()) @db.Uuid
  /// Gom trong PHẠM VI một tổ chức: QR là của tổ chức, không gom xuyên tổ chức được.
  organization_id String    @db.Uuid
  user_id         String    @db.Uuid
  /// Ảnh chuyển khoản. BẮT BUỘC: mọi khoản đều trả bằng chuyển khoản, không có tiền mặt,
  /// nên một lần thanh toán không có ảnh thì owner không có gì để đối soát.
  proof_url       String
  note            String?
  /// 'submitted' | 'confirmed' | 'rejected'
  status          String    @default("submitted") @db.VarChar(20)
  reject_reason   String?
  submitted_at    DateTime  @default(now()) @db.Timestamptz(6)
  confirmed_at    DateTime? @db.Timestamptz(6)
  confirmed_by    String?   @db.Uuid

  @@index([organization_id, status, submitted_at])
  @@index([user_id, submitted_at])
}
```

**Không có cột `amount`.** Tổng của một lần thanh toán luôn = Σ `amount` các charge trỏ vào
nó. Một nguồn sự thật, không có cảnh tổng lưu sẵn lệch với các dòng bên dưới.

## 4. Trạng thái trận

`status` chỉ có ba giá trị:

- `open` — đang nhận vote hoặc đã đá xong nhưng chưa chốt tiền
- `settled` — đã chốt chia tiền, các `MatchCharge` đã tồn tại
- `canceled` — owner huỷ trận

**"Đóng vote" không phải là một trạng thái lưu trong DB.** Nó được suy ra:

```
voteClosed = (số người đang vote >= max_players) || (now >= start_at)
```

Nếu là cột thì mỗi lần có người huỷ vote (khi còn slot, trước mốc 2h) lại phải nhớ mở lại,
và sẽ có lúc quên. Hai nguồn sự thật cho cùng một câu hỏi thì có lúc lệch nhau.

## 5. Luật vote

**Vote được khi tất cả đúng:**

- `status = 'open'`
- `now < start_at`
- Số người đang vote `< max_players`
- User chưa vote trận này
- User **không** đang vote một trận khác có `[start_at, end_at)` giao với trận này —
  **xét mọi tổ chức**, bỏ qua trận `canceled`

**Huỷ vote được khi:** đang vote, và `now < start_at - 2 giờ`
(hằng số `MATCH_CANCEL_LOCK_HOURS = 2`).

**Chống race.** Hai request cùng lúc có thể cùng lấy slot cuối, hoặc cùng vote hai trận
trùng giờ. Trong một transaction, theo đúng thứ tự này để không deadlock:

1. `pg_advisory_xact_lock(hashtext(user_id))` — mọi thao tác vote của cùng một user bị xếp hàng
2. `SELECT ... FROM matches WHERE id = $1 FOR UPDATE` — khoá trận đang đếm slot
3. Kiểm trùng giờ, kiểm slot, rồi mới ghi

Chọn advisory lock thay vì dựng `EXCLUDE` constraint trên `tstzrange`: exclusion constraint
buộc phải nhân đôi `start_at`/`end_at` xuống `MatchVote` và viết migration SQL thô, đổi lấy
một bảo đảm mà advisory lock đã cho — trong khi vẫn không tin vào tầng service.

Mọi thay đổi đều ghi thêm một row `MatchVoteEvent` trong cùng transaction.

## 6. Chốt chi phí và chia tiền

Owner mở màn chốt khi `now >= start_at` và `status != 'canceled'`.

Đầu vào: **một danh sách nhiều dòng chi phí** `[tên, số lượng, đơn giá]` + hệ số nam `k`
(mặc định lấy `match.male_ratio`, sửa tại chỗ được). Thêm/xoá dòng tuỳ ý, không giới hạn
danh mục cố định — owner tự đặt tên khoản:

| Tên | Số lượng | Đơn giá | Thành tiền |
|---|---:|---:|---:|
| Tiền sân | 2 | 120.000 | 240.000 |
| Cầu | 6 | 25.000 | 150.000 |
| Nước | 10 | 10.000 | 100.000 |
| | | **Tổng** | **490.000** |

Cột *Thành tiền* và dòng *Tổng* do hệ thống tính, không nhập tay.

```
total    = Σ (quantity × unit_price)
ratio_i  = 1  nếu gender = 'female'
         = k  nếu 'male', 'other', hoặc chưa khai
units    = Σ ratio_i                       (i chạy trên người CÒN vote lúc trận bắt đầu)
base     = total / units                   (số tiền một "suất nữ")
amount_i = ceil(base × ratio_i / 1000) × 1000
dư       = Σ amount_i − total              (hiện một dòng riêng ở màn xác nhận)
```

`units = 0` (không ai vote) hoặc `total = 0` → chặn, không cho chốt.

**FE tính preview tại chỗ** để gõ tới đâu thấy tới đó, nhưng **BE tính lại từ đầu khi
confirm** — con số vào DB luôn là của BE.

**Confirm là một transaction:** xoá `MatchExpense` cũ, ghi dòng mới, dựng lại
`MatchCharge` cho từng người, đặt `status = 'settled'` + `settled_at/by`.

**Chốt lại** được khi **mọi `MatchCharge` của trận đang `unpaid`**. Đã có người gửi ảnh thì
owner phải từ chối lần thanh toán đó trước — lý do ở §7.

## 7. Thanh toán gom

Một `Payment` gom nhiều `MatchCharge` `unpaid` của cùng một user trong cùng một tổ chức.

```
User chọn khoản (mặc định chọn hết) → xem tổng + QR tổ chức → upload ảnh → gửi
  ⇒ tạo Payment(status='submitted'), các charge được chọn: payment_status='submitted', payment_id=<id>
Owner duyệt   ⇒ Payment 'confirmed', các charge 'confirmed'
Owner từ chối ⇒ Payment 'rejected' + lý do, các charge về 'unpaid' (GIỮ payment_id)
Owner bỏ duyệt⇒ Payment về 'submitted', các charge về 'submitted'
```

**User chỉ có MỘT thao tác: gửi.** Không tự huỷ, không sửa, không gỡ khoản ra khỏi lần đã
gửi. Gửi xong là xong. Khoản chỉ quay lại danh sách phải thanh toán khi **owner báo chưa
nhận được** (từ chối) — và lúc đó user thấy kèm lý do. Cho user tự rút lại thì hai bên sẽ
có lúc nhìn hai sự thật khác nhau về cùng một lần chuyển khoản.

**Một cột trạng thái, hai phía đọc khác nhau:**

| `payment_status` | User thấy | Owner thấy |
|---|---|---|
| `unpaid` | **Chưa thanh toán** — nằm trong danh sách phải trả | Còn nợ |
| `submitted` | **Đã thanh toán** — biến khỏi danh sách phải trả | **Chờ duyệt**, có nút Duyệt / Từ chối |
| `confirmed` | Đã thanh toán · đã đối soát | Xong |

User gửi tiền xong là hết việc. Chuyện còn phải đối soát là việc của owner, không đẩy
ngược sự chờ đợi về phía người đã trả.

**Vì sao phải có nhánh từ chối:** ảnh mờ, chuyển thiếu, chuyển nhầm người. Không có nhánh
này thì mọi sai sót kẹt vĩnh viễn ở "chờ duyệt".

Khoản bị từ chối **giữ nguyên `payment_id`**, chỉ `payment_status` quay về `unpaid`. Đó là
đường duy nhất để nói cho user biết vì sao khoản sống lại — cắt liên kết là cắt luôn lời giải
thích. Lần gửi sau ghi đè liên kết này, và điều kiện chọn khoản chỉ nhìn `payment_status`.

**Chỉ có chuyển khoản.** Không có nhánh tiền mặt, không có cột `method`, owner không tạo
`Payment` hộ ai. Mọi lần thanh toán đều do chính người nợ gửi lên kèm ảnh — nhờ vậy mỗi
dòng tiền trong hệ thống đều có một chứng từ đối chiếu được, không có khoản nào "đã trả"
chỉ vì owner nói thế.

**Vì sao chốt lại chi phí đòi mọi khoản phải `unpaid`:** một ảnh có thể đang treo cho bốn
trận. Sửa tiền của một trận sẽ làm ảnh đó không còn khớp với bất kỳ tổng nào — và người đã
trả thì không nên thấy con số đổi sau lưng mình. Bắt owner từ chối trước là một thao tác
thừa hiếm khi xảy ra, đổi lấy việc không bao giờ có ảnh 500k nằm cạnh dòng nợ 620k.

## 8. API

Module `matches` (hai controller) và module `payments`, theo đúng pattern của
`organizations`: `@UseGuards(JwtAuthGuard)`, `userId` lấy từ access token, trả envelope
object chứ không trả mảng trần.

### Lịch và vote

| Route | Quyền |
|---|---|
| `POST /organizations/:orgId/matches` | owner |
| `GET /organizations/:orgId/matches?scope=upcoming\|past&page&pageSize` | member |
| `GET /matches/:id` | member — kèm danh sách vote, `myVote`, `myCharge` |
| `PATCH /matches/:id` | owner, khi chưa `settled` — cũng là API đứng sau thao tác kéo thả dời lịch |
| `DELETE /matches/:id` | owner — chuyển `canceled`, không xoá cứng |
| `POST /matches/:id/vote` · `DELETE /matches/:id/vote` | member |
| `GET /matches/:id/history` | member |

### Chi phí

| Route | Quyền |
|---|---|
| `GET /matches/:id/settlement` | member — chi phí + danh sách chia tiền |
| `POST /matches/:id/settlement` | owner — `{ expenses[], maleRatio }`, tạo hoặc ghi đè |

### Thanh toán

| Route | Quyền |
|---|---|
| `GET /organizations/:orgId/charges/me` | member — khoản của tôi trong tổ chức này, trả dạng nhóm (kèm QR + tổng nợ) |
| `POST /organizations/:orgId/payments` | member — `{ chargeIds[], proofUrl, note? }`, `proofUrl` bắt buộc |
| `GET /organizations/:orgId/payments?status=&userId=` | member: của mình · owner: tất cả |
| `POST /organizations/:orgId/payments/:id/confirm` | owner |
| `POST /organizations/:orgId/payments/:id/reject` | owner — `{ reason }` |
| `DELETE /organizations/:orgId/payments/:id/confirm` | owner — bỏ duyệt |

### Mở rộng sẵn có

`PATCH /organizations/:id` nhận thêm `paymentQrUrl` và `maleRatio`.
Ảnh QR và ảnh chứng từ dùng lại `POST /upload/presign` — thêm hai `UploadFolder`.

## 9. Mã lỗi

Thêm vào `ERROR_CODES`. Quyền owner dùng lại `ORG_004` sẵn có.

| Mã | HTTP | Nội dung |
|---|---|---|
| `MATCH_001` | 404 | Không tìm thấy lịch thi đấu |
| `MATCH_002` | 400 | Thời gian không hợp lệ (kết thúc ≤ bắt đầu, hoặc bắt đầu ở quá khứ) |
| `MATCH_003` | 409 | Trận đã bị huỷ |
| `MATCH_004` | 409 | Trận đã đủ người |
| `MATCH_005` | 409 | Đã hết hạn đăng ký — trận đã bắt đầu |
| `MATCH_006` | 409 | Bạn đã đăng ký một trận khác trùng giờ |
| `MATCH_007` | 409 | Bạn đã đăng ký trận này rồi |
| `MATCH_008` | 409 | Bạn chưa đăng ký trận này |
| `MATCH_009` | 409 | Không huỷ được khi còn dưới 2 giờ nữa là đến giờ chơi |
| `MATCH_010` | 409 | Trận chưa bắt đầu, chưa chốt được chi phí |
| `MATCH_011` | 409 | Đã có người gửi thanh toán, không sửa được chia tiền |
| `MATCH_012` | 400 | Không có người tham gia hoặc tổng chi phí bằng 0 |
| `PAY_001` | 404 | Không tìm thấy lần thanh toán |
| `PAY_002` | 409 | Khoản này đã được gửi thanh toán rồi |
| `PAY_003` | 409 | Lần thanh toán này đã được duyệt |
| `PAY_004` | 400 | Không có khoản nào được chọn |

## 10. Giao diện

### 10.1 Sidebar

```
TỔ CHỨC  (theo tổ chức đang chọn)
  Tổng quan      /orgs/:id
  Lịch thi đấu   /orgs/:id/matches
  Thanh toán     /orgs/:id/payments

  Thông tin cá nhân  /me   ← đứng riêng ở đáy cột, không thuộc nhóm nào
```

Mọi nghiệp vụ đều nằm trong phạm vi MỘT tổ chức, nên nav cũng vậy. `/` giữ nguyên vai trò cũ:
một ngã ba đá thẳng sang `/orgs/<id>` (hoặc màn hình tham gia/tạo tổ chức khi user chưa thuộc
tổ chức nào), không phải một trang có nội dung riêng.

**Cố tình KHÔNG có góc nhìn cá nhân xuyên tổ chức** — không trang chủ gộp, không lịch gộp,
không trang công nợ gộp. Người chơi ở nhiều tổ chức chuyển tổ chức bằng nút chuyển ở sidebar.
Đổi lại, không có màn hình nào phải trả lời "khoản này của tổ chức nào", và không có API nào
phải quét dữ liệu ngoài phạm vi tổ chức người dùng đang đứng.

### 10.2 Bộ lịch — FullCalendar

`@fullcalendar/react` + `daygrid` + `timegrid` + `interaction` (đều là plugin chuẩn, MIT;
chỉ resource/timeline mới cần license). Bọc thành **một** component dùng chung
`components/common/match-calendar.tsx`:

- `headerToolbar={false}` — toolbar mặc định của FullCalendar không thể trông giống shadcn.
  Tự dựng header (nút tháng trước/sau, *Hôm nay*, chuyển tháng/tuần) bằng `Button` sẵn có,
  điều khiển qua `calendarRef.current.getApi()`.
- Map bộ biến `--fc-*` sang token theme trong `globals.css` (`--fc-border-color`,
  `--fc-page-bg-color`, `--fc-today-bg-color`, …) để sáng/tối đi theo `next-themes`, không
  ghi đè bằng selector.
- `locale="vi"`, `firstDay={1}` — tuần bắt đầu thứ Hai.
- `eventContent` tự render chip: giờ · sân · `n/max`, màu theo trạng thái trận.
- Việt Nam không có DST nên không phải xử lý giờ nhảy; vẫn để `timeZone` mặc định local và
  gửi/nhận ISO có offset.

Nạp bằng `next/dynamic` với `ssr: false` — FullCalendar là component chỉ chạy ở client, và
nhờ vậy ~250KB của nó không nằm trong bundle của những trang không có lịch.

### 10.3 Tải ảnh — một component cho mọi chỗ

`components/common/image-upload.tsx` lo cả ba chỗ có ảnh: ảnh đại diện (`shape="circle"`),
mã QR của tổ chức và ảnh chuyển khoản (`shape="square"`). Xem trước ngay từ file vừa chọn,
báo % tiến độ, và **luôn** hỏi xác nhận trước khi xoá — ảnh đã nằm trên S3, gỡ đi là không có
đường hoàn lại.

### 10.4 Trang tổ chức

**`/orgs/[orgId]` — Tổng quan.** Thẻ đầu chạy suốt chiều ngang (tên, vai trò, số thành viên,
ngày vào, **hệ số nam**), rồi hai thẻ cạnh nhau (mã mời · mã QR), rồi bảng thành viên, cuối
cùng là khu rời/xoá tổ chức.

**Ai thấy gì**: member thấy ĐỦ mọi thông tin của tổ chức — tên, hệ số chia tiền, mã mời, mã QR.
Cái họ không có là các nút ĐỔI những thứ đó. Giấu bớt thông tin chỉ khiến họ phải đi hỏi owner
những câu mà màn hình trả lời được, mà cụ thể ở đây:

- **Mã mời**: mời bạn vào nhóm là việc ai trong nhóm cũng làm; bắt qua owner là dựng một nút
  thắt không cần thiết. Bù lại, BẬT/TẮT và xoay mã vẫn chỉ owner làm được — mở cửa chính là
  hành vi duyệt, và đóng cửa giết được mọi liên kết đã phát ra.
- **Mã QR**: member chính là người quét. Trước đây mã chỉ hiện trong hộp thoại thanh toán, tức
  là phải có nợ mới nhìn được — trong khi chuyển trước hoặc chuyển bù là chuyện có thật.
- **Hệ số nam**: HIỂN THỊ ở thẻ đầu (nó quyết định mình đóng bao nhiêu mỗi buổi), SỬA trong hộp
  thoại *Sửa thông tin* của owner. Để một ô số nằm thường trực ngoài trang chỉ mời người ta
  nghịch vào con số đang chi phối tiền của cả nhóm.

**`/orgs/[orgId]/matches` — Quản lý lịch thi đấu.** `MatchCalendar` là giao diện chính,
kèm một nút chuyển sang dạng danh sách (*Sắp tới* / *Đã qua*) cho ai thích đọc bảng.

Owner có thêm:
- **Thêm lịch**: `dateClick` (tháng) hoặc `select` (tuần) → mở dialog tạo với ngày/giờ đã
  điền sẵn theo ô vừa bấm.
- **Kéo thả dời lịch**: `editable={true}`, `eventDrop` và `eventResize` → gọi
  `PATCH /matches/:id`. Lỗi thì gọi `info.revert()` của FullCalendar để chip nhảy về chỗ
  cũ, kèm toast báo lý do — không để giao diện hiển thị một lịch mà server không có.
- Trận đã `settled` hoặc `canceled` đặt `editable: false` ngay trên event: đã chốt tiền
  rồi thì kéo đổi giờ là vô nghĩa.

Member thấy cùng bộ lịch nhưng `editable={false}`, chip có badge cho biết mình đã vote chưa.

**`/orgs/[orgId]/matches/[matchId]`** — thông tin trận, danh sách người tham gia, nút
Vote/Huỷ (khi bị khoá thì **nói rõ lý do**, không chỉ làm mờ nút), lịch sử vote thu gọn,
khu *Chi phí* (owner) và khu *Khoản của tôi* (số tiền + trạng thái + link sang trang
Thanh toán).

**Màn chốt chi phí** — bảng dòng chi phí thêm/xoá được, cột thành tiền tự tính, ô hệ số
nam, rồi bảng preview từng người kèm dòng "dư X đồng vào quỹ", cuối cùng là nút xác nhận.

**`/orgs/[orgId]/payments`** — ba tab:
- *Khoản của tôi*: thẻ "Bạn đang nợ X", danh sách khoản theo trận (tick chọn, mặc định tick
  hết) → dialog *Thanh toán*: tổng tiền, QR tổ chức, tải ảnh, gửi.
- *Tất cả chứng từ* (member: *Lịch sử của tôi*): các lần đã gửi, kèm ảnh và các trận đã trả.
- *Chờ duyệt* — chỉ owner, và là tab MỞ SẴN với họ: việc cần làm khi vào đây là đối soát
  chứng từ, không phải xem mình nợ gì.

### 10.5 Quy ước sẵn có

zod ở `ui/src/schema`, type suy ra ở `ui/src/types`, hàm gọi API ở `ui/src/api`, dữ liệu
bảng qua React Query như `MembersTable`.

Thêm phụ thuộc: `@fullcalendar/react`, `@fullcalendar/core`, `@fullcalendar/daygrid`,
`@fullcalendar/timegrid`, `@fullcalendar/interaction`. Repo hiện **chưa có thư viện ngày
tháng** — dùng `Intl.DateTimeFormat` cho hiển thị, không kéo thêm date-fns nếu FullCalendar
đã lo phần tính toán lịch.

## 11. Ngoài phạm vi MVP

Góc nhìn cá nhân xuyên tổ chức (trang chủ / lịch / công nợ gộp mọi tổ chức) · danh sách chờ
khi trận đầy · vote hộ / dẫn khách · lịch lặp hàng tuần · nhắc lịch qua thông báo · báo cáo
quỹ theo tháng · chuyển quyền owner · nhiều owner.

## 12. Thứ tự triển khai

1. **Lịch + vote** — migration `Match` / `MatchVote` / `MatchVoteEvent`, CRUD, luật vote,
   `MatchCalendar` (FullCalendar) + trang chi tiết + kéo thả. Chạy được độc lập.
2. **Chốt chi phí** — `MatchExpense` / `MatchCharge`, công thức, màn chốt.
3. **Thanh toán gom** — `Payment`, trang Thanh toán của tổ chức, luồng duyệt.
