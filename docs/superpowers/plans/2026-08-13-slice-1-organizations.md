# Slice 1 — Organizations, Members, Invite Link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người dùng đã đăng nhập Google tạo được tổ chức, mời người khác bằng link, người khác mở link và tham gia, xem danh sách thành viên, đổi quyền, rời nhóm.

**Architecture:** Toàn bộ schema 8 bảng được migrate một lần ở task 1 (schema đã chốt trong spec, chia nhỏ chỉ đẻ thêm file migration mà không giảm rủi ro). Sau đó dựng lớp phân quyền dùng chung (`OrgMemberGuard` + `@OrgRoles`) rồi mới tới module `organizations` gồm org / members / invites. Frontend dựng app shell bằng shadcn sidebar block, các màn hình đọc dữ liệu qua TanStack Query với response parse bằng zod.

**Tech Stack:** NestJS 11, Prisma 7 (`prisma-client` generator, output `src/generated/prisma`), PostgreSQL 16, Jest + ts-jest. Next.js 16 App Router, React 19, shadcn/ui new-york, TanStack Query v5, zustand, zod v4, axios.

**Spec:** [docs/superpowers/specs/2026-08-13-joytab-mvp-design.md](../specs/2026-08-13-joytab-mvp-design.md)

## Global Constraints

- Múi giờ toàn hệ thống cố định `Asia/Ho_Chi_Minh`, offset `+07:00`, không dùng thư viện timezone.
- Tiền là `Int` (VND). Không dùng `BigInt` ở bất kỳ cột tiền nào.
- Mọi cột thời gian là `@db.Timestamptz(6)`. Mọi PK là `String @id @default(uuid()) @db.Uuid`.
- Mọi bảng có `@@map` tên snake_case số nhiều. Mọi cột đặt tên snake_case.
- Mọi lỗi nghiệp vụ ném `AppException` với một mục trong `ERROR_CODES`. Không `throw new HttpException` trực tiếp, không `BadRequestException` của Nest.
- Mọi response controller trả object thuần; `ResponseInterceptor` tự bọc `{ success, message, data }`. Không tự bọc envelope trong controller.
- Comment tài liệu hàm dùng tiếng Việt theo dạng `Input: ... / Output: ...` đúng như code hiện có.
- FE: schema zod đặt ở `ui/src/schema`, type suy ra đặt ở `ui/src/types`, hàm gọi API đặt ở `ui/src/api`, hook đặt ở `ui/src/hooks`. Không đặt hàm gọi API vào `ui/src/lib`.
- FE hiển thị lỗi theo `code` trả về từ BE, không theo `message`.
- Lệnh chạy từ thư mục gốc repo: `pnpm --filter api ...`, `pnpm --filter ui ...`.

---

## File Structure

**Backend — tạo mới**

| File | Trách nhiệm |
|---|---|
| `api/src/common/decorators/current-user.decorator.ts` | Rút `userId`/`userEmail` từ request |
| `api/src/common/decorators/org-roles.decorator.ts` | Metadata `@OrgRoles(...)` + `@CurrentMembership()` |
| `api/src/common/guards/org-member.guard.ts` | Tra membership theo `:orgId`, chặn theo role |
| `api/src/common/guards/org-member.guard.spec.ts` | Test guard |
| `api/src/organizations/organizations.module.ts` | Wiring module |
| `api/src/organizations/organizations.controller.ts` | Route `/organizations` |
| `api/src/organizations/organizations.service.ts` | Tạo/list/detail/update org |
| `api/src/organizations/members.controller.ts` | Route thành viên |
| `api/src/organizations/members.service.ts` | Đổi role, kick, leave + bất biến last-admin |
| `api/src/organizations/members.service.spec.ts` | Test bất biến last-admin |
| `api/src/organizations/invites.controller.ts` | Route invite (gồm route public `/invites/:token`) |
| `api/src/organizations/invites.service.ts` | Tạo/list/revoke/preview/accept |
| `api/src/organizations/invites.utils.ts` | Sinh token, hash, vị từ hiệu lực |
| `api/src/organizations/invites.utils.spec.ts` | Test vị từ hiệu lực |
| `api/src/organizations/dto/*.ts` | DTO class-validator |

**Backend — sửa**

| File | Sửa gì |
|---|---|
| `api/prisma/schema.prisma` | Thêm 7 enum + 8 model + back-relation trên `User` |
| `api/src/common/constants/error-codes.constant.ts` | Thêm nhóm mã `ORG_*`, `INV_*` |
| `api/src/app.module.ts` | Import `OrganizationsModule` |

**Frontend — tạo mới**

| File | Trách nhiệm |
|---|---|
| `ui/src/schema/organization.ts` | Zod schema org / member / invite |
| `ui/src/types/organization.ts` | Type suy ra từ schema |
| `ui/src/api/organizations.ts` | Hàm gọi API |
| `ui/src/hooks/use-organizations.ts` | Hook TanStack Query |
| `ui/src/components/layout/app-sidebar.tsx` | Sidebar + org switcher |
| `ui/src/app/(private)/layout.tsx` | Bọc `SidebarProvider` (sửa file có sẵn) |
| `ui/src/app/(private)/page.tsx` | Danh sách tổ chức (thay nội dung cũ) |
| `ui/src/app/(private)/orgs/new/page.tsx` | Form tạo tổ chức |
| `ui/src/app/(private)/orgs/[orgId]/layout.tsx` | Nạp org, chặn khi không phải member |
| `ui/src/app/(private)/orgs/[orgId]/page.tsx` | Trang tổng quan tổ chức |
| `ui/src/app/(private)/orgs/[orgId]/members/page.tsx` + `_components/` | Thành viên + invite |
| `ui/src/app/invite/[token]/page.tsx` + `_components/` | Trang public nhận lời mời |

---

### Task 1: Prisma schema — toàn bộ 8 bảng nghiệp vụ

**Files:**
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/<timestamp>_add_mvp_domain_tables/migration.sql` (do `prisma migrate dev` sinh)

**Interfaces:**
- Consumes: `User` model đã có.
- Produces: Prisma client với các model `Organization`, `OrganizationMember`, `OrganizationInvite`, `EventTemplate`, `Event`, `EventAttendance`, `EventSettlement`, `Payment`, `PaymentAllocation`; enum `MemberRole`, `MemberStatus`, `InviteType`, `EventStatus`, `AttendanceStatus`, `PaymentMethod`, `PaymentStatus`. Import từ `../generated/prisma/client` (giá trị enum) và `../generated/prisma/enums` (type).

- [ ] **Step 1: Bật database**

```bash
docker compose up -d postgres
docker compose ps
```

Expected: container `joytab-postgres` ở trạng thái `Up`.

- [ ] **Step 2: Thêm back-relation vào model `User`**

Prisma bắt buộc mọi quan hệ phải có hai đầu. `User` bị trỏ tới từ 10 chỗ nên mỗi quan hệ phải có tên riêng. Thêm các dòng sau vào model `User` trong `api/prisma/schema.prisma`, ngay dưới `refresh_tokens`:

```prisma
  organizations_created  Organization[]       @relation("OrganizationCreator")
  memberships            OrganizationMember[]
  invites_created        OrganizationInvite[] @relation("InviteCreator")
  templates_created      EventTemplate[]      @relation("TemplateCreator")
  events_created         Event[]              @relation("EventCreator")
  attendances            EventAttendance[]
  settlements            EventSettlement[]
  payments               Payment[]            @relation("PaymentOwner")
  payments_created       Payment[]            @relation("PaymentCreator")
  payments_confirmed     Payment[]            @relation("PaymentConfirmer")
```

- [ ] **Step 3: Thêm enum vào cuối `schema.prisma`**

```prisma
enum MemberRole {
  ADMIN
  MEMBER
}

enum MemberStatus {
  ACTIVE
  LEFT
}

enum InviteType {
  EMAIL
  LINK
}

enum EventStatus {
  OPEN
  COMPLETED
  CANCELLED
}

/// Cố tình KHÔNG có WAITLIST: nhóm đủ người thì không vote GOING được nữa, ai bỏ vote
/// thì slot trống ra cho người khác. Không có hàng đợi, không auto-promote.
enum AttendanceStatus {
  GOING
  NOT_GOING
}

enum PaymentMethod {
  CASH
  BANK_TRANSFER
}

enum PaymentStatus {
  PENDING
  CONFIRMED
  REJECTED
}
```

- [ ] **Step 4: Thêm 4 model của lát này**

```prisma
model Organization {
  id         String   @id @default(uuid()) @db.Uuid
  name       String   @db.VarChar(255)
  avatar_url String?
  created_by String   @db.Uuid
  created_at DateTime @default(now()) @db.Timestamptz(6)
  updated_at DateTime @updatedAt @db.Timestamptz(6)

  creator   User                 @relation("OrganizationCreator", fields: [created_by], references: [id])
  members   OrganizationMember[]
  invites   OrganizationInvite[]
  templates EventTemplate[]
  events    Event[]
  payments  Payment[]

  @@map("organizations")
}

/// Rời nhóm KHÔNG xoá row mà đặt status = LEFT: giữ lại lịch sử vote và công nợ của
/// người đó, và cho phép quay lại nhóm mà không mất dữ liệu cũ.
model OrganizationMember {
  id              String       @id @default(uuid()) @db.Uuid
  organization_id String       @db.Uuid
  user_id         String       @db.Uuid
  role            MemberRole   @default(MEMBER)
  status          MemberStatus @default(ACTIVE)
  joined_at       DateTime     @default(now()) @db.Timestamptz(6)
  created_at      DateTime     @default(now()) @db.Timestamptz(6)
  updated_at      DateTime     @updatedAt @db.Timestamptz(6)

  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [user_id], references: [id])

  @@unique([organization_id, user_id])
  @@index([user_id, status])
  @@map("organization_members")
}

/// DB chỉ lưu SHA-256 của token, giống refresh_tokens: lộ DB cũng không dựng lại được
/// link mời. Token thô chỉ xuất hiện đúng một lần trong response lúc tạo.
model OrganizationInvite {
  id              String     @id @default(uuid()) @db.Uuid
  organization_id String     @db.Uuid
  type            InviteType @default(LINK)
  email           String?    @db.VarChar(255)
  token_hash      String     @unique
  expires_at      DateTime?  @db.Timestamptz(6)
  max_uses        Int?
  used_count      Int        @default(0)
  revoked_at      DateTime?  @db.Timestamptz(6)
  created_by      String     @db.Uuid
  created_at      DateTime   @default(now()) @db.Timestamptz(6)
  updated_at      DateTime   @updatedAt @db.Timestamptz(6)

  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  creator      User         @relation("InviteCreator", fields: [created_by], references: [id])

  @@index([organization_id, revoked_at])
  @@map("organization_invites")
}

