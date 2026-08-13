# Slice 4 — Finalize, Settlement, Công nợ, Payment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin hoàn tất trận → hệ thống chia tổng chi phí cho những người thực sự có mặt và tạo công nợ. Thành viên xem được mình nợ bao nhiêu, báo đã trả; admin duyệt và số nợ giảm đúng bằng số tiền được duyệt.

**Architecture:** Hai bất biến chi phối cả lát này. **Một:** tổng các settlement của một trận luôn bằng đúng tổng chi phí, không dư một đồng — nên chia tiền là hàm thuần theo largest-remainder, test riêng, không dính DB. **Hai:** `event_settlements.paid_amount` là dữ liệu dẫn xuất được lưu, nên nó chỉ được sửa bên trong transaction đổi trạng thái payment, và không có đường ghi nào khác. Mọi thứ còn lại phục vụ hai bất biến đó.

**Tech Stack:** NestJS 11, Prisma 7 (`$transaction` + `FOR UPDATE`), PostgreSQL 16, Jest. Next.js 16, shadcn/ui, TanStack Query.

**Spec:** [docs/superpowers/specs/2026-08-13-joytab-mvp-design.md](../specs/2026-08-13-joytab-mvp-design.md) — §6.4, §6.5.

**Tiền đề:** Lát 1–3 đã xong. Bảng `event_settlements`, `payments`, `payment_allocations` đã có từ migration lát 1. Lát này KHÔNG có migration mới.

## Global Constraints

Kế thừa Global Constraints của lát [1](./2026-08-13-slice-1-organizations.md), [2](./2026-08-13-slice-2-events.md), [3](./2026-08-13-slice-3-voting.md), cộng thêm:

- Tiền là số nguyên VND. Không làm tròn nghìn, không có số thực ở bất kỳ đâu trong đường tính tiền.
- **Bất biến chia tiền:** `SUM(settlements.amount) === total_cost` tuyệt đối, mọi trường hợp.
- **Bất biến công nợ:** `settlement.paid_amount === SUM(allocations.amount WHERE payment.status = 'CONFIRMED')`.
- `paid_amount` chỉ được ghi bên trong transaction confirm payment. Không có endpoint nào khác chạm vào nó.
- Chỉ payment `CONFIRMED` mới tính. `REJECTED` giữ nguyên allocation làm dấu vết nhưng không cộng vào đâu.

---

## File Structure

**Backend — tạo mới**

| File | Trách nhiệm |
|---|---|
| `api/src/billing/billing.utils.ts` | Hàm thuần: chia tiền, tự phân bổ payment |
| `api/src/billing/billing.utils.spec.ts` | Test hai hàm trên |
| `api/src/billing/settlements.service.ts` | Tạo settlement lúc finalize, đọc công nợ |
| `api/src/billing/payments.service.ts` | Tạo / duyệt / từ chối payment |
| `api/src/billing/payments.service.spec.ts` | Test quy tắc validate allocation |
| `api/src/billing/billing.controller.ts` | Route công nợ và payment |
| `api/src/billing/billing.module.ts` | Wiring |
| `api/src/billing/dto/*.ts` | DTO |
| `api/test/billing.integration.spec.ts` | Test bất biến với Postgres thật |

**Backend — sửa**

`api/src/events/events.service.ts` (thêm `finalize`, `reopen`), `api/src/events/events.controller.ts`, `api/src/events/events.module.ts` (import `BillingModule`), `api/src/common/constants/error-codes.constant.ts`, `api/src/app.module.ts`.

**Frontend — tạo mới**

`ui/src/schema/billing.ts`, `ui/src/types/billing.ts`, `ui/src/api/billing.ts`, `ui/src/hooks/use-billing.ts`, các route `orgs/[orgId]/debts/`, `orgs/[orgId]/payments/`, và component finalize trong màn chi tiết trận.

---

### Task 1: Hàm thuần — chia tiền và tự phân bổ

**Files:**
- Create: `api/src/billing/billing.utils.ts`
- Test: `api/src/billing/billing.utils.spec.ts`

**Interfaces:**
- Produces:
  - `splitCost(total: number, participantIds: string[]): { userId: string; amount: number }[]`
  - `autoAllocate(paymentAmount: number, debts: DebtSlot[]): { settlementId: string; amount: number }[]` với `type DebtSlot = { settlementId: string; remaining: number }`.

- [ ] **Step 1: Viết test trước**

`api/src/billing/billing.utils.spec.ts`:

```typescript
import { autoAllocate, splitCost } from './billing.utils';

describe('splitCost', () => {
  it('chia hết thì mọi người bằng nhau', () => {
    const result = splitCost(450000, ['a', 'b', 'c', 'd', 'e']);
    expect(result).toEqual([
      { userId: 'a', amount: 90000 },
      { userId: 'b', amount: 90000 },
      { userId: 'c', amount: 90000 },
      { userId: 'd', amount: 90000 },
      { userId: 'e', amount: 90000 },
    ]);
  });

  it('có dư thì những người đầu danh sách gánh thêm đúng 1 đồng', () => {
    const result = splitCost(100000, ['a', 'b', 'c']);
    expect(result.map((row) => row.amount)).toEqual([33334, 33333, 33333]);
  });

  it('tổng luôn bằng đúng total, không dư đồng nào', () => {
    for (const total of [0, 1, 7, 99999, 450001, 1234567]) {
      for (const size of [1, 2, 3, 4, 5, 7, 12]) {
        const ids = Array.from({ length: size }, (_, index) => `u${index}`);
        const sum = splitCost(total, ids).reduce((acc, row) => acc + row.amount, 0);
        expect(sum).toBe(total);
      }
    }
  });

  it('một người thì gánh hết', () => {
    expect(splitCost(450000, ['a'])).toEqual([{ userId: 'a', amount: 450000 }]);
  });

  it('không có ai thì trả mảng rỗng', () => {
    expect(splitCost(450000, [])).toEqual([]);
  });

  it('giữ nguyên thứ tự đầu vào — thứ tự quyết định ai gánh đồng lẻ nên phải tất định', () => {
    expect(splitCost(10, ['z', 'a', 'm']).map((row) => row.userId)).toEqual(['z', 'a', 'm']);
  });
});

describe('autoAllocate', () => {
  const debts = [
    { settlementId: 's1', remaining: 100000 },
    { settlementId: 's2', remaining: 80000 },
    { settlementId: 's3', remaining: 120000 },
  ];

  it('trả hết mọi khoản khi tiền vừa đủ', () => {
    expect(autoAllocate(300000, debts)).toEqual([
      { settlementId: 's1', amount: 100000 },
      { settlementId: 's2', amount: 80000 },
      { settlementId: 's3', amount: 120000 },
    ]);
  });

  it('đổ đầy nợ cũ trước rồi mới tới khoản sau', () => {
    expect(autoAllocate(150000, debts)).toEqual([
      { settlementId: 's1', amount: 100000 },
      { settlementId: 's2', amount: 50000 },
    ]);
  });

  it('trả đúng một khoản khi tiền ít hơn khoản đầu tiên', () => {
    expect(autoAllocate(30000, debts)).toEqual([{ settlementId: 's1', amount: 30000 }]);
  });

  it('dừng khi hết nợ dù còn tiền — phần thừa không được phân bổ đi đâu cả', () => {
    expect(autoAllocate(500000, debts)).toEqual([
      { settlementId: 's1', amount: 100000 },
      { settlementId: 's2', amount: 80000 },
      { settlementId: 's3', amount: 120000 },
    ]);
  });

  it('bỏ qua khoản đã trả xong', () => {
    expect(autoAllocate(50000, [{ settlementId: 's1', remaining: 0 }, { settlementId: 's2', remaining: 80000 }])).toEqual(
      [{ settlementId: 's2', amount: 50000 }],
    );
  });

  it('không có nợ thì trả mảng rỗng', () => {
    expect(autoAllocate(100000, [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

```bash
pnpm --filter api test -- billing.utils
```

Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Viết utils**

`api/src/billing/billing.utils.ts`:

```typescript
export type DebtSlot = { settlementId: string; remaining: number };

/**
 * Input: Tổng chi phí của trận và danh sách người thực sự có mặt (thứ tự đã tất định).
 * Output: Số tiền từng người phải trả.
 *
 *         Dùng largest-remainder: `base = floor(total / n)`, rồi `total % n` người ĐẦU danh
 *         sách trả thêm đúng 1 đồng. Không làm tròn nghìn — làm tròn sẽ để lại phần dư không
 *         ai chịu, và tổng settlement lệch tổng chi phí là thứ không bao giờ được phép xảy ra.
 *
 *         Thứ tự đầu vào quyết định ai gánh đồng lẻ nên caller phải truyền vào thứ tự tất định
 *         (sắp theo created_at rồi user_id), không được dựa vào thứ tự trả về của DB.
 */
export function splitCost(total: number, participantIds: string[]): { userId: string; amount: number }[] {
  const count = participantIds.length;
  if (count === 0) return [];

  const base = Math.floor(total / count);
  const remainder = total % count;

  return participantIds.map((userId, index) => ({
    userId,
    amount: index < remainder ? base + 1 : base,
  }));
}

/**
 * Input: Số tiền của payment và các khoản nợ còn lại, ĐÃ sắp theo nợ cũ trước.
 * Output: Phân bổ đổ đầy từng khoản theo thứ tự cho tới khi hết tiền hoặc hết nợ.
 *
 *         Tiền thừa (trả nhiều hơn tổng nợ) cố tình KHÔNG được phân bổ đi đâu: hệ thống
 *         không có khái niệm số dư, và trả dư vào một settlement sẽ phá bất biến
 *         paid_amount <= amount.
 */
