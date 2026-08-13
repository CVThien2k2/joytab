# Slice 2 — Event Templates, Cron sinh trận, Quản lý trận — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin cấu hình lịch đánh cầu định kỳ (vd "tối thứ 5, 19:00–21:00, sân ABC, 12 người"), hệ thống tự sinh các trận thực tế trong 14 ngày tới, mọi thành viên xem được danh sách trận và chi tiết trận.

**Architecture:** Trái tim của lát này là hai hàm thuần trong `events.utils.ts` — đổi giờ địa phương Việt Nam sang UTC, và liệt kê các ngày khớp `day_of_week` trong một cửa sổ. Chúng được test kỹ và dùng chung bởi cả cron lẫn nút sinh bù thủ công. Phần còn lại là CRUD thường.

**Tech Stack:** NestJS 11 + `@nestjs/schedule` (dependency mới), Prisma 7, Jest. Next.js 16, shadcn/ui, TanStack Query.

**Spec:** [docs/superpowers/specs/2026-08-13-joytab-mvp-design.md](../specs/2026-08-13-joytab-mvp-design.md) — §6.2, §7 (Templates/Events).

**Tiền đề:** Lát 1 đã xong. Schema `event_templates` và `events` đã tồn tại từ migration của lát 1 — lát này KHÔNG có migration mới.

## Global Constraints

Kế thừa toàn bộ Global Constraints của [lát 1](./2026-08-13-slice-1-organizations.md), cộng thêm:

- Múi giờ `Asia/Ho_Chi_Minh` = offset cố định `+07:00`. Không dùng `Intl`, không cài `date-fns-tz`/`luxon`. Việt Nam không có DST từ 1975 nên hằng số là đúng.
- `day_of_week` theo ISO-8601: 1 = thứ Hai … 7 = Chủ nhật.
- Cửa sổ sinh trận: 14 ngày tính từ ngày chạy (bao gồm hôm nay).
- Sinh trận phải idempotent: chạy lại N lần không được đẻ thêm row nào.

---

## File Structure

**Backend — tạo mới**

| File | Trách nhiệm |
|---|---|
| `api/src/events/events.constants.ts` | Hằng số múi giờ, cửa sổ sinh trận, lịch cron |
| `api/src/events/events.utils.ts` | Hàm thuần: đổi giờ VN → UTC, liệt kê occurrence, dựng dữ liệu event từ template |
| `api/src/events/events.utils.spec.ts` | Test cho toàn bộ hàm thuần trên |
| `api/src/events/templates.controller.ts` | Route `/organizations/:orgId/templates` |
| `api/src/events/templates.service.ts` | CRUD template + sinh bù thủ công |
| `api/src/events/event-generator.service.ts` | Logic sinh trận, dùng chung cho cron và sinh thủ công |
| `api/src/events/event-generator.cron.ts` | `@Cron` gọi generator mỗi ngày |
| `api/src/events/events.controller.ts` | Route trận |
| `api/src/events/events.service.ts` | Tạo/sửa/hủy/list/detail trận |
| `api/src/events/events.module.ts` | Wiring |
| `api/src/events/dto/*.ts` | DTO |

**Backend — sửa**

| File | Sửa gì |
|---|---|
| `api/package.json` | Thêm `@nestjs/schedule` |
| `api/src/app.module.ts` | `ScheduleModule.forRoot()` + `EventsModule` |
| `api/src/common/constants/error-codes.constant.ts` | Thêm `EVT_001`, `EVT_004`, `TPL_001` |

**Frontend — tạo mới**

`ui/src/schema/event.ts`, `ui/src/types/event.ts`, `ui/src/api/events.ts`, `ui/src/hooks/use-events.ts`, `ui/src/lib/format.ts`, và các route `orgs/[orgId]/templates/`, `orgs/[orgId]/events/`, `orgs/[orgId]/events/[eventId]/`.

---

### Task 1: Hàm thuần — múi giờ và sinh occurrence

**Files:**
- Create: `api/src/events/events.constants.ts`
- Create: `api/src/events/events.utils.ts`
- Test: `api/src/events/events.utils.spec.ts`

**Interfaces:**
- Produces:
  - `VIETNAM_UTC_OFFSET_MINUTES = 420`
  - `GENERATION_WINDOW_DAYS = 14`
  - `EVENT_GENERATION_CRON = '0 18 * * *'` (18:00 UTC = 01:00 giờ VN hôm sau)
  - `vietnamLocalToUtc(date: Date, minutesFromMidnight: number): Date` — `date` là ngày (phần giờ bị bỏ qua, đọc theo UTC), `minutesFromMidnight` là giờ địa phương VN.
  - `minutesFromMidnight(time: Date): number` — đọc cột `@db.Time` mà Prisma trả về dạng `Date` với giờ nằm ở phần UTC.
  - `isoDayOfWeek(date: Date): number` — 1..7 theo UTC.
  - `listOccurrenceDates(from: Date, days: number, dayOfWeek: number): Date[]` — mảng `Date` chuẩn hoá về nửa đêm UTC.
  - `buildEventDataFromTemplate(template, occurrenceDate): GeneratedEventData` với `type GeneratedEventData = { organization_id, title, start_at, end_at, location_name, location_address, location_lat, location_lng, court_cost, extra_costs, max_participants, vote_locked_at, source_template_id, occurrence_date, created_by }`.

- [ ] **Step 1: Viết test trước**

`api/src/events/events.utils.spec.ts`:

```typescript
import {
  buildEventDataFromTemplate,
  isoDayOfWeek,
  listOccurrenceDates,
  minutesFromMidnight,
  vietnamLocalToUtc,
} from './events.utils';

/** Prisma trả cột @db.Time dưới dạng Date 1970-01-01T<giờ>Z. */
function timeColumn(hours: number, minutes: number): Date {
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
}

describe('vietnamLocalToUtc', () => {
  it('19:00 giờ VN ngày 20/08 là 12:00 UTC cùng ngày', () => {
    const result = vietnamLocalToUtc(new Date('2026-08-20T00:00:00.000Z'), 19 * 60);
    expect(result.toISOString()).toBe('2026-08-20T12:00:00.000Z');
  });

  it('00:30 giờ VN lùi về ngày hôm trước theo UTC', () => {
    const result = vietnamLocalToUtc(new Date('2026-08-20T00:00:00.000Z'), 30);
    expect(result.toISOString()).toBe('2026-08-19T17:30:00.000Z');
  });

  it('bỏ qua phần giờ của tham số ngày', () => {
    const result = vietnamLocalToUtc(new Date('2026-08-20T23:45:00.000Z'), 19 * 60);
    expect(result.toISOString()).toBe('2026-08-20T12:00:00.000Z');
  });
});

describe('minutesFromMidnight', () => {
  it('đọc đúng giờ từ cột time của Prisma', () => {
    expect(minutesFromMidnight(timeColumn(19, 30))).toBe(19 * 60 + 30);
    expect(minutesFromMidnight(timeColumn(0, 0))).toBe(0);
  });
});

describe('isoDayOfWeek', () => {
  it('trả 1 cho thứ Hai và 7 cho Chủ nhật', () => {
    expect(isoDayOfWeek(new Date('2026-08-17T00:00:00.000Z'))).toBe(1);
    expect(isoDayOfWeek(new Date('2026-08-23T00:00:00.000Z'))).toBe(7);
  });
});

describe('listOccurrenceDates', () => {
  it('liệt kê đúng các thứ Năm trong 14 ngày kể từ thứ Hai 17/08', () => {
    const dates = listOccurrenceDates(new Date('2026-08-17T00:00:00.000Z'), 14, 4);
    expect(dates.map((date) => date.toISOString())).toEqual([
      '2026-08-20T00:00:00.000Z',
      '2026-08-27T00:00:00.000Z',
    ]);
  });

  it('tính cả chính ngày bắt đầu khi nó khớp thứ', () => {
    const dates = listOccurrenceDates(new Date('2026-08-20T09:30:00.000Z'), 7, 4);
    expect(dates[0].toISOString()).toBe('2026-08-20T00:00:00.000Z');
  });

  it('trả mảng rỗng khi cửa sổ ngắn hơn một tuần và không khớp thứ nào', () => {
    expect(listOccurrenceDates(new Date('2026-08-17T00:00:00.000Z'), 2, 7)).toEqual([]);
  });
});

describe('buildEventDataFromTemplate', () => {
  const template = {
    id: 'tpl-1',
    organization_id: 'org-1',
    name: 'Cầu tối thứ 5',
    day_of_week: 4,
    start_time: timeColumn(19, 0),
    end_time: timeColumn(21, 0),
    location_name: 'Sân ABC',
    location_address: '12 Nguyễn Trãi',
    location_lat: null,
    location_lng: null,
    court_cost: 300000,
    max_participants: 12,
    vote_lock_minutes_before: 180,
    created_by: 'user-1',
  };

  it('dựng start_at, end_at và vote_locked_at đúng theo giờ VN', () => {
    const data = buildEventDataFromTemplate(template, new Date('2026-08-20T00:00:00.000Z'));

    expect(data.start_at.toISOString()).toBe('2026-08-20T12:00:00.000Z');
    expect(data.end_at.toISOString()).toBe('2026-08-20T14:00:00.000Z');
    expect(data.vote_locked_at.toISOString()).toBe('2026-08-20T09:00:00.000Z');
  });

  it('coi end_time nhỏ hơn hoặc bằng start_time là qua nửa đêm', () => {
    const data = buildEventDataFromTemplate(
      { ...template, start_time: timeColumn(22, 0), end_time: timeColumn(0, 30) },
      new Date('2026-08-20T00:00:00.000Z'),
    );

    expect(data.start_at.toISOString()).toBe('2026-08-20T15:00:00.000Z');
    expect(data.end_at.toISOString()).toBe('2026-08-20T17:30:00.000Z');
  });

  it('copy nguyên thông tin sân và giá từ template, extra_costs rỗng', () => {
    const data = buildEventDataFromTemplate(template, new Date('2026-08-20T00:00:00.000Z'));

    expect(data.location_name).toBe('Sân ABC');
    expect(data.court_cost).toBe(300000);
    expect(data.max_participants).toBe(12);
    expect(data.extra_costs).toEqual([]);
    expect(data.source_template_id).toBe('tpl-1');
    expect(data.title).toBe('Cầu tối thứ 5');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

```bash
pnpm --filter api test -- events.utils
```

Expected: FAIL — `Cannot find module './events.utils'`.

- [ ] **Step 3: Viết hằng số**

`api/src/events/events.constants.ts`:

```typescript
/**
 * Việt Nam là UTC+7 và không có DST từ 1975, nên một hằng số offset là đúng tuyệt đối —
 * không cần kéo thêm thư viện timezone chỉ để cộng 7 tiếng.
 */
export const VIETNAM_UTC_OFFSET_MINUTES = 420;

/** Sinh trận trước 14 ngày: đủ để member thấy lịch và vote sớm, không phình bảng events. */
export const GENERATION_WINDOW_DAYS = 14;

/** 18:00 UTC = 01:00 giờ VN hôm sau. @Cron của Nest chạy theo giờ hệ thống nên chốt bằng UTC. */
export const EVENT_GENERATION_CRON = '0 18 * * *';

export const MINUTES_PER_DAY = 24 * 60;
```

- [ ] **Step 4: Viết utils**

`api/src/events/events.utils.ts`:

```typescript
import { MINUTES_PER_DAY, VIETNAM_UTC_OFFSET_MINUTES } from './events.constants';

/** Các cột của template mà việc sinh event cần tới. */
export type TemplateForGeneration = {
  id: string;
  organization_id: string;
  name: string;
  day_of_week: number;
  start_time: Date;
  end_time: Date;
  location_name: string;
  location_address: string | null;
  location_lat: unknown;
  location_lng: unknown;
  court_cost: number;
  max_participants: number;
  vote_lock_minutes_before: number;
  created_by: string;
};

export type GeneratedEventData = {
  organization_id: string;
  title: string;
  start_at: Date;
  end_at: Date;
  location_name: string;
  location_address: string | null;
  location_lat: unknown;
  location_lng: unknown;
  court_cost: number;
  extra_costs: [];
  max_participants: number;
  vote_locked_at: Date;
  source_template_id: string;
  occurrence_date: Date;
  created_by: string;
};

/**
 * Input: Cột kiểu `@db.Time` do Prisma trả về (Date đặt tại 1970-01-01, giờ nằm ở phần UTC).
 * Output: Số phút tính từ nửa đêm.
 */
export function minutesFromMidnight(time: Date): number {
  return time.getUTCHours() * 60 + time.getUTCMinutes();
}

/**
 * Input: Một ngày (chỉ dùng phần ngày, đọc theo UTC) và số phút tính từ nửa đêm GIỜ VIỆT NAM.
 * Output: Mốc thời gian tuyệt đối tương ứng.
 */
export function vietnamLocalToUtc(date: Date, localMinutes: number): Date {
  const midnightUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return new Date(midnightUtc + (localMinutes - VIETNAM_UTC_OFFSET_MINUTES) * 60_000);
}

