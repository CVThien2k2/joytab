import { Injectable, Logger } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { OrganizationPreview, OrganizationRole, OrganizationSummary } from '../common/utils/types';
import { DatabaseService } from '../database/database.service';
import { CreateOrganizationDto } from './organizations.dto';
import { JOIN_CODE_MAX_ATTEMPTS, ORGANIZATION_ROLES } from './organizations.constants';
import { generateJoinCode } from './organizations.utils';

/** Mã lỗi Prisma khi vi phạm unique constraint. */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

/** Row organizations + phần thông tin thành viên của chính user đang hỏi. */
type OrganizationWithMembership = {
  id: string;
  name: string;
  join_code: string;
  join_by_code_enabled: boolean;
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
   * Input: userId người tạo + tên tổ chức đã validate.
   * Output: Tổ chức mới với người tạo là owner.
   *
   *         Tạo org và tạo member nằm trong MỘT transaction: một tổ chức không có owner là
   *         tổ chức không ai vào sửa được, thà không tạo còn hơn tạo hỏng.
   */
  async create(userId: string, dto: CreateOrganizationDto): Promise<OrganizationSummary> {
    const organization = await this.createWithUniqueJoinCode(userId, dto.name);
    this.logger.log(`Organization "${organization.name}" created by ${userId}`);
    return this.toSummary(organization, 'owner', new Date());
  }

  /**
   * Input: userId + mã tham gia đã chuẩn hoá (lấy từ link mời).
   * Output: Tên + số thành viên của tổ chức, để dựng màn hình xác nhận TRƯỚC khi vào.
   *
   *         Cùng luật với joinByCode: mã sai và mã đúng-nhưng-đang-đóng đều trả ORG_002, để
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
    if (!organization || !organization.join_by_code_enabled) {
      throw new AppException(ERROR_CODES.ORG_002);
    }

    return {
      name: organization.name,
      memberCount: organization._count.members,
      alreadyMember: organization.members.length > 0,
    };
  }

  /**
   * Input: userId, id tổ chức, trạng thái công tắc mới.
   * Output: Tổ chức sau khi đổi, dưới góc nhìn của chính owner đó.
   *
   *         Công tắc này CHÍNH LÀ hành vi duyệt thành viên: bật là ai cầm mã/link cũng vào
   *         thẳng được, nên chỉ owner được chạm.
   *
   *         Không phải thành viên thì trả ORG_001 (không tồn tại) chứ không phải ORG_004:
   *         người ngoài không cần biết id đó có thật hay không. Là member nhưng không phải
   *         owner mới trả ORG_004 — người trong nhà thì nói thẳng là không đủ quyền.
   */
  async setJoinByCodeEnabled(
    userId: string,
    organizationId: string,
    enabled: boolean,
  ): Promise<OrganizationSummary> {
    const membership = await this.databaseService.organizationMember.findFirst({
      where: { organization_id: organizationId, user_id: userId },
    });
    if (!membership) throw new AppException(ERROR_CODES.ORG_001);
    if (this.toRole(membership.role) !== 'owner') throw new AppException(ERROR_CODES.ORG_004);

    const organization = await this.databaseService.organization.update({
      where: { id: organizationId },
      data: { join_by_code_enabled: enabled },
      include: { _count: { select: { members: true } } },
    });

    this.logger.log(
      `Organization ${organizationId} join-by-code ${enabled ? 'opened' : 'closed'} by ${userId}`,
    );
    return this.toSummary(organization, 'owner', membership.joined_at);
  }

  /**
   * Input: userId + mã tham gia đã chuẩn hoá.
   * Output: Tổ chức vừa vào, với vai trò member.
   *
   *         Mã sai và mã đúng-nhưng-đang-đóng đều trả CÙNG mã lỗi ORG_002: nếu tách ra,
   *         người ngoài dò được mã nào tồn tại chỉ bằng cách đọc mã lỗi.
   *         Vào là vào luôn, không có trạng thái chờ duyệt — mã chỉ có tác dụng khi owner đã
   *         chủ động bật `join_by_code_enabled`, nên bật công tắc CHÍNH LÀ hành vi duyệt.
   */
  async joinByCode(userId: string, joinCode: string): Promise<OrganizationSummary> {
    const organization = await this.databaseService.organization.findUnique({
      where: { join_code: joinCode },
      include: { _count: { select: { members: true } } },
    });
    if (!organization || !organization.join_by_code_enabled) {
      throw new AppException(ERROR_CODES.ORG_002);
    }

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
   * Input: userId người tạo + tên tổ chức.
   * Output: Row organizations đã tạo kèm `_count.members`.
   *
   *         Mã tham gia sinh ngẫu nhiên nên có thể trùng mã đã có; thay vì "đọc xem có chưa
   *         rồi mới ghi" (vẫn race), cứ ghi và bắt lỗi unique để thử mã khác.
   */
  private async createWithUniqueJoinCode(
    userId: string,
    name: string,
  ): Promise<OrganizationWithMembership> {
    for (let attempt = 1; attempt <= JOIN_CODE_MAX_ATTEMPTS; attempt++) {
      try {
        return await this.databaseService.organization.create({
          data: {
            name,
            join_code: generateJoinCode(),
            created_by: userId,
            members: { create: { user_id: userId, role: 'owner' } },
          },
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
   *         `joinCode` CHỈ trả cho owner: member không cần mã để làm gì, mà mã lộ ra là
   *         người ngoài vào được khi tổ chức đang mở cửa.
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
      joinByCodeEnabled: organization.join_by_code_enabled,
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
