# Slice 3 — Vote, Giới hạn slot, Khóa vote, Chấm công — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thành viên vote đi / không đi cho từng trận. Trận đủ người thì không ai vote đi được nữa; có người bỏ vote thì slot trống ra ngay cho người khác. Tới mốc khóa vote thì member không đổi được nữa. Sau trận, admin chấm ai thực sự có mặt.

**Architecture:** Lát này chỉ có một chỗ khó và nó là chỗ dễ sai nhất trong cả hệ thống: **đếm rồi ghi mà không khóa thì chắc chắn vượt `max_participants`**. Toàn bộ mutation vote đi qua đúng một hàm, mở đầu bằng `SELECT ... FOR UPDATE` trên hàng `events` để xếp hàng mọi thao tác vote của cùng một trận. Có một test tích hợp bắn request song song thật để chứng minh điều đó — không mock.

**Tech Stack:** NestJS 11, Prisma 7 (`$transaction` + `$queryRaw` FOR UPDATE), PostgreSQL 16, Jest. Next.js 16, TanStack Query optimistic update.

**Spec:** [docs/superpowers/specs/2026-08-13-joytab-mvp-design.md](../specs/2026-08-13-joytab-mvp-design.md) — §6.3.

**Tiền đề:** Lát 1 và lát 2 đã xong. Bảng `event_attendances` đã có từ migration lát 1. Lát này KHÔNG có migration mới.

## Global Constraints

Kế thừa Global Constraints của [lát 1](./2026-08-13-slice-1-organizations.md) và [lát 2](./2026-08-13-slice-2-events.md), cộng thêm:

- **Không có WAITLIST.** Enum `AttendanceStatus` chỉ có `GOING`, `NOT_GOING`. Không auto-promote, không hàng đợi. Trận đủ người thì vote `GOING` bị từ chối thẳng bằng `EVT_002`.
- Mọi thay đổi `event_attendances` phải chạy trong `$transaction` mở đầu bằng khóa hàng `events`. Không có ngoại lệ, kể cả đường của admin.
- Vote bị khóa khi `now >= vote_locked_at` **hoặc** `now >= start_at` **hoặc** `status != 'OPEN'`. Dùng lại `isVoteLocked` đã viết ở lát 2, không viết lại.
- Admin bỏ qua được khóa thời gian nhưng **không** bỏ qua được `max_participants`.

---

## File Structure

**Backend — tạo mới**

| File | Trách nhiệm |
|---|---|
| `api/src/events/attendances.service.ts` | Toàn bộ mutation vote, khóa hàng, đếm slot |
| `api/src/events/attendances.controller.ts` | Route vote và chấm công |
| `api/src/events/attendances.service.spec.ts` | Test quy tắc bằng mock |
| `api/test/attendances.integration.spec.ts` | Test tranh slot cuối với Postgres thật |
| `api/src/events/dto/vote.dto.ts`, `dto/update-attendance.dto.ts`, `dto/mark-attended.dto.ts` | DTO |
| `api/test/integration-db.ts` | Tiện ích dựng/dọn dữ liệu cho test tích hợp |

**Backend — sửa**

`api/src/common/constants/error-codes.constant.ts` (thêm `EVT_002`, `EVT_003`), `api/src/events/events.module.ts`, `api/jest.config.js` (cho phép test ngoài `src`).

**Frontend — tạo mới**

`ui/src/app/(private)/orgs/[orgId]/events/[eventId]/_components/vote-panel.tsx`, `attendance-list.tsx`, `attendance-check-dialog.tsx`. Sửa `event-detail.tsx`, `ui/src/api/events.ts`, `ui/src/hooks/use-events.ts`, `ui/src/lib/api-error.ts`.

---

### Task 1: Mã lỗi + service vote với khóa hàng

**Files:**
- Modify: `api/src/common/constants/error-codes.constant.ts`
- Create: `api/src/events/dto/vote.dto.ts`
- Create: `api/src/events/attendances.service.ts`
- Test: `api/src/events/attendances.service.spec.ts`
- Modify: `api/src/events/events.module.ts`

**Interfaces:**
- Consumes: `EventsService.requireEventForUser` và `isVoteLocked` từ lát 2, `DatabaseService`.
- Produces:
  - `AttendancesService.vote(eventId, userId, status): Promise<AttendanceResult>`
  - `AttendancesService.adminSetStatus(eventId, adminUserId, targetUserId, status): Promise<AttendanceResult>`
  - `AttendancesService.markAttended(eventId, adminUserId, entries): Promise<{ updated: number }>`
  - `type AttendanceResult = { status: AttendanceStatus; goingCount: number; isFull: boolean }`

- [ ] **Step 1: Thêm mã lỗi**