export function autoAllocate(paymentAmount: number, debts: DebtSlot[]): { settlementId: string; amount: number }[] {
  const allocations: { settlementId: string; amount: number }[] = [];
  let left = paymentAmount;

  for (const debt of debts) {
    if (left <= 0) break;
    if (debt.remaining <= 0) continue;

    const amount = Math.min(left, debt.remaining);
    allocations.push({ settlementId: debt.settlementId, amount });
    left -= amount;
  }

  return allocations;
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

```bash
pnpm --filter api test -- billing.utils
```

Expected: 12 test PASS. Chú ý test "tổng luôn bằng đúng total" chạy 42 tổ hợp — nếu nó đỏ thì thuật toán chia sai, không phải test sai.

- [ ] **Step 5: Commit**

```bash
git add api/src/billing
git commit -m "feat(billing): add cost splitting and payment auto-allocation helpers"
```

---

### Task 2: Mã lỗi + settlement service + finalize/reopen

**Files:**
- Modify: `api/src/common/constants/error-codes.constant.ts`
- Create: `api/src/billing/settlements.service.ts`
- Create: `api/src/billing/billing.module.ts`
- Modify: `api/src/events/events.service.ts`, `api/src/events/events.controller.ts`, `api/src/events/events.module.ts`, `api/src/app.module.ts`

**Interfaces:**
- Produces:
  - `SettlementsService.createForEvent(tx, eventId, total, participantIds): Promise<number>` — nhận sẵn transaction client, trả số settlement tạo ra. **Đây là điểm chạm duy nhất từ `events` sang `billing`.**
  - `SettlementsService.deleteForEvent(tx, eventId): Promise<void>`
  - `SettlementsService.listMyDebts(orgId, userId): Promise<{ items: DebtItem[]; totalRemaining: number }>`
  - `SettlementsService.listAllDebts(orgId): Promise<MemberDebt[]>`
  - `type DebtItem = { settlementId, eventId, eventTitle, eventStartAt, amount, paidAmount, remaining }`
  - `type MemberDebt = { userId, fullName, avatarUrl, totalAmount, totalPaid, totalRemaining }`
  - `EventsService.finalize(eventId, userId): Promise<EventView>`
  - `EventsService.reopen(eventId, userId): Promise<EventView>`

- [ ] **Step 1: Thêm mã lỗi**

```typescript
  EVT_005: { code: 'EVT_005', status: 409, message: 'Event has no confirmed attendee' },
  EVT_006: { code: 'EVT_006', status: 409, message: 'Event cannot be reopened after any payment' },

  // --- Thanh toán ---
  PAY_001: { code: 'PAY_001', status: 404, message: 'Payment not found' },
  PAY_002: { code: 'PAY_002', status: 409, message: 'Payment is not pending' },
  PAY_003: { code: 'PAY_003', status: 400, message: 'Allocations do not match payment amount' },
  PAY_004: { code: 'PAY_004', status: 409, message: 'Allocation exceeds remaining debt' },
  SET_001: { code: 'SET_001', status: 404, message: 'Settlement not found' },
```

- [ ] **Step 2: Viết settlements service**

`api/src/billing/settlements.service.ts`. Hàm quan trọng nhất:

```typescript
  /**
   * Input: Transaction client đang mở, eventId, tổng chi phí, danh sách người có mặt
   *        (đã sắp thứ tự tất định).
   * Output: Số settlement được tạo.
   *
   *         Cố tình NHẬN transaction từ bên ngoài thay vì tự mở: nó phải nằm chung
   *         transaction với việc đổi event sang COMPLETED, nếu không sẽ có khoảnh khắc trận
   *         đã COMPLETED mà chưa ai có công nợ.
   *
   *         Đây là điểm chạm DUY NHẤT từ module events sang module billing.
   */
  async createForEvent(
    tx: TransactionClient,
    eventId: string,
    total: number,
    participantIds: string[],
  ): Promise<number> {
    const shares = splitCost(total, participantIds);
    if (shares.length === 0) return 0;

    const result = await tx.eventSettlement.createMany({
      data: shares.map((share) => ({
        event_id: eventId,
        user_id: share.userId,
        amount: share.amount,
        paid_amount: 0,
      })),
    });
    return result.count;
  }
```

`listMyDebts` chỉ lấy settlement còn nợ, kèm thông tin trận, sắp theo `event.start_at` tăng dần:

```typescript
    const settlements = await this.database.eventSettlement.findMany({
      where: {
        user_id: userId,
        event: { organization_id: organizationId },
      },
      orderBy: { event: { start_at: 'asc' } },
      select: {
        id: true,
        amount: true,
        paid_amount: true,
        event: { select: { id: true, title: true, start_at: true } },
      },
    });
```

Trả về `totalRemaining = SUM(amount - paid_amount)` chỉ tính các khoản còn dương.

- [ ] **Step 3: Viết billing module**

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SettlementsService } from './settlements.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class BillingModule {}
```

Trong `EventsModule`: thêm `BillingModule` vào `imports`. Trong `AppModule`: thêm `BillingModule` vào `imports`.

- [ ] **Step 4: Viết finalize trong EventsService**

```typescript
  /**
   * Input: eventId, admin thực hiện.
   * Output: Trận sau khi hoàn tất.
   *
   *         Một transaction làm trọn ba việc: chốt danh sách người chịu tiền, tạo settlement,
   *         đổi trạng thái trận. Không được tách — trận COMPLETED mà chưa có settlement là
   *         trạng thái không ai xử lý được.
   *
   *         Khóa hàng events bằng FOR UPDATE để hai lần bấm finalize đồng thời không tạo
   *         hai bộ settlement (UNIQUE (event_id, user_id) sẽ chặn, nhưng chặn bằng lỗi ràng
   *         buộc thô là trải nghiệm tệ và khó chẩn đoán).
   */
  async finalize(eventId: string, userId: string): Promise<EventView> {
    const { event } = await this.requireEventForUser(eventId, userId);
    await this.requireAdmin(event.organization_id, userId);

    return this.database.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string; status: string; court_cost: number; extra_costs: unknown }[]>`
        SELECT id, status::text AS status, court_cost, extra_costs
        FROM events WHERE id = ${eventId}::uuid FOR UPDATE`;

      const lockedEvent = locked[0];
      if (!lockedEvent) throw new AppException(ERROR_CODES.EVT_001);
      if (lockedEvent.status !== 'OPEN') throw new AppException(ERROR_CODES.EVT_004);

      const attendees = await tx.eventAttendance.findMany({
        where: { event_id: eventId, attended: true },
        orderBy: [{ created_at: 'asc' }, { user_id: 'asc' }],
        select: { user_id: true },
      });
      if (attendees.length === 0) throw new AppException(ERROR_CODES.EVT_005);

      const total = computeTotalCost(lockedEvent.court_cost, parseExtraCosts(lockedEvent.extra_costs));
      await this.settlementsService.createForEvent(
        tx,
        eventId,
        total,
        attendees.map((attendee) => attendee.user_id),
      );

      const updated = await tx.event.update({
        where: { id: eventId },
        data: { status: 'COMPLETED', completed_at: new Date() },
      });
      return EventsService.toView(updated);
    });
  }

  /**
   * Input: eventId, admin thực hiện.
   * Output: Trận quay về OPEN, mọi settlement bị xoá.
   *
   *         Chỉ cho phép khi CHƯA có đồng nào được thanh toán. Có nút này vì admin gõ nhầm
   *         chi phí là chuyện thường; không có nó thì một trận nhập sai hỏng vĩnh viễn.
   */
  async reopen(eventId: string, userId: string): Promise<EventView> {
    const { event } = await this.requireEventForUser(eventId, userId);
    await this.requireAdmin(event.organization_id, userId);

    return this.database.$transaction(async (tx) => {
      const paidCount = await tx.eventSettlement.count({
        where: { event_id: eventId, paid_amount: { gt: 0 } },
      });
      if (paidCount > 0) throw new AppException(ERROR_CODES.EVT_006);

      await tx.eventSettlement.deleteMany({ where: { event_id: eventId } });
      const updated = await tx.event.update({
        where: { id: eventId },
        data: { status: 'OPEN', completed_at: null },
      });
      return EventsService.toView(updated);
    });
  }
