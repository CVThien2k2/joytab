import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { DatabaseService } from '../database/database.service';
import { MemberRole, MemberStatus } from '../generated/prisma/enums';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

/** Prisma client bên trong `$transaction` — không có $transaction/$connect lồng nhau. */
type TransactionClient = Parameters<Parameters<DatabaseService['$transaction']>[0]>[0];

type OrganizationSummary = {
  id: string;
  name: string;
  avatarUrl: string | null;
  myRole: MemberRole;
  memberCount: number;
  createdAt: Date;
};

type MemberView = {
  userId: string;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: Date;
};

@Injectable()
export class OrganizationsService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Input: userId người tạo và tên/avatar tổ chức.
   * Output: Tạo org + gắn người tạo làm ADMIN trong cùng một transaction — org không bao
   *         giờ tồn tại ở trạng thái không có admin nào.
   */
  async create(userId: string, dto: CreateOrganizationDto): Promise<OrganizationSummary> {
    const organization = await this.databaseService.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: { name: dto.name, avatar_url: dto.avatarUrl ?? null, created_by: userId },
      });
      await tx.organizationMember.create({
        data: {
          organization_id: created.id,
          user_id: userId,
          role: MemberRole.ADMIN,
          status: MemberStatus.ACTIVE,
        },
      });
      return created;
    });

    return {
      id: organization.id,
      name: organization.name,
      avatarUrl: organization.avatar_url,
      myRole: MemberRole.ADMIN,
      memberCount: 1,
      createdAt: organization.created_at,
    };
  }

  /**
   * Input: userId người gọi.
   * Output: Các tổ chức user đang là thành viên ACTIVE, kèm role và sĩ số.
   */
  async listMine(userId: string): Promise<OrganizationSummary[]> {
    const memberships = await this.databaseService.organizationMember.findMany({
      where: { user_id: userId, status: MemberStatus.ACTIVE },
      orderBy: { joined_at: 'asc' },
      select: {
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
            created_at: true,
            _count: { select: { members: { where: { status: MemberStatus.ACTIVE } } } },
          },
        },
      },
    });

    return memberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      avatarUrl: membership.organization.avatar_url,
      myRole: membership.role,
      memberCount: membership.organization._count.members,
      createdAt: membership.organization.created_at,
    }));
  }

  /**
   * Input: orgId (đã qua OrgMemberGuard) và role của người gọi.
   * Output: Chi tiết tổ chức kèm role của tôi — FE dùng `myRole` để ẩn/hiện menu ADMIN.
   */
  async getDetail(organizationId: string, myRole: MemberRole): Promise<OrganizationSummary> {
    const organization = await this.databaseService.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        avatar_url: true,
        created_at: true,
        _count: { select: { members: { where: { status: MemberStatus.ACTIVE } } } },
      },
    });
    if (!organization) throw new AppException(ERROR_CODES.ORG_001);

    return {
      id: organization.id,
      name: organization.name,
      avatarUrl: organization.avatar_url,
      myRole,
      memberCount: organization._count.members,
      createdAt: organization.created_at,
    };
  }

  /**
   * Input: orgId và các field cần đổi.
   * Output: Tổ chức sau khi cập nhật. Field không truyền thì giữ nguyên.
   */
  async update(organizationId: string, myRole: MemberRole, dto: UpdateOrganizationDto): Promise<OrganizationSummary> {
    await this.databaseService.organization.update({
      where: { id: organizationId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.avatarUrl !== undefined ? { avatar_url: dto.avatarUrl } : {}),
      },
    });

    return this.getDetail(organizationId, myRole);
  }

  /**
   * Input: orgId.
   * Output: Danh sách thành viên ACTIVE, ADMIN xếp trước rồi tới thứ tự tham gia.
   */
  async listMembers(organizationId: string): Promise<MemberView[]> {
    const members = await this.databaseService.organizationMember.findMany({
      where: { organization_id: organizationId, status: MemberStatus.ACTIVE },
      orderBy: [{ role: 'asc' }, { joined_at: 'asc' }],
      select: {
        user_id: true,
        role: true,
        status: true,
        joined_at: true,
        user: { select: { full_name: true, email: true, avatar_url: true } },
      },
    });

    return members.map((member) => ({
      userId: member.user_id,
      fullName: member.user.full_name,
      email: member.user.email,
      avatarUrl: member.user.avatar_url,
      role: member.role,
      status: member.status,
      joinedAt: member.joined_at,
    }));
  }

  /**
   * Input: orgId, user bị đổi và role mới.
   * Output: Thành viên sau khi đổi role. Hạ ADMIN cuối cùng xuống MEMBER → ORG_004.
   */
  async updateMemberRole(organizationId: string, targetUserId: string, role: MemberRole): Promise<MemberView> {
    await this.databaseService.$transaction(async (tx) => {
      await this.lockOrganization(tx, organizationId);
      const member = await this.findActiveMember(tx, organizationId, targetUserId);
      if (member.role === role) return;

      if (role === MemberRole.MEMBER) {
        await this.assertNotLastAdmin(tx, organizationId, targetUserId);
      }
      await tx.organizationMember.update({ where: { id: member.id }, data: { role } });
    });

    return this.getMemberView(organizationId, targetUserId);
  }

  /**
   * Input: orgId và user bị mời ra.
   * Output: Đặt status = LEFT (giữ lịch sử điểm danh/công nợ). Kick ADMIN cuối cùng → ORG_004.
   */
  async removeMember(organizationId: string, targetUserId: string): Promise<{ userId: string }> {
    await this.databaseService.$transaction(async (tx) => {
      await this.lockOrganization(tx, organizationId);
      const member = await this.findActiveMember(tx, organizationId, targetUserId);
      await this.assertNotLastAdmin(tx, organizationId, targetUserId);
      await tx.organizationMember.update({ where: { id: member.id }, data: { status: MemberStatus.LEFT } });
    });

    return { userId: targetUserId };
  }

  /**
   * Input: orgId và người gọi.
   * Output: Tự rời nhóm. ADMIN cuối cùng rời đi → ORG_004; phải trao quyền cho người khác trước.
   */
  async leave(organizationId: string, userId: string): Promise<{ userId: string }> {
    return this.removeMember(organizationId, userId);
  }

  /**
   * Input: transaction client và orgId.
   * Output: Khoá row tổ chức tới cuối transaction.
   *
   * Đây là điểm nối tiếp duy nhất cho mọi thao tác đổi thành viên. Không có nó thì hai admin
   * cùng lúc tự rời nhóm sẽ cùng đếm ra "còn 2 admin" rồi cùng đi, tổ chức mất sạch admin.
   */
  private async lockOrganization(tx: TransactionClient, organizationId: string): Promise<void> {
    const locked = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
    if (locked.length === 0) throw new AppException(ERROR_CODES.ORG_001);
  }

  private async findActiveMember(tx: TransactionClient, organizationId: string, userId: string) {
    const member = await tx.organizationMember.findUnique({
      where: { organization_id_user_id: { organization_id: organizationId, user_id: userId } },
      select: { id: true, role: true, status: true },
    });
    if (!member || member.status !== MemberStatus.ACTIVE) throw new AppException(ERROR_CODES.ORG_006);

    return member;
  }

  /**
   * Input: transaction client, orgId và user sắp bị gỡ khỏi hàng ngũ ADMIN.
   * Output: Ném ORG_004 nếu gỡ xong tổ chức không còn ADMIN nào ACTIVE.
   */
  private async assertNotLastAdmin(tx: TransactionClient, organizationId: string, userId: string): Promise<void> {
    const remainingAdmins = await tx.organizationMember.count({
      where: {
        organization_id: organizationId,
        status: MemberStatus.ACTIVE,
        role: MemberRole.ADMIN,
        user_id: { not: userId },
      },
    });
    if (remainingAdmins === 0) {
      const target = await tx.organizationMember.findUnique({
        where: { organization_id_user_id: { organization_id: organizationId, user_id: userId } },
        select: { role: true },
      });
      // Chỉ chặn khi chính người này đang là ADMIN — MEMBER rời đi thì admin không đổi.
      if (target?.role === MemberRole.ADMIN) throw new AppException(ERROR_CODES.ORG_004);
    }
  }

  private async getMemberView(organizationId: string, userId: string): Promise<MemberView> {
    const member = await this.databaseService.organizationMember.findUnique({
      where: { organization_id_user_id: { organization_id: organizationId, user_id: userId } },
      select: {
        user_id: true,
        role: true,
        status: true,
        joined_at: true,
        user: { select: { full_name: true, email: true, avatar_url: true } },
      },
    });
    if (!member) throw new AppException(ERROR_CODES.ORG_006);

    return {
      userId: member.user_id,
      fullName: member.user.full_name,
      email: member.user.email,
      avatarUrl: member.user.avatar_url,
      role: member.role,
      status: member.status,
      joinedAt: member.joined_at,
    };
  }
}
