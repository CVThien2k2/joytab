import { Injectable } from '@nestjs/common';
import { SettlementsService } from '../billing/settlements.service';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { DatabaseService } from '../database/database.service';
import { AttendanceStatus, EventStatus, MemberRole, MemberStatus } from '../generated/prisma/enums';
import { CreateEventDto } from './dto/create-event.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { MarkAttendedDto } from './dto/mark-attended.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { DEFAULT_EVENT_PAGE_SIZE } from './events.constants';
import {
  computeEventTotalCost,
  isVotingLocked,
  parseExtraCosts,
  toExtraCostsJson,
  type ExtraCost,
} from './events.utils';

type TransactionClient = Parameters<Parameters<DatabaseService['$transaction']>[0]>[0];

const MS_PER_MINUTE = 60 * 1000;

type EventSummary = {
  id: string;
  organizationId: string;
  title: string;
  startAt: Date;
  endAt: Date;
  locationName: string | null;
  locationAddress: string | null;
  courtCost: number;
  extraCosts: ExtraCost[];
  totalCost: number;
  maxParticipants: number;
  voteLockedAt: Date;
  status: EventStatus;
  goingCount: number;
  isFull: boolean;
  isLocked: boolean;
  completedAt: Date | null;
  cancelledAt: Date | null;
};

type AttendanceView = {
  userId: string;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  status: AttendanceStatus;
  attended: boolean | null;
  votedAt: Date;
};

type EventDetail = EventSummary & {
  attendances: AttendanceView[];
  myAttendance: { status: AttendanceStatus; attended: boolean | null } | null;
  myRole: MemberRole;
};

@Injectable()
export class EventsService {
  constructor(
    private readonly databaseService: DatabaseService,
    // Ranh giới ghi duy nhất từ events sang billing: events không bao giờ đụng thẳng vào
    // bảng event_settlements, và billing không bao giờ ghi ngược vào events.
    private readonly settlementsService: SettlementsService,
  ) {}

  /**
   * Input: orgId, admin tạo và thông tin buổi đánh.
   * Output: Event lẻ (không gắn template). Dùng cho buổi phát sinh ngoài lịch định kỳ.
   */
  async create(organizationId: string, createdBy: string, dto: CreateEventDto): Promise<EventSummary> {
    const startAt = new Date(dto.startAt);
    const event = await this.databaseService.event.create({
      data: {
        organization_id: organizationId,
        title: dto.title,
        start_at: startAt,
        end_at: new Date(dto.endAt),
        location_name: dto.locationName ?? null,
        location_address: dto.locationAddress ?? null,
        court_cost: dto.courtCost,
        extra_costs: toExtraCostsJson(dto.extraCosts ?? []),
        max_participants: dto.maxParticipants,
        vote_locked_at: new Date(startAt.getTime() - (dto.voteLockMinutesBefore ?? 0) * MS_PER_MINUTE),
        created_by: createdBy,
      },
    });

    return this.toEventSummary(event, 0);
  }

  /**
   * Input: orgId và bộ lọc status/from/to + phân trang.
   * Output: Danh sách buổi đánh sắp theo `start_at` tăng dần kèm sĩ số đang GOING.
   */
  async list(organizationId: string, query: ListEventsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_EVENT_PAGE_SIZE;
    const where = {
      organization_id: organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            start_at: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [events, total] = await Promise.all([
      this.databaseService.event.findMany({
        where,
        orderBy: { start_at: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { attendances: { where: { status: AttendanceStatus.GOING } } } } },
      }),
      this.databaseService.event.count({ where }),
    ]);

    return {
      items: events.map((event) => this.toEventSummary(event, event._count.attendances)),
      page,
      pageSize,
      total,
    };
  }