```

Thêm `POST :eventId/finalize` và `POST :eventId/reopen` vào `events.controller.ts` (controller `@Controller('events')`).

- [ ] **Step 5: Kiểm tra bằng tay**

Tạo trận 300.000đ tiền sân, thêm `extraCosts` 150.000đ, chấm 4 người có mặt, finalize.

Expected: 4 settlement, mỗi người 112.500đ, tổng đúng 450.000đ. Kiểm bằng `db:studio`.

- [ ] **Step 6: Commit**

```bash
pnpm --filter api build && pnpm --filter api test:unit
git add api/src
git commit -m "feat(billing): add settlements service, event finalize and reopen"
```

---

### Task 3: Payment — tạo, duyệt, từ chối

**Files:**
- Create: `api/src/billing/dto/create-payment.dto.ts`
- Create: `api/src/billing/payments.service.ts`
- Create: `api/src/billing/billing.controller.ts`
- Test: `api/src/billing/payments.service.spec.ts`
- Modify: `api/src/billing/billing.module.ts`

**Interfaces:**
- Produces:
  - `PaymentsService.create(orgId, actor, dto): Promise<PaymentView>` với `actor = { userId, role }`
  - `PaymentsService.confirm(paymentId, adminUserId): Promise<PaymentView>`
  - `PaymentsService.reject(paymentId, adminUserId): Promise<PaymentView>`
  - `PaymentsService.list(orgId, viewer, filters): Promise<PaymentView[]>`
  - `type PaymentView = { id, userId, userFullName, amount, method, status, note, createdAt, confirmedAt, allocations: { settlementId, eventTitle, amount }[] }`
  - `validateAllocations(paymentAmount, allocations, debts: Map<string, DebtInfo>, expectedUserId, expectedOrganizationId): void` — hàm thuần export ở cấp module từ `payments.service.ts`; ném `PAY_003` / `PAY_004` / `SET_001`.
  - `type DebtInfo = { remaining: number; userId: string; organizationId: string }`
- Consumes từ lát 2: `EventsService.requireEventForUser`, `EventsService.requireAdmin`, `EventsService.toView`, `parseExtraCosts`, `computeTotalCost`.

- [ ] **Step 1: Viết DTO**

```typescript
export class AllocationInputDto {
  @IsUUID()
  settlementId!: string;

  @IsInt()
  @Min(1)
  amount!: number;
}

export class CreatePaymentDto {
  /** Chỉ ADMIN được truyền (thu tiền hộ). MEMBER truyền vào sẽ bị bỏ qua. */
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsIn(['CASH', 'BANK_TRANSFER'])
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string;