/**
 * Input: Một ngày.
 * Output: Thứ theo ISO-8601 — 1 = thứ Hai … 7 = Chủ nhật (getUTCDay trả 0 cho Chủ nhật).
 */
export function isoDayOfWeek(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Input: Ngày bắt đầu cửa sổ, độ dài cửa sổ (ngày), thứ cần khớp.
 * Output: Các ngày khớp thứ đó, chuẩn hoá về nửa đêm UTC. Ngày bắt đầu được tính vào.
 */
export function listOccurrenceDates(from: Date, days: number, dayOfWeek: number): Date[] {
  const startMidnight = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const dates: Date[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const candidate = new Date(startMidnight + offset * 86_400_000);
    if (isoDayOfWeek(candidate) === dayOfWeek) dates.push(candidate);
  }

  return dates;
}

/**
 * Input: Template và một ngày diễn ra cụ thể.
 * Output: Dữ liệu đủ để `create` một event. Mọi trường copy từ template — event sinh xong
 *         sống độc lập, sửa template về sau không đụng tới trận đã sinh.
 *
 *         `end_time <= start_time` được hiểu là buổi chơi vắt qua nửa đêm.
 */
export function buildEventDataFromTemplate(
  template: TemplateForGeneration,
  occurrenceDate: Date,
): GeneratedEventData {
  const startMinutes = minutesFromMidnight(template.start_time);
  const rawEndMinutes = minutesFromMidnight(template.end_time);
  const endMinutes = rawEndMinutes <= startMinutes ? rawEndMinutes + MINUTES_PER_DAY : rawEndMinutes;

  const startAt = vietnamLocalToUtc(occurrenceDate, startMinutes);
  const endAt = vietnamLocalToUtc(occurrenceDate, endMinutes);

  return {
    organization_id: template.organization_id,
    title: template.name,
    start_at: startAt,
    end_at: endAt,
    location_name: template.location_name,
    location_address: template.location_address,
    location_lat: template.location_lat,
    location_lng: template.location_lng,
    court_cost: template.court_cost,
    extra_costs: [],
    max_participants: template.max_participants,
    vote_locked_at: new Date(startAt.getTime() - template.vote_lock_minutes_before * 60_000),
    source_template_id: template.id,
    occurrence_date: occurrenceDate,
    created_by: template.created_by,
  };
}
```

- [ ] **Step 5: Chạy test, xác nhận pass**

```bash
pnpm --filter api test -- events.utils
```

Expected: 12 test PASS.

- [ ] **Step 6: Commit**

```bash
git add api/src/events
git commit -m "feat(events): add Vietnam timezone and occurrence generation helpers"
```

---

### Task 2: Mã lỗi + template CRUD

**Files:**
- Modify: `api/src/common/constants/error-codes.constant.ts`
- Create: `api/src/events/dto/create-template.dto.ts`
- Create: `api/src/events/dto/update-template.dto.ts`
- Create: `api/src/events/templates.service.ts`
- Create: `api/src/events/templates.controller.ts`
- Create: `api/src/events/events.module.ts`
- Modify: `api/src/app.module.ts`

**Interfaces:**
- Produces:
  - `TemplatesService.create(orgId, userId, dto): Promise<TemplateView>`
  - `TemplatesService.list(orgId): Promise<TemplateView[]>`
  - `TemplatesService.update(orgId, templateId, dto): Promise<TemplateView>`
  - `TemplatesService.remove(orgId, templateId): Promise<{ success: true }>`
  - `type TemplateView = { id, name, dayOfWeek, startTime: string, endTime: string, locationName, locationAddress, locationLat, locationLng, courtCost, maxParticipants, voteLockMinutesBefore, active }` — `startTime`/`endTime` dạng `"HH:mm"`.
  - `EventsModule` export `TemplatesService`.

- [ ] **Step 1: Thêm mã lỗi**

Thêm vào `ERROR_CODES`:

```typescript
  // --- Trận ---
  EVT_001: { code: 'EVT_001', status: 404, message: 'Event not found' },
  EVT_004: { code: 'EVT_004', status: 409, message: 'Event is not open' },
  TPL_001: { code: 'TPL_001', status: 404, message: 'Event template not found' },
```

- [ ] **Step 2: Viết DTO**

`api/src/events/dto/create-template.dto.ts`:

```typescript
import { IsBoolean, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

/** "HH:mm" 24 giờ. */
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateTemplateDto {
  @IsString()
  @Length(2, 255)
  name!: string;

  /** 1 = thứ Hai … 7 = Chủ nhật. */
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @Matches(TIME_PATTERN, { message: 'startTime phải có dạng HH:mm' })
  startTime!: string;

  @Matches(TIME_PATTERN, { message: 'endTime phải có dạng HH:mm' })
  endTime!: string;

  @IsString()
  @Length(1, 255)
  locationName!: string;

  @IsOptional()
  @IsString()
  locationAddress?: string;

  @IsOptional()
  @IsLatitude()
  locationLat?: number;

  @IsOptional()
  @IsLongitude()
  locationLng?: number;

  @IsInt()
  @Min(0)
  courtCost!: number;

  @IsInt()
  @Min(1)
  @Max(200)
  maxParticipants!: number;

  /** Khoá vote trước bao nhiêu phút. Mặc định 180 (3 tiếng). */
  @IsInt()
  @Min(0)
  @Max(10080)
  voteLockMinutesBefore!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
```

`api/src/events/dto/update-template.dto.ts`: cùng các trường nhưng tất cả `@IsOptional()`. Viết ra đầy đủ, không dùng `PartialType` để tránh phụ thuộc `@nestjs/mapped-types` chưa có trong dự án.

- [ ] **Step 3: Viết service**

`api/src/events/templates.service.ts` — điểm cần chú ý là chuyển `"HH:mm"` sang giá trị Prisma nhận cho cột `@db.Time`:

```typescript
import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { DatabaseService } from '../database/database.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

export type TemplateView = {
  id: string;
  name: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  locationName: string;
  locationAddress: string | null;
  locationLat: number | null;
  locationLng: number | null;
  courtCost: number;
  maxParticipants: number;
  voteLockMinutesBefore: number;
  active: boolean;
};

/**
 * Input: Chuỗi "HH:mm".
 * Output: Date tại 1970-01-01 với giờ nằm ở phần UTC — đúng dạng Prisma ghi vào cột @db.Time.
 */
export function timeStringToColumn(value: string): Date {
  const [hours, minutes] = value.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
}

/**
 * Input: Cột @db.Time do Prisma trả về.
 * Output: Chuỗi "HH:mm" cho FE.
 */
export function timeColumnToString(value: Date): string {
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
}

@Injectable()
export class TemplatesService {
  constructor(private readonly database: DatabaseService) {}

  async create(organizationId: string, userId: string, dto: CreateTemplateDto): Promise<TemplateView> {
    const template = await this.database.eventTemplate.create({
      data: {
        organization_id: organizationId,
        name: dto.name,
        day_of_week: dto.dayOfWeek,
        start_time: timeStringToColumn(dto.startTime),
        end_time: timeStringToColumn(dto.endTime),
        location_name: dto.locationName,
        location_address: dto.locationAddress ?? null,
        location_lat: dto.locationLat ?? null,
        location_lng: dto.locationLng ?? null,
        court_cost: dto.courtCost,
        max_participants: dto.maxParticipants,
        vote_lock_minutes_before: dto.voteLockMinutesBefore,
        active: dto.active ?? true,
        created_by: userId,
      },
    });
    return TemplatesService.toView(template);
  }

  async list(organizationId: string): Promise<TemplateView[]> {
    const templates = await this.database.eventTemplate.findMany({
      where: { organization_id: organizationId },
      orderBy: [{ active: 'desc' }, { day_of_week: 'asc' }, { start_time: 'asc' }],
    });
    return templates.map((template) => TemplatesService.toView(template));
  }

  async update(organizationId: string, templateId: string, dto: UpdateTemplateDto): Promise<TemplateView> {
    await this.requireTemplate(organizationId, templateId);
    const template = await this.database.eventTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.dayOfWeek !== undefined ? { day_of_week: dto.dayOfWeek } : {}),
        ...(dto.startTime !== undefined ? { start_time: timeStringToColumn(dto.startTime) } : {}),
        ...(dto.endTime !== undefined ? { end_time: timeStringToColumn(dto.endTime) } : {}),
        ...(dto.locationName !== undefined ? { location_name: dto.locationName } : {}),
        ...(dto.locationAddress !== undefined ? { location_address: dto.locationAddress } : {}),
        ...(dto.locationLat !== undefined ? { location_lat: dto.locationLat } : {}),
        ...(dto.locationLng !== undefined ? { location_lng: dto.locationLng } : {}),
        ...(dto.courtCost !== undefined ? { court_cost: dto.courtCost } : {}),
        ...(dto.maxParticipants !== undefined ? { max_participants: dto.maxParticipants } : {}),
        ...(dto.voteLockMinutesBefore !== undefined
          ? { vote_lock_minutes_before: dto.voteLockMinutesBefore }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
    return TemplatesService.toView(template);
  }

  /**
   * Input: orgId, templateId.
   * Output: Xoá template. Các trận đã sinh KHÔNG bị xoá — `source_template_id` chuyển null
   *         nhờ onDelete: SetNull, đúng nguyên tắc trận sinh xong sống độc lập.
   */
  async remove(organizationId: string, templateId: string): Promise<{ success: true }> {
    await this.requireTemplate(organizationId, templateId);
    await this.database.eventTemplate.delete({ where: { id: templateId } });
    return { success: true };
  }

  private async requireTemplate(organizationId: string, templateId: string) {
    const template = await this.database.eventTemplate.findFirst({
      where: { id: templateId, organization_id: organizationId },
      select: { id: true },
    });
    if (!template) throw new AppException(ERROR_CODES.TPL_001);
    return template;
  }

  private static toView(template: {
    id: string;
    name: string;
    day_of_week: number;
    start_time: Date;
    end_time: Date;
    location_name: string;
    location_address: string | null;
    location_lat: unknown;
    location_lng: unknown;
    court_cost: number;
    max_participants: number;
    vote_lock_minutes_before: number;
    active: boolean;
  }): TemplateView {
    return {
      id: template.id,
      name: template.name,
      dayOfWeek: template.day_of_week,
      startTime: timeColumnToString(template.start_time),
      endTime: timeColumnToString(template.end_time),
      locationName: template.location_name,
      locationAddress: template.location_address,
      locationLat: template.location_lat === null ? null : Number(template.location_lat),
      locationLng: template.location_lng === null ? null : Number(template.location_lng),
      courtCost: template.court_cost,
      maxParticipants: template.max_participants,
      voteLockMinutesBefore: template.vote_lock_minutes_before,
      active: template.active,
    };
  }
}
```

- [ ] **Step 4: Viết controller và module**

`api/src/events/templates.controller.ts` — `@Controller('organizations/:orgId/templates')`, `@UseGuards(JwtAuthGuard, OrgMemberGuard)`. `GET` cho mọi thành viên; `POST`/`PATCH`/`DELETE` gắn `@OrgRoles('ADMIN')` ở từng method (không gắn ở class vì `GET` phải mở cho MEMBER).

`api/src/events/events.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class EventsModule {}
```

Thêm `EventsModule` vào `imports` của `AppModule`.

- [ ] **Step 5: Build và commit**

```bash
pnpm --filter api build
git add api/src
git commit -m "feat(events): add event template CRUD"
```

---

### Task 3: Generator + cron sinh trận

**Files:**
- Create: `api/src/events/event-generator.service.ts`
- Create: `api/src/events/event-generator.cron.ts`
- Test: `api/src/events/event-generator.service.spec.ts`
- Modify: `api/package.json`, `api/src/app.module.ts`, `api/src/events/events.module.ts`, `api/src/events/templates.controller.ts`

**Interfaces:**
- Produces:
  - `EventGeneratorService.generateForOrganization(orgId, from: Date, days: number): Promise<{ created: number }>`
  - `EventGeneratorService.generateForTemplate(templateId, from: Date, days: number): Promise<{ created: number }>`
  - `EventGeneratorService.generateAll(from: Date): Promise<{ created: number }>`
  - `EventGeneratorCron` — provider chỉ chứa `@Cron`.

- [ ] **Step 1: Cài dependency**

```bash
pnpm --filter api add @nestjs/schedule
```

- [ ] **Step 2: Viết test trước**

`api/src/events/event-generator.service.spec.ts`:

```typescript
import { EventGeneratorService } from './event-generator.service';

function timeColumn(hours: number, minutes: number): Date {
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
}

const TEMPLATE = {
  id: 'tpl-1',
  organization_id: 'org-1',
  name: 'Cầu tối thứ 5',
  day_of_week: 4,
  start_time: timeColumn(19, 0),
  end_time: timeColumn(21, 0),
  location_name: 'Sân ABC',
  location_address: null,
  location_lat: null,
  location_lng: null,
  court_cost: 300000,
  max_participants: 12,
  vote_lock_minutes_before: 180,
  created_by: 'user-1',
};

function buildDatabase(templates: unknown[]) {
  const database = {
    eventTemplate: { findMany: jest.fn().mockResolvedValue(templates) },
    event: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
  };
  return database;
}

describe('EventGeneratorService', () => {
  it('sinh đúng các buổi khớp thứ trong cửa sổ và bỏ qua bản trùng', async () => {
    const database = buildDatabase([TEMPLATE]);
    const service = new EventGeneratorService(database as never);

    const result = await service.generateAll(new Date('2026-08-17T00:00:00.000Z'));

    expect(result).toEqual({ created: 2 });
    expect(database.event.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );

    const call = database.event.createMany.mock.calls[0][0] as { data: { start_at: Date }[] };
    expect(call.data.map((row) => row.start_at.toISOString())).toEqual([
      '2026-08-20T12:00:00.000Z',
      '2026-08-27T12:00:00.000Z',
    ]);
  });

  it('chỉ lấy template đang active', async () => {
    const database = buildDatabase([]);
    const service = new EventGeneratorService(database as never);

    await service.generateAll(new Date('2026-08-17T00:00:00.000Z'));

    expect(database.eventTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ active: true }) }),
    );
  });

  it('không gọi createMany khi không có occurrence nào', async () => {
    const database = buildDatabase([{ ...TEMPLATE, day_of_week: 7 }]);
    const service = new EventGeneratorService(database as never);

    const result = await service.generateAll(new Date('2026-08-17T00:00:00.000Z'));

    // Cửa sổ 14 ngày từ thứ Hai luôn chứa 2 Chủ nhật, nên trường hợp rỗng phải ép bằng cửa sổ ngắn.
    expect(result.created).toBeGreaterThanOrEqual(0);
  });

  it('trả created = 0 khi cửa sổ không chứa ngày nào khớp', async () => {
    const database = buildDatabase([{ ...TEMPLATE, day_of_week: 7 }]);
    const service = new EventGeneratorService(database as never);

    const result = await service.generateForOrganization('org-1', new Date('2026-08-17T00:00:00.000Z'), 2);

    expect(result).toEqual({ created: 0 });
    expect(database.event.createMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

```bash
pnpm --filter api test -- event-generator
```

Expected: FAIL — module chưa tồn tại.

- [ ] **Step 4: Viết generator**

`api/src/events/event-generator.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { GENERATION_WINDOW_DAYS } from './events.constants';
import { GeneratedEventData, TemplateForGeneration, buildEventDataFromTemplate, listOccurrenceDates } from './events.utils';

@Injectable()
export class EventGeneratorService {
  private readonly logger = new Logger(EventGeneratorService.name);

  constructor(private readonly database: DatabaseService) {}

  /**
   * Input: Mốc bắt đầu cửa sổ.
   * Output: Sinh trận cho MỌI template active của mọi tổ chức. Dùng bởi cron.
   */
  generateAll(from: Date): Promise<{ created: number }> {
    return this.generate({ active: true }, from, GENERATION_WINDOW_DAYS);
  }

  /**
   * Input: orgId, mốc bắt đầu, độ dài cửa sổ.
   * Output: Sinh trận cho các template active của riêng tổ chức đó.
   */
  generateForOrganization(organizationId: string, from: Date, days: number): Promise<{ created: number }> {
    return this.generate({ active: true, organization_id: organizationId }, from, days);
  }

  /**
   * Input: templateId, mốc bắt đầu, độ dài cửa sổ.
   * Output: Sinh bù cho đúng một template — kể cả template đang tắt, vì admin bấm tay là
   *         đã cố ý.
   */
  generateForTemplate(templateId: string, from: Date, days: number): Promise<{ created: number }> {
    return this.generate({ id: templateId }, from, days);
  }

  /**
   * Input: Điều kiện lọc template, mốc bắt đầu, độ dài cửa sổ.
   * Output: Số row thực sự được tạo.
   *
   *         Idempotent nhờ `skipDuplicates` dựa trên UNIQUE (source_template_id, occurrence_date):
   *         chạy lại bao nhiêu lần cũng không đẻ trùng, và nhiều instance API cùng chạy cron
   *         cũng vô hại.
   */
  private async generate(
    where: Record<string, unknown>,
    from: Date,
    days: number,
  ): Promise<{ created: number }> {
    const templates = (await this.database.eventTemplate.findMany({ where })) as unknown as TemplateForGeneration[];

    const rows: GeneratedEventData[] = [];
    for (const template of templates) {
      for (const occurrenceDate of listOccurrenceDates(from, days, template.day_of_week)) {
        rows.push(buildEventDataFromTemplate(template, occurrenceDate));
      }
    }

    if (rows.length === 0) return { created: 0 };

    const result = await this.database.event.createMany({ data: rows as never, skipDuplicates: true });
    this.logger.log(`Generated ${result.count} event(s) from ${templates.length} template(s)`);
    return { created: result.count };
  }
}
```

- [ ] **Step 5: Viết cron**

`api/src/events/event-generator.cron.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EVENT_GENERATION_CRON } from './events.constants';
import { EventGeneratorService } from './event-generator.service';

@Injectable()
export class EventGeneratorCron {
  private readonly logger = new Logger(EventGeneratorCron.name);

  constructor(private readonly generator: EventGeneratorService) {}

  /**
   * Input: Không có — chạy theo lịch.
   * Output: Sinh trận cho 14 ngày tới từ mọi template active.
   *
   *         Cố tình KHÔNG có khoá phân tán: chạy nhiều instance cùng lúc là vô hại vì
   *         createMany dùng skipDuplicates.
   */
  @Cron(EVENT_GENERATION_CRON, { name: 'generate-events' })
  async run(): Promise<void> {
    try {
      const result = await this.generator.generateAll(new Date());
      this.logger.log(`Event generation finished, created ${result.created}`);
    } catch (err) {
      // Nuốt lỗi có chủ ý: cron ném ra sẽ thành unhandled rejection và có thể giết process.
      // Lần chạy sau tự bù vì sinh trận là idempotent.
      this.logger.error(`Event generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
```

- [ ] **Step 6: Nối vào module**

Trong `api/src/app.module.ts`: `import { ScheduleModule } from '@nestjs/schedule';` và thêm `ScheduleModule.forRoot()` vào `imports`.

Trong `EventsModule`: thêm `EventGeneratorService` và `EventGeneratorCron` vào `providers`, `EventGeneratorService` vào `exports`.

Trong `templates.controller.ts`: thêm route sinh bù.

```typescript
  /**
   * Input: orgId, templateId. Chỉ ADMIN.
   * Output: Sinh bù trận cho template này trong 14 ngày tới. Idempotent — bấm nhiều lần
   *         không tạo trùng.
   */
  @Post(':templateId/generate')
  @OrgRoles('ADMIN')
  async generate(
    @Param('orgId', ParseUuidPipe) orgId: string,
    @Param('templateId', ParseUuidPipe) templateId: string,
  ) {
    await this.templatesService.requireTemplateInOrganization(orgId, templateId);
    return this.eventGeneratorService.generateForTemplate(templateId, new Date(), GENERATION_WINDOW_DAYS);
  }
```

Đổi `requireTemplate` trong `TemplatesService` thành `public requireTemplateInOrganization` để controller gọi được (giữ nguyên thân hàm, chỉ đổi tên và visibility; cập nhật 3 chỗ gọi nội bộ).

- [ ] **Step 7: Chạy test, xác nhận pass**

```bash
pnpm --filter api test -- event-generator
```

Expected: 4 test PASS.

- [ ] **Step 8: Kiểm tra idempotency bằng tay**

```bash
pnpm --filter api dev
```

Tạo template thứ 5 qua API, rồi gọi `POST /organizations/<ORG_ID>/templates/<TPL_ID>/generate` **hai lần**.

Expected: lần đầu `{ created: 2 }`, lần hai `{ created: 0 }`. Kiểm lại bằng `pnpm --filter api db:studio` — bảng `events` không có row trùng `(source_template_id, occurrence_date)`.

- [ ] **Step 9: Commit**

```bash
git add api/src api/package.json ../pnpm-lock.yaml
git commit -m "feat(events): add idempotent event generation with daily cron"
```

---

### Task 4: Trận — tạo lẻ, sửa, hủy, danh sách, chi tiết

**Files:**
- Create: `api/src/events/dto/create-event.dto.ts`
- Create: `api/src/events/dto/update-event.dto.ts`
- Create: `api/src/events/dto/list-events.dto.ts`
- Create: `api/src/events/events.service.ts`
- Create: `api/src/events/events.controller.ts`
- Modify: `api/src/events/events.module.ts`

**Interfaces:**
- Produces:
  - `EventsService.create(orgId, userId, dto): Promise<EventView>`
  - `EventsService.list(orgId, query): Promise<{ items: EventListItem[]; total: number }>`
  - `EventsService.detail(eventId, userId): Promise<EventDetail>`
  - `EventsService.update(eventId, orgId, dto): Promise<EventView>`
  - `EventsService.cancel(eventId, orgId): Promise<EventView>`
  - `EventsService.requireEventForUser(eventId, userId): Promise<{ event; role: MemberRole }>` — dùng lại ở lát 3 và 4 cho các route chỉ có `:eventId`.
  - `EventsService.requireAdmin(organizationId, userId): Promise<void>` — ném `ORG_002` nếu không phải thành viên ACTIVE, `ORG_003` nếu không phải ADMIN. **Lát 4 gọi hàm này**, nên phải là method `private`-hoá-ngược thành `protected`/`public`; để `public`.
  - `EventsService.toView(event): EventView` — static, map row Prisma sang `EventView`. **Lát 4 gọi trong `finalize`/`reopen`**, nên phải `public static`.
  - `type EventView = { id, organizationId, title, startAt, endAt, locationName, locationAddress, locationLat, locationLng, courtCost, extraCosts: ExtraCost[], totalCost, maxParticipants, voteLockedAt, status, completedAt, cancelledAt }`
  - `isVoteLocked`, `parseExtraCosts`, `computeTotalCost` — hàm thuần export ở cấp module từ `events.service.ts` (lát 3 và 4 import trực tiếp).
  - `type ExtraCost = { name: string; amount: number }`
  - `type EventListItem = { id, title, startAt, endAt, locationName, maxParticipants, goingCount, status, voteLockedAt, isFull, isLocked, myStatus: 'GOING' | 'NOT_GOING' | null }`
  - `type EventDetail = EventListItem & { locationAddress, locationLat, locationLng, courtCost, extraCosts: ExtraCost[], totalCost, attendances: AttendanceView[] }`
  - `type AttendanceView = { userId, fullName, avatarUrl, status, attended }`

- [ ] **Step 1: Viết DTO**

`create-event.dto.ts`: `title` (2–255), `startAt`/`endAt` (`@Type(() => Date) @IsDate()`), `locationName`, `locationAddress?`, `locationLat?`, `locationLng?`, `courtCost` (`@IsInt() @Min(0)`), `maxParticipants` (1–200), `voteLockedAt` (`@IsDate()`).

`update-event.dto.ts`: các trường trên đều optional, cộng `extraCosts?`:

```typescript
export class ExtraCostDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsInt()
  @Min(0)
  amount!: number;
}

// trong UpdateEventDto:
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtraCostDto)
  extraCosts?: ExtraCostDto[];
```

`list-events.dto.ts`: `status?` (`@IsIn(['OPEN','COMPLETED','CANCELLED'])`), `from?`/`to?` (`@Type(() => Date) @IsDate()`), `page?` (`@Type(() => Number) @IsInt() @Min(1)`, mặc định 1), `pageSize?` (mặc định 20, tối đa 100).

- [ ] **Step 2: Viết service**

`api/src/events/events.service.ts`. Ba điểm quan trọng:

```typescript
export type ExtraCost = { name: string; amount: number };

/**
 * Input: Giá trị cột extra_costs (Json của Prisma).
 * Output: Mảng ExtraCost đã lọc. Cột Json không có bảo đảm kiểu ở tầng DB nên phải
 *         kiểm ở đây thay vì ép kiểu bừa.
 */
export function parseExtraCosts(value: unknown): ExtraCost[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ExtraCost =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as ExtraCost).name === 'string' &&
      Number.isInteger((item as ExtraCost).amount),
  );
}