  /**
   * Input: eventId và người gọi.
   * Output: Chi tiết buổi đánh + danh sách vote + vote của tôi + cờ is_full/is_locked.
   */
  async getDetail(eventId: string, userId: string): Promise<EventDetail> {
    const { membership } = await this.requireEventAccess(eventId, userId);
    const event = await this.databaseService.event.findUnique({
      where: { id: eventId },
      include: {
        attendances: {
          orderBy: { created_at: 'asc' },
          include: { user: { select: { full_name: true, email: true, avatar_url: true } } },
        },
      },
    });
    if (!event) throw new AppException(ERROR_CODES.EVT_001);

    const goingCount = event.attendances.filter((item) => item.status === AttendanceStatus.GOING).length;
    const mine = event.attendances.find((item) => item.user_id === userId);

    return {
      ...this.toEventSummary(event, goingCount),
      attendances: event.attendances.map((item) => ({
        userId: item.user_id,
        fullName: item.user.full_name,
        email: item.user.email,
        avatarUrl: item.user.avatar_url,
        status: item.status,
        attended: item.attended,
        votedAt: item.created_at,
      })),
      myAttendance: mine ? { status: mine.status, attended: mine.attended } : null,
      myRole: membership.role,
    };
  }

  /**
   * Input: eventId, admin và các field cần đổi.
   * Output: Event sau khi cập nhật. Chỉ sửa được khi còn OPEN — sửa chi phí sau khi đã chia
   *         tiền sẽ làm settlement lệch khỏi tổng, muốn sửa thì reopen trước.
   */
  async update(eventId: string, userId: string, dto: UpdateEventDto): Promise<EventSummary> {
    const { event } = await this.requireEventAccess(eventId, userId, MemberRole.ADMIN);
    if (event.status !== EventStatus.OPEN) throw new AppException(ERROR_CODES.EVT_004);

    const startAt = dto.startAt ? new Date(dto.startAt) : event.start_at;
    const updated = await this.databaseService.event.update({
      where: { id: eventId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.startAt !== undefined ? { start_at: startAt } : {}),
        ...(dto.endAt !== undefined ? { end_at: new Date(dto.endAt) } : {}),
        ...(dto.locationName !== undefined ? { location_name: dto.locationName } : {}),
        ...(dto.locationAddress !== undefined ? { location_address: dto.locationAddress } : {}),
        ...(dto.courtCost !== undefined ? { court_cost: dto.courtCost } : {}),
        ...(dto.extraCosts !== undefined ? { extra_costs: toExtraCostsJson(dto.extraCosts) } : {}),
        ...(dto.maxParticipants !== undefined ? { max_participants: dto.maxParticipants } : {}),
        ...(dto.voteLockMinutesBefore !== undefined
          ? { vote_locked_at: new Date(startAt.getTime() - dto.voteLockMinutesBefore * MS_PER_MINUTE) }
          : {}),
      },
      include: { _count: { select: { attendances: { where: { status: AttendanceStatus.GOING } } } } },
    });

