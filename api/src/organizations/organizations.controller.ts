import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  JOIN_CODE_THROTTLE_LIMIT,
  JOIN_CODE_THROTTLE_TTL_MS,
} from './organizations.constants';
import {
  CreateOrganizationDto,
  JoinCodeParamDto,
  JoinOrganizationDto,
  OrganizationIdParamDto,
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
  async previewByCode(
    @Req() request: Request & { userId: string },
    @Param() params: JoinCodeParamDto,
  ) {
    return {
      organization: await this.organizationsService.previewByCode(request.userId, params.code),
    };
  }

  /**
   * Input: cookie `at` + id tổ chức + { joinByCodeEnabled }.
   * Output: { organization } — tổ chức sau khi bật/tắt cửa vào bằng mã. Chỉ owner gọi được.
   */
  @Patch(':id')
  async update(
    @Req() request: Request & { userId: string },
    @Param() params: OrganizationIdParamDto,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return {
      organization: await this.organizationsService.setJoinByCodeEnabled(
        request.userId,
        params.id,
        dto.joinByCodeEnabled,
      ),
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