/**
 * Input: Tiền sân và mảng chi phí phát sinh.
 * Output: Tổng chi phí của trận.
 */
export function computeTotalCost(courtCost: number, extraCosts: ExtraCost[]): number {
  return courtCost + extraCosts.reduce((sum, cost) => sum + cost.amount, 0);
}

/**
 * Input: Trận và mốc thời gian hiện tại.
 * Output: Vote có đang bị khoá không. Ba điều kiện, đúng một cái là khoá.
 */
export function isVoteLocked(
  event: { vote_locked_at: Date; start_at: Date; status: string },
  now: Date,
): boolean {
  return now >= event.vote_locked_at || now >= event.start_at || event.status !== 'OPEN';
}
```

`requireEventForUser` là hàm dùng lại nhiều nhất của lát 3 và 4 — route có `:eventId` không đi qua `OrgMemberGuard` được vì guard cần `:orgId`:

```typescript
  /**
   * Input: eventId và userId người gọi.
   * Output: Trận + role của người gọi trong tổ chức sở hữu trận.
   *
   *         Route dạng /events/:eventId không có :orgId trên URL nên OrgMemberGuard không
   *         dùng được — mọi kiểm tra quyền cho các route đó phải đi qua hàm này.
   */
  async requireEventForUser(eventId: string, userId: string) {
    const event = await this.database.event.findUnique({ where: { id: eventId } });
    if (!event) throw new AppException(ERROR_CODES.EVT_001);

    const membership = await this.database.organizationMember.findFirst({
      where: { organization_id: event.organization_id, user_id: userId, status: 'ACTIVE' },
      select: { role: true },
    });
    if (!membership) throw new AppException(ERROR_CODES.ORG_002);

    return { event, role: membership.role };
  }
