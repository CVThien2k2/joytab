import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JOIN_CODE_THROTTLE_LIMIT, JOIN_CODE_THROTTLE_TTL_MS } from './organizations.constants';
import {
  CreateOrganizationDto,
  JoinCodeParamDto,
  JoinOrganizationDto,
  ListMembersQueryDto,
  OrganizationIdParamDto,
  OrganizationMemberParamDto,
  UpdateOrganizationDto,
} from './organizations.dto';
import { OrganizationsService } from './organizations.service';

/** Mọi route ở đây đều cần đăng nhập; userId luôn lấy từ access token, không nhận từ body. */
@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  /**
   * Input: cookie `at`.
   * Output: { organizations } — các tổ chức user đang thuộc, cũ nhất trước. Mảng rỗng là
   *         trạng thái hợp lệ (user chưa vào tổ chức nào), không phải lỗi 404.
   *
   *         Bọc trong object thay vì trả mảng trần để sau này thêm được field (vd tổ chức
   *         đang chọn) mà không phá hợp đồng cũ.
   */
  @Get()
  async list(@Req() request: Request & { userId: string }) {
    return { organizations: await this.organizationsService.listForUser(request.userId) };
  }

  /**
   * Input: cookie `at` + { name }.
   * Output: { organization } — tổ chức mới, người gọi là owner.
   */
  @Post()
  async create(@Req() request: Request & { userId: string }, @Body() dto: CreateOrganizationDto) {
    return { organization: await this.organizationsService.create(request.userId, dto) };
  }

  /**
   * Input: cookie `at` + mã tham gia trên URL (từ link mời).
   * Output: { organization } — tên + số thành viên + đã là thành viên chưa, để dựng màn hình
   *         xác nhận trước khi vào. Vẫn cần đăng nhập: chưa đăng nhập thì FE bắt login trước
   *         rồi mới quay lại đây.
   *
   *         Đặt TRƯỚC route động nào khác cũng không sao vì 'by-code' là path cố định, nhưng
   *         giữ nguyên thứ tự này cho khỏi phải nghĩ khi thêm GET /:id sau.
   */
  @Throttle({ global: { ttl: JOIN_CODE_THROTTLE_TTL_MS, limit: JOIN_CODE_THROTTLE_LIMIT } })
  @Get('by-code/:code')
  async previewByCode(@Req() request: Request & { userId: string }, @Param() params: JoinCodeParamDto) {
    return {
      organization: await this.organizationsService.previewByCode(request.userId, params.code),
    };
  }

  /**
   * Input: cookie `at` + id tổ chức trên URL + ?page&pageSize&q.
   * Output: { members, pagination } — một trang thành viên, owner trước rồi theo thứ tự vào.
   *
   *         Đặt SAU 'by-code/:code' nhưng trước hay sau cũng không đổi nghĩa: ':id/members'
   *         có hai đoạn nên không đụng route một đoạn nào.
   */
  @Get(':id/members')
  async listMembers(
    @Req() request: Request & { userId: string },
    @Param() params: OrganizationIdParamDto,
    @Query() query: ListMembersQueryDto,
  ) {
    return this.organizationsService.listMembers(request.userId, params.id, query);
  }

  /**
   * Input: cookie `at` + id tổ chức + userId người bị xoá.
   * Output: Envelope rỗng (`data` không có gì để trả).
   *
   *         MỘT route cho hai việc vì cùng một thay đổi dữ liệu: userId là chính mình = rời tổ
   *         chức (chỉ member), userId người khác = owner đuổi thành viên. Owner không rời được
   *         (ORG_005) — muốn dừng thì xoá cả tổ chức.
   */
  @Delete(':id/members/:userId')
  async removeMember(@Req() request: Request & { userId: string }, @Param() params: OrganizationMemberParamDto) {
    await this.organizationsService.removeMember(request.userId, params.id, params.userId);
  }

  /**
   * Input: cookie `at` + id tổ chức.
   * Output: Envelope rỗng. Chỉ owner gọi được; thành viên và dữ liệu của tổ chức đi theo.
   *
   *         Không dùng 204: mọi route trong API này đi qua ResponseInterceptor và trả cùng một
   *         envelope, giữ nếp đó thì FE không phải có nhánh riêng cho hai route xoá.
   */
  @Delete(':id')
  async remove(@Req() request: Request & { userId: string }, @Param() params: OrganizationIdParamDto) {
    await this.organizationsService.remove(request.userId, params.id);
  }

  /**
   * Input: cookie `at` + id tổ chức + { name?, joinByCodeEnabled? }.
   * Output: { organization } — tổ chức sau khi đổi tên và/hoặc bật/tắt cửa vào bằng mã. Chỉ
   *         owner gọi được. Hai field độc lập: gửi field nào đổi field đó.
   */
  @Patch(':id')
  async update(
    @Req() request: Request & { userId: string },
    @Param() params: OrganizationIdParamDto,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return {
      organization: await this.organizationsService.update(request.userId, params.id, dto),
    };
  }

  /**
   * Input: cookie `at` + { joinCode }.
   * Output: { organization } — tổ chức vừa vào, người gọi là member.
   */
  @Throttle({ global: { ttl: JOIN_CODE_THROTTLE_TTL_MS, limit: JOIN_CODE_THROTTLE_LIMIT } })
  @Post('join')
  async join(@Req() request: Request & { userId: string }, @Body() dto: JoinOrganizationDto) {
    return { organization: await this.organizationsService.joinByCode(request.userId, dto.joinCode) };
  }
}