```typescript
  /** Trận đã đủ người. Không có hàng đợi — người vote sau đơn giản là bị từ chối. */
  EVT_002: { code: 'EVT_002', status: 409, message: 'Event is full' },
  EVT_003: { code: 'EVT_003', status: 409, message: 'Voting is locked for this event' },
```

- [ ] **Step 2: Viết DTO**

`api/src/events/dto/vote.dto.ts`:

```typescript
import { IsIn } from 'class-validator';
import { AttendanceStatus } from '../../generated/prisma/enums';

export class VoteDto {
  @IsIn(['GOING', 'NOT_GOING'])
  status!: AttendanceStatus;
}
```

`api/src/events/dto/mark-attended.dto.ts`:

```typescript
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsUUID, ValidateNested } from 'class-validator';

export class AttendedEntryDto {
  @IsUUID()
  userId!: string;

  @IsBoolean()
  attended!: boolean;
}

export class MarkAttendedDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AttendedEntryDto)
  entries!: AttendedEntryDto[];
}
```

- [ ] **Step 3: Viết test quy tắc trước**

`api/src/events/attendances.service.spec.ts`:

```typescript
import { AttendancesService } from './attendances.service';

const FUTURE_EVENT = {
  id: 'evt-1',
  organization_id: 'org-1',
  max_participants: 2,
  vote_locked_at: new Date('2999-01-01T00:00:00.000Z'),
  start_at: new Date('2999-01-01T12:00:00.000Z'),
  status: 'OPEN',
};

const LOCKED_EVENT = { ...FUTURE_EVENT, vote_locked_at: new Date('2000-01-01T00:00:00.000Z') };

/**
 * DatabaseService giả: $transaction chạy callback ngay, $queryRaw trả hàng event đã "khóa".
 */
function buildDatabase(options: {
  event?: Record<string, unknown> | null;
  goingCount?: number;
  existing?: { id: string; status: string } | null;
  membershipRole?: 'ADMIN' | 'MEMBER' | null;
}) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue(options.event === null ? [] : [options.event ?? FUTURE_EVENT]),
    eventAttendance: {
      count: jest.fn().mockResolvedValue(options.goingCount ?? 0),
      findUnique: jest.fn().mockResolvedValue(options.existing ?? null),
      upsert: jest.fn().mockResolvedValue({ status: 'GOING' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const database = {
    ...tx,
    event: { findUnique: jest.fn().mockResolvedValue(options.event ?? FUTURE_EVENT) },
    organizationMember: {
      findFirst: jest.fn().mockResolvedValue(
        options.membershipRole === null ? null : { role: options.membershipRole ?? 'MEMBER' },
      ),
    },
    $transaction: jest.fn(async (callback: (client: unknown) => unknown) => callback(tx)),
  };
  return { database, tx };
}

describe('AttendancesService.vote', () => {
  it('cho vote GOING khi còn slot', async () => {
    const { database, tx } = buildDatabase({ goingCount: 1 });
    const service = new AttendancesService(database as never);

    const result = await service.vote('evt-1', 'user-1', 'GOING');

    expect(result).toEqual({ status: 'GOING', goingCount: 2, isFull: true });
    expect(tx.eventAttendance.upsert).toHaveBeenCalled();
  });

  it('ném EVT_002 khi trận đã đủ người', async () => {
    const { database } = buildDatabase({ goingCount: 2 });
    const service = new AttendancesService(database as never);

    await expect(service.vote('evt-1', 'user-1', 'GOING')).rejects.toMatchObject({ code: 'EVT_002' });
  });

  it('vẫn cho đổi sang NOT_GOING khi trận đã đủ người', async () => {
    const { database } = buildDatabase({ goingCount: 2, existing: { id: 'att-1', status: 'GOING' } });
    const service = new AttendancesService(database as never);

    await expect(service.vote('evt-1', 'user-1', 'NOT_GOING')).resolves.toMatchObject({
      status: 'NOT_GOING',
      goingCount: 1,
    });
  });

  it('không tính chính mình hai lần khi đã GOING và vote lại GOING', async () => {
    const { database } = buildDatabase({ goingCount: 2, existing: { id: 'att-1', status: 'GOING' } });
    const service = new AttendancesService(database as never);

    await expect(service.vote('evt-1', 'user-1', 'GOING')).resolves.toMatchObject({ goingCount: 2 });
  });

  it('ném EVT_003 khi đã qua mốc khóa vote', async () => {
    const { database } = buildDatabase({ event: LOCKED_EVENT });
    const service = new AttendancesService(database as never);

    await expect(service.vote('evt-1', 'user-1', 'GOING')).rejects.toMatchObject({ code: 'EVT_003' });
  });

  it('ném EVT_003 khi trận không còn OPEN', async () => {
    const { database } = buildDatabase({ event: { ...FUTURE_EVENT, status: 'CANCELLED' } });
    const service = new AttendancesService(database as never);

    await expect(service.vote('evt-1', 'user-1', 'GOING')).rejects.toMatchObject({ code: 'EVT_003' });
  });

  it('ném EVT_001 khi không tìm thấy trận', async () => {
    const { database } = buildDatabase({ event: null });
    const service = new AttendancesService(database as never);

    await expect(service.vote('evt-1', 'user-1', 'GOING')).rejects.toMatchObject({ code: 'EVT_001' });
  });

  it('ném ORG_002 khi người vote không thuộc tổ chức', async () => {
    const { database } = buildDatabase({ membershipRole: null });
    const service = new AttendancesService(database as never);

    await expect(service.vote('evt-1', 'user-1', 'GOING')).rejects.toMatchObject({ code: 'ORG_002' });
  });
});

describe('AttendancesService.adminSetStatus', () => {
  it('bỏ qua được mốc khóa vote', async () => {
    const { database } = buildDatabase({ event: LOCKED_EVENT, membershipRole: 'ADMIN' });
    const service = new AttendancesService(database as never);

    await expect(service.adminSetStatus('evt-1', 'admin-1', 'user-2', 'GOING')).resolves.toMatchObject({
      status: 'GOING',
    });
  });

  it('vẫn KHÔNG bỏ qua được max_participants', async () => {
    const { database } = buildDatabase({ event: LOCKED_EVENT, membershipRole: 'ADMIN', goingCount: 2 });
    const service = new AttendancesService(database as never);

    await expect(service.adminSetStatus('evt-1', 'admin-1', 'user-2', 'GOING')).rejects.toMatchObject({
      code: 'EVT_002',
    });
  });

  it('ném ORG_003 khi người gọi không phải ADMIN', async () => {
    const { database } = buildDatabase({ membershipRole: 'MEMBER' });
    const service = new AttendancesService(database as never);

    await expect(service.adminSetStatus('evt-1', 'user-1', 'user-2', 'GOING')).rejects.toMatchObject({
      code: 'ORG_003',
    });
  });
});
```