model EventTemplate {
  id                       String   @id @default(uuid()) @db.Uuid
  organization_id          String   @db.Uuid
  name                     String   @db.VarChar(255)
  /// 1 = thứ Hai ... 7 = Chủ nhật (ISO-8601).
  day_of_week              Int      @db.SmallInt
  start_time               DateTime @db.Time(0)
  end_time                 DateTime @db.Time(0)
  location_name            String   @db.VarChar(255)
  location_address         String?
  location_lat             Decimal? @db.Decimal(10, 7)
  location_lng             Decimal? @db.Decimal(10, 7)
  court_cost               Int      @default(0)
  max_participants         Int
  vote_lock_minutes_before Int      @default(180)
  active                   Boolean  @default(true)
  created_by               String   @db.Uuid
  created_at               DateTime @default(now()) @db.Timestamptz(6)
  updated_at               DateTime @updatedAt @db.Timestamptz(6)

  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  creator      User         @relation("TemplateCreator", fields: [created_by], references: [id])
  events       Event[]

  @@index([organization_id, active])
  @@map("event_templates")
}
```

- [ ] **Step 5: Thêm 4 model còn lại (events / billing)**

Migrate hết một lần dù lát 2–4 mới dùng tới, để chỉ có đúng một file migration cho toàn bộ domain.

```prisma
model Event {
  id               String      @id @default(uuid()) @db.Uuid
  organization_id  String      @db.Uuid
  title            String      @db.VarChar(255)
  start_at         DateTime    @db.Timestamptz(6)
  end_at           DateTime    @db.Timestamptz(6)
  location_name    String      @db.VarChar(255)
  location_address String?
  location_lat     Decimal?    @db.Decimal(10, 7)
  location_lng     Decimal?    @db.Decimal(10, 7)
  court_cost       Int         @default(0)
  /// Mảng [{ name: string, amount: int }]. Ghi đè cả mảng khi cập nhật, không patch phần tử.
  extra_costs      Json        @default("[]")
  max_participants Int
  vote_locked_at   DateTime    @db.Timestamptz(6)
  status           EventStatus @default(OPEN)
  /// Chỉ là khoá chống sinh trùng cho cron, KHÔNG phải quan hệ nghiệp vụ: event sinh xong
  /// sống độc lập, sửa/xoá template không ảnh hưởng trận đã sinh (nên onDelete: SetNull).
  source_template_id String?   @db.Uuid
  occurrence_date    DateTime? @db.Date
  created_by       String      @db.Uuid
  completed_at     DateTime?   @db.Timestamptz(6)
  cancelled_at     DateTime?   @db.Timestamptz(6)
  created_at       DateTime    @default(now()) @db.Timestamptz(6)
  updated_at       DateTime    @updatedAt @db.Timestamptz(6)

  organization    Organization      @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  source_template EventTemplate?    @relation(fields: [source_template_id], references: [id], onDelete: SetNull)
  creator         User              @relation("EventCreator", fields: [created_by], references: [id])
  attendances     EventAttendance[]
  settlements     EventSettlement[]

  @@unique([source_template_id, occurrence_date])
  @@index([organization_id, start_at])
  @@map("events")
}

model EventAttendance {
  id         String           @id @default(uuid()) @db.Uuid
  event_id   String           @db.Uuid
  user_id    String           @db.Uuid
  status     AttendanceStatus
  /// null = chưa chấm. Chỉ người attended = true mới bị chia tiền lúc finalize.
  attended   Boolean?
  created_at DateTime         @default(now()) @db.Timestamptz(6)
  updated_at DateTime         @updatedAt @db.Timestamptz(6)

  event Event @relation(fields: [event_id], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [user_id], references: [id])

  @@unique([event_id, user_id])
  @@index([event_id, status])
  @@map("event_attendances")
}

/// paid_amount là dữ liệu dẫn xuất nhưng được lưu vì màn công nợ đọc nhiều hơn ghi rất
/// nhiều. Bất biến: chỉ được đổi bên trong transaction đổi trạng thái payment.
model EventSettlement {
  id          String   @id @default(uuid()) @db.Uuid
  event_id    String   @db.Uuid
  user_id     String   @db.Uuid
  amount      Int
  paid_amount Int      @default(0)
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  updated_at  DateTime @updatedAt @db.Timestamptz(6)

  event       Event               @relation(fields: [event_id], references: [id], onDelete: Cascade)
  user        User                @relation(fields: [user_id], references: [id])
  allocations PaymentAllocation[]

  @@unique([event_id, user_id])
  @@index([user_id])
  @@map("event_settlements")
}

model Payment {
  id              String        @id @default(uuid()) @db.Uuid
  organization_id String        @db.Uuid
  user_id         String        @db.Uuid
  amount          Int
  method          PaymentMethod
  status          PaymentStatus @default(PENDING)
  note            String?
  created_by      String        @db.Uuid
  confirmed_by    String?       @db.Uuid
  confirmed_at    DateTime?     @db.Timestamptz(6)
  created_at      DateTime      @default(now()) @db.Timestamptz(6)
  updated_at      DateTime      @updatedAt @db.Timestamptz(6)

  organization Organization        @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  user         User                @relation("PaymentOwner", fields: [user_id], references: [id])
  creator      User                @relation("PaymentCreator", fields: [created_by], references: [id])
  confirmer    User?               @relation("PaymentConfirmer", fields: [confirmed_by], references: [id])
  allocations  PaymentAllocation[]

  @@index([organization_id, status])
  @@index([user_id, status])
  @@map("payments")
}

/// Allocation của payment REJECTED vẫn được giữ làm dấu vết, chỉ không cộng vào đâu cả.
model PaymentAllocation {
  id            String   @id @default(uuid()) @db.Uuid
  payment_id    String   @db.Uuid
  settlement_id String   @db.Uuid
  amount        Int
  created_at    DateTime @default(now()) @db.Timestamptz(6)

  payment    Payment         @relation(fields: [payment_id], references: [id], onDelete: Cascade)
  settlement EventSettlement @relation(fields: [settlement_id], references: [id], onDelete: Cascade)

  @@unique([payment_id, settlement_id])
  @@map("payment_allocations")
}
```

- [ ] **Step 6: Validate schema**

```bash
pnpm --filter api db:format && pnpm --filter api db:validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 7: Sinh migration và Prisma client**

```bash
pnpm --filter api exec prisma migrate dev --name add_mvp_domain_tables
pnpm --filter api db:generate
```

Expected: migration mới trong `api/prisma/migrations/`, client sinh lại ở `api/src/generated/prisma`.

- [ ] **Step 8: Kiểm tra biên dịch**

```bash
pnpm --filter api build
```

Expected: build thành công, không lỗi type.

- [ ] **Step 9: Commit**

```bash
git add api/prisma api/src/generated
git commit -m "feat(db): add 8 MVP domain tables and enums"
```

---

### Task 2: Mã lỗi + guard/decorator phân quyền tổ chức

**Files:**
- Modify: `api/src/common/constants/error-codes.constant.ts`
- Create: `api/src/common/decorators/current-user.decorator.ts`
- Create: `api/src/common/decorators/org-roles.decorator.ts`
- Create: `api/src/common/guards/org-member.guard.ts`
- Test: `api/src/common/guards/org-member.guard.spec.ts`

**Interfaces:**
- Consumes: `DatabaseService` từ `../../database/database.service`, `AppException`, `ERROR_CODES`.
- Produces:
  - `@CurrentUser(): { userId: string; userEmail: string }` — param decorator.
  - `@CurrentMembership(): OrgMembership` với `type OrgMembership = { organizationId: string; role: MemberRole }`, export từ `org-roles.decorator.ts`.
  - `@OrgRoles(...roles: MemberRole[])` — method decorator.
  - `OrgMemberGuard` — class guard, dùng kèm `@UseGuards(JwtAuthGuard, OrgMemberGuard)`.

- [ ] **Step 1: Thêm mã lỗi**

Thêm vào `ERROR_CODES` trong `api/src/common/constants/error-codes.constant.ts`, đặt sau nhóm `AUTH_*`:

```typescript
  // --- Tổ chức ---
  ORG_001: { code: 'ORG_001', status: 404, message: 'Organization not found' },
  /** Đã xác thực nhưng không phải thành viên ACTIVE. 403 chứ không 404: che giấu sự tồn tại của org không đem lại gì. */
  ORG_002: { code: 'ORG_002', status: 403, message: 'Not a member of this organization' },
  ORG_003: { code: 'ORG_003', status: 403, message: 'Admin role required' },
  /** Bất biến: một tổ chức luôn còn ít nhất một ADMIN đang ACTIVE. */
  ORG_004: { code: 'ORG_004', status: 409, message: 'Organization must keep at least one admin' },
  ORG_005: { code: 'ORG_005', status: 409, message: 'Already a member' },

  // --- Lời mời ---
  INV_001: { code: 'INV_001', status: 404, message: 'Invite not found' },
  INV_002: { code: 'INV_002', status: 410, message: 'Invite expired, revoked or used up' },
```

- [ ] **Step 2: Viết test cho guard trước**

Tạo `api/src/common/guards/org-member.guard.spec.ts`:

```typescript
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../exceptions/app.exception';
import { OrgMemberGuard } from './org-member.guard';

type MembershipRow = { organization_id: string; role: 'ADMIN' | 'MEMBER' } | null;

function buildContext(params: Record<string, string>, userId?: string): ExecutionContext {
  const request = { params, userId } as Record<string, unknown>;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function buildGuard(row: MembershipRow, requiredRoles?: string[]) {
  const database = {
    organizationMember: { findFirst: jest.fn().mockResolvedValue(row) },
  };
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(requiredRoles) };
  return {
    guard: new OrgMemberGuard(database as never, reflector as unknown as Reflector),
    database,
  };
}

describe('OrgMemberGuard', () => {
  it('cho qua và gắn membership khi user là thành viên ACTIVE', async () => {
    const { guard } = buildGuard({ organization_id: 'org-1', role: 'MEMBER' });
    const context = buildContext({ orgId: 'org-1' }, 'user-1');

    await expect(guard.canActivate(context)).resolves.toBe(true);

    const request = context.switchToHttp().getRequest<{ membership?: unknown }>();
    expect(request.membership).toEqual({ organizationId: 'org-1', role: 'MEMBER' });
  });

  it('ném ORG_002 khi không phải thành viên', async () => {
    const { guard } = buildGuard(null);
    const context = buildContext({ orgId: 'org-1' }, 'user-1');

    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'ORG_002' });
  });

  it('ném ORG_003 khi route yêu cầu ADMIN mà user chỉ là MEMBER', async () => {
    const { guard } = buildGuard({ organization_id: 'org-1', role: 'MEMBER' }, ['ADMIN']);
    const context = buildContext({ orgId: 'org-1' }, 'user-1');

    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'ORG_003' });
  });

  it('ném ORG_001 khi route thiếu param orgId', async () => {
    const { guard } = buildGuard({ organization_id: 'org-1', role: 'ADMIN' });
    const context = buildContext({}, 'user-1');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(AppException);
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

```bash
pnpm --filter api test -- org-member.guard
```

Expected: FAIL — `Cannot find module './org-member.guard'`.

- [ ] **Step 4: Viết decorator**

Tạo `api/src/common/decorators/current-user.decorator.ts`:

```typescript
import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';

