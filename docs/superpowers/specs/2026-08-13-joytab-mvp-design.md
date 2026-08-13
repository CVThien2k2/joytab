# Joytab MVP — Design Spec

Ngày: 2026-08-13. Nguồn: [mvp-features.md](../../mvp-features.md), [mvp-badminton-db-design.md](../../mvp-badminton-db-design.md).

Spec này là hợp đồng thiết kế cho bản MVP quản lý nhóm đánh cầu. Chỗ nào lệch hai tài liệu gốc đều được ghi rõ kèm lý do; hai tài liệu đó sẽ được cập nhật lại sau khi spec được duyệt.

## 1. Trạng thái xuất phát

Đã có trong repo:

- Monorepo pnpm + turbo: `api` (NestJS 11, Prisma 7, Postgres 16), `ui` (Next.js 16, React 19, shadcn new-york, TanStack Query, zustand).
- Auth hoàn chỉnh: Google OAuth → cookie `at` (JWT, stateless) + `rt` (opaque, xoay vòng, hash SHA-256 trong DB).
- Hạ tầng dùng chung: envelope `{ success, message, data }`, `ERROR_CODES`, `AppException`, `HttpExceptionFilter`, `JwtAuthGuard`, `AppLogger`, throttler toàn cục.
- Hai bảng: `users`, `refresh_tokens`.

Chưa có: toàn bộ 8 bảng nghiệp vụ và mọi màn hình sau đăng nhập.

## 2. Quyết định thay thế tài liệu gốc

| # | Tài liệu gốc | Quyết định | Lý do |
|---|---|---|---|
| 1 | `event_attendances.status` có `WAITLIST` | **Bỏ hẳn WAITLIST.** Enum còn `GOING`, `NOT_GOING` | Nhóm đủ người thì không vote `GOING` được nữa; ai bỏ vote thì slot trống ra, người khác vote vào. Không có hàng đợi, không có auto-promote |
| 2 | `users` có `google_id`, `name` | Giữ nguyên bảng `users` hiện tại (`provider`, `provider_user_id`, `full_name`) | Code đã chạy; migrate ngược không đem lại gì |
| 3 | Event không cần `template_id` | Thêm `source_template_id` (nullable, `onDelete: SetNull`) + `occurrence_date` | Cron cần khóa chống sinh trùng. Hai cột chỉ dùng cho idempotency, không có logic nghiệp vụ nào đọc ngược về template |
| 4 | Tiền kiểu `bigint` | Dùng `Int` (VND) | Trần 2.147 tỷ/dòng là quá đủ. Tránh `BigInt` của Prisma vốn không `JSON.stringify` được, nếu không phải vá `BigInt.prototype.toJSON` toàn cục |
| 5 | Mời qua email | MVP chỉ làm invite **LINK** | Không kéo thêm mail provider. Cột `type`/`email` vẫn có sẵn để bật EMAIL sau mà không cần migrate |
| 6 | (không nói) | Múi giờ cố định `Asia/Ho_Chi_Minh`, offset `+07:00` | Việt Nam không có DST từ 1975. Dùng hằng số offset thay vì kéo thư viện timezone |
| 7 | (không nói) | Chia tiền lẻ theo largest-remainder | `total / n` hiếm khi chia hết. Xem §6.4 |

## 3. Kiến trúc code

Ba bounded context, mỗi cái một Nest module phẳng theo đúng phong cách `auth` hiện có (`*.controller.ts` / `*.service.ts` / `*.constants.ts` / `*.utils.ts` / `dto/`):

```
api/src/
  organizations/   org + members + invites
  events/          templates + events + attendances + cron sinh event
  billing/         settlements + payments + allocations
  common/          guards/decorators dùng chung (mở rộng cái đang có)
```

Ranh giới ghi: `events` gọi sang `billing` đúng một lần — lúc finalize, qua `SettlementService.createForEvent(tx, ...)` nhận sẵn transaction client. `billing` không bao giờ ghi ngược vào `events`.

Không có domain layer tách rời, không repository pattern. 10 bảng không đủ để trả giá cho lớp trừu tượng đó.

## 4. Data model

Toàn bộ thêm vào [api/prisma/schema.prisma](../../../api/prisma/schema.prisma), giữ phong cách hiện có: uuid PK, `@db.Timestamptz(6)`, `@@map` snake_case, comment `///` tiếng Việt ở chỗ có quyết định thiết kế.