- [ ] **Step 4: Chạy test, xác nhận fail**

```bash
pnpm --filter api test -- attendances.service
```

Expected: FAIL — module chưa tồn tại.

- [ ] **Step 5: Viết service**

`api/src/events/attendances.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { DatabaseService } from '../database/database.service';
import { AttendanceStatus } from '../generated/prisma/enums';
import { isVoteLocked } from './events.service';

export type AttendanceResult = { status: AttendanceStatus; goingCount: number; isFull: boolean };

/** Hàng `events` sau khi đã khóa — chỉ các cột cần cho quyết định vote. */
type LockedEvent = {
  id: string;
  organization_id: string;
  max_participants: number;
  vote_locked_at: Date;
  start_at: Date;
  status: string;
};

@Injectable()
export class AttendancesService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Input: eventId, userId của chính người vote, trạng thái mới.
   * Output: Trạng thái sau khi ghi + sĩ số GOING mới.
   *         Bị khóa vote → EVT_003. Trận đủ người mà vote GOING → EVT_002.
   */
  vote(eventId: string, userId: string, status: AttendanceStatus): Promise<AttendanceResult> {
    return this.applyVote({ eventId, actorUserId: userId, targetUserId: userId, status, bypassLock: false });
  }

  /**
   * Input: eventId, admin thực hiện, user bị sửa, trạng thái mới.
   * Output: Như vote(), nhưng bỏ qua mốc khóa thời gian.
   *         Cố tình VẪN kiểm max_participants: admin sửa nhầm cho quá sĩ số thì lúc chia
   *         tiền và đặt sân đều sai, nên chặn ở đây chứ không tin vào thao tác tay.
   */
  adminSetStatus(
    eventId: string,
    adminUserId: string,
    targetUserId: string,
    status: AttendanceStatus,
  ): Promise<AttendanceResult> {
    return this.applyVote({
      eventId,
      actorUserId: adminUserId,
      targetUserId,
      status,
      bypassLock: true,
      requireAdmin: true,
    });
  }

  /**
   * Input: eventId, admin thực hiện, danh sách { userId, attended }.
   * Output: Số dòng được cập nhật.
   *
   *         Chỉ chấm được khi trận còn OPEN: sau khi finalize thì settlement đã chốt theo
   *         danh sách này, sửa attended lúc đó sẽ làm số tiền và người chịu tiền lệch nhau.
   */
  async markAttended(
    eventId: string,
    adminUserId: string,
    entries: { userId: string; attended: boolean }[],
  ): Promise<{ updated: number }> {
    const event = await this.database.event.findUnique({
      where: { id: eventId },
      select: { id: true, organization_id: true, status: true },
    });
    if (!event) throw new AppException(ERROR_CODES.EVT_001);
    await this.requireRole(event.organization_id, adminUserId, true);
    if (event.status !== 'OPEN') throw new AppException(ERROR_CODES.EVT_004);

    const results = await this.database.$transaction(
      entries.map((entry) =>
        this.database.eventAttendance.updateMany({
          where: { event_id: eventId, user_id: entry.userId },
          data: { attended: entry.attended },
        }),
      ),
    );

    return { updated: results.reduce((sum, result) => sum + result.count, 0) };
  }

  /**
   * Input: Mọi tham số của một lần ghi vote.
   * Output: Kết quả vote.
   *
   *         ĐÂY LÀ ĐƯỜNG DUY NHẤT ghi vào event_attendances.
   *
   *         `SELECT ... FOR UPDATE` trên hàng events là thứ duy nhất chống được việc hai
   *         người cùng giành slot cuối: nó xếp hàng mọi transaction vote của CÙNG một trận,
   *         nên bước đếm và bước ghi bên dưới trở thành nguyên tử với nhau. Bỏ khóa đi thì
   *         hai người cùng đọc goingCount = 11/12 và cùng ghi được, thành 13/12.
   *
   *         Khóa trên hàng `events` chứ không phải `event_attendances` vì cái cần bảo vệ là
   *         BẤT BIẾN TRÊN TẬP HỢP (tổng số GOING), không phải một dòng cụ thể — dòng cần
   *         chặn có thể còn chưa tồn tại.
   */
  private async applyVote(params: {
    eventId: string;
    actorUserId: string;
    targetUserId: string;
    status: AttendanceStatus;
    bypassLock: boolean;
    requireAdmin?: boolean;
  }): Promise<AttendanceResult> {
    const event = await this.database.event.findUnique({
      where: { id: params.eventId },
      select: { id: true, organization_id: true },
    });
    if (!event) throw new AppException(ERROR_CODES.EVT_001);
    await this.requireRole(event.organization_id, params.actorUserId, params.requireAdmin ?? false);

    return this.database.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<LockedEvent[]>`
        SELECT id, organization_id, max_participants, vote_locked_at, start_at, status::text AS status
        FROM events WHERE id = ${params.eventId}::uuid FOR UPDATE`;

      const lockedEvent = locked[0];
      if (!lockedEvent) throw new AppException(ERROR_CODES.EVT_001);

      if (params.bypassLock) {
        if (lockedEvent.status !== 'OPEN') throw new AppException(ERROR_CODES.EVT_004);
      } else if (isVoteLocked(lockedEvent, new Date())) {
        throw new AppException(ERROR_CODES.EVT_003);
      }

      const existing = await tx.eventAttendance.findUnique({
        where: { event_id_user_id: { event_id: params.eventId, user_id: params.targetUserId } },
        select: { id: true, status: true },
      });

      const goingCount = await tx.eventAttendance.count({
        where: { event_id: params.eventId, status: 'GOING' },
      });

      // Trừ chính mình ra khi đang GOING: vote lại GOING không được coi là chiếm thêm slot.
      const goingWithoutTarget = existing?.status === 'GOING' ? goingCount - 1 : goingCount;

      if (params.status === 'GOING' && goingWithoutTarget >= lockedEvent.max_participants) {
        throw new AppException(ERROR_CODES.EVT_002);
      }

      await tx.eventAttendance.upsert({
        where: { event_id_user_id: { event_id: params.eventId, user_id: params.targetUserId } },
        create: { event_id: params.eventId, user_id: params.targetUserId, status: params.status },
        update: { status: params.status },
      });

      const nextGoingCount = params.status === 'GOING' ? goingWithoutTarget + 1 : goingWithoutTarget;
      return {
        status: params.status,
        goingCount: nextGoingCount,
        isFull: nextGoingCount >= lockedEvent.max_participants,
      };
    });
  }

  /**
   * Input: orgId, userId, có bắt buộc ADMIN hay không.
   * Output: Không trả gì nếu hợp lệ. Không phải thành viên ACTIVE → ORG_002; thiếu quyền
   *         ADMIN → ORG_003.
   */
  private async requireRole(organizationId: string, userId: string, requireAdmin: boolean): Promise<void> {
    const membership = await this.database.organizationMember.findFirst({
      where: { organization_id: organizationId, user_id: userId, status: 'ACTIVE' },
      select: { role: true },
    });
    if (!membership) throw new AppException(ERROR_CODES.ORG_002);
    if (requireAdmin && membership.role !== 'ADMIN') throw new AppException(ERROR_CODES.ORG_003);
  }
}
```