  /** Bỏ trống = tự phân bổ nợ cũ trước. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationInputDto)
  allocations?: AllocationInputDto[];
}
```

- [ ] **Step 2: Viết test validate trước**

`api/src/billing/payments.service.spec.ts`:

```typescript
import { validateAllocations } from './payments.service';

const debts = new Map([
  ['s1', { remaining: 100000, userId: 'u1', organizationId: 'org-1' }],
  ['s2', { remaining: 80000, userId: 'u1', organizationId: 'org-1' }],
]);

describe('validateAllocations', () => {
  it('chấp nhận khi tổng khớp và không khoản nào vượt nợ', () => {
    expect(() =>
      validateAllocations(180000, [
        { settlementId: 's1', amount: 100000 },
        { settlementId: 's2', amount: 80000 },
      ], debts, 'u1', 'org-1'),
    ).not.toThrow();
  });

  it('ném PAY_003 khi tổng phân bổ nhỏ hơn số tiền payment', () => {
    expect(() =>
      validateAllocations(200000, [{ settlementId: 's1', amount: 100000 }], debts, 'u1', 'org-1'),
    ).toThrow(expect.objectContaining({ code: 'PAY_003' }));
  });

  it('ném PAY_003 khi tổng phân bổ lớn hơn số tiền payment', () => {
    expect(() =>
      validateAllocations(50000, [{ settlementId: 's1', amount: 100000 }], debts, 'u1', 'org-1'),
    ).toThrow(expect.objectContaining({ code: 'PAY_003' }));
  });

  it('ném PAY_004 khi phân bổ vượt phần nợ còn lại', () => {
    expect(() =>
      validateAllocations(150000, [{ settlementId: 's1', amount: 150000 }], debts, 'u1', 'org-1'),
    ).toThrow(expect.objectContaining({ code: 'PAY_004' }));
  });

  it('ném SET_001 khi settlement không tồn tại', () => {
    expect(() =>
      validateAllocations(1000, [{ settlementId: 'ghost', amount: 1000 }], debts, 'u1', 'org-1'),
    ).toThrow(expect.objectContaining({ code: 'SET_001' }));
  });

  it('ném SET_001 khi settlement thuộc người khác', () => {
    expect(() =>
      validateAllocations(1000, [{ settlementId: 's1', amount: 1000 }], debts, 'u2', 'org-1'),
    ).toThrow(expect.objectContaining({ code: 'SET_001' }));
  });

  it('ném SET_001 khi settlement thuộc tổ chức khác', () => {
    expect(() =>
      validateAllocations(1000, [{ settlementId: 's1', amount: 1000 }], debts, 'u1', 'org-2'),
    ).toThrow(expect.objectContaining({ code: 'SET_001' }));
  });

  it('ném PAY_003 khi không có phân bổ nào', () => {
    expect(() => validateAllocations(1000, [], debts, 'u1', 'org-1')).toThrow(
      expect.objectContaining({ code: 'PAY_003' }),
    );
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail, rồi viết service**

```bash
pnpm --filter api test -- payments.service
```

`validateAllocations` là hàm thuần export ở đầu file:

```typescript
export type DebtInfo = { remaining: number; userId: string; organizationId: string };

/**
 * Input: Số tiền payment, các phân bổ, bản đồ settlementId → thông tin nợ, chủ nợ và org kỳ vọng.
 * Output: Không trả gì nếu hợp lệ.
 *
 *         Ba điều kiện: tổng phân bổ khớp đúng số tiền (không cho tiền treo lơ lửng), mọi
 *         settlement thuộc đúng người và đúng org, và không khoản nào trả vượt phần còn nợ.
 *
 *         Được gọi HAI LẦN — lúc tạo và lúc confirm. Không phải thừa: giữa hai thời điểm đó
 *         có thể đã có payment khác trả cùng khoản nợ, làm phân bổ cũ trở nên vượt hạn mức.
 */
export function validateAllocations(
  paymentAmount: number,
  allocations: { settlementId: string; amount: number }[],
  debts: Map<string, DebtInfo>,
  expectedUserId: string,
  expectedOrganizationId: string,
): void {
  const total = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  if (allocations.length === 0 || total !== paymentAmount) {
    throw new AppException(ERROR_CODES.PAY_003);
  }

  for (const allocation of allocations) {
    const debt = debts.get(allocation.settlementId);
    if (!debt || debt.userId !== expectedUserId || debt.organizationId !== expectedOrganizationId) {
      throw new AppException(ERROR_CODES.SET_001);
    }
    if (allocation.amount > debt.remaining) {
      throw new AppException(ERROR_CODES.PAY_004);
    }
  }
}
```

`create` — điểm quan trọng là ai tạo thì trạng thái khác nhau:

```typescript
  /**
   * Input: orgId, người thao tác (kèm role), dữ liệu payment.
   * Output: Payment vừa tạo kèm phân bổ.
   *
   *         MEMBER tạo → PENDING, chờ admin duyệt. ADMIN tạo → CONFIRMED ngay trong cùng
   *         transaction: admin thu tiền mặt tại sân thì bắt bấm duyệt lần nữa là thao tác thừa.
   *
   *         `userId` trong DTO chỉ có tác dụng khi người gọi là ADMIN (thu hộ); MEMBER luôn
   *         là chính mình bất kể gửi gì lên.
   */
```

Bỏ trống `allocations` → nạp nợ còn lại sắp theo `event.start_at` rồi gọi `autoAllocate`.

`confirm` — transaction, khóa các settlement liên quan:

```typescript
      const settlementIds = allocations.map((allocation) => allocation.settlement_id);
      // Khóa theo thứ tự id đã sắp: hai admin duyệt hai payment chạm cùng tập settlement mà
      // khóa theo thứ tự khác nhau sẽ deadlock.
      await tx.$queryRaw`
        SELECT id FROM event_settlements
        WHERE id = ANY(${settlementIds}::uuid[]) ORDER BY id FOR UPDATE`;
```

Sau khi validate lại, cộng `paid_amount` cho từng settlement rồi đặt payment `CONFIRMED`, `confirmed_by`, `confirmed_at`.

`reject` — chỉ đổi `PENDING → REJECTED`, không đụng `paid_amount`. Trạng thái khác `PENDING` → `PAY_002`.

- [ ] **Step 4: Viết controller**

`billing.controller.ts` chứa hai controller:

- `@Controller('organizations/:orgId')` + `@UseGuards(JwtAuthGuard, OrgMemberGuard)`:
  - `GET debts/me` — mọi thành viên.
  - `GET debts` — `@OrgRoles('ADMIN')`.
  - `POST payments` — mọi thành viên; service tự phân biệt theo `membership.role`.
  - `GET payments` — mọi thành viên; MEMBER chỉ thấy payment của chính mình (service lọc theo role, không tin query param).
- `@Controller('payments')` + `@UseGuards(JwtAuthGuard)`:
  - `GET :paymentId`, `POST :paymentId/confirm`, `POST :paymentId/reject` — tự nạp payment rồi kiểm quyền như `requireEventForUser` ở lát 2.

- [ ] **Step 5: Chạy test và commit**

```bash
pnpm --filter api test -- payments.service
pnpm --filter api build
git add api/src/billing
git commit -m "feat(billing): add payment creation, confirmation and rejection"
```

---

### Task 4: Test tích hợp — bất biến công nợ

**Files:**
- Create: `api/test/billing.integration.spec.ts`
- Modify: `api/test/integration-db.ts`

**Interfaces:**
- Produces: `seedFinalizedEvent(database, options): Promise<BillingScenario>` — tạo org + N thành viên + trận đã finalize với settlement sẵn.

- [ ] **Step 1: Mở rộng tiện ích seed**

Thêm `seedFinalizedEvent` vào `api/test/integration-db.ts`: dựng scenario như `seedVotingScenario`, cho tất cả `GOING` + `attended = true`, rồi gọi thẳng `EventsService.finalize`.

- [ ] **Step 2: Viết test**

`api/test/billing.integration.spec.ts` — bốn test:

```typescript
  it('finalize chia đúng và tổng settlement bằng tổng chi phí', async () => {
    // court_cost 300000 + extra 150000 = 450000, 4 người → 112500 mỗi người.
    const settlements = await database.eventSettlement.findMany({ where: { event_id: scenario.eventId } });
    expect(settlements).toHaveLength(4);
    expect(settlements.reduce((sum, row) => sum + row.amount, 0)).toBe(450000);
  });

