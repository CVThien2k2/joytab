import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentMembership } from '../common/decorators/current-membership.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../common/guards/org-member.guard';
import { CommonParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { RequestMembership } from '../common/utils/types';
import { MemberRole } from '../generated/prisma/enums';
import { CreateEventTemplateDto } from './dto/create-event-template.dto';
import { UpdateEventTemplateDto } from './dto/update-event-template.dto';
import { EventGeneratorService } from './event-generator.service';
import { TemplatesService } from './templates.service';

@Controller('organizations/:orgId/templates')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class TemplatesController {
  constructor(
    private readonly templatesService: TemplatesService,
    private readonly eventGeneratorService: EventGeneratorService,
  ) {}

  /**
   * Input: orgId + cấu hình lịch định kỳ hàng tuần.
   * Output: Template mới.
   */
  @Post()
  @OrgRoles(MemberRole.ADMIN)
  create(
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() userId: string,
    @Body() dto: CreateEventTemplateDto,
  ) {
    return this.templatesService.create(membership.organizationId, userId, dto);
  }

  /**
   * Input: orgId.
   * Output: Danh sách lịch định kỳ. Mọi thành viên đều xem được để biết nhóm đánh hôm nào.
   */
  @Get()
  list(@CurrentMembership() membership: RequestMembership) {
    return this.templatesService.list(membership.organizationId);
  }

  /**
   * Input: orgId, id template và field cần đổi.
   * Output: Template sau khi cập nhật.
   */
  @Patch(':templateId')
  @OrgRoles(MemberRole.ADMIN)
  update(
    @CurrentMembership() membership: RequestMembership,
    @Param('templateId', CommonParseUuidPipe) templateId: string,
    @Body() dto: UpdateEventTemplateDto,
  ) {
    return this.templatesService.update(membership.organizationId, templateId, dto);
  }

  /**
   * Input: orgId và id template.
   * Output: Xoá template; các buổi đã sinh vẫn còn nguyên.
   */
  @Delete(':templateId')
  @OrgRoles(MemberRole.ADMIN)
  remove(
    @CurrentMembership() membership: RequestMembership,
    @Param('templateId', CommonParseUuidPipe) templateId: string,
  ) {
    return this.templatesService.remove(membership.organizationId, templateId);
  }

  /**
   * Input: orgId và id template.
   * Output: Sinh bù ngay các buổi trong 14 ngày tới, dùng chung đúng hàm mà cron gọi.
   *         Idempotent nên bấm nhiều lần cũng không đẻ trùng.
   */
  @Post(':templateId/generate')
  @OrgRoles(MemberRole.ADMIN)
  async generate(
    @CurrentMembership() membership: RequestMembership,
    @Param('templateId', CommonParseUuidPipe) templateId: string,
  ) {
    const template = await this.templatesService.requireTemplate(membership.organizationId, templateId);
    const created = await this.eventGeneratorService.generateForTemplate(template);

    return { templateId, created };
  }
}