### 4.1 Enum

```prisma
enum MemberRole       { ADMIN MEMBER }
enum MemberStatus     { ACTIVE LEFT }
enum InviteType       { EMAIL LINK }
enum EventStatus      { OPEN COMPLETED CANCELLED }
enum AttendanceStatus { GOING NOT_GOING }
enum PaymentMethod    { CASH BANK_TRANSFER }
enum PaymentStatus    { PENDING CONFIRMED REJECTED }
```

Dùng Prisma enum (khác `users.status` đang là `VarChar`) vì đây là tập đóng nằm giữa mọi nhánh nghiệp vụ — sai một chữ là bug thầm lặng. Đổi lại phải `ALTER TYPE` khi thêm giá trị.

### 4.2 Bảng

| Bảng | Cột chính | Ràng buộc / index |
|---|---|---|
| `organizations` | `name`, `avatar_url?`, `created_by` | — |
| `organization_members` | `organization_id`, `user_id`, `role`, `status`, `joined_at` | `UNIQUE (organization_id, user_id)`; index `(user_id, status)` |
| `organization_invites` | `organization_id`, `type`, `email?`, `token_hash`, `expires_at?`, `max_uses?`, `used_count`, `revoked_at?`, `created_by` | `token_hash` UNIQUE; index `(organization_id, revoked_at)` |
| `event_templates` | `organization_id`, `name`, `day_of_week` (1–7), `start_time`/`end_time` (`@db.Time`), `location_*`, `court_cost`, `max_participants`, `vote_lock_minutes_before`, `active`, `created_by` | index `(organization_id, active)` |
| `events` | `organization_id`, `title`, `start_at`, `end_at`, `location_*`, `court_cost`, `extra_costs` (Json, default `[]`), `max_participants`, `vote_locked_at`, `status`, `source_template_id?`, `occurrence_date?`, `created_by`, `completed_at?`, `cancelled_at?` | `UNIQUE (source_template_id, occurrence_date)`; index `(organization_id, start_at)` |
| `event_attendances` | `event_id`, `user_id`, `status`, `attended?` | `UNIQUE (event_id, user_id)`; index `(event_id, status)` |
| `event_settlements` | `event_id`, `user_id`, `amount`, `paid_amount` | `UNIQUE (event_id, user_id)`; index `(user_id)` |
| `payments` | `organization_id`, `user_id`, `amount`, `method`, `status`, `note?`, `created_by`, `confirmed_by?`, `confirmed_at?` | index `(organization_id, status)`, `(user_id, status)` |
| `payment_allocations` | `payment_id`, `settlement_id`, `amount` | `UNIQUE (payment_id, settlement_id)` |

Không soft-delete ở bảng mới. Rời nhóm dùng `organization_members.status = LEFT`.

### 4.3 Không lưu trạng thái dẫn xuất

Không có `is_full`, `is_locked`, `debt_status`. Tính lúc đọc:

```
is_full   = COUNT(attendance WHERE status = GOING) >= max_participants
is_locked = now >= vote_locked_at OR now >= start_at OR status != OPEN
debt      = paid_amount == 0 ? UNPAID : paid_amount < amount ? PARTIAL : PAID
```

`event_settlements.paid_amount` là ngoại lệ có chủ ý: nó là dữ liệu dẫn xuất nhưng được lưu, vì màn công nợ đọc nhiều hơn ghi rất nhiều. Rủi ro lệch được chốt bằng **bất biến: `paid_amount` chỉ đổi bên trong transaction đổi trạng thái payment, không có đường ghi nào khác**, cộng một test đối chiếu tổng allocation của payment `CONFIRMED`.

### 4.4 `extra_costs`

```json
[{ "name": "Cầu", "amount": 120000 }, { "name": "Nước", "amount": 30000 }]
```

Validate ở DTO (`name` không rỗng, `amount` là số nguyên ≥ 0). Ghi đè cả mảng khi cập nhật, không patch từng phần tử.

## 5. Phân quyền

Thêm vào `common/`:

- `OrgMemberGuard` — đọc `:orgId` từ route param, tra `organization_members` (`status = ACTIVE`), gắn `request.membership = { organizationId, role }`. Không thấy → `ORG_002` (403, không phải 404 — đã xác thực rồi, che giấu sự tồn tại của org không đem lại gì).
- `@OrgRoles(MemberRole.ADMIN)` — decorator metadata; guard đọc và đối chiếu `membership.role`.
- `@CurrentUser()` / `@CurrentMembership()` — param decorator, thay cho việc bới `request.userId` thủ công.

Route lồng trong org đều đi qua `JwtAuthGuard` → `OrgMemberGuard`. Route thao tác trên `:eventId` / `:paymentId` (không có `:orgId` trên URL) tự nạp bản ghi rồi kiểm tra membership trong service — guard không đoán được org từ id lồng nhau.

Bất biến: **một tổ chức luôn còn ít nhất một ADMIN đang ACTIVE.** Chặn ở cả ba đường: rời nhóm, hạ quyền, xóa thành viên.

## 6. Quy tắc nghiệp vụ

### 6.1 Invite link

Tạo: sinh 32 byte random → token thô trả về **đúng một lần** trong response (dựng thành URL `{FRONTEND_ORIGIN}/invite/{token}`), DB chỉ lưu SHA-256 — cùng cách `refresh_tokens` đang làm.

Còn hiệu lực khi `revoked_at IS NULL AND (expires_at IS NULL OR now < expires_at) AND (max_uses IS NULL OR used_count < max_uses)`.

Accept chạy trong transaction, khóa row invite (`FOR UPDATE`) để `used_count` không vượt `max_uses` khi nhiều người bấm cùng lúc:

1. Khóa + kiểm tra hiệu lực.
2. Đã là member `ACTIVE` → trả về org luôn, **không** tăng `used_count` (bấm lại link không đốt lượt).
3. Từng `LEFT` → bật lại `ACTIVE`, giữ nguyên row cũ.
4. Chưa từng có → tạo membership `MEMBER` / `ACTIVE`.
5. Tăng `used_count` ở bước 3 và 4.

### 6.2 Sinh event từ template

`@nestjs/schedule` (dependency mới), chạy `0 1 * * *` giờ VN. Mỗi lần chạy: với mọi template `active`, sinh các buổi trong cửa sổ **14 ngày tới**.

- `occurrence_date` = các ngày trong cửa sổ có `day_of_week` khớp.
- `start_at` = `occurrence_date` + `start_time` diễn giải ở `+07:00` rồi đổi sang UTC. `end_at` tương tự; nếu `end_time <= start_time` thì hiểu là qua nửa đêm, cộng một ngày.
- `vote_locked_at` = `start_at - vote_lock_minutes_before` phút.
- Mọi trường còn lại copy từ template — event sinh xong sống độc lập, sửa template không ảnh hưởng trận đã sinh.
- Idempotent bằng `createMany({ skipDuplicates: true })` dựa trên `UNIQUE (source_template_id, occurrence_date)`. Chạy lại bao nhiêu lần cũng không đẻ trùng.
- Có thêm `POST /organizations/:orgId/templates/:id/generate` (ADMIN) để sinh bù thủ công, dùng chung đúng hàm đó.

Chạy nhiều instance API sẽ chạy cron nhiều lần — vô hại nhờ `skipDuplicates`.

### 6.3 Vote và giới hạn slot

`PUT /events/:eventId/attendance` với `{ status: GOING | NOT_GOING }`.

Chạy trong `$transaction`, mở đầu bằng `SELECT id FROM events WHERE id = $1 FOR UPDATE` — khóa hàng event để mọi thao tác vote của cùng một trận được xếp hàng. Đây là chỗ duy nhất chống được việc hai người cùng giành slot cuối; đếm rồi mới ghi mà không khóa thì chắc chắn vượt `max_participants`.

Trong khóa:

1. Event phải `OPEN`, chưa khóa vote (`now < vote_locked_at AND now < start_at`) — sai thì `EVENT_LOCKED`.
2. Nếu chuyển sang `GOING`: đếm `GOING` hiện tại (trừ chính mình nếu đã `GOING`); `>= max_participants` → `EVENT_FULL`.
3. Upsert theo `(event_id, user_id)`.

Chuyển `GOING → NOT_GOING` luôn được phép (khi chưa khóa) và slot trống ra ngay, người khác vote vào được. Không có hàng đợi, không auto-promote.

