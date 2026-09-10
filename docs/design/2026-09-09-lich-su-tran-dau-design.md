# Thiết kế — Ẩn trận đã kết thúc khỏi lịch, thêm trang Lịch sử đấu

Ngày chốt: 2026-09-09 · Phạm vi: `api/src/matches` (NestJS + Prisma) và
`ui/src/app/(private)/orgs/[orgId]` (Next.js App Router)

## 1. Bài toán

Trang `/orgs/[orgId]/matches` đang hiện MỌI trận trong kỳ đang xem (tháng/tuần/ngày), kể cả trận
đã qua giờ kết thúc — muốn biết mình từng tham gia trận nào, đã trả tiền chưa, người dùng phải
tự lùi lịch dò từng tuần.

Tách thành hai việc, hai nơi:

1. **Trang Lịch thi đấu** (`/orgs/[orgId]/matches`, giữ nguyên cấu trúc) — chỉ còn việc SẮP TỚI:
   ẩn mọi trận đã kết thúc.
2. **Trang Lịch sử đấu** (`/orgs/[orgId]/history`, mới, một mục nav riêng ở sidebar) — mọi thành
   viên xem được. **Danh sách thẻ, mỗi trận một thẻ**, cuộn tới đáy thì tải thêm. Lọc theo
   **khoảng ngày**, **trạng thái trận** và **trạng thái thanh toán**. Mỗi thẻ nói rõ mình có
   tham gia hay không và đã trả tiền chưa.

## 2. Những quyết định đã chốt

| Vấn đề | Chốt | Vì sao |
|---|---|---|
| Lịch sử nằm ở đâu | **Route riêng** `/orgs/[orgId]/history` + một mục nav ở sidebar, KHÔNG phải tab của trang lịch | Lịch phải vừa một khung nhìn (lưới cao cố định, cuộn bên trong), còn lịch sử là danh sách cuộn dài không giới hạn — nhét chung một trang thì một trong hai luôn phải nhường cách cuộn của nó. Nav riêng cũng là một đích tới thẳng, không phải "vào lịch rồi bấm thêm một lần" |
| Cách hiện lịch sử | **Danh sách thẻ + cuộn vô hạn**, không phải bảng có phân trang | Cùng một thứ với agenda trên mobile đang hiện: mỗi buổi một thẻ, đọc được ngay trên màn hẹp. Bảng thì phải chọn cột nào bỏ đi ở 360px, còn số trang thì bắt người ta bấm để đọc tiếp cái vốn chỉ cần cuộn |
| Phân trang | **Cursor keyset** trên `(start_at desc, id desc)`, không phải `page`/`pageSize` | Cuộn vô hạn cộng offset là hỏng khi dữ liệu chèn thêm giữa lúc cuộn: owner chốt tiền một trận là nó nhảy lên đầu, mọi trang sau trôi một dòng và người đang cuộn thấy một thẻ lặp lại |
| Lọc theo ngày | **Chép bộ lọc khoảng ngày của hub** (`components/stats/date-range-filter`): một `Popover` + `Calendar` chọn cả hai đầu trong một lần mở | Chủ dự án chỉ thẳng sang bộ lọc đó. Kéo theo `react-day-picker` + hai component `popover`/`calendar` (repo chưa có) — đổi lại được đúng UX đã dùng ở dự án bên kia, thay vì hai ô `<input type="date">` hiện theo locale của trình duyệt (mm/dd/yyyy trên máy en-US) |
| Trận nào thuộc "lịch sử" | `status ∈ {settled, canceled}` | Trận `open` dù đã qua giờ nhưng chưa chốt tiền vẫn là việc đang treo, chưa phải chuyện đã xong |
| Trận nào coi là "đã kết thúc" (ẩn khỏi trang lịch) | `end_at <= now`, tức `matchPhase(...) === "ended"` | Hàm này đã có sẵn (`ui/src/lib/match-phase.ts:63-67`), đúng biên nửa mở `[start_at, end_at)` |
| Filter thanh toán với trận KHÔNG tham gia | Ẩn khỏi kết quả khi có lọc `paid`/`unpaid` — không có lựa chọn "n/a" | Trận không tham gia thì `myPaymentStatus = null` (không có row `MatchCharge`), không khớp `paid` cũng không khớp `unpaid` |
| Kiểu UI của hai filter trạng thái | Dropdown multi-select (`DropdownMenuCheckboxItem`) + badge đếm số đã chọn + nút "Xoá filter" | Theo đúng pattern `users-table-filters.tsx` bên `hub` (route `/admin/users`) mà chủ dự án tham khảo |
| Ai xem được trang Lịch sử | Mọi thành viên (`requireMembership`), không riêng owner | Đúng yêu cầu "tất cả user đều xem được" — khớp mức quyền các route đọc trận hiện có (`detail`, `history`, `settlement`) |