export type AuthenticatedUser = { userId: string; userEmail: string };

/**
 * Input: Request đã đi qua JwtAuthGuard (guard gán sẵn userId/userEmail).
 * Output: `{ userId, userEmail }` — thay cho việc bới thủ công `request.userId` ở từng handler.
 */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedUser => {
  const request = context.switchToHttp().getRequest<Request & { userId: string; userEmail: string }>();
  return { userId: request.userId, userEmail: request.userEmail };
});
```

Tạo `api/src/common/decorators/org-roles.decorator.ts`:

```typescript
import { ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';
import { MemberRole } from '../../generated/prisma/enums';

export const ORG_ROLES_KEY = 'org_roles';

export type OrgMembership = { organizationId: string; role: MemberRole };

/**
 * Input: Danh sách role được phép truy cập route.
 * Output: Metadata cho OrgMemberGuard đọc. Không gắn decorator = mọi thành viên ACTIVE đều vào được.
 */
export const OrgRoles = (...roles: MemberRole[]) => SetMetadata(ORG_ROLES_KEY, roles);

/**
 * Input: Request đã đi qua OrgMemberGuard.
 * Output: Membership của user trong org đang thao tác.
 */
export const CurrentMembership = createParamDecorator((_data: unknown, context: ExecutionContext): OrgMembership => {
  const request = context.switchToHttp().getRequest<Request & { membership: OrgMembership }>();
  return request.membership;
});
```

- [ ] **Step 5: Viết guard**

Tạo `api/src/common/guards/org-member.guard.ts`:

```typescript
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { DatabaseService } from '../../database/database.service';
import { MemberRole } from '../../generated/prisma/enums';
import { ERROR_CODES } from '../constants/error-codes.constant';
import { ORG_ROLES_KEY, OrgMembership } from '../decorators/org-roles.decorator';
import { AppException } from '../exceptions/app.exception';

@Injectable()
export class OrgMemberGuard implements CanActivate {
  /**
   * Input: DatabaseService để tra membership, Reflector để đọc metadata @OrgRoles.
   * Output: Guard chặn request của người không phải thành viên ACTIVE của org trên URL.
   *         Luôn dùng SAU JwtAuthGuard vì cần request.userId.
   */
  constructor(
    private readonly database: DatabaseService,
    private readonly reflector: Reflector,
  ) {}

  /**
   * Input: ExecutionContext của request có param `:orgId`.
   * Output: true và gắn `request.membership`. Thiếu orgId → ORG_001.
   *         Không phải thành viên ACTIVE → ORG_002. Thiếu role yêu cầu → ORG_003.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { userId?: string; membership?: OrgMembership }>();

    const organizationId = request.params?.orgId;
    if (!organizationId) throw new AppException(ERROR_CODES.ORG_001);
    if (!request.userId) throw new AppException(ERROR_CODES.AUTH_001);

    const membership = await this.database.organizationMember.findFirst({
      where: { organization_id: organizationId, user_id: request.userId, status: 'ACTIVE' },
      select: { organization_id: true, role: true },
    });
    if (!membership) throw new AppException(ERROR_CODES.ORG_002);

    const requiredRoles = this.reflector.getAllAndOverride<MemberRole[] | undefined>(ORG_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles?.length && !requiredRoles.includes(membership.role)) {
      throw new AppException(ERROR_CODES.ORG_003);
    }

    request.membership = { organizationId: membership.organization_id, role: membership.role };
    return true;
  }
}
```

- [ ] **Step 6: Chạy test, xác nhận pass**

```bash
pnpm --filter api test -- org-member.guard
```

Expected: 4 test PASS.

- [ ] **Step 7: Commit**

```bash
git add api/src/common
git commit -m "feat(common): add org membership guard, role and user decorators"
```

---

### Task 3: Module organizations — tạo, danh sách, chi tiết, cập nhật

**Files:**
- Create: `api/src/organizations/organizations.module.ts`
- Create: `api/src/organizations/organizations.controller.ts`
- Create: `api/src/organizations/organizations.service.ts`
- Create: `api/src/organizations/dto/create-organization.dto.ts`
- Create: `api/src/organizations/dto/update-organization.dto.ts`
- Modify: `api/src/app.module.ts`

**Interfaces:**
- Consumes: `OrgMemberGuard`, `@OrgRoles`, `@CurrentUser`, `@CurrentMembership`, `JwtAuthGuard`, `DatabaseService`.
- Produces:
  - `OrganizationsService.create(userId, dto): Promise<OrganizationSummary>`
  - `OrganizationsService.listForUser(userId): Promise<OrganizationSummary[]>`
  - `OrganizationsService.getDetail(orgId, role): Promise<OrganizationDetail>`
  - `OrganizationsService.update(orgId, dto): Promise<OrganizationSummary>`
  - `type OrganizationSummary = { id: string; name: string; avatarUrl: string | null; role: MemberRole; memberCount: number }`
  - `type OrganizationDetail = OrganizationSummary & { createdAt: Date }`
  - `OrganizationsModule` export `OrganizationsService`.

- [ ] **Step 1: Viết DTO**

`api/src/organizations/dto/create-organization.dto.ts`:

```typescript
import { IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @Length(2, 255)
  name!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  avatarUrl?: string;
}
```

`api/src/organizations/dto/update-organization.dto.ts`:

```typescript
import { IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @Length(2, 255)
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  avatarUrl?: string;
}
```

- [ ] **Step 2: Viết service**

`api/src/organizations/organizations.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { DatabaseService } from '../database/database.service';
import { MemberRole } from '../generated/prisma/enums';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

export type OrganizationSummary = {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: MemberRole;
  memberCount: number;
};

export type OrganizationDetail = OrganizationSummary & { createdAt: Date };

@Injectable()
export class OrganizationsService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Input: userId người tạo và thông tin tổ chức.
   * Output: Tạo org + gán người tạo làm ADMIN trong cùng transaction — không được phép tồn tại
   *         org không có admin, dù chỉ trong khoảnh khắc giữa hai câu lệnh.
   */
  async create(userId: string, dto: CreateOrganizationDto): Promise<OrganizationSummary> {
    const organization = await this.database.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: { name: dto.name, avatar_url: dto.avatarUrl ?? null, created_by: userId },
      });
      await tx.organizationMember.create({
        data: { organization_id: created.id, user_id: userId, role: 'ADMIN', status: 'ACTIVE' },
      });
      return created;
    });

    return {
      id: organization.id,
      name: organization.name,
      avatarUrl: organization.avatar_url,
      role: 'ADMIN',
      memberCount: 1,
    };
  }

  /**
   * Input: userId hiện tại.
   * Output: Danh sách tổ chức user đang tham gia (ACTIVE), kèm role và số thành viên.
   */
  async listForUser(userId: string): Promise<OrganizationSummary[]> {
    const memberships = await this.database.organizationMember.findMany({
      where: { user_id: userId, status: 'ACTIVE' },
      orderBy: { joined_at: 'asc' },
      select: {
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
            _count: { select: { members: { where: { status: 'ACTIVE' } } } },
          },
        },
      },
    });

    return memberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      avatarUrl: membership.organization.avatar_url,
      role: membership.role,
      memberCount: membership.organization._count.members,
    }));
  }

  /**
   * Input: orgId (đã qua OrgMemberGuard) và role của người gọi.
   * Output: Chi tiết tổ chức. Role lấy từ membership đã tra sẵn ở guard, không tra lại DB.
   */
  async getDetail(organizationId: string, role: MemberRole): Promise<OrganizationDetail> {
    const organization = await this.database.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        avatar_url: true,
        created_at: true,
        _count: { select: { members: { where: { status: 'ACTIVE' } } } },
      },
    });
    if (!organization) throw new AppException(ERROR_CODES.ORG_001);

    return {
      id: organization.id,
      name: organization.name,
      avatarUrl: organization.avatar_url,
      role,
      memberCount: organization._count.members,
      createdAt: organization.created_at,
    };
  }

  /**
   * Input: orgId và các trường cần đổi.
   * Output: Tổ chức sau khi cập nhật. Người gọi đã được guard xác nhận là ADMIN.
   */
  async update(organizationId: string, role: MemberRole, dto: UpdateOrganizationDto): Promise<OrganizationSummary> {
    const organization = await this.database.organization.update({
      where: { id: organizationId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.avatarUrl !== undefined ? { avatar_url: dto.avatarUrl } : {}),
      },
      select: {
        id: true,
        name: true,
        avatar_url: true,
        _count: { select: { members: { where: { status: 'ACTIVE' } } } },
      },
    });

    return {
      id: organization.id,
      name: organization.name,
      avatarUrl: organization.avatar_url,
      role,
      memberCount: organization._count.members,
    };
  }
}
```

- [ ] **Step 3: Viết controller**

`api/src/organizations/organizations.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentMembership, OrgMembership, OrgRoles } from '../common/decorators/org-roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../common/guards/org-member.guard';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  /**
   * Input: Tên tổ chức (+ avatar tuỳ chọn).
   * Output: Tổ chức mới; người tạo tự động là ADMIN.
   */
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(user.userId, dto);
  }

  /**
   * Input: Không có.
   * Output: Danh sách tổ chức user đang tham gia.
   */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.listForUser(user.userId);
  }

  /**
   * Input: orgId trên URL.
   * Output: Chi tiết tổ chức kèm role của người gọi.
   */
  @Get(':orgId')
  @UseGuards(OrgMemberGuard)
  detail(@Param('orgId', ParseUuidPipe) orgId: string, @CurrentMembership() membership: OrgMembership) {
    return this.organizationsService.getDetail(orgId, membership.role);
  }

  /**
   * Input: orgId + các trường cần đổi. Chỉ ADMIN.
   * Output: Tổ chức sau khi cập nhật.
   */
  @Patch(':orgId')
  @UseGuards(OrgMemberGuard)
  @OrgRoles('ADMIN')
  update(
    @Param('orgId', ParseUuidPipe) orgId: string,
    @CurrentMembership() membership: OrgMembership,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(orgId, membership.role, dto);
  }
}
```

- [ ] **Step 4: Viết module và nối vào app**

`api/src/organizations/organizations.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

