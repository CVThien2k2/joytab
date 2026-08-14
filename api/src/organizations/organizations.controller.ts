import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentMembership } from '../common/decorators/current-membership.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../common/guards/org-member.guard';
import { CommonParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { RequestMembership } from '../common/utils/types';
import { MemberRole } from '../generated/prisma/enums';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  /**
   * Input: Tên (và avatar) tổ chức mới.
   * Output: Tổ chức vừa tạo; người tạo tự động là ADMIN.
   */
  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(userId, dto);
  }

  /**
   * Input: Không có.
   * Output: Các tổ chức tôi đang tham gia (ACTIVE).
   */
  @Get()
  listMine(@CurrentUser() userId: string) {
    return this.organizationsService.listMine(userId);
  }

  /**
   * Input: orgId.
   * Output: Chi tiết tổ chức + role của tôi.
   */
  @Get(':orgId')
  @UseGuards(OrgMemberGuard)
  getDetail(@CurrentMembership() membership: RequestMembership) {
    return this.organizationsService.getDetail(membership.organizationId, membership.role);
  }

  /**
   * Input: orgId + field cần đổi.
   * Output: Tổ chức sau khi cập nhật.
   */
  @Patch(':orgId')
  @UseGuards(OrgMemberGuard)
  @OrgRoles(MemberRole.ADMIN)
  update(@CurrentMembership() membership: RequestMembership, @Body() dto: UpdateOrganizationDto) {
    return this.organizationsService.update(membership.organizationId, membership.role, dto);
  }

  /**
   * Input: orgId.
   * Output: Danh sách thành viên ACTIVE.
   */
  @Get(':orgId/members')
  @UseGuards(OrgMemberGuard)
  listMembers(@CurrentMembership() membership: RequestMembership) {
    return this.organizationsService.listMembers(membership.organizationId);
  }

  /**
   * Input: orgId, userId đích và role mới.
   * Output: Thành viên sau khi đổi role. Hạ ADMIN cuối cùng → ORG_004.
   */
  @Patch(':orgId/members/:userId')
  @UseGuards(OrgMemberGuard)
  @OrgRoles(MemberRole.ADMIN)
  updateMemberRole(
    @CurrentMembership() membership: RequestMembership,
    @Param('userId', CommonParseUuidPipe) targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.organizationsService.updateMemberRole(membership.organizationId, targetUserId, dto.role);
  }

  /**
   * Input: orgId và userId đích.
   * Output: Đặt thành viên về LEFT. Kick ADMIN cuối cùng → ORG_004.
   */
  @Delete(':orgId/members/:userId')
  @UseGuards(OrgMemberGuard)
  @OrgRoles(MemberRole.ADMIN)
  removeMember(
    @CurrentMembership() membership: RequestMembership,
    @Param('userId', CommonParseUuidPipe) targetUserId: string,
  ) {
    return this.organizationsService.removeMember(membership.organizationId, targetUserId);
  }

  /**
   * Input: orgId.
   * Output: Tự rời nhóm. ADMIN cuối cùng phải trao quyền trước, không thì ORG_004.
   */
  @Post(':orgId/leave')
  @UseGuards(OrgMemberGuard)
  leave(@CurrentMembership() membership: RequestMembership) {
    return this.organizationsService.leave(membership.organizationId, membership.userId);
  }
}