## 3. Không đổi mô hình dữ liệu

Mọi field cần thiết đã có sẵn trên `Match`/`MatchCharge`/`MatchSummary` — **không thêm cột,
không migration**:

- `status` (`'open' | 'settled' | 'canceled'`) — lọc trạng thái.
- `voted` (suy từ `MatchVote`) — có tham gia hay không.
- `myPaymentStatus` (`'paid' | 'unpaid' | null`, suy từ `MatchCharge` của chính user) — `null`
  khi không tham gia, vì không có row charge nào.

Index `@@index([organization_id, start_at])` đang có trên `matches` cũng chính là index mà truy
vấn keyset dưới đây cần — không thêm index mới.

## 4. Ẩn trận đã kết thúc khỏi trang Lịch thi đấu

Chỉ sửa FE. Thêm điều kiện lọc cạnh lọc `canceled` đã có ở `matches/page.tsx`:

```tsx
const visibleMatches = useMemo(
  () =>
    (matches ?? []).filter(
      (match) => match.status !== "canceled" && matchPhase(match, now) !== "ended",
    ),
  [matches, now],
)
```

Không đổi API call (vẫn theo `range` của kỳ đang xem) — chỉ lọc thêm ở client trước khi đưa vào
`MatchCalendar`/`MatchAgenda`.

Hệ quả chấp nhận được: lùi lịch về tuần/tháng trước sẽ thấy lưới trống — những trận đó giờ nằm
ở trang Lịch sử đấu, không còn là việc của trang này.

## 5. Backend — route mới `GET /organizations/:organizationId/matches/history`

Tách route riêng thay vì nhồi filter vào `GET /organizations/:organizationId/matches` hiện có:
route đó phục vụ bộ lịch (khoảng ngày có trần `MATCH_RANGE_MAX_DAYS = 92` ngày, không phân
trang, trả cả trận `canceled` để vẽ mờ). Lịch sử thì ngược lại — không giới hạn thời gian, cuộn
theo cursor, mới nhất trước. Hai hợp đồng khác nhau, gộp lại là nhồi thêm nhánh if/else vào chỗ
đang đơn giản.

### 5.1 Hằng số (`matches.constants.ts`)

```ts
/** Một lô lịch sử. 20 đủ phủ hết màn hình cao nhất mà vẫn là một request nhỏ. */
export const MATCH_HISTORY_DEFAULT_LIMIT = 20;
export const MATCH_HISTORY_MAX_LIMIT = 50;

/** Hai trạng thái tạo nên lịch sử: đã chốt tiền, hoặc đã huỷ. */
export const MATCH_HISTORY_STATUSES = ['settled', 'canceled'] as const;

/** Mốc cuộn: "<start_at ISO>|<match id>". BE sinh, FE gửi lại nguyên văn. */
export const MATCH_HISTORY_CURSOR_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\|[0-9a-f]{8}-…$/;
```

### 5.2 DTO — `MatchHistoryQueryDto` (`matches.dto.ts`)

`from`/`to` (ISO 8601, biên nửa mở, không gửi = cả quá khứ và không có trần ngày),
`status[]` (mặc định cả hai giá trị của `MATCH_HISTORY_STATUSES`), `paymentStatus[]`
(`CHARGE_PAYMENT_STATUSES`), `limit`, `cursor`.

Hai field mảng đi qua `@Transform(toArrayOrUndefined)`: `?status=a&status=b` thì Express đã gom
sẵn mảng, nhưng gửi đúng MỘT giá trị thì nó là chuỗi trần — mà `@IsIn({ each: true })` trên
chuỗi lại xét từng KÝ TỰ.

`cursor` chốt shape bằng `@Matches(MATCH_HISTORY_CURSOR_REGEX)`, nên sai shape là 400 của
ValidationPipe chứ không phải một `new Date(NaN)` lọt xuống câu query.

### 5.3 Service — `listHistoryForOrganization` (`matches.service.ts`)

