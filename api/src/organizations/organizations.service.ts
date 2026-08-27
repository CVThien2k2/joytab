import { Injectable, Logger } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import {
  OrganizationMemberSummary,
  OrganizationPreview,
  OrganizationRole,
  OrganizationSummary,
  Pagination,
} from '../common/utils/types';
import { DatabaseService } from '../database/database.service';
import {
  CreateOrganizationDto,
  ListMembersQueryDto,
  UpdateOrganizationDto,
} from './organizations.dto';
import { JOIN_CODE_MAX_ATTEMPTS, ORGANIZATION_ROLES } from './organizations.constants';
import { generateJoinCode } from './organizations.utils';

/** Mã lỗi Prisma khi vi phạm unique constraint. */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

/** Row organizations + phần thông tin thành viên của chính user đang hỏi. */
type OrganizationWithMembership = {
  id: string;
  name: string;
  /** NULL = tổ chức đang kín. Xem chú thích ở schema.prisma. */
  join_code: string | null;
  _count: { members: number };
};

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Input: userId đã xác thực.
   * Output: Các tổ chức user đang thuộc, cũ nhất trước.
   *
   *         Thứ tự theo `joined_at` tăng dần là hợp đồng với FE: giai đoạn này FE luôn lấy
   *         phần tử đầu làm "tổ chức đang xem", nên thứ tự phải ổn định giữa các lần gọi.
   *         Thêm `id` làm tie-breaker vì hai lần join trong cùng một micro-giây là có thể.
   */
  async listForUser(userId: string): Promise<OrganizationSummary[]> {
    const memberships = await this.databaseService.organizationMember.findMany({
      where: { user_id: userId },
      orderBy: [{ joined_at: 'asc' }, { id: 'asc' }],
      include: {
        organization: {
          include: { _count: { select: { members: true } } },
        },
      },
    });

    return memberships.map((membership) =>
      this.toSummary(membership.organization, this.toRole(membership.role), membership.joined_at),
    );
  }

  /**
   * Input: userId người hỏi + id tổ chức + phân trang/từ khoá.
   * Output: Một trang thành viên (owner trước, rồi theo thứ tự vào) kèm meta phân trang.
   *
   *         Người hỏi phải là thành viên, nếu không thì ORG_001 (không tồn tại) — CÙNG lý do
   *         với setJoinByCodeEnabled: người ngoài không cần biết id đó có thật hay không.
   *         Ở đây còn quan trọng hơn vì cái rò ra sẽ là email của người khác.
   *
   *         Sắp owner lên đầu bằng `role: 'desc'` ('owner' > 'member' theo thứ tự chữ) chứ
   *         không sắp trong JS: chỉ trang hiện tại được tải về, nên thứ tự BẮT BUỘC phải do DB
   *         quyết định — sắp sau khi cắt trang thì trang 2 tự sắp lại theo kiểu của nó.
   *
   *         Đếm và lấy trang trong CÙNG một transaction: hai query rời nhau thì giữa chúng có
   *         người vào/ra, `totalItems` lệch với số dòng thực trả về.
   */
  async listMembers(
    userId: string,
    organizationId: string,
    query: ListMembersQueryDto,
  ): Promise<{ members: OrganizationMemberSummary[]; pagination: Pagination }> {
    await this.requireMembership(userId, organizationId);

    const where = this.buildMemberFilter(organizationId, query.q);
    const [totalItems, rows] = await this.databaseService.$transaction([
      this.databaseService.organizationMember.count({ where }),
      this.databaseService.organizationMember.findMany({
        where,
        orderBy: [{ role: 'desc' }, { joined_at: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          user: { select: { id: true, full_name: true, email: true, avatar_url: true } },
        },
      }),
    ]);

    return {
      members: rows.map((member) => ({
        userId: member.user.id,
        fullName: member.user.full_name,
        email: member.user.email,
        avatarUrl: member.user.avatar_url,
        role: this.toRole(member.role),
        joinedAt: member.joined_at.toISOString(),
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        // max(1) để FE luôn có ít nhất một trang để hiện, kể cả khi tìm không ra ai.
        totalPages: Math.max(1, Math.ceil(totalItems / query.pageSize)),
      },
    };
  }

  /**
   * Input: id tổ chức + từ khoá (có thể rỗng).
   * Output: Điều kiện `where` dùng CHUNG cho cả count và findMany — hai chỗ lệch điều kiện thì
   *         tổng số và số dòng không khớp nhau, lỗi rất khó thấy.
   *
   *         Tìm trên `full_name` HOẶC `email`, `insensitive` để gõ hoa thường gì cũng ra.
   */
  private buildMemberFilter(organizationId: string, search?: string) {
    const q = search?.trim();
    if (!q) return { organization_id: organizationId };

    return {
      organization_id: organizationId,
      user: {
        OR: [
          { full_name: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
        ],
      },
    };
  }

  /**
   * Input: userId người thao tác + id tổ chức + userId người bị xoá.
   * Output: Xoá một người khỏi tổ chức. Cùng một endpoint lo hai việc vì chúng là CÙNG một
   *         thay đổi dữ liệu, chỉ khác ai là người bị xoá:
   *  - Tự xoá mình = rời tổ chức. Member làm được, owner thì KHÔNG.
   *  - Xoá người khác = owner đuổi thành viên.
   *
   *         Owner không rời được (ORG_005) vì chưa có chuyển quyền sở hữu: mất owner là để lại
   *         một tổ chức không ai bật/tắt được mã mời, không ai xoá được. Owner muốn dừng thì
   *         xoá cả tổ chức. Cũng vì vậy không ai xoá được owner, kể cả chính owner.
   */
  async removeMember(userId: string, organizationId: string, targetUserId: string): Promise<void> {
    const actor = await this.requireMembership(userId, organizationId);
    const isSelf = targetUserId === userId;

    // Kiểm quyền TRƯỚC khi đọc target: member hỏi về người khác thì không được biết người đó
    // có trong tổ chức hay không.
    if (!isSelf && this.toRole(actor.role) !== 'owner') {
      throw new AppException(ERROR_CODES.ORG_004);
    }

    const target = isSelf
      ? actor
      : await this.databaseService.organizationMember.findFirst({
          where: { organization_id: organizationId, user_id: targetUserId },
          select: { id: true, role: true },
        });
    if (!target) throw new AppException(ERROR_CODES.ORG_001);
    if (this.toRole(target.role) === 'owner') throw new AppException(ERROR_CODES.ORG_005);

    await this.databaseService.organizationMember.delete({ where: { id: target.id } });
    this.logger.log(
      isSelf
        ? `User ${userId} left organization ${organizationId}`
        : `User ${targetUserId} removed from organization ${organizationId} by ${userId}`,
    );
  }

  /**
   * Input: userId người thao tác + id tổ chức.
   * Output: Xoá cả tổ chức. Chỉ owner làm được.
   *
   *         Các hàng organization_members đi theo bằng `onDelete: Cascade` khai ở schema chứ
   *         không xoá tay ở đây: ràng buộc nằm ở DB thì mọi đường xoá đều dọn sạch, kể cả khi
   *         sau này có script xoá trực tiếp không qua service này.
   */
  async remove(userId: string, organizationId: string): Promise<void> {
    const membership = await this.requireMembership(userId, organizationId);
    if (this.toRole(membership.role) !== 'owner') throw new AppException(ERROR_CODES.ORG_004);

    await this.databaseService.organization.delete({ where: { id: organizationId } });
    this.logger.log(`Organization ${organizationId} deleted by ${userId}`);
  }

  /**
   * Input: userId + id tổ chức.
   * Output: Hàng membership của user trong tổ chức đó; không có thì ORG_001.
   *
   *         Gom một chỗ cho ba route đọc/xoá đang lặp lại đúng ba dòng này, và cái quan trọng
   *         nhất là chúng phải trả CÙNG một mã lỗi: người ngoài luôn nhận "không tồn tại",
   *         không bao giờ nhận 403 (403 là đã xác nhận id đó có thật).
   *
   *         setJoinByCodeEnabled KHÔNG dùng hàm này: nó còn cần `joined_at` để dựng response,
   *         nên đọc cả hàng thay vì hai cột.
   */
  private async requireMembership(
    userId: string,
    organizationId: string,
  ): Promise<{ id: string; role: string }> {
    const membership = await this.databaseService.organizationMember.findFirst({
      where: { organization_id: organizationId, user_id: userId },
      select: { id: true, role: true },
    });
    if (!membership) throw new AppException(ERROR_CODES.ORG_001);
    return membership;
  }

  /**
   * Input: userId người tạo + tên tổ chức đã validate.
   * Output: Tổ chức mới với người tạo là owner, và ĐANG KÍN (`join_code` = null).
   *
   *         Không sinh mã sẵn: mã tồn tại đồng nghĩa cửa đang mở, nên sinh sẵn là mở cửa hộ
   *         owner. Owner bật công tắc thì lúc đó mới có mã.
   *
   *         Tạo org và tạo member nằm trong MỘT transaction (`members.create` lồng trong
   *         `organization.create`): một tổ chức không có owner là tổ chức không ai vào sửa
   *         được, thà không tạo còn hơn tạo hỏng.
   */
  async create(userId: string, dto: CreateOrganizationDto): Promise<OrganizationSummary> {
    const organization = await this.databaseService.organization.create({
      data: {
        name: dto.name,
        created_by: userId,
        members: { create: { user_id: userId, role: 'owner' } },
      },
      include: { _count: { select: { members: true } } },
    });

    this.logger.log(`Organization "${organization.name}" created by ${userId} (closed)`);
    return this.toSummary(organization, 'owner', new Date());
  }

  /**
   * Input: userId + mã tham gia đã chuẩn hoá (lấy từ link mời).
   * Output: Tên + số thành viên của tổ chức, để dựng màn hình xác nhận TRƯỚC khi vào.
   *
   *         Cùng luật với joinByCode: mã sai và mã của tổ chức đã đóng cửa đều trả ORG_002, để
   *         màn hình xem trước không trở thành công cụ dò xem mã nào có thật.
   *
   *         `alreadyMember` để FE hiện lối vào thay vì nút tham gia — hỏi trước ở đây rẻ hơn
   *         là để user bấm rồi ăn 409.
   */
  async previewByCode(userId: string, joinCode: string): Promise<OrganizationPreview> {
    const organization = await this.databaseService.organization.findUnique({
      where: { join_code: joinCode },
      include: {
        _count: { select: { members: true } },
        members: { where: { user_id: userId }, select: { id: true }, take: 1 },
      },
    });
    // Không cần kiểm "đang mở" nữa: tổ chức kín có join_code = null nên không mã nào tìm ra
    // nó. Mã sai và tổ chức đã đóng vì thế tự nhiên rơi vào cùng một nhánh, cùng một mã lỗi.
    if (!organization) throw new AppException(ERROR_CODES.ORG_002);

    return {
      name: organization.name,
      memberCount: organization._count.members,
      alreadyMember: organization.members.length > 0,
    };
  }

  /**
   * Input: userId, id tổ chức, các field cần đổi (tên và/hoặc công tắc, đều tuỳ chọn).
   * Output: Tổ chức sau khi đổi, dưới góc nhìn của chính owner đó.
   *
   *         Chỉ owner được chạm: công tắc CHÍNH LÀ hành vi duyệt thành viên, và tên tổ chức là
   *         thứ mọi thành viên nhìn thấy.
   *
   *         Hai field độc lập: gửi `name` mà không gửi `joinByCodeEnabled` thì mã KHÔNG bị xoay
   *         — đổi tên không được phép làm chết các liên kết mời đang lưu hành.
   *
   *         MỞ cửa luôn sinh mã MỚI, kể cả khi đang mở sẵn — không dùng lại mã cũ. Nhờ vậy đóng
   *         cửa là mọi liên kết đã chia sẻ chết vĩnh viễn: mở lại không hồi sinh chúng, và owner
   *         cũng có sẵn đường xoay mã khi mã cũ lọt ra ngoài.
   *         ĐÓNG là set null — không giữ mã "để dành", vì mã còn trong DB là mã còn có thể lọt.
   *
   *         Không phải thành viên thì trả ORG_001 (không tồn tại) chứ không phải ORG_004:
   *         người ngoài không cần biết id đó có thật hay không. Là member nhưng không phải
   *         owner mới trả ORG_004 — người trong nhà thì nói thẳng là không đủ quyền.
   */
  async update(
    userId: string,
    organizationId: string,
    dto: UpdateOrganizationDto,
  ): Promise<OrganizationSummary> {
    const membership = await this.databaseService.organizationMember.findFirst({
      where: { organization_id: organizationId, user_id: userId },
    });
    if (!membership) throw new AppException(ERROR_CODES.ORG_001);
    if (this.toRole(membership.role) !== 'owner') throw new AppException(ERROR_CODES.ORG_004);

    // Xoay mã đứng riêng một query vì nó phải thử lại khi trùng mã; tên thì ghi thẳng.
    if (dto.joinByCodeEnabled === true) {
      await this.updateWithNewJoinCode(organizationId);
    }

    const organization = await this.databaseService.organization.update({
      where: { id: organizationId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.joinByCodeEnabled === false ? { join_code: null } : {}),
      },
      include: { _count: { select: { members: true } } },
    });

    const changes = [
      dto.name !== undefined ? `renamed to "${dto.name}"` : null,
      dto.joinByCodeEnabled === true ? 'opened with a new join code' : null,
      dto.joinByCodeEnabled === false ? 'closed' : null,
    ].filter(Boolean);
    if (changes.length > 0) {
      this.logger.log(`Organization ${organizationId} ${changes.join(', ')} by ${userId}`);
    }

    return this.toSummary(organization, 'owner', membership.joined_at);
  }

  /**
   * Input: userId + mã tham gia đã chuẩn hoá.
   * Output: Tổ chức vừa vào, với vai trò member.
   *
   *         Mã sai và mã của tổ chức đã đóng cửa đều trả CÙNG mã lỗi ORG_002: nếu tách ra,
   *         người ngoài dò được mã nào tồn tại chỉ bằng cách đọc mã lỗi.
   *         Vào là vào luôn, không có trạng thái chờ duyệt — mã chỉ tồn tại khi owner đã chủ
   *         động mở cửa, nên mở cửa CHÍNH LÀ hành vi duyệt.
   */
  async joinByCode(userId: string, joinCode: string): Promise<OrganizationSummary> {
    const organization = await this.databaseService.organization.findUnique({
      where: { join_code: joinCode },
      include: { _count: { select: { members: true } } },
    });
    // Tổ chức kín có join_code = null nên không mã nào tìm ra nó: "mã sai" và "tổ chức đã
    // đóng cửa" tự nhiên là cùng một nhánh, không cần kiểm công tắc riêng.
    if (!organization) throw new AppException(ERROR_CODES.ORG_002);

    const joinedAt = new Date();
    try {
      await this.databaseService.organizationMember.create({
        data: {
          organization_id: organization.id,
          user_id: userId,
          role: 'member',
          joined_at: joinedAt,
        },
      });
    } catch (err) {
      // Đã là thành viên: để unique index báo thay vì đọc trước rồi ghi — hai request song
      // song cùng nhập mã thì đọc-trước-ghi-sau vẫn lọt, còn index thì không.
      if (this.isUniqueViolation(err)) throw new AppException(ERROR_CODES.ORG_003);
      throw err;
    }

    this.logger.log(`User ${userId} joined organization ${organization.id} by code`);
    // +1 vì `_count` đọc trước khi thêm chính user này.
    return this.toSummary(
      { ...organization, _count: { members: organization._count.members + 1 } },
      'member',
      joinedAt,
    );
  }

  /**
   * Input: id tổ chức.
   * Output: Row organizations sau khi gắn một mã tham gia MỚI, kèm `_count.members`.
   *
   *         Mã sinh ngẫu nhiên nên có thể trùng mã đang dùng ở tổ chức khác; thay vì "đọc xem
   *         có chưa rồi mới ghi" (vẫn race), cứ ghi và bắt lỗi unique để thử mã khác.
   */
  private async updateWithNewJoinCode(organizationId: string): Promise<OrganizationWithMembership> {
    for (let attempt = 1; attempt <= JOIN_CODE_MAX_ATTEMPTS; attempt++) {
      try {
        return await this.databaseService.organization.update({
          where: { id: organizationId },
          data: { join_code: generateJoinCode() },
          include: { _count: { select: { members: true } } },
        });
      } catch (err) {
        if (!this.isUniqueViolation(err) || attempt === JOIN_CODE_MAX_ATTEMPTS) throw err;
        this.logger.warn(`Join code collision on attempt ${attempt}, retrying`);
      }
    }
    // Không tới được: vòng lặp trên hoặc return hoặc throw. Có để TypeScript thấy mọi nhánh.
    throw new AppException(ERROR_CODES.SYS_001);
  }

  /**
   * Input: Lỗi bất kỳ từ Prisma.
   * Output: true nếu là vi phạm unique constraint (P2002).
   *
   *         Nhận diện bằng thuộc tính `code` chứ không `instanceof`: client được generate ra
   *         src/generated nên import class lỗi vào đây chỉ để so kiểu là buộc thêm phụ thuộc
   *         mà không được gì.
   */
  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: unknown }).code === PRISMA_UNIQUE_VIOLATION
    );
  }

  /**
   * Input: Row organizations (kèm `_count.members`), vai trò của user đang hỏi, thời điểm join.
   * Output: OrganizationSummary trả cho FE.
   *
   *         `joinCode` CHỈ trả cho owner: member không cần mã để làm gì, mà mã lộ ra là người
   *         ngoài vào được ngay (mã tồn tại nghĩa là cửa đang mở).
   */
  private toSummary(
    organization: OrganizationWithMembership,
    role: OrganizationRole,
    joinedAt: Date,
  ): OrganizationSummary {
    return {
      id: organization.id,
      name: organization.name,
      role,
      joinCode: role === 'owner' ? organization.join_code : null,
      // Suy ra từ mã, không đọc cột riêng: cửa mở đúng bằng việc có mã. Member vẫn nhận được
      // cờ này (dù không thấy mã) để FE giải thích được vì sao họ không có gì để chia sẻ.
      joinByCodeEnabled: organization.join_code !== null,
      memberCount: organization._count.members,
      joinedAt: joinedAt.toISOString(),
    };
  }

  /**
   * Input: Giá trị cột `role` (VarChar nên DB về nguyên tắc chứa được giá trị lạ).
   * Output: Vai trò hợp lệ; giá trị không nhận ra coi như 'member' — quyền thấp nhất.
   */
  private toRole(value: string): OrganizationRole {
    return ORGANIZATION_ROLES.includes(value as OrganizationRole)
      ? (value as OrganizationRole)
      : 'member';
  }
}
