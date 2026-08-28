import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CreateMatchDto,
  MatchIdParamDto,
  MatchOrganizationParamDto,
  MatchRangeQueryDto,
  SettleMatchDto,
  UpdateMatchDto,
} from './matches.dto';
import { MatchesService } from './matches.service';

/**
 * Lịch thi đấu trong phạm vi MỘT tổ chức: tạo và liệt kê.
 *
 * Tách khỏi MatchesController vì hai nhóm route trả lời hai câu hỏi khác nhau — "tổ chức này
 * có những trận nào" cần biết tổ chức, còn mọi thao tác lên một trận cụ thể thì id trận đã
 * đủ (tổ chức suy ra được từ nó).
 */
@Controller('organizations/:organizationId/matches')
@UseGuards(JwtAuthGuard)
export class OrganizationMatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  /**
   * Input: cookie `at` + id tổ chức + ?from&to (ISO 8601, đều tuỳ chọn).
   * Output: { matches } — các trận trong khoảng, sớm nhất trước. Gồm cả trận đã huỷ để bộ
   *         lịch hiện chúng ở dạng gạch mờ.
   */
  @Get()
  async list(
    @Req() request: Request & { userId: string },
    @Param() params: MatchOrganizationParamDto,
    @Query() query: MatchRangeQueryDto,
  ) {
    return {
      matches: await this.matchesService.listForOrganization(request.userId, params.organizationId, query),
    };
  }

  /**
   * Input: cookie `at` + id tổ chức + { courtName, startAt, endAt, maxPlayers, maleRatio?, note? }.
   * Output: { match } — trận vừa tạo. Chỉ owner gọi được.
   */
  @Post()
  async create(
    @Req() request: Request & { userId: string },
    @Param() params: MatchOrganizationParamDto,
    @Body() dto: CreateMatchDto,
  ) {
    return {
      match: await this.matchesService.create(request.userId, params.organizationId, dto),
    };
  }
}

/** Mọi thao tác lên một trận cụ thể. Đều cần đăng nhập và là thành viên của tổ chức chứa trận. */
@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  /**
   * Input: cookie `at` + id trận.
   * Output: { match } — chi tiết kèm danh sách người tham gia, "tôi đã vote chưa", còn huỷ
   *         được không, và số tiền của tôi nếu trận đã chốt.
   */
  @Get(':id')
  async detail(@Req() request: Request & { userId: string }, @Param() params: MatchIdParamDto) {
    return { match: await this.matchesService.detail(request.userId, params.id) };
  }

  /**
   * Input: cookie `at` + id trận + các field cần đổi.
   * Output: { match } — sau khi đổi. Cũng là API đứng sau thao tác kéo thả trên lịch, nên
   *         FE phải hoàn tác chip về chỗ cũ khi route này trả lỗi.
   */
  @Patch(':id')
  async update(
    @Req() request: Request & { userId: string },
    @Param() params: MatchIdParamDto,
    @Body() dto: UpdateMatchDto,
  ) {
    return { match: await this.matchesService.update(request.userId, params.id, dto) };
  }

  /**
   * Input: cookie `at` + id trận.
   * Output: Envelope rỗng. Huỷ MỀM (status = 'canceled') để người đã vote thấy trận biến mất
   *         có lý do và lịch sử vote vẫn tra được.
   */
  @Delete(':id')
  async cancel(@Req() request: Request & { userId: string }, @Param() params: MatchIdParamDto) {
    await this.matchesService.cancel(request.userId, params.id);
  }

  /**
   * Input: cookie `at` + id trận.
   * Output: Envelope rỗng. Lỗi nói rõ vì sao không vote được: đủ người, đã bắt đầu, hay trùng
   *         giờ với một trận khác của chính user (xét mọi tổ chức).
   */
  @Post(':id/vote')
  async vote(@Req() request: Request & { userId: string }, @Param() params: MatchIdParamDto) {
    await this.matchesService.vote(request.userId, params.id);
  }

  /**
   * Input: cookie `at` + id trận.
   * Output: Envelope rỗng. Chặn khi còn dưới 2 giờ nữa là tới giờ chơi.
   */
  @Delete(':id/vote')
  async cancelVote(@Req() request: Request & { userId: string }, @Param() params: MatchIdParamDto) {
    await this.matchesService.cancelVote(request.userId, params.id);
  }

  /**
   * Input: cookie `at` + id trận.
   * Output: { events } — lịch sử vote/huỷ, mới nhất trước. Mọi thành viên đọc được, không
   *         riêng owner: người cùng đá mới là người cần biết ai đã rút.
   */
  @Get(':id/history')
  async history(@Req() request: Request & { userId: string }, @Param() params: MatchIdParamDto) {
    return { events: await this.matchesService.history(request.userId, params.id) };
  }

  /**
   * Input: cookie `at` + id trận.
   * Output: { settlement } — bảng chia tiền đã lưu. Trận chưa chốt thì MATCH_013: chưa có gì
   *         để đọc, FE tự dựng preview từ danh sách người tham gia.
   */
  @Get(':id/settlement')
  async settlement(@Req() request: Request & { userId: string }, @Param() params: MatchIdParamDto) {
    return { settlement: await this.matchesService.getSettlement(request.userId, params.id) };
  }

  /**
   * Input: cookie `at` + id trận + { maleRatio, expenses: [{ name, quantity, unitPrice }] }.
   * Output: { settlement } — bảng chia tiền vừa lưu. Chỉ owner, và chỉ khi trận đã bắt đầu.
   *
   *         Gửi TOÀN BỘ danh sách chi phí mỗi lần: chốt lại là ghi đè cả bảng.
   */
  @Post(':id/settlement')
  async settle(
    @Req() request: Request & { userId: string },
    @Param() params: MatchIdParamDto,
    @Body() dto: SettleMatchDto,
  ) {
    return { settlement: await this.matchesService.settle(request.userId, params.id, dto) };
  }
}