```ts
const cursor = this.decodeHistoryCursor(query.cursor);
const rows = await this.databaseService.match.findMany({
  where: {
    organization_id: organizationId,
    status: { in: query.status ?? [...MATCH_HISTORY_STATUSES] },
    ...(query.from || query.to
      ? { start_at: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lt: new Date(query.to) } : {}) } }
      : {}),
    // Khoản của CHÍNH người hỏi (@@unique([match_id, user_id]) nên `some` là chính xác).
    ...(query.paymentStatus
      ? { charges: { some: { user_id: userId, payment_status: { in: query.paymentStatus } } } }
      : {}),
    // Keyset: phần nằm SAU mốc cuộn theo đúng thứ tự sắp ở dưới.
    ...(cursor
      ? { OR: [{ start_at: { lt: cursor.startAt } }, { start_at: cursor.startAt, id: { lt: cursor.id } }] }
      : {}),
  },
  orderBy: [{ start_at: 'desc' }, { id: 'desc' }],
  // Lấy THỪA một dòng để biết còn nữa hay không — rẻ hơn một query count.
  take: query.limit + 1,
  include: this.summaryInclude(userId),
});
```

Trả `{ matches, nextCursor }`, `nextCursor = null` là đã hết.

Tái dùng nguyên `summaryInclude`/`toSummary` đã có — mỗi thẻ vẫn có `voted`/`myPaymentStatus` để
hiện badge, không viết lại logic đó lần hai. `id` là tie-breaker: hai trận cùng giờ bắt đầu mà
thứ tự không cố định thì giữa hai lô sẽ có thẻ hiện hai lần hoặc mất hẳn.

## 6. Frontend

### 6.1 Schema + API client

- `ui/src/schema/match.ts`: `matchHistoryPageResponseSchema` = envelope của
  `{ matches: MatchSummary[]; nextCursor: string | null }`. Không dùng `paginationSchema`: cuộn
  vô hạn không có số trang lẫn tổng số dòng để hiện.
- `ui/src/api/matches.ts`: `fetchOrganizationMatchHistory({ organizationId, filters, cursor })` —
  tên khác hẳn `fetchMatchHistory` (lịch sử vote/huỷ của MỘT trận) để không đụng nhau. Query
  dựng bằng `URLSearchParams` với key LẶP (`status=a&status=b`) chứ không đưa mảng cho axios:
  axios serialize thành `status[]=…`, mà cặp ngoặc đó chỉ gom lại thành mảng nếu BE dùng query
  parser `extended`.

### 6.2 Hook — `useOrganizationMatchHistory`

`useInfiniteQuery` (react-query v5 nên bắt buộc có `initialPageParam`), `getNextPageParam` đọc
`nextCursor`, `staleTime` 30s.

Khoá cache LỒNG dưới `matchQueryKeys.organization(organizationId)`: cả `invalidateMatchData`
lẫn mutation thanh toán (`use-payments-api.ts`) đều đang invalidate đúng tiền tố đó, nên chốt
tiền hay trả tiền xong là danh sách lịch sử tự mới lại — không phải thêm khoá vào hai chỗ và có
ngày quên một chỗ. Bộ lọc nằm TRONG queryKey, nên đổi filter là tự bắt đầu lại từ lô đầu.

### 6.3 Điều hướng

- `app-sidebar.tsx`: thêm `{ segment: "history", label: "Lịch sử đấu", icon: History }` ngay sau
  Lịch thi đấu, `ownerOnly: false`.
- `use-breadcrumb.ts`: thêm `history: "Lịch sử đấu"` vào `ORGANIZATION_LABELS`.
- Segment ĐỨNG RIÊNG (`/orgs/:id/history`) chứ không lồng dưới `matches`: nav so bằng
  `pathname.startsWith(href)`, nên `/orgs/:id/matches/history` sẽ làm sáng cùng lúc hai mục.

### 6.4 Trang + danh sách thẻ + cuộn vô hạn

- `history/page.tsx`: khung `mx-auto w-full max-w-7xl` như trang Thanh toán, không tiêu đề riêng
  (breadcrumb đã nói tên trang).
- `history/_components/match-history-list.tsx`:
  - Giữ state filter cục bộ, đổi ngày/trạng thái/thanh toán đều đi qua `MatchHistoryFilters`.
  - **Sentinel cuộn**: một `<div>` rỗng ở cuối danh sách + `IntersectionObserver`
    (`rootMargin: 200px`) gọi `fetchNextPage()`. `pageCount` nằm trong deps của effect để
    observer được dựng lại sau mỗi lô: lô ngắn hơn màn hình thì cái mốc vẫn nằm trong khung
    nhìn, mà đứng yên trong khung nhìn thì không sinh thêm sự kiện intersect nào nữa.
  - Bốn trạng thái hiển thị: lô đầu đang tải (spinner), rỗng (chưa lọc / đang lọc là hai câu
    khác nhau), đang tải lô sau (spinner nhỏ ở đáy), và đã hết (mốc cuộn biến mất, không hiện
    dòng "đã hết" nào).

