import { Injectable, Logger } from '@nestjs/common';
import { Bank } from '../banks/banks.constants';
import { BanksService } from '../banks/banks.service';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import {
  BankAccount,
  OrganizationMemberSummary,
  OrganizationOverview,
  OrganizationPreview,
  OrganizationRole,
  OrganizationSummary,
  Pagination,
} from '../common/utils/types';
import { DatabaseService } from '../database/database.service';
import { UploadService } from '../upload/upload.service';
import { CreateOrganizationDto, ListMembersQueryDto, UpdateOrganizationDto } from './organizations.dto';
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
  bank_bin: string | null;
  bank_account_no: string | null;
  male_ratio: unknown;
  skip_owner_payment: boolean;
  _count: { members: number };
};

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly uploadService: UploadService,
    private readonly banksService: BanksService,
  ) {}

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

    const banks = await this.bankIndex();
    return memberships.map((membership) =>
      this.toSummary(membership.organization, this.toRole(membership.role), membership.joined_at, banks),
    );
  }

  /**
   * Input: userId người hỏi + id tổ chức + phân trang/từ khoá.
   * Output: Một trang thành viên (owner trước, rồi theo thứ tự vào) kèm meta phân trang.
   *
   *         MỌI thành viên đọc được. Danh sách "trong nhóm có những ai" là thứ ai trong nhóm
   *         cũng cần — người ta đăng ký đi đá cùng nhau, mà không biết nhóm gồm những ai thì
   *         mỗi buổi lại phải đi hỏi. XOÁ thành viên thì vẫn chỉ owner (kiểm riêng ở
   *         `removeMember`), nên mở đọc ở đây không mở theo quyền nào khác.
   *
   *         Người NGOÀI tổ chức vẫn nhận ORG_001 (không tồn tại) — cùng lý do với
   *         setJoinByCodeEnabled: người ngoài không cần biết id đó có thật hay không, và cái
   *         rò ra ở đây là email của người khác.
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
   * Input: userId + id tổ chức.
   * Output: Bốn con số của trang chủ, tính cho CHÍNH người hỏi.
   *
   *         Nằm ở module tổ chức chứ không ở matches/payments: nó không thuộc riêng bên nào —
   *         hai con số đầu là tiền (match_charges), hai con số sau là trận (matches). Đặt vào
   *         một trong hai module là bên còn lại phải mở một endpoint thứ hai cho cùng một màn.
   *
   *         Bốn query chạy SONG SONG trong một transaction: chúng độc lập nhau, mà bốn lượt
   *         chờ nối đuôi thì trang chủ tải chậm gấp bốn lần không vì lý do gì.
   *
   *         `unpaidTotal` cố ý cùng nguồn với `charges/me` (bảng match_charges, `unpaid` của
   *         chính user) để thẻ ở trang chủ và hộp thoại trả tiền không bao giờ nói hai số.
   */
  async overview(userId: string, organizationId: string): Promise<OrganizationOverview> {
    await this.requireMembership(userId, organizationId);

    const mine = { user_id: userId, match: { organization_id: organizationId } };
    const [unpaid, paid, playedCount, upcomingCount] = await this.databaseService.$transaction([
      this.databaseService.matchCharge.aggregate({
        where: { ...mine, payment_status: 'unpaid' },
        _sum: { amount: true },
        _count: true,
      }),
      this.databaseService.matchCharge.aggregate({
        where: { ...mine, payment_status: 'paid' },
        _sum: { amount: true },
      }),
      // "Đã chơi" = buổi ĐÃ CHỐT TIỀN mà mình có mặt. Không đếm buổi `open` đã qua giờ: chừng
      // nào chưa chốt thì nó vẫn là việc đang treo, và có buổi treo vài tuần rồi mới huỷ.
      this.databaseService.match.count({
        where: {
          organization_id: organizationId,
          status: 'settled',
          OR: [
            { votes: { some: { user_id: userId } } },
            { charges: { some: { user_id: userId } } },
          ],
        },
      }),
      // "Sắp diễn ra" = của CẢ tổ chức, không riêng buổi mình đã đăng ký: đây là con số đứng
      // ngay trên danh sách buổi sắp tới, mà danh sách đó cũng hiện cả buổi chưa đăng ký.
      this.databaseService.match.count({
        where: { organization_id: organizationId, status: 'open', start_at: { gt: new Date() } },
      }),
    ]);

    return {
      // `_sum` là null khi không có row nào khớp — không phải 0.
      unpaidTotal: unpaid._sum.amount ?? 0,
      unpaidCount: unpaid._count,
      paidTotal: paid._sum.amount ?? 0,
      playedCount,
      upcomingCount,
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
   *         Các hàng organization_members/matches/payments đi theo bằng `onDelete: Cascade`
   *         khai ở schema chứ không xoá tay ở đây: ràng buộc nằm ở DB thì mọi đường xoá đều dọn
   *         sạch, kể cả khi sau này có script xoá trực tiếp không qua service này.
   *
   *         Ảnh trên S3 (QR, minh chứng thanh toán của mọi payment thuộc tổ chức) thì KHÔNG có
   *         cascade nào lo — dọn SAU khi DB xoá thành công, không chặn việc xoá tổ chức nếu dọn
   *         S3 lỗi. Xoá theo prefix `orgs/<organizationId>/` (`deleteOrganizationFolder`) thay
   *         vì liệt kê từng trường ảnh: tự dọn sạch cả những loại ảnh thêm sau này.
   */
  async remove(userId: string, organizationId: string): Promise<void> {
    const membership = await this.requireMembership(userId, organizationId);
    if (this.toRole(membership.role) !== 'owner') throw new AppException(ERROR_CODES.ORG_004);

    await this.databaseService.organization.delete({ where: { id: organizationId } });
    this.logger.log(`Organization ${organizationId} deleted by ${userId}`);

    await this.uploadService.deleteOrganizationFolder(organizationId);
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
  private async requireMembership(userId: string, organizationId: string): Promise<{ id: string; role: string }> {
    const membership = await this.databaseService.organizationMember.findFirst({
      where: { organization_id: organizationId, user_id: userId },
      select: { id: true, role: true },
    });
    if (!membership) throw new AppException(ERROR_CODES.ORG_001);
    return membership;
  }

  /**
   * Input: userId người tạo + tên tổ chức đã validate.
   * Output: Tổ chức mới với người tạo là owner, và ĐANG MỞ (`join_code` có sẵn).
   *
   *         Mở sẵn vì việc đầu tiên của người vừa lập nhóm luôn là mời người vào: bắt họ tạo
   *         xong rồi đi tìm một công tắc để bật mới có mã là chèn một bước vào giữa đúng lúc
   *         họ đang muốn gửi lời mời. Công tắc vẫn còn nguyên — owner đóng lại bất cứ lúc nào,
   *         và đóng là mọi liên kết đã phát ra chết ngay.
   *
   *         Đánh đổi: từ lúc tạo, ai có mã là vào thẳng, không qua bước duyệt nào. Chấp nhận
   *         được vì mã chỉ nằm ở chỗ owner cho tới khi chính owner chia sẻ nó.
   *
   *         Tạo org và tạo member nằm trong MỘT transaction (`members.create` lồng trong
   *         `organization.create`): một tổ chức không có owner là tổ chức không ai vào sửa
   *         được, thà không tạo còn hơn tạo hỏng.
   *
   *         Thử lại khi trùng mã, y như `updateWithNewJoinCode`: unique index là nơi chặn
   *         thật, còn 1.1e12 tổ hợp thì trùng 5 lần liên tiếp nghĩa là hỏng ở chỗ khác.
   */
  async create(userId: string, dto: CreateOrganizationDto): Promise<OrganizationSummary> {
    // Validate TRƯỚC khi ghi: bin rác lọt vào là mã QR sinh ra sau này dẫn tiền tới một ngân
    // hàng không tồn tại, mà lúc đó không ai đi soát lại cột này nữa.
    await this.requireValidBankAccount(dto.bankBin, dto.bankAccountNo);

    const data = {
      name: dto.name,
      created_by: userId,
      // Không gửi thì để DB lấy mặc định (male_ratio 1.0, skip_owner_payment false) — ghi
      // đè bằng giá trị mình tự nghĩ ra là dựng thêm một nguồn sự thật thứ hai.
      ...(dto.bankBin ? { bank_bin: dto.bankBin, bank_account_no: dto.bankAccountNo } : {}),
      ...(dto.maleRatio !== undefined ? { male_ratio: dto.maleRatio } : {}),
      ...(dto.skipOwnerPayment !== undefined ? { skip_owner_payment: dto.skipOwnerPayment } : {}),
      members: { create: { user_id: userId, role: 'owner' as const } },
    };

    const organization = await this.createWithNewJoinCode(data);

    this.logger.log(`Organization "${organization.name}" created by ${userId} (open)`);
    return this.toSummary(organization, 'owner', new Date(), await this.bankIndex());
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
   *
   *         `bankBin` và `bankAccountNo` đi THÀNH CẶP: gửi một mình một cái là ORG_006. Nửa
   *         cặp không dựng nổi mã QR, mà ghi vào DB rồi thì màn thanh toán mới phát hiện ra.
   */
  async update(userId: string, organizationId: string, dto: UpdateOrganizationDto): Promise<OrganizationSummary> {
    const membership = await this.databaseService.organizationMember.findFirst({
      where: { organization_id: organizationId, user_id: userId },
    });
    if (!membership) throw new AppException(ERROR_CODES.ORG_001);
    if (this.toRole(membership.role) !== 'owner') throw new AppException(ERROR_CODES.ORG_004);

    // Cặp bank đi cùng nhau, và bin phải là ngân hàng có thật — kiểm TRƯỚC mọi lượt ghi để
    // không có chuyện đổi tên thành công còn tài khoản thì hỏng giữa chừng.
    const bankChange = this.resolveBankChange(dto.bankBin, dto.bankAccountNo);
    if (bankChange?.bank_bin) await this.requireValidBankAccount(bankChange.bank_bin, bankChange.bank_account_no);

    // Xoay mã đứng riêng một query vì nó phải thử lại khi trùng mã; tên thì ghi thẳng.
    if (dto.joinByCodeEnabled === true) {
      await this.updateWithNewJoinCode(organizationId);
    }

    const organization = await this.databaseService.organization.update({
      where: { id: organizationId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.joinByCodeEnabled === false ? { join_code: null } : {}),
        // Chuỗi rỗng ở cả hai = gỡ tài khoản. Phân biệt được với "không gửi" nhờ `!== undefined`,
        // nên owner đổi tên tổ chức không vô tình xoá mất tài khoản đang nhận tiền.
        ...(bankChange ?? {}),
        ...(dto.maleRatio !== undefined ? { male_ratio: dto.maleRatio } : {}),
        ...(dto.skipOwnerPayment !== undefined ? { skip_owner_payment: dto.skipOwnerPayment } : {}),
      },
      include: { _count: { select: { members: true } } },
    });

    const changes = [
      dto.name !== undefined ? `renamed to "${dto.name}"` : null,
      dto.joinByCodeEnabled === true ? 'opened with a new join code' : null,
      dto.joinByCodeEnabled === false ? 'closed' : null,
      // KHÔNG log số tài khoản: log đi vào file và đi qua nhiều tay hơn DB.
      bankChange ? (bankChange.bank_bin ? `bank account set (bin ${bankChange.bank_bin})` : 'bank account removed') : null,
      dto.maleRatio !== undefined ? `male ratio set to ${dto.maleRatio}` : null,
      dto.skipOwnerPayment !== undefined ? `skip owner payment set to ${dto.skipOwnerPayment}` : null,
    ].filter(Boolean);
    if (changes.length > 0) {
      this.logger.log(`Organization ${organizationId} ${changes.join(', ')} by ${userId}`);
    }

    return this.toSummary(organization, 'owner', membership.joined_at, await this.bankIndex());
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
      await this.bankIndex(),
    );
  }

  /**
   * Input: id tổ chức.
   * Output: Row organizations sau khi gắn một mã tham gia MỚI, kèm `_count.members`.
   *
   *         Mã sinh ngẫu nhiên nên có thể trùng mã đang dùng ở tổ chức khác; thay vì "đọc xem
   *         có chưa rồi mới ghi" (vẫn race), cứ ghi và bắt lỗi unique để thử mã khác.
   */
  /**
   * Input: Mảnh `data` của `organization.create`, CHƯA có `join_code`.
   * Output: Tổ chức vừa tạo, đã kèm mã tham gia.
   *
   *         Sinh mã rồi thử ghi, trùng thì sinh lại — không đọc trước để kiểm mã đã tồn tại
   *         chưa: giữa lượt đọc và lượt ghi vẫn có chỗ cho một request khác chen vào lấy đúng
   *         mã đó. Unique index mới là nơi chặn thật.
   *
   *         Song sinh với `updateWithNewJoinCode` (dùng cho lượt MỞ CỬA lại) chứ không gộp
   *         được: một bên `create` một bên `update`, và bên create còn phải tạo cả hàng
   *         membership trong cùng transaction.
   */
  private async createWithNewJoinCode(
    data: Parameters<DatabaseService['organization']['create']>[0]['data'],
  ): Promise<OrganizationWithMembership> {
    for (let attempt = 1; attempt <= JOIN_CODE_MAX_ATTEMPTS; attempt++) {
      try {
        return await this.databaseService.organization.create({
          data: { ...data, join_code: generateJoinCode() },
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
    return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === PRISMA_UNIQUE_VIOLATION;
  }

  /**
   * Input: Row organizations (kèm `_count.members`), vai trò của user đang hỏi, thời điểm join.
   * Output: OrganizationSummary trả cho FE.
   *
   *         `joinCode` trả cho MỌI thành viên, không riêng owner: mời bạn vào nhóm là việc ai
   *         trong nhóm cũng làm, bắt phải qua owner chỉ tạo một nút thắt không cần thiết. Đổi
   *         lại, mã trong tay nhiều người hơn — nên việc BẬT/TẮT và xoay mã vẫn CHỈ owner làm
   *         được (PATCH /organizations/:id), và đóng cửa là mã chết ngay lập tức.
   */
  /**
   * Input: Không nhận tham số.
   * Output: Bảng tra ngân hàng theo BIN.
   *
   *         Dựng MỘT LẦN cho cả danh sách tổ chức rồi truyền xuống `toSummary`, thay vì mỗi
   *         tổ chức một lượt tra: danh sách nằm sẵn trong RAM nên tra lẻ không tốn mạng, nhưng
   *         nó biến `toSummary` thành hàm async và kéo theo `Promise.all` ở mọi chỗ gọi.
   */
  private async bankIndex(): Promise<Map<string, Bank>> {
    const banks = await this.banksService.list();
    return new Map(banks.map((bank) => [bank.bin, bank]));
  }

  /**
   * Input: `bankBin` và `bankAccountNo` lấy từ body PATCH (có thể undefined, có thể rỗng).
   * Output: Mảnh `data` để ghi vào Prisma, hoặc `null` khi lần này không đụng tới tài khoản.
   *
   *         Ba trạng thái, không phải hai: KHÔNG GỬI gì (giữ nguyên), gửi CẢ HAI rỗng (gỡ),
   *         gửi CẢ HAI có giá trị (đặt). Gửi nửa cặp là ORG_006 — không đoán hộ, vì đoán sai
   *         ở đây nghĩa là tiền của cả nhóm chảy vào một số tài khoản không ai kiểm.
   */
  private resolveBankChange(
    bankBin: string | undefined,
    bankAccountNo: string | undefined,
  ): { bank_bin: string | null; bank_account_no: string | null } | null {
    if (bankBin === undefined && bankAccountNo === undefined) return null;
    if (bankBin === undefined || bankAccountNo === undefined) throw new AppException(ERROR_CODES.ORG_006);

    const hasBin = bankBin.length > 0;
    const hasAccount = bankAccountNo.length > 0;
    if (hasBin !== hasAccount) throw new AppException(ERROR_CODES.ORG_006);

    return hasBin ? { bank_bin: bankBin, bank_account_no: bankAccountNo } : { bank_bin: null, bank_account_no: null };
  }

  /**
   * Input: Cặp bin + số tài khoản sắp ghi vào DB (bin rỗng/undefined = không có gì để kiểm).
   * Output: Không trả gì; ném ORG_006 nếu thiếu nửa cặp, ORG_007 nếu bin không phải ngân hàng
   *         có thật.
   *
   *         Kiểm bin ở đây là hàng rào cuối: DTO chỉ biết "6 chữ số", còn "6 chữ số này có phải
   *         một ngân hàng không" thì chỉ danh sách VietQR trả lời được.
   */
  private async requireValidBankAccount(bin: string | undefined | null, accountNo: string | undefined | null): Promise<void> {
    if (!bin && !accountNo) return;
    if (!bin || !accountNo) throw new AppException(ERROR_CODES.ORG_006);
    if (!(await this.banksService.findByBin(bin))) throw new AppException(ERROR_CODES.ORG_007);
  }

  private toSummary(
    organization: OrganizationWithMembership,
    role: OrganizationRole,
    joinedAt: Date,
    banks: Map<string, Bank>,
  ): OrganizationSummary {
    return {
      id: organization.id,
      name: organization.name,
      role,
      joinCode: organization.join_code,
      // Suy ra từ mã, không đọc cột riêng: cửa mở đúng bằng việc có mã.
      joinByCodeEnabled: organization.join_code !== null,
      memberCount: organization._count.members,
      bankAccount: toBankAccount(organization.bank_bin, organization.bank_account_no, banks),
      maleRatio: Number(organization.male_ratio),
      skipOwnerPayment: organization.skip_owner_payment,
      joinedAt: joinedAt.toISOString(),
    };
  }

  /**
   * Input: Giá trị cột `role` (VarChar nên DB về nguyên tắc chứa được giá trị lạ).
   * Output: Vai trò hợp lệ; giá trị không nhận ra coi như 'member' — quyền thấp nhất.
   */
  private toRole(value: string): OrganizationRole {
    return ORGANIZATION_ROLES.includes(value as OrganizationRole) ? (value as OrganizationRole) : 'member';
  }
}

/**
 * Input: Hai cột bank trong DB + bảng tra ngân hàng.
 * Output: Tài khoản nhận tiền đã gắn tên ngân hàng, hoặc null khi tổ chức chưa cấu hình.
 *
 *         BIN không tra ra vẫn TRẢ VỀ tài khoản, chỉ là tên ngân hàng lùi về chính con số:
 *         tiền đã cấu hình rồi, mà danh sách VietQR thì có thể đang là bản bundle sẵn hẹp hơn
 *         bản thật. Nuốt luôn tài khoản chỉ vì tra hụt một cái tên là làm cả tổ chức không
 *         thanh toán được vì một sự cố ở chỗ khác.
 */
function toBankAccount(
  bin: string | null,
  accountNo: string | null,
  banks: Map<string, Bank>,
): BankAccount | null {
  if (!bin || !accountNo) return null;

  const bank = banks.get(bin);
  return {
    bin,
    accountNo,
    bankCode: bank?.code ?? '',
    bankShortName: bank?.shortName ?? bin,
    bankName: bank?.name ?? `Ngân hàng ${bin}`,
    bankLogo: bank?.logo ?? '',
  };
}