- [ ] **Step 6: Chạy test, xác nhận pass**

```bash
pnpm --filter api test -- attendances.service
```

Expected: 11 test PASS.

- [ ] **Step 7: Commit**

```bash
git add api/src
git commit -m "feat(events): add attendance voting with row-locked capacity check"
```

---

### Task 2: Controller vote và chấm công

**Files:**
- Create: `api/src/events/attendances.controller.ts`
- Create: `api/src/events/dto/update-attendance.dto.ts`
- Modify: `api/src/events/events.module.ts`

**Interfaces:**
- Produces: 3 route dưới `@Controller('events/:eventId')`.

- [ ] **Step 1: Viết controller**

```typescript
import { Body, Controller, Param, Patch, Put, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { AttendancesService } from './attendances.service';
import { MarkAttendedDto } from './dto/mark-attended.dto';
import { VoteDto } from './dto/vote.dto';

// Không dùng OrgMemberGuard: URL không có :orgId nên guard không tra được membership.
// AttendancesService tự kiểm quyền sau khi nạp trận.
@Controller('events/:eventId')
@UseGuards(JwtAuthGuard)
export class AttendancesController {
  constructor(private readonly attendancesService: AttendancesService) {}

  /**
   * Input: eventId + trạng thái vote của chính mình.
   * Output: Trạng thái mới + sĩ số GOING. Đủ người → EVT_002, đã khóa → EVT_003.
   */
  @Put('attendance')
  vote(
    @Param('eventId', ParseUuidPipe) eventId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VoteDto,
  ) {
    return this.attendancesService.vote(eventId, user.userId, dto.status);
  }

  /**
   * Input: eventId, userId bị sửa, trạng thái mới. Chỉ ADMIN.
   * Output: Như vote nhưng bỏ qua mốc khóa thời gian.
   */
  @Put('attendances/:userId')
  adminSetStatus(
    @Param('eventId', ParseUuidPipe) eventId: string,
    @Param('userId', ParseUuidPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VoteDto,
  ) {
    return this.attendancesService.adminSetStatus(eventId, user.userId, userId, dto.status);
  }

  /**
   * Input: eventId + danh sách { userId, attended }. Chỉ ADMIN, chỉ khi trận còn OPEN.
   * Output: Số dòng được cập nhật.
   */
  @Patch('attendances')
  markAttended(
    @Param('eventId', ParseUuidPipe) eventId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MarkAttendedDto,
  ) {
    return this.attendancesService.markAttended(eventId, user.userId, dto.entries);
  }
}
```