// AuthModule để JwtAuthGuard resolve được AuthJwtService.
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
```

Trong `api/src/app.module.ts`: thêm `import { OrganizationsModule } from './organizations/organizations.module';` và thêm `OrganizationsModule` vào mảng `imports` ngay sau `AuthModule`.

- [ ] **Step 5: Kiểm tra bằng tay**

```bash
pnpm --filter api build
pnpm --filter api dev
```

Đăng nhập qua FE để có cookie, rồi trong DevTools console của tab FE:

```javascript
await (await fetch('http://localhost:8000/organizations', {
  method: 'POST', credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'CLB Cầu Lông Test' }),
})).json()
```

Expected: `{ success: true, message: 'ok', data: { id, name: 'CLB Cầu Lông Test', role: 'ADMIN', memberCount: 1 } }`

- [ ] **Step 6: Commit**

```bash
git add api/src/organizations api/src/app.module.ts
git commit -m "feat(organizations): add organization create, list, detail and update"
```

---

### Task 4: Thành viên — danh sách, đổi quyền, kick, rời nhóm

**Files:**
- Create: `api/src/organizations/members.controller.ts`
- Create: `api/src/organizations/members.service.ts`
- Create: `api/src/organizations/dto/update-member.dto.ts`
- Test: `api/src/organizations/members.service.spec.ts`
- Modify: `api/src/organizations/organizations.module.ts`

**Interfaces:**
- Consumes: `DatabaseService`, `AppException`, `ERROR_CODES`, `OrgMemberGuard`, `@OrgRoles`.
- Produces:
  - `MembersService.list(orgId): Promise<MemberView[]>`
  - `MembersService.updateRole(orgId, targetUserId, role): Promise<MemberView>`
  - `MembersService.remove(orgId, targetUserId): Promise<{ success: true }>`
  - `MembersService.leave(orgId, userId): Promise<{ success: true }>`
  - `type MemberView = { userId: string; fullName: string | null; email: string; avatarUrl: string | null; role: MemberRole; joinedAt: Date }`

- [ ] **Step 1: Viết test bất biến last-admin trước**

`api/src/organizations/members.service.spec.ts`:

```typescript
import { MembersService } from './members.service';

/** Dựng DatabaseService giả với $transaction chạy callback ngay trên chính nó. */
function buildDatabase(overrides: {
  member?: unknown;
  activeAdminCount?: number;
}) {
  const organizationMember = {
    findFirst: jest.fn().mockResolvedValue(overrides.member ?? null),
    count: jest.fn().mockResolvedValue(overrides.activeAdminCount ?? 0),
    update: jest.fn().mockResolvedValue({}),
  };
  const database = {
    organizationMember,
    $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback({ organizationMember })),
  };
  return { database, organizationMember };
}

