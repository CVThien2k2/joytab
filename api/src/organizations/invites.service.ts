import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { DatabaseService } from '../database/database.service';
import { InviteType, MemberRole, MemberStatus } from '../generated/prisma/enums';
import { CreateInviteDto } from './dto/create-invite.dto';
import { INVITE_EXPIRES_DAY_IN_MS } from './organizations.constants';
import { buildInviteUrl, generateInviteToken, hashInviteToken, isInviteUsable } from './organizations.utils';

type TransactionClient = Parameters<Parameters<DatabaseService['$transaction']>[0]>[0];

type InviteView = {
  id: string;
  type: InviteType;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  revokedAt: Date | null;
  usable: boolean;
  createdAt: Date;
};

/** Chỉ lần tạo mới có `token`/`url` — DB không giữ token thô nên không lấy lại được. */
type CreatedInviteView = InviteView & { token: string; url: string };

type InvitePreview = {
  organization: { id: string; name: string; avatarUrl: string | null; memberCount: number };
  usable: boolean;
};

@Injectable()
export class InvitesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Input: orgId, admin tạo link và tuỳ chọn hạn dùng / số lượt.
   * Output: Invite mới kèm token thô + URL FE — trả về ĐÚNG MỘT LẦN tại đây.
   */
  async create(organizationId: string, createdBy: string, dto: CreateInviteDto): Promise<CreatedInviteView> {
    const rawToken = generateInviteToken();
    const expiresAt =
      dto.expiresInDays === undefined ? null : new Date(Date.now() + dto.expiresInDays * INVITE_EXPIRES_DAY_IN_MS);

    const invite = await this.databaseService.organizationInvite.create({
      data: {
        organization_id: organizationId,
        type: InviteType.LINK,
        token_hash: hashInviteToken(rawToken),
        expires_at: expiresAt,
        max_uses: dto.maxUses ?? null,
        created_by: createdBy,
      },
    });

    return {
      ...this.toInviteView(invite, new Date()),
      token: rawToken,
      url: buildInviteUrl(this.configService.get<string>('FRONTEND_ORIGIN'), rawToken),
    };
  }

  /**
   * Input: orgId.
   * Output: Mọi invite của tổ chức (kể cả đã revoke/hết hạn) kèm cờ `usable` tính lúc đọc.
   */
  async list(organizationId: string): Promise<InviteView[]> {
    const invites = await this.databaseService.organizationInvite.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
    });
    const now = new Date();

    return invites.map((invite) => this.toInviteView(invite, now));
  }

  /**
   * Input: orgId và id invite.
   * Output: Đặt `revoked_at` = now. Revoke lại lần nữa không đổi mốc thời gian cũ.
   */
  async revoke(organizationId: string, inviteId: string): Promise<InviteView> {
    const invite = await this.databaseService.organizationInvite.findFirst({
      where: { id: inviteId, organization_id: organizationId },
    });
    if (!invite) throw new AppException(ERROR_CODES.INV_001);
    if (invite.revoked_at) return this.toInviteView(invite, new Date());

    const revoked = await this.databaseService.organizationInvite.update({
      where: { id: invite.id },
      data: { revoked_at: new Date() },
    });

    return this.toInviteView(revoked, new Date());
  }

  /**
   * Input: Token thô trên URL. Route public — người chưa đăng nhập cũng xem được.
   * Output: Tên tổ chức để hiển thị lời mời + link còn dùng được hay không.
   *
   * Cố tình KHÔNG ném lỗi khi link hết hiệu lực: FE cần tên nhóm để hiện "Lời mời vào
   * <nhóm> đã hết hạn" thay vì một trang trống.
   */
  async preview(rawToken: string): Promise<InvitePreview> {
    const invite = await this.databaseService.organizationInvite.findUnique({
      where: { token_hash: hashInviteToken(rawToken) },
      select: {
        revoked_at: true,
        expires_at: true,
        max_uses: true,
        used_count: true,
        organization: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
            _count: { select: { members: { where: { status: MemberStatus.ACTIVE } } } },
          },
        },
      },
    });
    if (!invite) throw new AppException(ERROR_CODES.INV_001);

    return {
      organization: {
        id: invite.organization.id,
        name: invite.organization.name,
        avatarUrl: invite.organization.avatar_url,
        memberCount: invite.organization._count.members,
      },
      usable: isInviteUsable(invite, new Date()),
    };
  }

  /**
   * Input: Token thô và user đã đăng nhập.
   * Output: `{ organizationId, role, alreadyMember }`.
   *
   * Chạy trong transaction và khoá row invite (FOR UPDATE) để `used_count` không vượt
   * `max_uses` khi nhiều người bấm link cùng lúc — đếm rồi mới ghi mà không khoá thì chắc
   * chắn có lúc thủng trần.
   */
  async accept(rawToken: string, userId: string): Promise<{ organizationId: string; alreadyMember: boolean }> {
    const tokenHash = hashInviteToken(rawToken);

    return this.databaseService.$transaction(async (tx) => {
      const invite = await this.lockInviteByTokenHash(tx, tokenHash);
      if (!isInviteUsable(invite, new Date())) throw new AppException(ERROR_CODES.INV_002);

      const existing = await tx.organizationMember.findUnique({
        where: { organization_id_user_id: { organization_id: invite.organization_id, user_id: userId } },
        select: { id: true, status: true },
      });

      // Bấm lại chính link mình đã dùng thì không đốt thêm lượt — nếu không, người dùng
      // F5 vài lần là hết sạch max_uses của cả nhóm.
      if (existing?.status === MemberStatus.ACTIVE) {
        return { organizationId: invite.organization_id, alreadyMember: true };
      }

      if (existing) {
        await tx.organizationMember.update({
          where: { id: existing.id },
          data: { status: MemberStatus.ACTIVE, joined_at: new Date() },
        });
      } else {
        await tx.organizationMember.create({
          data: {
            organization_id: invite.organization_id,
            user_id: userId,
            role: MemberRole.MEMBER,
            status: MemberStatus.ACTIVE,
          },
        });
      }

      await tx.organizationInvite.update({
        where: { id: invite.id },
        data: { used_count: { increment: 1 } },
      });

      return { organizationId: invite.organization_id, alreadyMember: false };
    });
  }

  /**
   * Input: transaction client và SHA-256 của token.
   * Output: Invite đã khoá tới cuối transaction; không tìm thấy → INV_001.
   */
  private async lockInviteByTokenHash(tx: TransactionClient, tokenHash: string) {
    const rows = await tx.$queryRaw<
      {
        id: string;
        organization_id: string;
        revoked_at: Date | null;
        expires_at: Date | null;
        max_uses: number | null;
        used_count: number;
      }[]
    >`SELECT id, organization_id, revoked_at, expires_at, max_uses, used_count
      FROM organization_invites
      WHERE token_hash = ${tokenHash}
      FOR UPDATE`;
    if (rows.length === 0) throw new AppException(ERROR_CODES.INV_001);

    return rows[0];
  }

  private toInviteView(
    invite: {
      id: string;
      type: InviteType;
      expires_at: Date | null;
      max_uses: number | null;
      used_count: number;
      revoked_at: Date | null;
      created_at: Date;
    },
    now: Date,
  ): InviteView {
    return {
      id: invite.id,
      type: invite.type,
      expiresAt: invite.expires_at,
      maxUses: invite.max_uses,
      usedCount: invite.used_count,
      revokedAt: invite.revoked_at,
      usable: isInviteUsable(invite, now),
      createdAt: invite.created_at,
    };
  }
}