- [ ] **Step 2: Đăng ký vào module**

Thêm `AttendancesController` vào `controllers` và `AttendancesService` vào `providers` + `exports` của `EventsModule`.

- [ ] **Step 3: Build và kiểm tra bằng tay**

```bash
pnpm --filter api build && pnpm --filter api dev
```

Vote thử bằng DevTools console:

```javascript
await (await fetch('http://localhost:8000/events/<EVENT_ID>/attendance', {
  method: 'PUT', credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'GOING' }),
})).json()
```

Expected: `{ success: true, data: { status: 'GOING', goingCount: 1, isFull: false } }`.

- [ ] **Step 4: Commit**

```bash
git add api/src/events
git commit -m "feat(events): add attendance vote and attended-marking endpoints"
```

---

### Task 3: Test tích hợp — tranh slot cuối với Postgres thật

**Files:**
- Create: `api/test/integration-db.ts`
- Create: `api/test/attendances.integration.spec.ts`
- Modify: `api/jest.config.js`
- Modify: `api/package.json`

Test này là lý do lát 3 tồn tại. Mock không chứng minh được gì về khóa hàng — chỉ Postgres thật mới chứng minh được.

**Interfaces:**
- Produces: `createIntegrationDatabase(): DatabaseService`, `seedVotingScenario(db, options): Promise<{ eventId, userIds }>`, `cleanupScenario(db, orgId): Promise<void>`.

- [ ] **Step 1: Mở rộng jest config**

`api/jest.config.js` — `rootDir` hiện là `src` nên không thấy thư mục `test`. Đổi thành:

```javascript
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  // Test tích hợp mở transaction thật và chờ khóa, 5s mặc định là quá ngắn.
  testTimeout: 30000,
};
```

Thêm script vào `api/package.json`:

```json
    "test:integration": "jest --testPathPattern 'test/.*\\.integration\\.spec\\.ts$' --runInBand",
    "test:unit": "jest --testPathIgnorePatterns 'test/.*integration'"
```

`--runInBand` là bắt buộc: các test tích hợp dùng chung một database, chạy song song sẽ giẫm lên dữ liệu của nhau.

- [ ] **Step 2: Viết tiện ích dựng dữ liệu**

`api/test/integration-db.ts`:

```typescript
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../src/database/database.service';

/**
 * Input: Không có; đọc DB_* từ process.env như app thật.
 * Output: DatabaseService nối tới database thật. Test tích hợp cố tình KHÔNG mock Prisma —
 *         thứ đang được kiểm là hành vi khóa của Postgres.
 */
export function createIntegrationDatabase(): DatabaseService {
  return new DatabaseService(new ConfigService(process.env));
}

export type VotingScenario = {
  organizationId: string;
  eventId: string;
  userIds: string[];
};

/**
 * Input: DatabaseService, số user cần tạo, sĩ số tối đa của trận.
 * Output: Một tổ chức + một trận OPEN chưa khóa vote + N thành viên ACTIVE.
 */
export async function seedVotingScenario(
  database: DatabaseService,
  options: { userCount: number; maxParticipants: number },
): Promise<VotingScenario> {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

  const users = await Promise.all(
    Array.from({ length: options.userCount }, (_, index) =>
      database.user.create({
        data: {
          provider: 'google',
          provider_user_id: `it-${suffix}-${index}`,
          email: `it-${suffix}-${index}@example.test`,
          full_name: `Tester ${index}`,
        },
      }),
    ),
  );

  const organization = await database.organization.create({
    data: { name: `IT Org ${suffix}`, created_by: users[0].id },
  });

  await database.organizationMember.createMany({
    data: users.map((user, index) => ({
      organization_id: organization.id,
      user_id: user.id,
      role: index === 0 ? ('ADMIN' as const) : ('MEMBER' as const),
      status: 'ACTIVE' as const,
    })),
  });

  const startAt = new Date(Date.now() + 7 * 86_400_000);
  const event = await database.event.create({
    data: {
      organization_id: organization.id,
      title: 'IT Event',
      start_at: startAt,
      end_at: new Date(startAt.getTime() + 2 * 3_600_000),
      location_name: 'IT Court',
      court_cost: 300000,
      max_participants: options.maxParticipants,
      vote_locked_at: new Date(startAt.getTime() - 3 * 3_600_000),
      created_by: users[0].id,
    },
  });

  return { organizationId: organization.id, eventId: event.id, userIds: users.map((user) => user.id) };
}

/**
 * Input: DatabaseService và scenario cần dọn.
 * Output: Xoá sạch dữ liệu test. Organization cascade xuống event/attendance nên chỉ cần
 *         xoá org rồi xoá user.
 */
export async function cleanupScenario(database: DatabaseService, scenario: VotingScenario): Promise<void> {
  await database.organization.delete({ where: { id: scenario.organizationId } });
  await database.user.deleteMany({ where: { id: { in: scenario.userIds } } });
}
```

- [ ] **Step 3: Viết test tranh slot**

`api/test/attendances.integration.spec.ts`:

```typescript
import { AttendancesService } from '../src/events/attendances.service';
import { DatabaseService } from '../src/database/database.service';
import { cleanupScenario, createIntegrationDatabase, seedVotingScenario, VotingScenario } from './integration-db';

describe('Vote đồng thời ở slot cuối (Postgres thật)', () => {
  let database: DatabaseService;
  let service: AttendancesService;
  let scenario: VotingScenario;

  beforeAll(async () => {
    database = createIntegrationDatabase();
    await database.$connect();
    service = new AttendancesService(database);
  });

  afterEach(async () => {
    if (scenario) await cleanupScenario(database, scenario);
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it('10 người vote cùng lúc vào trận 4 chỗ thì đúng 4 người vào được', async () => {
    scenario = await seedVotingScenario(database, { userCount: 10, maxParticipants: 4 });

    const results = await Promise.allSettled(
      scenario.userIds.map((userId) => service.vote(scenario.eventId, userId, 'GOING')),
    );

    const accepted = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(accepted).toHaveLength(4);
    expect(rejected).toHaveLength(6);
    for (const result of rejected) {
      expect((result as PromiseRejectedResult).reason).toMatchObject({ code: 'EVT_002' });
    }

    const goingCount = await database.eventAttendance.count({
      where: { event_id: scenario.eventId, status: 'GOING' },
    });
    expect(goingCount).toBe(4);
  });

  it('bỏ vote làm trống slot và người tiếp theo vào được ngay', async () => {
    scenario = await seedVotingScenario(database, { userCount: 3, maxParticipants: 2 });
    const [first, second, third] = scenario.userIds;

    await service.vote(scenario.eventId, first, 'GOING');
    await service.vote(scenario.eventId, second, 'GOING');
    await expect(service.vote(scenario.eventId, third, 'GOING')).rejects.toMatchObject({ code: 'EVT_002' });

    await service.vote(scenario.eventId, first, 'NOT_GOING');

    await expect(service.vote(scenario.eventId, third, 'GOING')).resolves.toMatchObject({
      status: 'GOING',
      goingCount: 2,
      isFull: true,
    });
  });

  it('cùng một người bấm GOING nhiều lần không chiếm thêm slot', async () => {
    scenario = await seedVotingScenario(database, { userCount: 2, maxParticipants: 1 });
    const [first] = scenario.userIds;

    await Promise.allSettled([
      service.vote(scenario.eventId, first, 'GOING'),
      service.vote(scenario.eventId, first, 'GOING'),
      service.vote(scenario.eventId, first, 'GOING'),
    ]);

    const goingCount = await database.eventAttendance.count({
      where: { event_id: scenario.eventId, status: 'GOING' },
    });
    expect(goingCount).toBe(1);
  });
});
```