describe('MembersService — bất biến luôn còn ít nhất một ADMIN', () => {
  it('chặn ADMIN cuối cùng tự rời nhóm', async () => {
    const { database } = buildDatabase({
      member: { id: 'm1', role: 'ADMIN', status: 'ACTIVE' },
      activeAdminCount: 1,
    });
    const service = new MembersService(database as never);

    await expect(service.leave('org-1', 'user-1')).rejects.toMatchObject({ code: 'ORG_004' });
  });

  it('cho ADMIN rời nhóm khi vẫn còn admin khác', async () => {
    const { database, organizationMember } = buildDatabase({
      member: { id: 'm1', role: 'ADMIN', status: 'ACTIVE' },
      activeAdminCount: 2,
    });
    const service = new MembersService(database as never);

    await expect(service.leave('org-1', 'user-1')).resolves.toEqual({ success: true });
    expect(organizationMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'LEFT' }) }),
    );
  });

  it('cho MEMBER rời nhóm mà không cần đếm admin', async () => {
    const { database } = buildDatabase({
      member: { id: 'm1', role: 'MEMBER', status: 'ACTIVE' },
      activeAdminCount: 1,
    });
    const service = new MembersService(database as never);

    await expect(service.leave('org-1', 'user-1')).resolves.toEqual({ success: true });
  });

  it('chặn hạ quyền ADMIN cuối cùng xuống MEMBER', async () => {
    const { database } = buildDatabase({
      member: { id: 'm1', role: 'ADMIN', status: 'ACTIVE' },
      activeAdminCount: 1,
    });
    const service = new MembersService(database as never);

    await expect(service.updateRole('org-1', 'user-1', 'MEMBER')).rejects.toMatchObject({ code: 'ORG_004' });
  });

  it('chặn kick ADMIN cuối cùng', async () => {
    const { database } = buildDatabase({
      member: { id: 'm1', role: 'ADMIN', status: 'ACTIVE' },
      activeAdminCount: 1,
    });
    const service = new MembersService(database as never);

    await expect(service.remove('org-1', 'user-1')).rejects.toMatchObject({ code: 'ORG_004' });
  });

  it('ném ORG_002 khi thao tác trên người không phải thành viên ACTIVE', async () => {
    const { database } = buildDatabase({ member: null });
    const service = new MembersService(database as never);

    await expect(service.remove('org-1', 'ghost')).rejects.toMatchObject({ code: 'ORG_002' });
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

```bash
pnpm --filter api test -- members.service
```

Expected: FAIL — `Cannot find module './members.service'`.

- [ ] **Step 3: Viết DTO**

`api/src/organizations/dto/update-member.dto.ts`:

```typescript
import { IsIn } from 'class-validator';
import { MemberRole } from '../../generated/prisma/enums';

export class UpdateMemberDto {
  @IsIn(['ADMIN', 'MEMBER'])
  role!: MemberRole;
}
```

- [ ] **Step 4: Viết service**

`api/src/organizations/members.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { DatabaseService } from '../database/database.service';
import { MemberRole } from '../generated/prisma/enums';

export type MemberView = {
  userId: string;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  role: MemberRole;
  joinedAt: Date;
};

/** Client Prisma bên trong $transaction — chỉ cần phần organizationMember. */
type MemberTx = {
  organizationMember: {
    findFirst: (args: unknown) => Promise<{ id: string; role: MemberRole; status: string } | null>;
    count: (args: unknown) => Promise<number>;
    update: (args: unknown) => Promise<unknown>;
  };
};

@Injectable()
export class MembersService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Input: orgId.
   * Output: Danh sách thành viên ACTIVE kèm thông tin user, ADMIN xếp trước.
   */
  async list(organizationId: string): Promise<MemberView[]> {
    const members = await this.database.organizationMember.findMany({
      where: { organization_id: organizationId, status: 'ACTIVE' },
      orderBy: [{ role: 'asc' }, { joined_at: 'asc' }],
      select: {
        role: true,
        joined_at: true,
        user: { select: { id: true, full_name: true, email: true, avatar_url: true } },
      },
    });

    return members.map((member) => ({
      userId: member.user.id,
      fullName: member.user.full_name,
      email: member.user.email,
      avatarUrl: member.user.avatar_url,
      role: member.role,
      joinedAt: member.joined_at,
    }));
  }

  /**
   * Input: orgId, user bị đổi quyền, role mới.
   * Output: Cập nhật role. Hạ ADMIN cuối cùng xuống MEMBER → ORG_004.
   */
  async updateRole(organizationId: string, targetUserId: string, role: MemberRole): Promise<{ success: true }> {
    return this.database.$transaction(async (tx) => {
      const member = await this.requireActiveMember(tx as MemberTx, organizationId, targetUserId);
      if (member.role === 'ADMIN' && role === 'MEMBER') {
        await this.requireAnotherAdminExists(tx as MemberTx, organizationId);
      }
      await (tx as MemberTx).organizationMember.update({ where: { id: member.id }, data: { role } });
      return { success: true as const };
    });
  }

  /**
   * Input: orgId, user bị loại.
   * Output: Đặt status = LEFT. Loại ADMIN cuối cùng → ORG_004.
   */
  async remove(organizationId: string, targetUserId: string): Promise<{ success: true }> {
    return this.database.$transaction(async (tx) => {
      const member = await this.requireActiveMember(tx as MemberTx, organizationId, targetUserId);
      if (member.role === 'ADMIN') {
        await this.requireAnotherAdminExists(tx as MemberTx, organizationId);
      }
      await (tx as MemberTx).organizationMember.update({
        where: { id: member.id },
        data: { status: 'LEFT' },
      });
      return { success: true as const };
    });
  }

  /**
   * Input: orgId, userId của chính người gọi.
   * Output: Tự rời nhóm. Cùng bất biến với remove().
   */
  async leave(organizationId: string, userId: string): Promise<{ success: true }> {
    return this.remove(organizationId, userId);
  }

  /**
   * Input: transaction client, orgId, userId.
   * Output: Membership ACTIVE tương ứng, hoặc ném ORG_002.
   */
  private async requireActiveMember(tx: MemberTx, organizationId: string, userId: string) {
    const member = await tx.organizationMember.findFirst({
      where: { organization_id: organizationId, user_id: userId, status: 'ACTIVE' },
      select: { id: true, role: true, status: true },
    });
    if (!member) throw new AppException(ERROR_CODES.ORG_002);
    return member;
  }

  /**
   * Input: transaction client, orgId.
   * Output: Không trả gì nếu còn ≥ 2 ADMIN ACTIVE; ngược lại ném ORG_004.
   *         Đếm bên trong transaction để không có cửa sổ race giữa đếm và ghi.
   */
  private async requireAnotherAdminExists(tx: MemberTx, organizationId: string): Promise<void> {
    const adminCount = await tx.organizationMember.count({
      where: { organization_id: organizationId, role: 'ADMIN', status: 'ACTIVE' },
    });
    if (adminCount <= 1) throw new AppException(ERROR_CODES.ORG_004);
  }
}
```

- [ ] **Step 5: Chạy test, xác nhận pass**

```bash
pnpm --filter api test -- members.service
```

Expected: 6 test PASS.

- [ ] **Step 6: Viết controller**

`api/src/organizations/members.controller.ts`:

```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../common/guards/org-member.guard';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MembersService } from './members.service';

@Controller('organizations/:orgId')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  /**
   * Input: orgId.
   * Output: Danh sách thành viên ACTIVE.
   */
  @Get('members')
  list(@Param('orgId', ParseUuidPipe) orgId: string) {
    return this.membersService.list(orgId);
  }

  /**
   * Input: orgId, userId bị đổi quyền, role mới. Chỉ ADMIN.
   * Output: `{ success: true }`.
   */
  @Patch('members/:userId')
  @OrgRoles('ADMIN')
  updateRole(
    @Param('orgId', ParseUuidPipe) orgId: string,
    @Param('userId', ParseUuidPipe) userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.membersService.updateRole(orgId, userId, dto.role);
  }

  /**
   * Input: orgId, userId bị loại. Chỉ ADMIN.
   * Output: `{ success: true }`.
   */
  @Delete('members/:userId')
  @OrgRoles('ADMIN')
  remove(@Param('orgId', ParseUuidPipe) orgId: string, @Param('userId', ParseUuidPipe) userId: string) {
    return this.membersService.remove(orgId, userId);
  }

  /**
   * Input: orgId; người gọi là chính mình.
   * Output: `{ success: true }`. ADMIN cuối cùng không rời được (ORG_004).
   */
  @Post('leave')
  leave(@Param('orgId', ParseUuidPipe) orgId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.leave(orgId, user.userId);
  }
}
```

- [ ] **Step 7: Đăng ký vào module**

Trong `api/src/organizations/organizations.module.ts`: thêm `MembersController` vào `controllers`, `MembersService` vào `providers` và `exports`.

- [ ] **Step 8: Build và commit**

```bash
pnpm --filter api build
git add api/src/organizations
git commit -m "feat(organizations): add member listing, role change, removal and leave"
```

---

### Task 5: Invite link — tạo, thu hồi, preview, tham gia

**Files:**
- Create: `api/src/organizations/invites.utils.ts`
- Create: `api/src/organizations/invites.service.ts`
- Create: `api/src/organizations/invites.controller.ts`
- Create: `api/src/organizations/dto/create-invite.dto.ts`
- Test: `api/src/organizations/invites.utils.spec.ts`
- Modify: `api/src/organizations/organizations.module.ts`

**Interfaces:**
- Consumes: `DatabaseService`, `ConfigService` (`FRONTEND_ORIGIN`), `AppException`, `ERROR_CODES`.
- Produces:
  - `generateInviteToken(): string` — 32 byte random, base64url.
  - `hashInviteToken(raw: string): string` — SHA-256 hex.
  - `isInviteUsable(invite: InviteValidityInput, now: Date): boolean` với `type InviteValidityInput = { revoked_at: Date | null; expires_at: Date | null; max_uses: number | null; used_count: number }`.
  - `buildInviteUrl(frontendOrigin: string, rawToken: string): string`.
  - `InvitesService.create(orgId, userId, dto): Promise<InviteCreated>` — `type InviteCreated = { id: string; url: string; expiresAt: Date | null; maxUses: number | null }`. `url` chỉ trả về đúng lần này.
  - `InvitesService.list(orgId): Promise<InviteView[]>`
  - `InvitesService.revoke(orgId, inviteId): Promise<{ success: true }>`
  - `InvitesService.preview(rawToken): Promise<{ organizationId: string; organizationName: string; organizationAvatarUrl: string | null; usable: boolean }>`
  - `InvitesService.accept(rawToken, userId): Promise<{ organizationId: string; organizationName: string }>`

- [ ] **Step 1: Viết test cho utils trước**

`api/src/organizations/invites.utils.spec.ts`:

```typescript
import { buildInviteUrl, generateInviteToken, hashInviteToken, isInviteUsable } from './invites.utils';

const NOW = new Date('2026-08-13T10:00:00.000Z');

function invite(overrides: Partial<Parameters<typeof isInviteUsable>[0]> = {}) {
  return { revoked_at: null, expires_at: null, max_uses: null, used_count: 0, ...overrides };
}

describe('isInviteUsable', () => {
  it('còn dùng được khi không giới hạn gì', () => {
    expect(isInviteUsable(invite(), NOW)).toBe(true);
  });

  it('hết hiệu lực khi đã bị thu hồi', () => {
    expect(isInviteUsable(invite({ revoked_at: new Date('2026-08-12T00:00:00.000Z') }), NOW)).toBe(false);
  });

  it('hết hiệu lực khi quá hạn', () => {
    expect(isInviteUsable(invite({ expires_at: new Date('2026-08-13T09:59:59.000Z') }), NOW)).toBe(false);
  });

  it('còn hiệu lực đúng tại thời điểm sát hạn', () => {
    expect(isInviteUsable(invite({ expires_at: new Date('2026-08-13T10:00:01.000Z') }), NOW)).toBe(true);
  });

  it('hết hiệu lực đúng khi đã dùng hết lượt', () => {
    expect(isInviteUsable(invite({ max_uses: 3, used_count: 3 }), NOW)).toBe(false);
  });

  it('còn hiệu lực khi vẫn dư lượt', () => {
    expect(isInviteUsable(invite({ max_uses: 3, used_count: 2 }), NOW)).toBe(true);
  });
});

describe('token invite', () => {
  it('sinh token khác nhau mỗi lần và an toàn cho URL', () => {
    const first = generateInviteToken();
    const second = generateInviteToken();
    expect(first).not.toEqual(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(first)).toBe(first);
  });

  it('hash tất định và không chứa token thô', () => {
    const raw = generateInviteToken();
    expect(hashInviteToken(raw)).toBe(hashInviteToken(raw));
    expect(hashInviteToken(raw)).toHaveLength(64);
    expect(hashInviteToken(raw)).not.toContain(raw);
  });
});

describe('buildInviteUrl', () => {
  it('ghép đúng đường dẫn và bỏ dấu / thừa ở origin', () => {
    expect(buildInviteUrl('http://localhost:3000/', 'abc')).toBe('http://localhost:3000/invite/abc');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

```bash
pnpm --filter api test -- invites.utils
```

Expected: FAIL — `Cannot find module './invites.utils'`.

- [ ] **Step 3: Viết utils**

`api/src/organizations/invites.utils.ts`:

```typescript
import { createHash, randomBytes } from 'node:crypto';

/** Đủ để suy ra hiệu lực của một invite mà không cần cả row. */
export type InviteValidityInput = {
  revoked_at: Date | null;
  expires_at: Date | null;
  max_uses: number | null;
  used_count: number;
};

/**
 * Input: Không có.
 * Output: Token thô 32 byte ngẫu nhiên, base64url — an toàn để nhét thẳng vào URL.
 */
export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Input: Token thô.
 * Output: SHA-256 hex. DB chỉ lưu giá trị này; lộ DB cũng không dựng lại được link mời.
 */
export function hashInviteToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Input: Các cột quyết định hiệu lực của invite và mốc thời gian hiện tại.
 * Output: true nếu invite còn dùng được. Ba điều kiện phải đồng thời đúng.
 */
export function isInviteUsable(invite: InviteValidityInput, now: Date): boolean {
  if (invite.revoked_at !== null) return false;
  if (invite.expires_at !== null && now.getTime() >= invite.expires_at.getTime()) return false;
  if (invite.max_uses !== null && invite.used_count >= invite.max_uses) return false;
  return true;
}

/**
 * Input: Origin của frontend và token thô.
 * Output: URL đầy đủ để admin copy đi gửi.
 */
export function buildInviteUrl(frontendOrigin: string, rawToken: string): string {
  return `${frontendOrigin.replace(/\/+$/, '')}/invite/${rawToken}`;
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

```bash
pnpm --filter api test -- invites.utils
```

Expected: 9 test PASS.

- [ ] **Step 5: Viết DTO**

`api/src/organizations/dto/create-invite.dto.ts`:

```typescript
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Min } from 'class-validator';

export class CreateInviteDto {
  /** Bỏ trống = không hết hạn. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;

  /** Bỏ trống = không giới hạn số lượt. */
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;
}
```

- [ ] **Step 6: Viết service**

`api/src/organizations/invites.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { DatabaseService } from '../database/database.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { buildInviteUrl, generateInviteToken, hashInviteToken, isInviteUsable } from './invites.utils';

export type InviteCreated = { id: string; url: string; expiresAt: Date | null; maxUses: number | null };

export type InviteView = {
  id: string;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  revokedAt: Date | null;
  usable: boolean;
  createdAt: Date;
};

export type InvitePreview = {
  organizationId: string;
  organizationName: string;
  organizationAvatarUrl: string | null;
  usable: boolean;
};

@Injectable()
export class InvitesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Input: orgId, admin tạo, cấu hình hạn dùng / số lượt.
   * Output: Invite mới kèm URL đầy đủ. URL chỉ trả về ĐÚNG LẦN NÀY — DB chỉ giữ hash,
   *         mất link thì phải tạo cái mới.
   */
  async create(organizationId: string, userId: string, dto: CreateInviteDto): Promise<InviteCreated> {
    const rawToken = generateInviteToken();
    const invite = await this.database.organizationInvite.create({
      data: {
        organization_id: organizationId,
        type: 'LINK',
        token_hash: hashInviteToken(rawToken),
        expires_at: dto.expiresAt ?? null,
        max_uses: dto.maxUses ?? null,
        created_by: userId,
      },
      select: { id: true, expires_at: true, max_uses: true },
    });

    const frontendOrigin = this.configService.get<string>('FRONTEND_ORIGIN') ?? 'http://localhost:3000';
    return {
      id: invite.id,
      url: buildInviteUrl(frontendOrigin, rawToken),
      expiresAt: invite.expires_at,
      maxUses: invite.max_uses,
    };
  }

  /**
   * Input: orgId.
   * Output: Các invite của org kèm cờ `usable` tính tại thời điểm đọc. Không bao giờ trả token.
   */
  async list(organizationId: string): Promise<InviteView[]> {
    const invites = await this.database.organizationInvite.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        expires_at: true,
        max_uses: true,
        used_count: true,
        revoked_at: true,
        created_at: true,
      },
    });

    const now = new Date();
    return invites.map((invite) => ({
      id: invite.id,
      expiresAt: invite.expires_at,
      maxUses: invite.max_uses,
      usedCount: invite.used_count,
      revokedAt: invite.revoked_at,
      usable: isInviteUsable(invite, now),
      createdAt: invite.created_at,
    }));
  }

  /**
   * Input: orgId, inviteId.
   * Output: Đặt revoked_at = now. Thu hồi lại lần nữa là no-op, không lỗi.
   */
  async revoke(organizationId: string, inviteId: string): Promise<{ success: true }> {
    const result = await this.database.organizationInvite.updateMany({
      where: { id: inviteId, organization_id: organizationId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    if (result.count === 0) {
      const exists = await this.database.organizationInvite.findFirst({
        where: { id: inviteId, organization_id: organizationId },
        select: { id: true },
      });
      if (!exists) throw new AppException(ERROR_CODES.INV_001);
    }
    return { success: true };
  }

  /**
   * Input: Token thô từ URL.
   * Output: Tên tổ chức để hiển thị trước khi người dùng bấm tham gia. Public (chưa đăng nhập
   *         cũng xem được) nên chỉ trả tên và avatar, không trả gì thêm.
   */
  async preview(rawToken: string): Promise<InvitePreview> {
    const invite = await this.database.organizationInvite.findUnique({
      where: { token_hash: hashInviteToken(rawToken) },
      select: {
        revoked_at: true,
        expires_at: true,
        max_uses: true,
        used_count: true,
        organization: { select: { id: true, name: true, avatar_url: true } },
      },
    });
    if (!invite) throw new AppException(ERROR_CODES.INV_001);

    return {
      organizationId: invite.organization.id,
      organizationName: invite.organization.name,
      organizationAvatarUrl: invite.organization.avatar_url,
      usable: isInviteUsable(invite, new Date()),
    };
  }

  /**
   * Input: Token thô, userId người tham gia.
   * Output: Tổ chức vừa tham gia.
   *
   *         Chạy trong transaction và khoá row invite bằng `FOR UPDATE`: không có khoá thì
   *         hai người bấm cùng lúc trên link còn đúng 1 lượt sẽ cùng đọc used_count = 0
   *         và cùng vào được, vượt max_uses.
   *
   *         Bấm lại link khi đã là thành viên KHÔNG đốt thêm lượt.
   */
  async accept(rawToken: string, userId: string): Promise<{ organizationId: string; organizationName: string }> {
    const tokenHash = hashInviteToken(rawToken);

    return this.database.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        { id: string; organization_id: string; revoked_at: Date | null; expires_at: Date | null; max_uses: number | null; used_count: number }[]
      >`SELECT id, organization_id, revoked_at, expires_at, max_uses, used_count
        FROM organization_invites WHERE token_hash = ${tokenHash} FOR UPDATE`;

      const invite = locked[0];
      if (!invite) throw new AppException(ERROR_CODES.INV_001);
      if (!isInviteUsable(invite, new Date())) throw new AppException(ERROR_CODES.INV_002);

      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: invite.organization_id },
        select: { id: true, name: true },
      });

      const existing = await tx.organizationMember.findUnique({
        where: { organization_id_user_id: { organization_id: invite.organization_id, user_id: userId } },
        select: { id: true, status: true },
      });

      if (existing?.status === 'ACTIVE') {
        return { organizationId: organization.id, organizationName: organization.name };
      }

      if (existing) {
        await tx.organizationMember.update({
          where: { id: existing.id },
          data: { status: 'ACTIVE', joined_at: new Date() },
        });
      } else {
        await tx.organizationMember.create({
          data: {
            organization_id: invite.organization_id,
            user_id: userId,
            role: 'MEMBER',
            status: 'ACTIVE',
          },
        });
      }

      await tx.organizationInvite.update({
        where: { id: invite.id },
        data: { used_count: { increment: 1 } },
      });

      return { organizationId: organization.id, organizationName: organization.name };
    });
  }
}
```

- [ ] **Step 7: Viết controller**

`api/src/organizations/invites.controller.ts` — chứa hai controller: một cho route trong org (cần ADMIN), một cho route theo token.

```typescript
import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../common/guards/org-member.guard';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { CreateInviteDto } from './dto/create-invite.dto';
import { InvitesService } from './invites.service';

@Controller('organizations/:orgId/invites')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
@OrgRoles('ADMIN')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  /**
   * Input: orgId + cấu hình hạn dùng/số lượt.
   * Output: Invite mới kèm URL. URL chỉ xuất hiện đúng lần này.
   */
  @Post()
  create(
    @Param('orgId', ParseUuidPipe) orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInviteDto,
  ) {
    return this.invitesService.create(orgId, user.userId, dto);
  }

  /**
   * Input: orgId.
   * Output: Danh sách invite kèm cờ còn dùng được hay không.
   */
  @Get()
  list(@Param('orgId', ParseUuidPipe) orgId: string) {
    return this.invitesService.list(orgId);
  }

  /**
   * Input: orgId, inviteId.
   * Output: `{ success: true }`.
   */
  @Delete(':inviteId')
  revoke(@Param('orgId', ParseUuidPipe) orgId: string, @Param('inviteId', ParseUuidPipe) inviteId: string) {
    return this.invitesService.revoke(orgId, inviteId);
  }
}

@Controller('invites')
export class InviteTokenController {
  constructor(private readonly invitesService: InvitesService) {}

  /**
   * Input: Token thô trên URL.
   * Output: Tên tổ chức + cờ còn hiệu lực. PUBLIC — cố tình không có guard để người chưa
   *         đăng nhập vẫn thấy mình được mời vào đâu trước khi quyết định login.
   */
  @Get(':token')
  preview(@Param('token') token: string) {
    return this.invitesService.preview(token);
  }

  /**
   * Input: Token thô + user đã đăng nhập.
   * Output: Tổ chức vừa tham gia.
   */
  @Post(':token/accept')
  @UseGuards(JwtAuthGuard)
  accept(@Param('token') token: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invitesService.accept(token, user.userId);
  }
}
```

- [ ] **Step 8: Đăng ký vào module**

Trong `api/src/organizations/organizations.module.ts`: thêm `InvitesController` và `InviteTokenController` vào `controllers`, `InvitesService` vào `providers` và `exports`.

- [ ] **Step 9: Kiểm tra bằng tay đường đi trọn vẹn**

```bash
pnpm --filter api build && pnpm --filter api dev
```

Trong DevTools console (đã đăng nhập, thay `<ORG_ID>`):

```javascript
const invite = (await (await fetch('http://localhost:8000/organizations/<ORG_ID>/invites', {
  method: 'POST', credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ maxUses: 2 }),
})).json()).data
const token = invite.url.split('/invite/')[1]
await (await fetch(`http://localhost:8000/invites/${token}`)).json()
```

Expected: preview trả `{ organizationName, usable: true }`. Gọi `POST /invites/<token>/accept` bằng chính tài khoản đang là ADMIN → trả về org, `used_count` **không** tăng (kiểm bằng `GET /organizations/<ORG_ID>/invites`).

- [ ] **Step 10: Chạy toàn bộ test và commit**

```bash
pnpm --filter api test
git add api/src/organizations
git commit -m "feat(organizations): add invite link create, revoke, preview and accept"
```

---

### Task 6: FE — schema, type, API client và hook cho tổ chức

**Files:**
- Create: `ui/src/schema/organization.ts`
- Create: `ui/src/types/organization.ts`
- Create: `ui/src/api/organizations.ts`
- Create: `ui/src/hooks/use-organizations.ts`
- Create: `ui/src/lib/api-error.ts`

**Interfaces:**
- Consumes: `apiClient` từ `@/api/client`, `envelope` từ `@/schema/envelope`.
- Produces:
  - Schema: `organizationSummarySchema`, `organizationDetailSchema`, `memberSchema`, `inviteSchema`, `inviteCreatedSchema`, `invitePreviewSchema`.
  - Type: `OrganizationSummary`, `OrganizationDetail`, `Member`, `Invite`, `InviteCreated`, `InvitePreview`, `MemberRole`.
  - API: `fetchOrganizations`, `createOrganization`, `fetchOrganization`, `fetchMembers`, `updateMemberRole`, `removeMember`, `leaveOrganization`, `fetchInvites`, `createInvite`, `revokeInvite`, `fetchInvitePreview`, `acceptInvite`.
  - Hook: `useOrganizations`, `useOrganization`, `useCreateOrganization`, `useMembers`, `useUpdateMemberRole`, `useRemoveMember`, `useLeaveOrganization`, `useInvites`, `useCreateInvite`, `useRevokeInvite`, `useInvitePreview`, `useAcceptInvite`.
  - `getApiErrorCode(error: unknown): string | undefined` và `getApiErrorMessage(error: unknown, fallback: string): string`.

- [ ] **Step 1: Viết helper đọc mã lỗi**

`ui/src/lib/api-error.ts`:

```typescript
import axios from "axios"

/** Message tiếng Việt theo mã lỗi BE. BE trả message tiếng Anh, FE tự dịch theo `code`. */
const ERROR_MESSAGES: Record<string, string> = {
  ORG_001: "Không tìm thấy tổ chức",
  ORG_002: "Bạn không phải thành viên của tổ chức này",
  ORG_003: "Chỉ quản trị viên mới làm được việc này",
  ORG_004: "Tổ chức phải còn ít nhất một quản trị viên",
  ORG_005: "Bạn đã là thành viên rồi",
  INV_001: "Không tìm thấy lời mời",
  INV_002: "Lời mời đã hết hạn, bị thu hồi hoặc hết lượt dùng",
  VALIDATION_001: "Dữ liệu không hợp lệ",
}

/**
 * Input: Lỗi bất kỳ ném ra từ axios.
 * Output: Mã lỗi nghiệp vụ của BE nếu có.
 */
export function getApiErrorCode(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) return undefined
  return (error.response?.data as { code?: string } | undefined)?.code
}

/**
 * Input: Lỗi bất kỳ và câu mặc định khi không nhận ra mã.
 * Output: Câu tiếng Việt để hiển thị. Khớp theo `code`, KHÔNG dùng `message` của BE.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  const code = getApiErrorCode(error)
  return (code && ERROR_MESSAGES[code]) || fallback
}
```

- [ ] **Step 2: Viết zod schema**

`ui/src/schema/organization.ts`:

```typescript
import { z } from "zod"

export const memberRoleSchema = z.enum(["ADMIN", "MEMBER"])

export const organizationSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  role: memberRoleSchema,
  memberCount: z.number().int(),
})

export const organizationDetailSchema = organizationSummarySchema.extend({
  createdAt: z.iso.datetime(),
})

export const memberSchema = z.object({
  userId: z.uuid(),
  fullName: z.string().nullable(),
  email: z.email(),
  avatarUrl: z.string().nullable(),
  role: memberRoleSchema,
  joinedAt: z.iso.datetime(),
})

export const inviteSchema = z.object({
  id: z.uuid(),
  expiresAt: z.iso.datetime().nullable(),
  maxUses: z.number().int().nullable(),
  usedCount: z.number().int(),
  revokedAt: z.iso.datetime().nullable(),
  usable: z.boolean(),
  createdAt: z.iso.datetime(),
})

export const inviteCreatedSchema = z.object({
  id: z.uuid(),
  url: z.url(),
  expiresAt: z.iso.datetime().nullable(),
  maxUses: z.number().int().nullable(),
})

export const invitePreviewSchema = z.object({
  organizationId: z.uuid(),
  organizationName: z.string(),
  organizationAvatarUrl: z.string().nullable(),
  usable: z.boolean(),
})

export const acceptInviteSchema = z.object({
  organizationId: z.uuid(),
  organizationName: z.string(),
})

export const successSchema = z.object({ success: z.literal(true) })
```

- [ ] **Step 3: Viết type**

`ui/src/types/organization.ts`:

```typescript
import type { z } from "zod"
import type {
  inviteCreatedSchema,
  invitePreviewSchema,
  inviteSchema,
  memberRoleSchema,
  memberSchema,
  organizationDetailSchema,
  organizationSummarySchema,
} from "@/schema/organization"

export type MemberRole = z.infer<typeof memberRoleSchema>
export type OrganizationSummary = z.infer<typeof organizationSummarySchema>
export type OrganizationDetail = z.infer<typeof organizationDetailSchema>
export type Member = z.infer<typeof memberSchema>
export type Invite = z.infer<typeof inviteSchema>
export type InviteCreated = z.infer<typeof inviteCreatedSchema>
export type InvitePreview = z.infer<typeof invitePreviewSchema>
```

- [ ] **Step 4: Viết hàm gọi API**

`ui/src/api/organizations.ts`:

```typescript
import { apiClient } from "@/api/client"
import { envelope } from "@/schema/envelope"
import {
  acceptInviteSchema,
  inviteCreatedSchema,
  invitePreviewSchema,
  inviteSchema,
  memberSchema,
  organizationDetailSchema,
  organizationSummarySchema,
  successSchema,
} from "@/schema/organization"
import type { z } from "zod"
import type {
  Invite,
  InviteCreated,
  InvitePreview,
  Member,
  MemberRole,
  OrganizationDetail,
  OrganizationSummary,
} from "@/types/organization"

/**
 * Input: Schema cho `data` và promise trả về từ axios.
 * Output: `data` đã parse. Không tin kiểu trả về của BE — sai shape là lỗi ngay tại đây.
 */
async function parsed<T extends z.ZodTypeAny>(
  schema: T,
  request: Promise<{ data: unknown }>,
): Promise<z.infer<T>> {
  const response = await request
  return envelope(schema).parse(response.data).data
}

export function fetchOrganizations(): Promise<OrganizationSummary[]> {
  return parsed(organizationSummarySchema.array(), apiClient.get("/organizations"))
}

export function createOrganization(input: { name: string; avatarUrl?: string }): Promise<OrganizationSummary> {
  return parsed(organizationSummarySchema, apiClient.post("/organizations", input))
}

export function fetchOrganization(orgId: string): Promise<OrganizationDetail> {
  return parsed(organizationDetailSchema, apiClient.get(`/organizations/${orgId}`))
}

export function fetchMembers(orgId: string): Promise<Member[]> {
  return parsed(memberSchema.array(), apiClient.get(`/organizations/${orgId}/members`))
}

export function updateMemberRole(orgId: string, userId: string, role: MemberRole) {
  return parsed(successSchema, apiClient.patch(`/organizations/${orgId}/members/${userId}`, { role }))
}

export function removeMember(orgId: string, userId: string) {
  return parsed(successSchema, apiClient.delete(`/organizations/${orgId}/members/${userId}`))
}

export function leaveOrganization(orgId: string) {
  return parsed(successSchema, apiClient.post(`/organizations/${orgId}/leave`))
}

export function fetchInvites(orgId: string): Promise<Invite[]> {
  return parsed(inviteSchema.array(), apiClient.get(`/organizations/${orgId}/invites`))
}

export function createInvite(
  orgId: string,
  input: { expiresAt?: string; maxUses?: number },
): Promise<InviteCreated> {
  return parsed(inviteCreatedSchema, apiClient.post(`/organizations/${orgId}/invites`, input))
}

export function revokeInvite(orgId: string, inviteId: string) {
  return parsed(successSchema, apiClient.delete(`/organizations/${orgId}/invites/${inviteId}`))
}

export function fetchInvitePreview(token: string): Promise<InvitePreview> {
  return parsed(invitePreviewSchema, apiClient.get(`/invites/${token}`))
}

export function acceptInvite(token: string) {
  return parsed(acceptInviteSchema, apiClient.post(`/invites/${token}/accept`))
}
```

- [ ] **Step 5: Viết hook**

`ui/src/hooks/use-organizations.ts`:

```typescript
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  acceptInvite,
  createInvite,
  createOrganization,
  fetchInvitePreview,
  fetchInvites,
  fetchMembers,
  fetchOrganization,
  fetchOrganizations,
  leaveOrganization,
  removeMember,
  revokeInvite,
  updateMemberRole,
} from "@/api/organizations"
import { getApiErrorMessage } from "@/lib/api-error"
import type { MemberRole } from "@/types/organization"

export const orgKeys = {
  all: ["orgs"] as const,
  detail: (orgId: string) => ["org", orgId] as const,
  members: (orgId: string) => ["org", orgId, "members"] as const,
  invites: (orgId: string) => ["org", orgId, "invites"] as const,
  invitePreview: (token: string) => ["invite", token] as const,
}

export function useOrganizations() {
  return useQuery({ queryKey: orgKeys.all, queryFn: fetchOrganizations })
}

export function useOrganization(orgId: string) {
  return useQuery({ queryKey: orgKeys.detail(orgId), queryFn: () => fetchOrganization(orgId), enabled: !!orgId })
}

export function useCreateOrganization() {
  const queryClient = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: createOrganization,
    onSuccess: (organization) => {
      void queryClient.invalidateQueries({ queryKey: orgKeys.all })
      toast.success(`Đã tạo ${organization.name}`)
      router.replace(`/orgs/${organization.id}`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không tạo được tổ chức")),
  })
}

export function useMembers(orgId: string) {
  return useQuery({ queryKey: orgKeys.members(orgId), queryFn: () => fetchMembers(orgId), enabled: !!orgId })
}

export function useUpdateMemberRole(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { userId: string; role: MemberRole }) =>
      updateMemberRole(orgId, input.userId, input.role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys.members(orgId) })
      toast.success("Đã cập nhật quyền")
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không đổi được quyền")),
  })
}

