import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentMembership } from '../common/decorators/current-membership.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../common/guards/org-member.guard';
import { CommonParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { RequestMembership } from '../common/utils/types';
import { MemberRole } from '../generated/prisma/enums';
import { CreateEventDto } from './dto/create-event.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { MarkAttendedDto } from './dto/mark-attended.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpsertAttendanceDto } from './dto/upsert-attendance.dto';
import { EventsService } from './events.service';

@Controller('organizations/:orgId/events')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class OrganizationEventsController {
  constructor(private readonly eventsService: EventsService) {}

  /**
   * Input: orgId + thông tin buổi đánh lẻ.
   * Output: Event mới (không gắn template).
   */
  @Post()
  @OrgRoles(MemberRole.ADMIN)
  create(
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() userId: string,
    @Body() dto: CreateEventDto,
  ) {
    return this.eventsService.create(membership.organizationId, userId, dto);
  }

  /**
   * Input: orgId + bộ lọc status/from/to + phân trang.
   * Output: Danh sách buổi đánh sắp theo giờ bắt đầu.
   */
  @Get()
  list(@CurrentMembership() membership: RequestMembership, @Query() query: ListEventsQueryDto) {
    return this.eventsService.list(membership.organizationId, query);
  }
}

/**
 * Route thao tác trên `:eventId` không có `:orgId` trên URL nên KHÔNG dùng OrgMemberGuard —
 * guard không đoán được org từ id lồng nhau. EventsService tự nạp event rồi kiểm tra membership.
 */
@Controller('events/:eventId')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  /**
   * Input: eventId.
   * Output: Chi tiết + danh sách vote + vote của tôi + is_full/is_locked.
   */
  @Get()
  getDetail(@Param('eventId', CommonParseUuidPipe) eventId: string, @CurrentUser() userId: string) {
    return this.eventsService.getDetail(eventId, userId);
  }

  /**
   * Input: eventId + field cần đổi.
   * Output: Event sau khi cập nhật (ADMIN, chỉ khi còn OPEN).
   */
  @Patch()
  update(
    @Param('eventId', CommonParseUuidPipe) eventId: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.update(eventId, userId, dto);
  }

  /**
   * Input: eventId.
   * Output: Huỷ buổi đánh (ADMIN, chỉ từ OPEN).
   */
  @Post('cancel')
  cancel(@Param('eventId', CommonParseUuidPipe) eventId: string, @CurrentUser() userId: string) {
    return this.eventsService.cancel(eventId, userId);
  }

  /**
   * Input: eventId + trạng thái vote.
   * Output: Vote của chính mình kèm sĩ số mới. Trận đủ người → EVT_002, quá giờ khoá → EVT_003.
   */
  @Put('attendance')
  vote(
    @Param('eventId', CommonParseUuidPipe) eventId: string,
    @CurrentUser() userId: string,
    @Body() dto: UpsertAttendanceDto,
  ) {
    return this.eventsService.vote(eventId, userId, dto.status);
  }

  /**
   * Input: eventId, userId đích và trạng thái.
   * Output: Sửa vote hộ người khác (ADMIN) — bỏ qua mốc khoá vote, vẫn tôn trọng sĩ số tối đa.
   */
  @Put('attendances/:userId')
  setAttendance(
    @Param('eventId', CommonParseUuidPipe) eventId: string,
    @Param('userId', CommonParseUuidPipe) targetUserId: string,
    @CurrentUser() userId: string,
    @Body() dto: UpsertAttendanceDto,
  ) {
    return this.eventsService.setAttendanceByAdmin(eventId, userId, targetUserId, dto.status);
  }

  /**
   * Input: eventId + danh sách `{ userId, attended }`.
   * Output: Chấm điểm danh thực tế hàng loạt (ADMIN).
   */
  @Patch('attendances')
  markAttended(
    @Param('eventId', CommonParseUuidPipe) eventId: string,
    @CurrentUser() userId: string,
    @Body() dto: MarkAttendedDto,
  ) {
    return this.eventsService.markAttended(eventId, userId, dto);
  }

  /**
   * Input: eventId.
   * Output: Chốt sổ và chia tiền cho người `attended = true` (ADMIN).
   */
  @Post('finalize')
  finalize(@Param('eventId', CommonParseUuidPipe) eventId: string, @CurrentUser() userId: string) {
    return this.eventsService.finalize(eventId, userId);
  }

  /**
   * Input: eventId.
   * Output: Mở lại trận đã chốt (ADMIN) — chỉ khi chưa ai trả đồng nào.
   */
  @Post('reopen')
  reopen(@Param('eventId', CommonParseUuidPipe) eventId: string, @CurrentUser() userId: string) {
    return this.eventsService.reopen(eventId, userId);
  }
}