Admin sửa attendance của người khác: `PUT /events/:eventId/attendances/:userId` — bỏ qua kiểm tra khóa vote, vẫn tôn trọng `max_participants`, chỉ dùng được khi event còn `OPEN`.

Xác nhận thực tế tham gia: `PATCH /events/:eventId/attendances` nhận `[{ userId, attended }]`, ADMIN, chỉ khi event `OPEN`.

### 6.4 Finalize và chia tiền

`POST /events/:eventId/finalize` (ADMIN), transaction:

1. Event phải `OPEN`, không thì `EVENT_NOT_OPEN`.
2. Người chịu tiền = attendance có `attended = true`. Rỗng → `EVENT_NO_ATTENDEE` (không tạo trận nợ 0 người).
3. `total = court_cost + SUM(extra_costs[].amount)`.
4. Chia: `base = floor(total / n)`, `remainder = total % n`. `remainder` người đầu tiên (sắp theo `attendances.created_at`, rồi `user_id` để tất định) trả `base + 1`. Tổng settlement luôn khớp `total` tuyệt đối — không làm tròn nghìn, không để dư đồng nào.
5. Tạo `event_settlements` với `paid_amount = 0`.
6. `status = COMPLETED`, `completed_at = now`.

Mở lại: `POST /events/:eventId/reopen` (ADMIN) — chỉ khi **mọi** settlement của trận còn `paid_amount = 0`. Xóa settlement, về `OPEN`. Có nó vì admin gõ nhầm chi phí là chuyện thường, không có thì trận hỏng vĩnh viễn.

Hủy: `POST /events/:eventId/cancel` (ADMIN) — chỉ từ `OPEN`.

### 6.5 Payment và phân bổ

Tạo: `POST /organizations/:orgId/payments`

```
{ userId?, amount, method, note?, allocations?: [{ settlementId, amount }] }
```

- `userId` chỉ ADMIN được truyền (thu tiền hộ); MEMBER luôn là chính mình.
- Bỏ trống `allocations` → tự phân bổ **nợ cũ trước** (settlement của user trong org đó, `paid_amount < amount`, sắp theo `event.start_at` tăng dần), đổ đầy từng khoản tới khi hết tiền.
- MEMBER tạo → `PENDING`. ADMIN tạo → `CONFIRMED` ngay trong cùng transaction (tiền mặt tại sân).

Validate (áp dụng cho cả lúc tạo lẫn lúc confirm):

- `SUM(allocations.amount) == payment.amount` — không cho tiền treo lơ lửng.
- Mọi settlement phải thuộc đúng `user_id` của payment và đúng org.
- Với mỗi settlement: `allocation.amount <= amount - paid_amount` — không cho trả dư.

Duyệt: `POST /payments/:id/confirm` (ADMIN) — transaction: `PENDING → CONFIRMED`, khóa các settlement liên quan (`FOR UPDATE`), validate lại rồi `paid_amount += allocation.amount`. Validate lại là bắt buộc: giữa lúc tạo và lúc duyệt có thể đã có payment khác trả cùng khoản nợ đó.

Từ chối: `POST /payments/:id/reject` (ADMIN) — `PENDING → REJECTED`, không đụng `paid_amount`.

Chỉ allocation của payment `CONFIRMED` mới được tính. `REJECTED` giữ nguyên allocation để làm dấu vết, không cộng vào đâu cả.

## 7. API surface

Không có version prefix, khớp với `/auth/*` đang có. Mọi response đi qua envelope chuẩn.

**Organizations**

```
POST   /organizations                          tạo (người tạo thành ADMIN)
GET    /organizations                          org tôi đang tham gia (ACTIVE)
GET    /organizations/:orgId                   chi tiết + role của tôi
PATCH  /organizations/:orgId                   ADMIN
GET    /organizations/:orgId/members
PATCH  /organizations/:orgId/members/:userId   ADMIN — đổi role
DELETE /organizations/:orgId/members/:userId   ADMIN — kick (LEFT)
POST   /organizations/:orgId/leave             tự rời
```

**Invites**

```
POST   /organizations/:orgId/invites           ADMIN — trả token thô 1 lần
GET    /organizations/:orgId/invites           ADMIN
DELETE /organizations/:orgId/invites/:id       ADMIN — revoke
GET    /invites/:token                         public — preview tên org + tính hiệu lực
POST   /invites/:token/accept                  auth
```