- [ ] **Step 4: Chạy test tích hợp**

```bash
docker compose up -d postgres
pnpm --filter api exec dotenv -e .env -- true 2>/dev/null || true
pnpm --filter api test:integration
```

Nếu biến môi trường không tự nạp, chạy kèm: `env $(grep -v '^#' api/.env | xargs) pnpm --filter api test:integration`.

Expected: 3 test PASS. **Nếu test đầu tiên báo 5+ người vào được thì khóa `FOR UPDATE` chưa hoạt động** — kiểm lại rằng `$queryRaw` nằm bên trong `$transaction` và dùng `tx.$queryRaw` chứ không phải `this.database.$queryRaw`.

- [ ] **Step 5: Commit**

```bash
git add api/test api/jest.config.js api/package.json
git commit -m "test(events): prove capacity invariant under concurrent votes"
```

---

### Task 4: FE — khu vực vote

**Files:**
- Modify: `ui/src/api/events.ts`, `ui/src/hooks/use-events.ts`, `ui/src/lib/api-error.ts`
- Create: `ui/src/app/(private)/orgs/[orgId]/events/[eventId]/_components/vote-panel.tsx`
- Modify: `ui/src/app/(private)/orgs/[orgId]/events/[eventId]/_components/event-detail.tsx`

**Interfaces:**
- Produces: `voteEvent(eventId, status)`, `useVote(eventId)` với optimistic update.

- [ ] **Step 1: Bổ sung message lỗi**

```typescript
  EVT_002: "Trận đã đủ người",
  EVT_003: "Đã khóa vote cho trận này",
```

- [ ] **Step 2: Thêm API và hook vote**

Trong `ui/src/api/events.ts`:

```typescript
export const attendanceResultSchema = z.object({
  status: z.enum(["GOING", "NOT_GOING"]),
  goingCount: z.number().int(),
  isFull: z.boolean(),
})

export function voteEvent(eventId: string, status: "GOING" | "NOT_GOING") {
  return parsed(attendanceResultSchema, apiClient.put(`/events/${eventId}/attendance`, { status }))
}
```

Trong `ui/src/hooks/use-events.ts`:

```typescript
/**
 * Input: eventId.
 * Output: Mutation vote với optimistic update — vote là thao tác bấm nhiều nhất trong app,
 *         phải phản hồi tức thì thay vì chờ round-trip.
 *
 *         Rollback về snapshot khi lỗi: server là nguồn sự thật cho sĩ số, và lỗi hay gặp
 *         nhất (EVT_002 - đủ người) chính là lúc con số lạc quan đã sai.
 */
export function useVote(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (status: "GOING" | "NOT_GOING") => voteEvent(eventId, status),
    onMutate: async (status) => {
      await queryClient.cancelQueries({ queryKey: eventKeys.detail(eventId) })
      const previous = queryClient.getQueryData<EventDetail>(eventKeys.detail(eventId))
      if (previous) {
        const wasGoing = previous.myStatus === "GOING"
        const willGo = status === "GOING"
        const goingCount = previous.goingCount + (willGo ? 1 : 0) - (wasGoing ? 1 : 0)
        queryClient.setQueryData<EventDetail>(eventKeys.detail(eventId), {
          ...previous,
          myStatus: status,
          goingCount,
          isFull: goingCount >= previous.maxParticipants,
        })
      }
      return { previous }
    },
    onError: (error, _status, context) => {
      if (context?.previous) queryClient.setQueryData(eventKeys.detail(eventId), context.previous)
      toast.error(getApiErrorMessage(error, "Không vote được"))
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) }),
  })
}
```

- [ ] **Step 3: Viết vote panel**

`vote-panel.tsx` — nhận `event: EventDetail`:

- Thanh sĩ số: `{goingCount}/{maxParticipants}` + `Progress` hoặc thanh div đơn giản; tô `text-destructive` khi `isFull`.
- Hai nút lớn: "Tôi đi" (`variant` = `default` khi `myStatus === "GOING"`, ngược lại `outline`) và "Không đi".
- Vô hiệu hóa cả hai nút khi `isLocked`, kèm dòng giải thích: `Đã khóa vote lúc {formatEventDateTime(voteLockedAt)}`.
- Vô hiệu hóa riêng nút "Tôi đi" khi `isFull && myStatus !== "GOING"`, kèm dòng "Trận đã đủ người".
- Khi chưa khóa và chưa full, hiện dòng nhỏ: `Khóa vote lúc {formatEventDateTime(voteLockedAt)}`.

- [ ] **Step 4: Gắn vào chi tiết trận**