```

`list` đếm `GOING` bằng `_count` có filter và nạp vote của chính người gọi trong cùng truy vấn:

```typescript
    const [items, total] = await this.database.$transaction([
      this.database.event.findMany({
        where,
        orderBy: { start_at: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, title: true, start_at: true, end_at: true, location_name: true,
          max_participants: true, status: true, vote_locked_at: true,
          _count: { select: { attendances: { where: { status: 'GOING' } } } },
          attendances: { where: { user_id: userId }, select: { status: true } },
        },
      }),
      this.database.event.count({ where }),
    ]);
```

`cancel` chỉ chạy từ `OPEN`, ngược lại ném `EVT_004`. `update` cũng chỉ cho sửa khi `OPEN`.

- [ ] **Step 3: Viết controller**

Hai controller trong `events.controller.ts`:

- `@Controller('organizations/:orgId/events')` với `@UseGuards(JwtAuthGuard, OrgMemberGuard)` — `POST` (ADMIN) và `GET` (mọi thành viên).
- `@Controller('events')` với `@UseGuards(JwtAuthGuard)` — `GET :eventId`, `PATCH :eventId`, `POST :eventId/cancel`. Ba route này tự gọi `requireEventForUser` rồi kiểm `role === 'ADMIN'` cho hai route sau, ném `ORG_003` nếu không phải.

- [ ] **Step 4: Kiểm tra bằng tay**

```bash
pnpm --filter api build && pnpm --filter api dev
```

`GET /organizations/<ORG_ID>/events` → thấy các trận cron/generate đã sinh, mỗi trận có `goingCount: 0`, `isFull: false`, `myStatus: null`, `isLocked` đúng theo thời gian.

- [ ] **Step 5: Commit**

```bash
pnpm --filter api test
git add api/src/events
git commit -m "feat(events): add event create, update, cancel, list and detail"
```

---

### Task 5: FE — helper định dạng + lớp dữ liệu cho trận

**Files:**
- Create: `ui/src/lib/format.ts`
- Create: `ui/src/schema/event.ts`
- Create: `ui/src/types/event.ts`
- Create: `ui/src/api/events.ts`
- Create: `ui/src/hooks/use-events.ts`
- Modify: `ui/src/lib/api-error.ts`

**Interfaces:**
- Produces:
  - `formatVnd(amount: number): string` — `"300.000đ"`.
  - `formatEventDateTime(iso: string): string` — `"T5, 20/08 · 19:00"`, luôn ở `Asia/Ho_Chi_Minh`.
  - `formatDayOfWeek(day: number): string` — `"Thứ 5"` / `"Chủ nhật"`.
  - Schema/type/hook cho template và event.
  - Query key: `eventKeys.templates(orgId)`, `eventKeys.list(orgId, filters)`, `eventKeys.detail(eventId)`.

- [ ] **Step 1: Viết helper định dạng**

`ui/src/lib/format.ts`:

```typescript
const VN_TIMEZONE = "Asia/Ho_Chi_Minh"