**Templates**

```
POST   /organizations/:orgId/templates             ADMIN
GET    /organizations/:orgId/templates
PATCH  /organizations/:orgId/templates/:id         ADMIN
DELETE /organizations/:orgId/templates/:id         ADMIN
POST   /organizations/:orgId/templates/:id/generate ADMIN — sinh bù
```

**Events**

```
POST   /organizations/:orgId/events            ADMIN — tạo lẻ
GET    /organizations/:orgId/events            ?status=&from=&to= , phân trang
GET    /events/:eventId                        chi tiết + attendances + vote của tôi + is_full/is_locked
PATCH  /events/:eventId                        ADMIN
POST   /events/:eventId/cancel                 ADMIN
PUT    /events/:eventId/attendance             vote của chính mình
PUT    /events/:eventId/attendances/:userId    ADMIN
PATCH  /events/:eventId/attendances            ADMIN — chấm attended hàng loạt
POST   /events/:eventId/finalize               ADMIN
POST   /events/:eventId/reopen                 ADMIN
```

**Billing**

```
GET    /organizations/:orgId/debts/me          công nợ của tôi + tổng
GET    /organizations/:orgId/debts             ADMIN — theo từng thành viên
POST   /organizations/:orgId/payments
GET    /organizations/:orgId/payments          ?status= ; MEMBER chỉ thấy của mình
GET    /payments/:paymentId
POST   /payments/:paymentId/confirm            ADMIN
POST   /payments/:paymentId/reject             ADMIN
```

### Mã lỗi mới

Thêm vào [error-codes.constant.ts](../../../api/src/common/constants/error-codes.constant.ts), giữ nguyên quy ước `code` là hợp đồng ổn định với FE:

```
ORG_001 404 Organization not found
ORG_002 403 Not a member of this organization
ORG_003 403 Admin role required
ORG_004 409 Organization must keep at least one admin
ORG_005 409 Already a member

INV_001 404 Invite not found
INV_002 410 Invite expired, revoked or used up

EVT_001 404 Event not found
EVT_002 409 Event is full
EVT_003 409 Voting is locked for this event
EVT_004 409 Event is not open
EVT_005 409 Event has no confirmed attendee
EVT_006 409 Event cannot be reopened after any payment
TPL_001 404 Event template not found

PAY_001 404 Payment not found
PAY_002 409 Payment is not pending
PAY_003 400 Allocations do not match payment amount
PAY_004 409 Allocation exceeds remaining debt
SET_001 404 Settlement not found
```

## 8. Frontend

Next.js App Router, mọi màn hình nghiệp vụ nằm trong `(private)`. Bám shadcn/ui Blocks (new-york, đúng `components.json` hiện có) làm sườn layout, không tự chế design system.

**Cấu trúc file** (theo quy ước đang dùng trong repo): schema zod → `src/schema`, type suy ra → `src/types`, hàm gọi API → `src/api`, hook TanStack Query → `src/hooks`, component dùng riêng cho một route → `_components` cạnh route đó.

**Routes**

```
(private)/
  page.tsx                          danh sách tổ chức của tôi + nút tạo
  orgs/new/
  orgs/[orgId]/
    page.tsx                        trận sắp tới + công nợ của tôi
    events/                         danh sách trận
    events/[eventId]/               chi tiết + vote + chấm attended + finalize
    templates/                      ADMIN — lịch định kỳ
    members/                        ADMIN — thành viên + invite link
    debts/                          công nợ của tôi
    payments/                       ADMIN — hàng đợi duyệt
(public)/
  invite/[token]/                   preview + nút tham gia (chưa login → đẩy sang Google)
```

**Shell**: block `sidebar-07` (sidebar thu gọn + breadcrumb), org switcher ở đầu sidebar. Menu ẩn/hiện theo `role` trả về từ `GET /organizations/:orgId`.

**Component shadcn cần thêm**: `sidebar`, `breadcrumb`, `table`, `badge`, `tabs`, `dropdown-menu`, `form`, `alert-dialog`, `skeleton`, `sheet`, `popover`, `calendar`, `tooltip`, `switch`, `textarea`, `radio-group`.

**Quy ước dữ liệu**

