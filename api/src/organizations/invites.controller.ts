import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentMembership } from '../common/decorators/current-membership.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../common/guards/org-member.guard';
import { CommonParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { RequestMembership } from '../common/utils/types';
import { MemberRole } from '../generated/prisma/enums';
import { CreateInviteDto } from './dto/create-invite.dto';
import { InvitesService } from './invites.service';

@Controller('organizations/:orgId/invites')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
@OrgRoles(MemberRole.ADMIN)
export class OrganizationInvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  /**
   * Input: orgId + tuỳ chọn hạn dùng / số lượt.
   * Output: Invite mới kèm token thô và URL — chỉ thấy được đúng lần này.
   */
  @Post()
  create(
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() userId: string,
    @Body() dto: CreateInviteDto,
  ) {
    return this.invitesService.create(membership.organizationId, userId, dto);
  }

  /**
   * Input: orgId.
   * Output: Danh sách invite của tổ chức (không có token).
   */
  @Get()
  list(@CurrentMembership() membership: RequestMembership) {
    return this.invitesService.list(membership.organizationId);
  }

  /**
   * Input: orgId và id invite.
   * Output: Invite sau khi thu hồi.
   */
  @Delete(':inviteId')
  revoke(@CurrentMembership() membership: RequestMembership, @Param('inviteId', CommonParseUuidPipe) inviteId: string) {
    return this.invitesService.revoke(membership.organizationId, inviteId);
  }
}

@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  /**
   * Input: Token thô trên URL. Route PUBLIC — người chưa đăng nhập cần xem được lời mời
   *        trước khi quyết định bấm đăng nhập Google.
   * Output: Tên tổ chức + link còn dùng được hay không.
   */
  @Get(':token')
  preview(@Param('token') token: string) {
    return this.invitesService.preview(token);
  }

  /**
   * Input: Token thô + user đã đăng nhập.
   * Output: `{ organizationId, alreadyMember }` để FE điều hướng thẳng vào nhóm.
   */
  @Post(':token/accept')
  @UseGuards(JwtAuthGuard)
  accept(@Param('token') token: string, @CurrentUser() userId: string) {
    return this.invitesService.accept(token, userId);
  }
}