    return this.toEventSummary(updated, updated._count.attendances);
  }

  /**
   * Input: eventId và admin.
   * Output: Chuyển sang CANCELLED. Chỉ đi được từ OPEN — trận đã chia tiền thì phải reopen trước.
   */
  async cancel(eventId: string, userId: string): Promise<EventSummary> {
    const { event } = await this.requireEventAccess(eventId, userId, MemberRole.ADMIN);
    if (event.status !== EventStatus.OPEN) throw new AppException(ERROR_CODES.EVT_004);

    const cancelled = await this.databaseService.event.update({
      where: { id: eventId },
      data: { status: EventStatus.CANCELLED, cancelled_at: new Date() },
      include: { _count: { select: { attendances: { where: { status: AttendanceStatus.GOING } } } } },
    });

    return this.toEventSummary(cancelled, cancelled._count.attendances);
  }

  /**
   * Input: eventId, người vote và trạng thái mới.
   * Output: Vote của chính mình. GOING → NOT_GOING luôn được (khi chưa khoá) và slot trống
   *         ra ngay cho người khác; không có hàng đợi, không auto-promote.
   */
  async vote(eventId: string, userId: string, status: AttendanceStatus) {
    await this.requireEventAccess(eventId, userId);

    return this.databaseService.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      if (isVotingLocked(event, new Date())) {
        throw new AppException(event.status === EventStatus.OPEN ? ERROR_CODES.EVT_003 : ERROR_CODES.EVT_004);
      }

      return this.upsertAttendanceInLock(tx, event, userId, status);
    });
  }

  /**
   * Input: eventId, admin, user đích và trạng thái mới.
   * Output: Sửa vote hộ người khác — bỏ qua mốc khoá vote (admin điền bù cho người tới muộn)
   *         nhưng vẫn tôn trọng `max_participants` và vẫn chỉ dùng được khi trận còn OPEN.
   */
  async setAttendanceByAdmin(eventId: string, actorUserId: string, targetUserId: string, status: AttendanceStatus) {
    const { event } = await this.requireEventAccess(eventId, actorUserId, MemberRole.ADMIN);
    await this.requireActiveMember(event.organization_id, targetUserId);

    return this.databaseService.$transaction(async (tx) => {
      const locked = await this.lockEvent(tx, eventId);
      if (locked.status !== EventStatus.OPEN) throw new AppException(ERROR_CODES.EVT_004);

      return this.upsertAttendanceInLock(tx, locked, targetUserId, status);
    });
  }

  /**
   * Input: eventId, admin và danh sách `{ userId, attended }`.
   * Output: Số dòng đã cập nhật. Chỉ chấm được người đã có vote trong trận, và chỉ khi trận
   *         còn OPEN — sau finalize thì con số này đã bị đóng băng thành công nợ.
   */
  async markAttended(eventId: string, userId: string, dto: MarkAttendedDto): Promise<{ updated: number }> {
    const { event } = await this.requireEventAccess(eventId, userId, MemberRole.ADMIN);
    if (event.status !== EventStatus.OPEN) throw new AppException(ERROR_CODES.EVT_004);

    const updated = await this.databaseService.$transaction(
      dto.items.map((item) =>
        this.databaseService.eventAttendance.updateMany({
          where: { event_id: eventId, user_id: item.userId },
          data: { attended: item.attended },
        }),
      ),
    );

    return { updated: updated.reduce((sum, result) => sum + result.count, 0) };
  }

  /**
   * Input: eventId và admin.
   * Output: Chốt sổ — tạo công nợ cho những người `attended = true` rồi chuyển COMPLETED.
   *
   * Toàn bộ nằm trong một transaction có khoá row event, nên finalize hai lần đồng thời thì
   * lần sau thấy status đã COMPLETED và dừng lại.
   */
  async finalize(eventId: string, userId: string) {
    await this.requireEventAccess(eventId, userId, MemberRole.ADMIN);

    return this.databaseService.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      if (event.status !== EventStatus.OPEN) throw new AppException(ERROR_CODES.EVT_004);

      const attendees = await tx.eventAttendance.findMany({
        where: { event_id: eventId, attended: true },
        orderBy: [{ created_at: 'asc' }, { user_id: 'asc' }],
        select: { user_id: true },
      });
      if (attendees.length === 0) throw new AppException(ERROR_CODES.EVT_005);

      const settlements = await this.settlementsService.createForEvent(tx, {
        eventId,
        userIds: attendees.map((attendee) => attendee.user_id),
        totalAmount: computeEventTotalCost(event.court_cost, event.extra_costs),
      });

      await tx.event.update({
        where: { id: eventId },
        data: { status: EventStatus.COMPLETED, completed_at: new Date() },
      });

      return { eventId, totalAmount: settlements.totalAmount, settlements: settlements.items };
    });
  }

  /**
   * Input: eventId và admin.
   * Output: Mở lại trận đã chốt — xoá sạch settlement, về OPEN.
   *
   * Chỉ cho phép khi CHƯA ai trả đồng nào (mọi settlement còn paid_amount = 0), không thì
   * EVT_006. Có nút này vì admin gõ nhầm chi phí là chuyện thường; thiếu nó thì trận hỏng
   * vĩnh viễn.
   */
  async reopen(eventId: string, userId: string) {
    await this.requireEventAccess(eventId, userId, MemberRole.ADMIN);

    return this.databaseService.$transaction(async (tx) => {
      const event = await this.lockEvent(tx, eventId);
      if (event.status !== EventStatus.COMPLETED) throw new AppException(ERROR_CODES.EVT_004);

      await this.settlementsService.removeForEvent(tx, eventId);
      await tx.event.update({ where: { id: eventId }, data: { status: EventStatus.OPEN, completed_at: null } });

      return { eventId, status: EventStatus.OPEN };
    });
  }

  /**
   * Input: transaction client và eventId.
   * Output: Event đã khoá row tới cuối transaction.
   *
   * Đây là chỗ DUY NHẤT chống được việc hai người cùng giành slot cuối: đếm rồi mới ghi mà
   * không khoá thì chắc chắn có lúc vượt `max_participants`.
   */
  private async lockEvent(tx: TransactionClient, eventId: string) {
    const rows = await tx.$queryRaw<
      {
        id: string;
        organization_id: string;
        status: EventStatus;
        start_at: Date;
        vote_locked_at: Date;
        max_participants: number;
        court_cost: number;
        extra_costs: unknown;
      }[]
    >`SELECT id, organization_id, status, start_at, vote_locked_at, max_participants, court_cost, extra_costs
      FROM events
      WHERE id = ${eventId}::uuid
      FOR UPDATE`;
    if (rows.length === 0) throw new AppException(ERROR_CODES.EVT_001);

    return rows[0];
  }

  /**
   * Input: transaction client (đang giữ khoá event), event, user và trạng thái mới.
   * Output: Upsert attendance. Chuyển sang GOING khi trận đã đủ người → EVT_002.
   */
  private async upsertAttendanceInLock(
    tx: TransactionClient,
    event: { id: string; max_participants: number },
    userId: string,
    status: AttendanceStatus,
  ) {
    if (status === AttendanceStatus.GOING) {
      const goingCount = await tx.eventAttendance.count({
        where: { event_id: event.id, status: AttendanceStatus.GOING, user_id: { not: userId } },
      });
      if (goingCount >= event.max_participants) throw new AppException(ERROR_CODES.EVT_002);
    }

    const attendance = await tx.eventAttendance.upsert({
      where: { event_id_user_id: { event_id: event.id, user_id: userId } },
      create: { event_id: event.id, user_id: userId, status },
      update: { status },
    });
    const goingCount = await tx.eventAttendance.count({
      where: { event_id: event.id, status: AttendanceStatus.GOING },
    });

    return {
      eventId: event.id,
      userId,
      status: attendance.status,
      attended: attendance.attended,
      goingCount,
      isFull: goingCount >= event.max_participants,
    };
  }

  /**
   * Input: eventId, người gọi và role tối thiểu (nếu có).
   * Output: `{ event, membership }`.
   *
   * Route thao tác trên `:eventId` không có `:orgId` trên URL nên OrgMemberGuard không dùng
   * được — org phải suy ra từ chính event, và đó là việc của service.
   */
  private async requireEventAccess(eventId: string, userId: string, requiredRole?: MemberRole) {
    const event = await this.databaseService.event.findUnique({ where: { id: eventId } });
    if (!event) throw new AppException(ERROR_CODES.EVT_001);

    const membership = await this.requireActiveMember(event.organization_id, userId);
    if (requiredRole && membership.role !== requiredRole) throw new AppException(ERROR_CODES.ORG_003);

    return { event, membership: { organizationId: event.organization_id, userId, role: membership.role } };
  }

  private async requireActiveMember(organizationId: string, userId: string): Promise<{ role: MemberRole }> {
    const membership = await this.databaseService.organizationMember.findUnique({
      where: { organization_id_user_id: { organization_id: organizationId, user_id: userId } },
      select: { role: true, status: true },
    });
    if (!membership || membership.status !== MemberStatus.ACTIVE) throw new AppException(ERROR_CODES.ORG_002);

    return { role: membership.role };
  }

  private toEventSummary(
    event: {
      id: string;
      organization_id: string;
      title: string;
      start_at: Date;
      end_at: Date;
      location_name: string | null;
      location_address: string | null;
      court_cost: number;
      extra_costs: unknown;
      max_participants: number;
      vote_locked_at: Date;
      status: EventStatus;
      completed_at: Date | null;
      cancelled_at: Date | null;
    },
    goingCount: number,
  ): EventSummary {
    const extraCosts = parseExtraCosts(event.extra_costs);

    return {
      id: event.id,
      organizationId: event.organization_id,
      title: event.title,
      startAt: event.start_at,
      endAt: event.end_at,
      locationName: event.location_name,
      locationAddress: event.location_address,
      courtCost: event.court_cost,
      extraCosts,
      totalCost: computeEventTotalCost(event.court_cost, extraCosts),
      maxParticipants: event.max_participants,
      voteLockedAt: event.vote_locked_at,
      status: event.status,
      goingCount,
      isFull: goingCount >= event.max_participants,
      isLocked: isVotingLocked(event, new Date()),
      completedAt: event.completed_at,
      cancelledAt: event.cancelled_at,
    };
  }
}