- Mọi response parse qua zod với `envelope(...)` đã có, không tin kiểu trả về.
- Query key: `['orgs']`, `['org', orgId]`, `['events', orgId, filters]`, `['event', eventId]`, `['debts', orgId, 'me']`, `['payments', orgId, filters]`.
- Mutation vote dùng optimistic update rồi `invalidate ['event', eventId]` — vote là thao tác bấm nhiều nhất, phải phản hồi tức thì.
- Lỗi hiển thị theo `code` chứ không theo `message`: `EVT_002` → "Trận đã đủ người", `EVT_003` → "Đã khóa vote".
- Tiền format `Intl.NumberFormat('vi-VN')`; ngày giờ format ở `Asia/Ho_Chi_Minh`.

## 9. Testing

Test theo rủi ro, không phủ đều. Jest đã cấu hình sẵn (`api/jest.config.js`, `rootDir: src`, `*.spec.ts`).

**Unit — hàm thuần, không DB** (giá trị cao nhất trên mỗi dòng test):

- Chia tiền largest-remainder: chia hết, có dư, 1 người, số tiền lẻ. Bất biến kiểm mọi ca: `SUM(settlements) === total`.
- Sinh occurrence từ template: đúng `day_of_week`, đổi `+07:00` → UTC đúng, ca qua nửa đêm, `vote_locked_at` đúng.
- Vị từ hiệu lực invite và vị từ khóa vote — bảng ca biên quanh mốc thời gian.
- Tự phân bổ payment nợ-cũ-trước: đủ tiền, thiếu tiền, thừa tiền.

**Integration — Postgres thật** (`docker-compose.yml` đã có sẵn), chỉ cho chỗ mà mock không chứng minh được gì:

- Vote đồng thời ở slot cuối: bắn N request song song vào trận còn 1 chỗ → đúng 1 thành công, `COUNT(GOING)` không bao giờ vượt `max_participants`.
- Accept invite đồng thời khi `max_uses` còn 1 lượt.
- Finalize hai lần đồng thời → chỉ một lần tạo settlement.
- Confirm payment: `paid_amount` khớp tổng allocation; confirm lần hai bị chặn; đối chiếu bất biến `paid_amount === SUM(allocation của payment CONFIRMED)`.

**Không test**: CRUD thuần, mapping DTO, component UI.

## 10. Lát cắt triển khai

Bốn lát dọc, mỗi lát chạy được end-to-end và demo được.

| Lát | Backend | Frontend | Demo được |
|---|---|---|---|
| 1 | Migration đủ 8 bảng + enum; module `organizations`; `OrgMemberGuard`/`@OrgRoles`; invite link | App shell + org switcher, danh sách/tạo org, màn thành viên, màn invite, trang `/invite/[token]` | Tạo nhóm, gửi link, người khác join, rời nhóm |
| 2 | Module `events`: template CRUD, cron sinh event, tạo/sửa/hủy trận, list + detail | Màn lịch định kỳ, danh sách trận, chi tiết trận (chưa vote) | Admin đặt lịch tối thứ 5, hệ thống tự sinh trận |
| 3 | Vote + khóa slot có `FOR UPDATE`, khóa vote theo thời gian, admin sửa attendance, chấm `attended` | Nút vote + đếm slot realtime, danh sách người đi, màn chấm công | Member vote, trận full chặn vote, tới giờ khóa |
| 4 | Module `billing`: finalize + settlement, payment + allocation, confirm/reject, API công nợ | Màn finalize (nhập chi phí, xem trước chia tiền), màn công nợ, màn duyệt thanh toán | Chia tiền, member báo trả, admin duyệt |

Migration gộp một lần ở lát 1 thay vì rải bốn lần: schema đã chốt sẵn, chia nhỏ chỉ đẻ thêm file migration mà không giảm rủi ro gì.

## 11. Việc kèm theo

- Cập nhật `docs/mvp-features.md` và `docs/mvp-badminton-db-design.md` cho khớp 7 quyết định ở §2 — để tài liệu gốc không còn mâu thuẫn với code.
- Thêm dependency: `@nestjs/schedule` (api). Không thêm thư viện timezone.
- Biến môi trường mới: không có. `FRONTEND_ORIGIN` đã tồn tại và đủ dùng để dựng link invite.