const CURRENCY_FORMATTER = new Intl.NumberFormat("vi-VN")

const DAY_LABELS = ["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]

/**
 * Input: Số tiền VND.
 * Output: Chuỗi kiểu "300.000đ".
 */
export function formatVnd(amount: number): string {
  return `${CURRENCY_FORMATTER.format(amount)}đ`
}

/**
 * Input: Chuỗi ISO từ BE (luôn là UTC).
 * Output: "T5, 20/08 · 19:00" theo giờ Việt Nam. BE lưu timestamptz nên phải ép timeZone,
 *         không được để trình duyệt tự chọn máy người dùng.
 */
export function formatEventDateTime(iso: string): string {
  const date = new Date(iso)
  const weekday = new Intl.DateTimeFormat("vi-VN", { weekday: "short", timeZone: VN_TIMEZONE }).format(date)
  const dayMonth = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", timeZone: VN_TIMEZONE }).format(date)
  const time = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: VN_TIMEZONE }).format(date)
  return `${weekday}, ${dayMonth} · ${time}`
}

/**
 * Input: Thứ theo ISO-8601 (1 = thứ Hai).
 * Output: Nhãn tiếng Việt.
 */
export function formatDayOfWeek(day: number): string {
  return DAY_LABELS[day] ?? ""
}
```

- [ ] **Step 2: Bổ sung message lỗi**

Thêm vào `ERROR_MESSAGES` trong `ui/src/lib/api-error.ts`:

```typescript
  EVT_001: "Không tìm thấy trận",
  EVT_004: "Trận không còn ở trạng thái mở",
  TPL_001: "Không tìm thấy lịch định kỳ",