export function useRemoveMember(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => removeMember(orgId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys.members(orgId) })
      toast.success("Đã xoá thành viên")
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không xoá được thành viên")),
  })
}

export function useLeaveOrganization(orgId: string) {
  const queryClient = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: () => leaveOrganization(orgId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys.all })
      toast.success("Đã rời nhóm")
      router.replace("/")
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không rời được nhóm")),
  })
}

export function useInvites(orgId: string) {
  return useQuery({ queryKey: orgKeys.invites(orgId), queryFn: () => fetchInvites(orgId), enabled: !!orgId })
}

export function useCreateInvite(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { expiresAt?: string; maxUses?: number }) => createInvite(orgId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: orgKeys.invites(orgId) }),
    onError: (error) => toast.error(getApiErrorMessage(error, "Không tạo được link mời")),
  })
}

export function useRevokeInvite(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (inviteId: string) => revokeInvite(orgId, inviteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgKeys.invites(orgId) })
      toast.success("Đã thu hồi link")
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thu hồi được link")),
  })
}

export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: orgKeys.invitePreview(token),
    queryFn: () => fetchInvitePreview(token),
    enabled: !!token,
    retry: false,
  })
}

export function useAcceptInvite(token: string) {
  const queryClient = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: () => acceptInvite(token),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: orgKeys.all })
      toast.success(`Đã tham gia ${result.organizationName}`)
      router.replace(`/orgs/${result.organizationId}`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không tham gia được")),
  })
}
```

- [ ] **Step 6: Kiểm tra type và commit**

```bash
pnpm --filter ui exec tsc --noEmit
git add ui/src/schema ui/src/types ui/src/api ui/src/hooks ui/src/lib
git commit -m "feat(ui): add organization schemas, api client and query hooks"
```

---

### Task 7: FE — app shell với sidebar và danh sách tổ chức

**Files:**
- Create: `ui/src/components/layout/app-sidebar.tsx`
- Create: `ui/src/components/layout/org-switcher.tsx`
- Modify: `ui/src/app/(private)/layout.tsx`
- Modify: `ui/src/app/(private)/page.tsx`
- Create: `ui/src/app/(private)/_components/organization-list.tsx`
- Create: `ui/src/app/(private)/orgs/new/page.tsx`
- Create: `ui/src/app/(private)/orgs/new/_components/create-organization-form.tsx`
- Create: `ui/src/app/(private)/orgs/[orgId]/layout.tsx`
- Create: `ui/src/app/(private)/orgs/[orgId]/page.tsx`

**Interfaces:**
- Consumes: `useOrganizations`, `useOrganization`, `useCreateOrganization` từ Task 6.
- Produces: `AppSidebar` (nhận `orgId?: string`), `OrgSwitcher`. Layout `(private)` bọc `SidebarProvider` + `SidebarInset`.

- [ ] **Step 1: Cài component shadcn còn thiếu**

```bash
pnpm --filter ui exec shadcn@latest add sidebar breadcrumb table badge dropdown-menu form alert-dialog skeleton sheet tooltip popover
```

Expected: các file mới trong `ui/src/components/ui/`.

- [ ] **Step 2: Viết org switcher**

`ui/src/components/layout/org-switcher.tsx` — dùng `DropdownMenu` + `SidebarMenuButton` theo mẫu block `sidebar-07`:

```tsx
"use client"

