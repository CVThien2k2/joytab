import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateOrganizationDto, JoinOrganizationDto } from './organizations.dto';
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
   * Input: cookie `at` + { joinCode }.
   * Output: { organization } — tổ chức vừa vào, người gọi là member.
   */
  @Post('join')
  async join(@Req() request: Request & { userId: string }, @Body() dto: JoinOrganizationDto) {
    return { organization: await this.organizationsService.joinByCode(request.userId, dto.joinCode) };
  }
}