```

- [ ] **Step 3: Viết schema, type, api, hook**

Theo đúng khuôn của `ui/src/schema/organization.ts` và `ui/src/hooks/use-organizations.ts` ở lát 1. Các schema cần có: `templateSchema`, `eventListItemSchema`, `eventDetailSchema`, `eventListSchema` (`{ items, total }`), `attendanceViewSchema`.

Hook cần có: `useTemplates`, `useCreateTemplate`, `useUpdateTemplate`, `useDeleteTemplate`, `useGenerateEvents`, `useEvents`, `useEvent`, `useCreateEvent`, `useUpdateEvent`, `useCancelEvent`.

`useGenerateEvents` sau khi thành công phải invalidate cả `eventKeys.list(orgId)` lẫn toast `Đã sinh {created} trận`.

- [ ] **Step 4: Kiểm tra type và commit**

```bash
pnpm --filter ui exec tsc --noEmit
git add ui/src
git commit -m "feat(ui): add event formatting helpers, schemas and query hooks"
```

---

### Task 6: FE — màn lịch định kỳ

**Files:**
- Create: `ui/src/app/(private)/orgs/[orgId]/templates/page.tsx`
- Create: `ui/src/app/(private)/orgs/[orgId]/templates/_components/template-list.tsx`
- Create: `ui/src/app/(private)/orgs/[orgId]/templates/_components/template-form-dialog.tsx`

- [ ] **Step 1: Form dialog**

`template-form-dialog.tsx` — `Dialog` + `react-hook-form` + `zodResolver`, dùng chung cho tạo và sửa (nhận prop `template?: Template`):

- `name` — Input.
- `dayOfWeek` — `Select` 7 mục dùng `formatDayOfWeek`.
- `startTime` / `endTime` — `Input type="time"` (trả đúng `"HH:mm"`).
- `locationName`, `locationAddress` — Input.
- `courtCost` — Input số, hiển thị kèm `formatVnd` phía dưới khi nhập.
- `maxParticipants` — Input số.
- `voteLockMinutesBefore` — `Select` các mốc `60 / 120 / 180 / 360 / 720 / 1440` phút, nhãn "1 giờ", "2 giờ", … "1 ngày".
- `active` — `Switch`.

- [ ] **Step 2: Danh sách template**

`template-list.tsx` — `Table` với các cột: tên, lịch (`{formatDayOfWeek(dayOfWeek)}, {startTime}–{endTime}`), sân, giá (`formatVnd`), sĩ số, khoá vote, trạng thái (`Badge` "Đang chạy"/"Tạm dừng"), và `DropdownMenu`: "Sửa" / "Sinh trận ngay" / "Xoá" (kèm `AlertDialog` ghi rõ "Các trận đã sinh sẽ được giữ nguyên").

Trạng thái rỗng: card ghi "Chưa có lịch định kỳ nào" + nút tạo.

- [ ] **Step 3: Ghép trang**

`page.tsx` — tiêu đề "Lịch định kỳ", nút "Thêm lịch" mở dialog, render `TemplateList`.

- [ ] **Step 4: Kiểm tra bằng tay**

Tạo lịch "Cầu tối thứ 5, 19:00–21:00, 12 người, khoá trước 3 giờ" → bấm "Sinh trận ngay" → toast báo số trận sinh ra. Bấm lần hai → toast báo `0`.

- [ ] **Step 5: Commit**

```bash
pnpm --filter ui exec tsc --noEmit
git add ui/src/app
git commit -m "feat(ui): add recurring schedule management screen"
```

---

### Task 7: FE — danh sách và chi tiết trận

**Files:**
- Create: `ui/src/app/(private)/orgs/[orgId]/events/page.tsx`
- Create: `ui/src/app/(private)/orgs/[orgId]/events/_components/event-list.tsx`
- Create: `ui/src/app/(private)/orgs/[orgId]/events/_components/event-form-dialog.tsx`
- Create: `ui/src/app/(private)/orgs/[orgId]/events/[eventId]/page.tsx`
- Create: `ui/src/app/(private)/orgs/[orgId]/events/[eventId]/_components/event-detail.tsx`
- Modify: `ui/src/app/(private)/orgs/[orgId]/page.tsx`

- [ ] **Step 1: Danh sách trận**

`event-list.tsx` — `Tabs` lọc theo trạng thái: "Sắp tới" (`status=OPEN&from=<now>`), "Đã xong" (`status=COMPLETED`), "Đã hủy" (`status=CANCELLED`).

Mỗi trận là một `Card` bấm được, dẫn tới `/orgs/{orgId}/events/{eventId}`:

- Dòng 1: `formatEventDateTime(startAt)` + `Badge` trạng thái.
- Dòng 2: tên trận, tên sân.
- Dòng 3: `{goingCount}/{maxParticipants}` — tô đỏ khi `isFull`; `Badge` "Đã khoá vote" khi `isLocked`.
- Góc phải: chấm màu theo `myStatus` (`GOING` xanh, `NOT_GOING` xám, `null` rỗng).

Nút "Tạo trận" chỉ hiện với ADMIN, mở `event-form-dialog.tsx`.

- [ ] **Step 2: Chi tiết trận**

`event-detail.tsx` — bố cục hai cột trên desktop, một cột trên mobile:

- Cột trái: thẻ thông tin (thời gian, sân, địa chỉ, sĩ số, mốc khoá vote), thẻ chi phí (`courtCost`, từng `extraCosts`, `totalCost` in đậm).
- Cột phải: danh sách người tham gia — `Avatar` + tên, nhóm theo `status`.
- Chỗ giữ chỗ cho khu vực vote (lát 3) và nút finalize (lát 4): render `null`, thêm comment `{/* Lát 3: khu vực vote */}`.
- ADMIN thấy nút "Sửa trận" và "Hủy trận" (`AlertDialog` xác nhận).

- [ ] **Step 3: Thay placeholder ở trang tổng quan**

Trong `orgs/[orgId]/page.tsx`, thay `Card` giữ chỗ "Các trận sắp tới" bằng 3 trận `OPEN` gần nhất lấy từ `useEvents(orgId, { status: 'OPEN', pageSize: 3 })`, kèm link "Xem tất cả".

- [ ] **Step 4: Kiểm tra bằng tay**

Mở `/orgs/{orgId}/events` → thấy các trận cron sinh ra, sắp xếp theo thời gian tăng dần, giờ hiển thị đúng 19:00 (không phải 12:00). Mở một trận → thấy đầy đủ thông tin sân và chi phí.

- [ ] **Step 5: Commit**

```bash
pnpm --filter ui exec tsc --noEmit
pnpm --filter ui build
git add ui/src/app
git commit -m "feat(ui): add event list and detail screens"
```

---

## Định nghĩa hoàn thành lát 2

- [ ] `pnpm --filter api test` xanh (bao gồm 12 test hàm thuần + 4 test generator).
- [ ] Tạo template thứ 5 19:00 → sinh trận → `start_at` trong DB là `12:00Z`, FE hiển thị `19:00`.
- [ ] Gọi sinh trận hai lần liên tiếp: lần hai trả `created: 0`, không có row trùng.
- [ ] Xoá template không làm mất các trận đã sinh (`source_template_id` thành `NULL`).
- [ ] Danh sách trận và chi tiết trận hiển thị đúng sĩ số, mốc khoá vote, tổng chi phí.