import { ChevronsUpDown, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { useOrganizations } from "@/hooks/use-organizations"

/**
 * Input: orgId đang mở (nếu có).
 * Output: Nút chuyển tổ chức ở đầu sidebar; chọn tổ chức khác thì điều hướng sang tổ chức đó.
 */
export function OrgSwitcher({ orgId }: { orgId?: string }) {
  const router = useRouter()
  const { data: organizations = [] } = useOrganizations()
  const current = organizations.find((organization) => organization.id === orgId)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <Avatar className="size-8 rounded-lg">
                <AvatarImage src={current?.avatarUrl ?? undefined} alt={current?.name ?? ""} />
                <AvatarFallback className="rounded-lg">{current?.name?.[0] ?? "?"}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{current?.name ?? "Chọn tổ chức"}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {current ? `${current.memberCount} thành viên` : "Chưa chọn"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width)" align="start">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Tổ chức của bạn</DropdownMenuLabel>
            {organizations.map((organization) => (
              <DropdownMenuItem key={organization.id} onSelect={() => router.push(`/orgs/${organization.id}`)}>
                {organization.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/orgs/new">
                <Plus className="size-4" />
                Tạo tổ chức mới
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
```

- [ ] **Step 3: Viết sidebar**

`ui/src/components/layout/app-sidebar.tsx` — menu chỉ hiện mục ADMIN khi `role === "ADMIN"`:

```tsx
"use client"

import { CalendarDays, CreditCard, Home, Repeat, Users, Wallet } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogoutButton } from "@/components/common/logout-button"
import { ThemeModeButton } from "@/components/common/theme-mode-button"
import { OrgSwitcher } from "@/components/layout/org-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useOrganization } from "@/hooks/use-organizations"

/**
 * Input: orgId đang mở (undefined khi ở trang danh sách tổ chức).
 * Output: Sidebar chính. Mục dành cho ADMIN chỉ hiện khi role của người dùng là ADMIN —
 *         đây là ẩn UI cho gọn, phân quyền thật vẫn nằm ở BE.
 */
export function AppSidebar({ orgId }: { orgId?: string }) {
  const pathname = usePathname()
  const { data: organization } = useOrganization(orgId ?? "")
  const isAdmin = organization?.role === "ADMIN"

  const items = orgId
    ? [
        { href: `/orgs/${orgId}`, label: "Tổng quan", icon: Home, adminOnly: false },
        { href: `/orgs/${orgId}/events`, label: "Các trận", icon: CalendarDays, adminOnly: false },
        { href: `/orgs/${orgId}/debts`, label: "Công nợ của tôi", icon: Wallet, adminOnly: false },
        { href: `/orgs/${orgId}/templates`, label: "Lịch định kỳ", icon: Repeat, adminOnly: true },
        { href: `/orgs/${orgId}/members`, label: "Thành viên", icon: Users, adminOnly: true },
        { href: `/orgs/${orgId}/payments`, label: "Duyệt thanh toán", icon: CreditCard, adminOnly: true },
      ]
    : []

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <OrgSwitcher orgId={orgId} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Quản lý</SidebarGroupLabel>
          <SidebarMenu>
            {items
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-2">
          <ThemeModeButton />
          <LogoutButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
```

- [ ] **Step 4: Bọc layout private**

Thay nội dung `ui/src/app/(private)/layout.tsx`:

```tsx
import { RequireAuth } from "@/components/wrapper/require-auth"
import { SidebarProvider } from "@/components/ui/sidebar"
import { PrivateShell } from "./_components/private-shell"

/**
 * Input: Nội dung các route private.
 * Output: Bọc RequireAuth + shell có sidebar. Shell tách ra client component riêng vì
 *         cần đọc orgId từ URL.
 */
export default function PrivateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <RequireAuth>
      <SidebarProvider>
        <PrivateShell>{children}</PrivateShell>
      </SidebarProvider>
    </RequireAuth>
  )
}
```

Tạo `ui/src/app/(private)/_components/private-shell.tsx`:

```tsx
"use client"

import { useParams } from "next/navigation"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"

/**
 * Input: Nội dung trang.
 * Output: Sidebar + vùng nội dung. Lấy orgId từ route param để sidebar biết đang ở tổ chức nào.
 */
export function PrivateShell({ children }: { children: React.ReactNode }) {
  const params = useParams<{ orgId?: string }>()

  return (
    <>
      <AppSidebar orgId={params.orgId} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  )
}
```

`SidebarInset`/`SidebarTrigger` nằm trong `private-shell.tsx`, không import vào `layout.tsx`.

- [ ] **Step 5: Trang danh sách tổ chức**

Thay `ui/src/app/(private)/page.tsx` để render `<OrganizationList />`, giữ nguyên khối `metadata` đang có nhưng đổi `title` thành `"Tổ chức của tôi"`.

`ui/src/app/(private)/_components/organization-list.tsx`:

```tsx
"use client"

import { Plus, Users } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useOrganizations } from "@/hooks/use-organizations"

/**
 * Input: Không nhận tham số.
 * Output: Lưới các tổ chức đang tham gia; rỗng thì mời tạo cái đầu tiên.
 */
export function OrganizationList() {
  const { data: organizations, isPending } = useOrganizations()

  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
    )
  }

  if (!organizations?.length) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardHeader>
          <CardTitle>Chưa có tổ chức nào</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tạo một nhóm để bắt đầu đặt lịch và chia tiền sân.
          </p>
          <Button asChild>
            <Link href="/orgs/new">
              <Plus /> Tạo tổ chức
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tổ chức của tôi</h1>
        <Button asChild size="sm">
          <Link href="/orgs/new">
            <Plus /> Tạo tổ chức
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {organizations.map((organization) => (
          <Link key={organization.id} href={`/orgs/${organization.id}`}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader className="flex-row items-center justify-between gap-2">
                <CardTitle className="truncate">{organization.name}</CardTitle>
                {organization.role === "ADMIN" && <Badge variant="secondary">Quản trị</Badge>}
              </CardHeader>
              <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4" />
                {organization.memberCount} thành viên
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Trang tạo tổ chức**

`ui/src/app/(private)/orgs/new/_components/create-organization-form.tsx` — dùng `react-hook-form` + `zodResolver` + component `form` của shadcn, một trường `name` (2–255 ký tự), nút submit gọi `useCreateOrganization()`. Hook tự toast và điều hướng sang `/orgs/{id}` khi thành công.

`ui/src/app/(private)/orgs/new/page.tsx` — export `metadata` với `title: "Tạo tổ chức"`, render form trong `Card` rộng tối đa `max-w-md`.

- [ ] **Step 7: Layout và trang tổng quan tổ chức**

`ui/src/app/(private)/orgs/[orgId]/layout.tsx` — client component đọc `useOrganization(orgId)`; đang tải thì render `Skeleton`, lỗi `ORG_002`/`ORG_001` thì hiện thông báo "Bạn không có quyền truy cập tổ chức này" kèm link về `/`.

`ui/src/app/(private)/orgs/[orgId]/page.tsx` — hiện tên tổ chức, số thành viên, và hai `Card` giữ chỗ ghi "Các trận sắp tới" / "Công nợ của tôi" (lát 2 và lát 4 sẽ thay bằng dữ liệu thật).

- [ ] **Step 8: Kiểm tra bằng tay**

```bash
pnpm dev
```

Mở `http://localhost:3000`: đăng nhập → thấy trạng thái rỗng → tạo tổ chức → được đưa sang `/orgs/{id}` → sidebar hiện tên tổ chức và các mục ADMIN.

- [ ] **Step 9: Commit**

```bash
pnpm --filter ui exec tsc --noEmit
git add ui/src
git commit -m "feat(ui): add app shell with sidebar, organization list and create form"
```

---

### Task 8: FE — màn thành viên và quản lý link mời

**Files:**
- Create: `ui/src/app/(private)/orgs/[orgId]/members/page.tsx`
- Create: `ui/src/app/(private)/orgs/[orgId]/members/_components/member-table.tsx`
- Create: `ui/src/app/(private)/orgs/[orgId]/members/_components/invite-panel.tsx`
- Create: `ui/src/app/(private)/orgs/[orgId]/members/_components/leave-organization-button.tsx`

**Interfaces:**
- Consumes: `useMembers`, `useUpdateMemberRole`, `useRemoveMember`, `useInvites`, `useCreateInvite`, `useRevokeInvite`, `useLeaveOrganization`, `useOrganization`.
- Produces: không có export dùng lại ở task khác.

- [ ] **Step 1: Bảng thành viên**

`member-table.tsx` — `Table` của shadcn, mỗi dòng: `Avatar` + tên + email, `Badge` role, và `DropdownMenu` thao tác chỉ hiện khi người xem là ADMIN:

- "Đặt làm quản trị" / "Hạ xuống thành viên" → `useUpdateMemberRole`.
- "Xoá khỏi nhóm" → mở `AlertDialog` xác nhận rồi gọi `useRemoveMember`.

Không hiện menu thao tác trên chính dòng của mình — tự rời nhóm đi qua nút riêng ở Step 3.

Lỗi `ORG_004` đã được `getApiErrorMessage` dịch thành "Tổ chức phải còn ít nhất một quản trị viên" và hook tự toast, không cần xử lý thêm.

- [ ] **Step 2: Panel link mời**

`invite-panel.tsx` — chỉ render khi `organization.role === "ADMIN"`:

- Form tạo: `Select` hạn dùng (`Không hết hạn` / `1 ngày` / `7 ngày` / `30 ngày`) và `Input` số lượt tối đa (bỏ trống = không giới hạn). Quy đổi hạn dùng thành `expiresAt` ISO trước khi gọi `useCreateInvite`.
- Sau khi tạo thành công: hiện `Dialog` chứa URL trong `Input` readonly + nút "Sao chép" gọi `navigator.clipboard.writeText` rồi `toast.success("Đã sao chép link mời")`. Kèm dòng cảnh báo: link chỉ hiện đúng lần này.
- Bảng các link đã tạo: cột lượt dùng (`usedCount / maxUses ?? "∞"`), hạn dùng, `Badge` trạng thái (`usable` → "Còn hiệu lực" xanh, ngược lại "Hết hiệu lực" xám), nút "Thu hồi" khi còn hiệu lực.

- [ ] **Step 3: Nút rời nhóm**

`leave-organization-button.tsx` — `Button variant="destructive"` mở `AlertDialog`; xác nhận thì gọi `useLeaveOrganization(orgId)`. Hook tự điều hướng về `/`.

- [ ] **Step 4: Ghép trang**

`page.tsx` — client component, `Tabs` hai tab: "Thành viên" (`MemberTable` + `LeaveOrganizationButton`) và "Link mời" (`InvitePanel`, chỉ render tab này khi là ADMIN).

- [ ] **Step 5: Kiểm tra bằng tay**

Tạo link mời với `maxUses = 1`, copy URL, mở ở cửa sổ ẩn danh bằng tài khoản Google khác → tham gia được. Quay lại tab admin, refresh: `usedCount` = 1, badge chuyển "Hết hiệu lực". Thử hạ quyền chính mình khi là admin duy nhất → toast "Tổ chức phải còn ít nhất một quản trị viên".

- [ ] **Step 6: Commit**

```bash
pnpm --filter ui exec tsc --noEmit
git add ui/src/app
git commit -m "feat(ui): add members table, invite link management and leave organization"
```

---

### Task 9: FE — trang public nhận lời mời

**Files:**
- Create: `ui/src/app/invite/[token]/page.tsx`
- Create: `ui/src/app/invite/[token]/_components/invite-card.tsx`

**Interfaces:**
- Consumes: `useInvitePreview`, `useAcceptInvite`, `useAuthStore`, `startGoogleLogin` từ `@/lib/google-login`.
- Produces: không có export dùng lại.

Trang nằm NGOÀI nhóm route `(private)` và `(auth)` vì phải xem được khi chưa đăng nhập.

- [ ] **Step 1: Đọc luồng đăng nhập hiện có**

Mở `ui/src/lib/google-login.ts` và `ui/src/app/(auth)/login/callback/_components/auth-callback.tsx` để biết hàm khởi động OAuth tên gì và callback điều hướng về đâu. Dùng đúng hàm đó, không tự dựng URL Google.

- [ ] **Step 2: Viết invite card**

`invite-card.tsx`:

- `useInvitePreview(token)` — `isPending` → `Skeleton`; lỗi → thẻ "Lời mời không tồn tại" + link về `/`.
- `usable === false` → thẻ "Lời mời đã hết hạn hoặc bị thu hồi", không có nút tham gia.
- Đã đăng nhập (`useAuthStore(state => state.user)` khác null) → nút "Tham gia {tên tổ chức}" gọi `useAcceptInvite(token)`.
- Chưa đăng nhập → nút "Đăng nhập Google để tham gia". Trước khi chuyển hướng, lưu `sessionStorage.setItem("joytab-pending-invite", token)`.

- [ ] **Step 3: Tự động nhận lời mời sau khi đăng nhập**

Trong `invite-card.tsx`, thêm `useEffect`: khi user vừa có (đã đăng nhập) và `sessionStorage.getItem("joytab-pending-invite") === token`, xoá key đó rồi gọi mutation accept đúng một lần (dùng `useRef` cờ để không gọi lặp).

Cần thêm điều hướng ở `auth-callback.tsx`: nếu `sessionStorage` có `joytab-pending-invite`, chuyển về `/invite/{token}` thay vì `/`.

- [ ] **Step 4: Viết page**

`page.tsx` — export `metadata` với `title: "Lời mời tham gia"` và `robots: { index: false, follow: false }`; render `<InviteCard token={...} />` căn giữa màn hình. Nhớ `await params` (Next.js 16 truyền `params` dạng Promise).

- [ ] **Step 5: Kiểm tra bằng tay đường đi trọn vẹn**

Đăng xuất hoàn toàn, mở link mời → thấy tên tổ chức → bấm đăng nhập Google → sau callback quay lại trang mời và tự động tham gia → được đưa vào `/orgs/{id}`.

- [ ] **Step 6: Chạy toàn bộ kiểm tra và commit**

```bash
pnpm --filter api test
pnpm --filter api build
pnpm --filter ui exec tsc --noEmit
pnpm --filter ui build
git add ui/src
git commit -m "feat(ui): add public invite landing page with post-login auto accept"
```

---

## Định nghĩa hoàn thành lát 1

- [ ] `pnpm --filter api test` xanh (guard, members, invites utils).
- [ ] `pnpm build` xanh cả `api` và `ui`.
- [ ] Đường đi tay: đăng nhập → tạo tổ chức → tạo link mời → tài khoản thứ hai mở link, đăng nhập, tham gia → admin thấy thành viên mới → thành viên rời nhóm được.
- [ ] Bất biến last-admin chặn được cả ba đường: rời nhóm, hạ quyền, kick.