  it('finalize hai lần đồng thời chỉ tạo một bộ settlement', async () => {
    const results = await Promise.allSettled([
      eventsService.finalize(scenario.eventId, scenario.adminId),
      eventsService.finalize(scenario.eventId, scenario.adminId),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);

    const count = await database.eventSettlement.count({ where: { event_id: scenario.eventId } });
    expect(count).toBe(4);
  });

  it('confirm payment cập nhật paid_amount đúng bằng tổng allocation', async () => {
    // Tạo payment trả hết một settlement, confirm, rồi kiểm bất biến.
    const settlement = /* settlement đầu tiên */;
    const payment = await paymentsService.create(scenario.organizationId, { userId: settlement.user_id, role: 'MEMBER' }, {
      amount: settlement.amount, method: 'BANK_TRANSFER',
    });
    await paymentsService.confirm(payment.id, scenario.adminId);

    const after = await database.eventSettlement.findUniqueOrThrow({ where: { id: settlement.id } });
    const confirmedTotal = await database.paymentAllocation.aggregate({
      where: { settlement_id: settlement.id, payment: { status: 'CONFIRMED' } },
      _sum: { amount: true },
    });

    expect(after.paid_amount).toBe(settlement.amount);
    expect(after.paid_amount).toBe(confirmedTotal._sum.amount);
  });

  it('confirm lần thứ hai bị chặn và paid_amount không bị cộng đúp', async () => {
    await paymentsService.confirm(payment.id, scenario.adminId);
    await expect(paymentsService.confirm(payment.id, scenario.adminId)).rejects.toMatchObject({ code: 'PAY_002' });

    const after = await database.eventSettlement.findUniqueOrThrow({ where: { id: settlement.id } });
    expect(after.paid_amount).toBe(settlement.amount);
  });

  it('payment REJECTED không làm thay đổi paid_amount', async () => {
    await paymentsService.reject(payment.id, scenario.adminId);
    const after = await database.eventSettlement.findUniqueOrThrow({ where: { id: settlement.id } });
    expect(after.paid_amount).toBe(0);
  });

  it('reopen bị chặn sau khi đã có tiền vào', async () => {
    await paymentsService.confirm(payment.id, scenario.adminId);
    await expect(eventsService.reopen(scenario.eventId, scenario.adminId)).rejects.toMatchObject({ code: 'EVT_006' });
  });
```

Điền đầy đủ phần dựng dữ liệu ở mỗi test theo khuôn của `attendances.integration.spec.ts`.

- [ ] **Step 3: Chạy và commit**

```bash
pnpm --filter api test:integration
git add api/test
git commit -m "test(billing): prove settlement and paid_amount invariants"
```

---

### Task 5: FE — lớp dữ liệu billing

**Files:**
- Create: `ui/src/schema/billing.ts`, `ui/src/types/billing.ts`, `ui/src/api/billing.ts`, `ui/src/hooks/use-billing.ts`
- Modify: `ui/src/lib/api-error.ts`, `ui/src/api/events.ts`, `ui/src/hooks/use-events.ts`

- [ ] **Step 1: Bổ sung message lỗi**

```typescript
  EVT_005: "Chưa chấm ai có mặt, không chia tiền được",
  EVT_006: "Đã có người thanh toán, không mở lại trận được",
  PAY_001: "Không tìm thấy khoản thanh toán",
  PAY_002: "Khoản thanh toán không còn chờ duyệt",
  PAY_003: "Số tiền phân bổ không khớp tổng thanh toán",
  PAY_004: "Phân bổ vượt quá số nợ còn lại",
  SET_001: "Không tìm thấy khoản nợ",
```

- [ ] **Step 2: Schema, type, api, hook**

Theo khuôn các lát trước. Query key: `billingKeys.myDebts(orgId)`, `billingKeys.allDebts(orgId)`, `billingKeys.payments(orgId, filters)`.

Hook: `useMyDebts`, `useAllDebts`, `usePayments`, `useCreatePayment`, `useConfirmPayment`, `useRejectPayment`.

Mọi mutation payment sau khi thành công phải invalidate **cả** `billingKeys.myDebts(orgId)` **và** `billingKeys.payments(orgId)` — duyệt một payment làm thay đổi số nợ, hai màn hình phải khớp nhau ngay.

Thêm vào `use-events.ts`: `useFinalizeEvent(eventId, orgId)` và `useReopenEvent(eventId, orgId)`; cả hai invalidate `eventKeys.detail(eventId)`, `eventKeys.list(orgId)` và `billingKeys.myDebts(orgId)`.

- [ ] **Step 3: Commit**

```bash
pnpm --filter ui exec tsc --noEmit
git add ui/src
git commit -m "feat(ui): add billing schemas, api client and query hooks"
```

---

### Task 6: FE — màn finalize trong chi tiết trận

**Files:**
- Create: `ui/src/app/(private)/orgs/[orgId]/events/[eventId]/_components/finalize-dialog.tsx`
- Create: `ui/src/app/(private)/orgs/[orgId]/events/[eventId]/_components/extra-costs-editor.tsx`
- Modify: `event-detail.tsx`

- [ ] **Step 1: Editor chi phí phát sinh**

`extra-costs-editor.tsx` — dùng `useFieldArray` của react-hook-form: mỗi dòng là `Input` tên + `Input` số tiền + nút xóa; nút "Thêm khoản". Lưu bằng `useUpdateEvent` (ghi đè cả mảng `extraCosts`).

- [ ] **Step 2: Dialog finalize**

`finalize-dialog.tsx` — chỉ ADMIN, chỉ khi `event.status === "OPEN"`. Bốn bước hiển thị trên một màn, đúng thứ tự tài liệu:

1. **Người có mặt** — số người `attended === true`; nếu 0 thì hiện cảnh báo đỏ "Chưa chấm ai có mặt" và vô hiệu hóa nút xác nhận.
2. **Tiền sân** — `formatVnd(courtCost)` + link "Sửa" mở form sửa trận.
3. **Chi phí phát sinh** — `ExtraCostsEditor` nhúng thẳng vào.
4. **Xem trước chia tiền** — tổng `formatVnd(totalCost)`, số người, và bảng từng người phải trả bao nhiêu. **Tính ở FE bằng đúng thuật toán largest-remainder của BE** để con số hiển thị khớp tuyệt đối với settlement sắp tạo:

```typescript
/**
 * Input: Tổng chi phí và số người có mặt.
 * Output: Mảng số tiền từng người. Phải khớp bit-by-bit với splitCost ở BE — nếu lệch,
 *         người dùng thấy một con số rồi bị tính một con số khác.
 */
function previewSplit(total: number, count: number): number[] {
  if (count === 0) return []
  const base = Math.floor(total / count)
  const remainder = total % count
  return Array.from({ length: count }, (_, index) => (index < remainder ? base + 1 : base))
}
```

Nút "Hoàn tất trận" gọi `useFinalizeEvent`. `AlertDialog` xác nhận với nội dung: "Sau khi hoàn tất, {n} người sẽ nợ tổng {formatVnd(total)}. Chỉ mở lại được khi chưa ai thanh toán."

- [ ] **Step 3: Nút mở lại trận**

Trong `event-detail.tsx`, khi `status === "COMPLETED"` và người xem là ADMIN: nút "Mở lại trận" (`variant="outline"`) gọi `useReopenEvent`. Lỗi `EVT_006` đã có message tiếng Việt sẵn.

- [ ] **Step 4: Kiểm tra bằng tay**

Trận 300k tiền sân + 120k cầu + 30k nước, 5 người có mặt → xem trước hiện đúng 90.000đ/người, tổng 450.000đ. Finalize → trạng thái chuyển "Đã hoàn tất", 5 settlement được tạo.

- [ ] **Step 5: Commit**

```bash
pnpm --filter ui exec tsc --noEmit
git add ui/src
git commit -m "feat(ui): add event finalize dialog with cost preview"
```

---

### Task 7: FE — màn công nợ và duyệt thanh toán

**Files:**
- Create: `ui/src/app/(private)/orgs/[orgId]/debts/page.tsx` + `_components/my-debts.tsx` + `_components/pay-dialog.tsx`
- Create: `ui/src/app/(private)/orgs/[orgId]/payments/page.tsx` + `_components/payment-queue.tsx` + `_components/all-debts.tsx`
- Modify: `ui/src/app/(private)/orgs/[orgId]/page.tsx`

- [ ] **Step 1: Màn công nợ của tôi**

`my-debts.tsx`:

- Thẻ tổng ở đầu: `Tổng còn nợ` + `formatVnd(totalRemaining)` chữ lớn.
- Danh sách từng khoản: ngày trận (`formatEventDateTime`), tên trận, `formatVnd(amount)`, và `Badge` trạng thái — `paidAmount === 0` → "Chưa trả"; `0 < paidAmount < amount` → "Trả một phần" kèm `{formatVnd(paidAmount)}/{formatVnd(amount)}`; `paidAmount >= amount` → "Đã trả" (xanh).
- Nút "Tôi đã trả" mở `pay-dialog.tsx`.
- Trạng thái rỗng: "Bạn không nợ khoản nào 🎉".

- [ ] **Step 2: Dialog báo đã trả**

`pay-dialog.tsx`:

- `Input` số tiền, mặc định điền sẵn `totalRemaining`.
- `RadioGroup` phương thức: "Tiền mặt" / "Chuyển khoản".
- `Textarea` ghi chú (tùy chọn).
- Dòng giải thích dưới ô tiền: "Tiền sẽ tự động trừ vào các khoản nợ cũ trước." — không cho người dùng tự chọn allocation ở MVP; BE tự phân bổ.
- Xem trước phân bổ: chạy `autoAllocate` phía FE trên danh sách nợ đang hiển thị, liệt kê "Trận X: 100.000đ", "Trận Y: 50.000đ".
- Submit gọi `useCreatePayment`, toast "Đã gửi, chờ quản trị viên xác nhận".

- [ ] **Step 3: Màn duyệt thanh toán (ADMIN)**

`payment-queue.tsx` — `Tabs`: "Chờ duyệt" / "Đã duyệt" / "Từ chối".

Mỗi dòng: `Avatar` + tên người trả, `formatVnd(amount)`, phương thức, thời gian, và danh sách allocation dạng chữ nhỏ (`Trận X: 100.000đ`). Tab "Chờ duyệt" có hai nút "Xác nhận" / "Từ chối", mỗi nút bọc `AlertDialog`.

`all-debts.tsx` — tab thứ tư "Công nợ nhóm": `Table` từng thành viên với tổng phải trả / đã trả / còn lại, sắp giảm dần theo còn lại.

- [ ] **Step 4: Thay placeholder ở trang tổng quan**

Trong `orgs/[orgId]/page.tsx`, thay `Card` giữ chỗ "Công nợ của tôi" bằng số tổng thật từ `useMyDebts(orgId)` + link "Xem chi tiết".

- [ ] **Step 5: Kiểm tra đường đi trọn vẹn của lát 4**

1. Admin finalize 3 trận cho cùng một member → member nợ 3 khoản.
2. Member mở "Công nợ của tôi" → thấy tổng đúng bằng tổng 3 khoản.
3. Member bấm "Tôi đã trả" toàn bộ → xem trước hiện đủ 3 dòng phân bổ → gửi.
4. Admin mở "Duyệt thanh toán" → thấy 1 payment chờ với 3 allocation → xác nhận.
5. Member refresh → cả 3 khoản chuyển "Đã trả", tổng còn nợ = 0.
6. Admin thử "Mở lại trận" trên trận đã có tiền → toast "Đã có người thanh toán, không mở lại trận được".

- [ ] **Step 6: Chạy toàn bộ kiểm tra và commit**

```bash
pnpm --filter api test:unit
pnpm --filter api test:integration
pnpm --filter api build
pnpm --filter ui exec tsc --noEmit
pnpm --filter ui build
git add ui/src
git commit -m "feat(ui): add debt tracking and payment approval screens"
```

---

### Task 8: Đồng bộ lại tài liệu gốc

**Files:**
- Modify: `docs/mvp-features.md`
- Modify: `docs/mvp-badminton-db-design.md`

Hai tài liệu này hiện đang mâu thuẫn với code ở 7 điểm (spec §2). Để nguyên thì người đọc sau sẽ tin nhầm tài liệu.

- [ ] **Step 1: Sửa `mvp-features.md`**

- §6: bỏ `WAITLIST` khỏi danh sách trạng thái vote.
- §7: viết lại ví dụ — đủ người thì người vote sau bị từ chối, có người bỏ vote thì slot trống ra.
- §3: ghi rõ MVP chỉ làm invite link; invite qua email để giai đoạn sau.
- §11: bổ sung quy tắc chia tiền lẻ (largest-remainder) và khả năng mở lại trận khi chưa ai trả.

- [ ] **Step 2: Sửa `mvp-badminton-db-design.md`**

- §3 `users`: thay bằng schema thật (`provider`, `provider_user_id`, `full_name`, …).
- §8 `events`: thêm `source_template_id`, `occurrence_date` kèm giải thích đó là khóa chống sinh trùng, không phải quan hệ nghiệp vụ.
- §9 `event_attendances`: bỏ `WAITLIST` khỏi enum và khỏi phần "Rule".
- Mọi cột tiền: `bigint` → `int`, kèm một dòng lý do.
- Thêm một mục ngắn về múi giờ cố định `Asia/Ho_Chi_Minh`.

- [ ] **Step 3: Commit**

```bash
git add docs/mvp-features.md docs/mvp-badminton-db-design.md
git commit -m "docs: sync MVP docs with implemented design decisions"
```

---

## Định nghĩa hoàn thành lát 4 (và toàn bộ MVP)

- [ ] `SUM(settlements.amount) === total_cost` đúng với mọi tổ hợp số tiền / số người (test 42 tổ hợp).
- [ ] `settlement.paid_amount === SUM(allocation của payment CONFIRMED)` — kiểm bằng test tích hợp.
- [ ] Confirm hai lần không cộng đúp; payment `REJECTED` không đụng `paid_amount`.
- [ ] Reopen bị chặn khi đã có tiền vào.
- [ ] Đường đi trọn vẹn MVP chạy được: đăng nhập → tạo nhóm → mời qua link → đặt lịch định kỳ → cron sinh trận → vote → khóa vote → chấm công → finalize → công nợ → thanh toán → admin duyệt → hết nợ.
- [ ] Hai tài liệu trong `docs/` không còn mâu thuẫn với code.