### 6.5 Thanh lọc

- **Khoảng ngày** — chép từ hub: `Popover` + `Calendar mode="range"`, chỉ ghi ra ngoài khi đã
  chọn đủ hai đầu (khoảng dở dang giữ ở state `draft`, đóng lịch là bỏ). Khác hub hai chỗ, và
  đều vì chỗ dùng khác: nguồn sự thật là state của trang chứ không phải URL (ba bộ lọc phải
  cùng một nguồn), và KHÔNG chặn ngày tương lai (một buổi đã huỷ có thể nằm ở tương lai). Chưa
  lọc thì nút hiện "Mọi thời điểm". `numberOfMonths` là 1 trên mobile — hai tháng cạnh nhau
  ~560px, tràn khỏi màn 360px.
- FE quy `to` về **0h ngày HÔM SAU** ngày người dùng chọn trước khi gửi (biên `[from, to)`),
  nếu không thì chọn "đến 30/8" sẽ cắt mất chính các buổi trong ngày 30/8.
- **Trạng thái** / **Thanh toán**: `DropdownMenu` + `DropdownMenuCheckboxItem`, `Badge` đếm số
  đã chọn trên trigger, `onSelect` bị chặn ở từng ô để menu không đóng sau mỗi lần tick.
- **Xoá filter**: `Button` viền đứt màu destructive, chỉ hiện khi có filter đang bật.

### 6.6 Component thêm mới / tách ra

- `components/common/match-card.tsx` — tách từ `match-agenda.tsx` (vạch màu giai đoạn, giờ, tên
  sân, `MatchStatusBadge`, sĩ số, badge Tham gia/Không tham gia, badge Đã trả/Chưa trả, mũi chỉ).
  Prop `showDate`: agenda gộp theo ngày nên thẻ ở đó chỉ cần GIỜ; lịch sử là danh sách phẳng
  trải nhiều tháng nên thẻ tự mang NGÀY.
- `components/ui/popover.tsx` + `components/ui/calendar.tsx` — chép từ `hub/packages/ui`, đổi
  import path. Thêm phụ thuộc `react-day-picker@^10`. Popover dùng chung package `radix-ui` đã
  có, không thêm dep.

## 7. Kiểm thử

- BE (`api/test/e2e/matches.e2e-spec.ts`, describe "Lịch sử thi đấu", 8 test, chạy trên Postgres
  thật): mặc định chỉ `settled` + `canceled` và không lẫn `open`; mỗi dòng nói đúng
  `voted`/`myPaymentStatus` (khoản của người khác không lộ thành khoản của mình); lọc trạng
  thái; lọc thanh toán chỉ xét khoản của chính mình; lọc ngày đúng biên nửa mở; cursor nối liền
  không lặp (kể cả hai trận CÙNG `start_at`) và hết thì trả `null`; cursor sai shape bị 400;
  member xem được, người ngoài nhận 404.
- FE: không có test framework cho component trong repo — verify bằng chạy thật trên trình duyệt:
  trận đã kết thúc biến khỏi trang lịch; nav + breadcrumb "Lịch sử đấu"; cuộn tới đáy tải thêm
  lô sau rồi dừng đúng lúc hết; lọc ngày (kể cả chọn một ngày duy nhất, kiểm biên `[from, to)`);
  lọc trạng thái/thanh toán với badge đếm; "Xoá filter" trả lại danh sách đầy đủ.

## 8. Ngoài phạm vi

- Ô tìm kiếm theo tên sân, và các nút chọn nhanh khoảng ngày (30 ngày / 3 tháng) — chưa ai yêu
  cầu, thêm sau nếu cần.
- Tổng số trận / tổng tiền đã đóng trong khoảng đang lọc — là một câu hỏi khác (báo cáo), không
  phải danh sách.
- Đổi hành vi route `GET /organizations/:id/matches` hiện tại — vẫn phục vụ bộ lịch, không đổi.
- Mã lỗi mới — route mới không có nhánh lỗi nghiệp vụ nào ngoài validate chuẩn của
  `ValidationPipe`.