Thay comment `{/* Lát 3: khu vực vote */}` trong `event-detail.tsx` bằng `<VotePanel event={event} />`. Chỉ render khi `event.status === "OPEN"`.

- [ ] **Step 5: Kiểm tra bằng tay**

Mở cùng một trận ở hai trình duyệt với hai tài khoản. Đặt `maxParticipants = 1` (sửa trận). Cả hai cùng bấm "Tôi đi": một người thành công, người kia thấy toast "Trận đã đủ người" và nút quay về trạng thái cũ (rollback hoạt động).

- [ ] **Step 6: Commit**

```bash
pnpm --filter ui exec tsc --noEmit
git add ui/src
git commit -m "feat(ui): add vote panel with optimistic updates"
```

---

### Task 5: FE — danh sách người tham gia và màn chấm công

**Files:**
- Create: `ui/src/app/(private)/orgs/[orgId]/events/[eventId]/_components/attendance-list.tsx`
- Create: `ui/src/app/(private)/orgs/[orgId]/events/[eventId]/_components/attendance-check-dialog.tsx`
- Modify: `ui/src/api/events.ts`, `ui/src/hooks/use-events.ts`, `event-detail.tsx`

**Interfaces:**
- Produces: `markAttended(eventId, entries)`, `adminSetAttendance(eventId, userId, status)`, hook `useMarkAttended(eventId)`, `useAdminSetAttendance(eventId)`.

- [ ] **Step 1: Danh sách người tham gia**

`attendance-list.tsx` — hai nhóm với tiêu đề đếm số:

- "Sẽ đi ({goingCount})" — `Avatar` + tên. Người đã được chấm `attended === true` có `Badge` "Có mặt"; `attended === false` có `Badge variant="outline"` "Vắng".
- "Không đi ({notGoingCount})" — chữ mờ hơn.

ADMIN: mỗi dòng có `DropdownMenu` nhỏ "Chuyển sang không đi" / "Chuyển sang sẽ đi" gọi `useAdminSetAttendance`. Chỉ hiện khi `event.status === "OPEN"`.

- [ ] **Step 2: Dialog chấm công**

`attendance-check-dialog.tsx` — chỉ ADMIN, chỉ khi `event.status === "OPEN"`:

- Nút mở: "Chấm công" (icon `ClipboardCheck`).
- Nội dung: danh sách người `GOING`, mỗi dòng một `Checkbox` "có mặt", mặc định tích sẵn theo `attended ?? true` (người đã đăng ký thì mặc định là có đi — admin chỉ cần bỏ tích người vắng, ít thao tác nhất).
- Chân dialog: `Đã chấm: {checkedCount} người` + nút "Lưu" gọi `useMarkAttended` với đủ toàn bộ `entries`.
- Sau khi lưu thành công: toast "Đã chấm công" và đóng dialog.

- [ ] **Step 3: Gắn vào chi tiết trận**

Trong `event-detail.tsx`: thay khối placeholder danh sách người tham gia bằng `<AttendanceList event={event} />`, và đặt `<AttendanceCheckDialog event={event} />` cạnh nút "Sửa trận" trong thanh thao tác của ADMIN.

- [ ] **Step 4: Kiểm tra đường đi trọn vẹn của lát 3**

1. Tài khoản A (admin) tạo trận 2 chỗ.
2. A và B cùng vote "Tôi đi" → cả hai vào được, hiển thị `2/2`, nút tô đỏ.
3. C vote "Tôi đi" → toast "Trận đã đủ người".
4. B chuyển sang "Không đi" → C vote lại → vào được.
5. A sửa `voteLockedAt` về quá khứ → B mở lại trang, nút vote bị vô hiệu hóa, hiện dòng "Đã khóa vote lúc …".
6. A mở "Chấm công", bỏ tích C, lưu → danh sách hiện `Badge` "Vắng" ở C.

- [ ] **Step 5: Chạy toàn bộ kiểm tra và commit**

```bash
pnpm --filter api test:unit
pnpm --filter api test:integration
pnpm --filter api build
pnpm --filter ui exec tsc --noEmit
pnpm --filter ui build
git add ui/src
git commit -m "feat(ui): add attendance list and attendance check dialog"
```

---

## Định nghĩa hoàn thành lát 3

- [ ] Test tích hợp chứng minh 10 người vote song song vào trận 4 chỗ → đúng 4 người `GOING`, 6 người nhận `EVT_002`.
- [ ] Bỏ vote làm trống slot và người khác vào được ngay — không có hàng đợi, không auto-promote.
- [ ] Sau `vote_locked_at`, member không đổi được vote nhưng ADMIN vẫn sửa được.
- [ ] ADMIN sửa attendance không vượt được `max_participants`.
- [ ] Chấm công lưu `attended` đúng và chỉ chạy khi trận còn `OPEN`.
