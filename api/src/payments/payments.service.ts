import { Injectable, Logger } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { requireMembership } from '../common/utils/membership';
import { ChargePaymentStatus, OrganizationChargeGroup, PaymentSummary, UserChargeItem } from '../common/utils/types';
import { DatabaseService } from '../database/database.service';
import { CreatePaymentDto } from './payments.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Input: userId + id tổ chức.
   * Output: Công nợ của user trong tổ chức đó, GOM THEO TỔ CHỨC (một phần tử).
   *
   *         Vẫn trả dạng nhóm chứ không phải mảng khoản phẳng: nhóm mang theo mã QR và tổng
   *         nợ — đúng những thứ màn thanh toán cần, và một lần chuyển khoản chỉ trả được cho
   *         một tổ chức vì QR khác nhau.
   *
   *         CHỈ trả khoản `unpaid`: trả rồi là xong, và nó đã có mặt trong sổ chứng từ. Nhờ vậy
   *         danh sách này không phình theo số buổi đã chơi — nó là danh sách VIỆC CÒN PHẢI LÀM,
   *         không phải sổ kế toán.
   */
  async listCharges(userId: string, organizationId: string): Promise<OrganizationChargeGroup[]> {
    await requireMembership(this.databaseService, userId, organizationId);

    const charges = await this.databaseService.matchCharge.findMany({
      where: {
        user_id: userId,
        payment_status: 'unpaid',
        match: { organization_id: organizationId },
      },
      orderBy: [{ match: { start_at: 'asc' } }, { id: 'asc' }],
      include: {
        match: {
          select: {
            id: true,
            court_name: true,
            start_at: true,
            organization: { select: { id: true, name: true, payment_qr_url: true } },
          },
        },
      },
    });

    const groups = new Map<string, OrganizationChargeGroup>();
    for (const charge of charges) {
      const organization = charge.match.organization;
      let group = groups.get(organization.id);
      if (!group) {
        group = {
          organizationId: organization.id,
          organizationName: organization.name,
          paymentQrUrl: organization.payment_qr_url,
          unpaidTotal: 0,
          charges: [],
        };
        groups.set(organization.id, group);
      }

      const item: UserChargeItem = {
        chargeId: charge.id,
        matchId: charge.match.id,
        courtName: charge.match.court_name,
        startAt: charge.match.start_at.toISOString(),
        amount: charge.amount,
        paymentStatus: this.toChargeStatus(charge.payment_status),
      };
      group.charges.push(item);
      group.unpaidTotal += charge.amount;
    }

    return [...groups.values()];
  }

  /**
   * Input: userId + id tổ chức + danh sách khoản + ảnh chuyển khoản.
   * Output: Lần thanh toán vừa tạo.
   *
   *         Gửi là XONG: khoản chuyển thẳng sang 'paid', không ai duyệt. Ảnh chuyển khoản vẫn
   *         bắt buộc — nó không còn để owner xét, mà để cả nhóm đối chiếu khi có tranh cãi về
   *         sau. Không có đường tự rút lại: rút được thì trạng thái "đã trả" chỉ còn là một ý
   *         kiến, và người ghi sổ lại phải đi hỏi từng người.
   *
   *         Khoá theo user trong transaction: hai tab cùng bấm gửi thì tab sau phải thấy các
   *         khoản đã bị tab trước lấy, nếu không sẽ có hai lần thanh toán cho cùng một khoản.
   */
  async create(userId: string, organizationId: string, dto: CreatePaymentDto): Promise<PaymentSummary> {
    await requireMembership(this.databaseService, userId, organizationId);

    const organization = await this.databaseService.organization.findUnique({
      where: { id: organizationId },
      select: { payment_qr_url: true },
    });
    if (!organization) throw new AppException(ERROR_CODES.ORG_001);
    // Không có QR thì không có chỗ để chuyển tiền tới — ảnh gửi lên lúc này là ảnh của một
    // giao dịch không ai biết đi đâu.
    if (!organization.payment_qr_url) throw new AppException(ERROR_CODES.PAY_005);

    const chargeIds = [...new Set(dto.chargeIds)];
    const paymentId = await this.databaseService.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

      const charges = await tx.matchCharge.findMany({
        where: {
          id: { in: chargeIds },
          user_id: userId,
          payment_status: 'unpaid',
          match: { organization_id: organizationId },
        },
        select: { id: true },
      });
      // Thiếu dù chỉ một khoản là từ chối cả lần gửi: khoản lạ, khoản của người khác, khoản
      // đã trả rồi — cả ba đều nghĩa là ảnh user sắp gửi không khớp với số tiền hệ thống định
      // ghi. Trả về một phần còn tệ hơn: user tưởng đã trả hết.
      if (charges.length !== chargeIds.length) throw new AppException(ERROR_CODES.PAY_002);

      const payment = await tx.payment.create({
        data: {
          organization_id: organizationId,
          user_id: userId,
          proof_url: dto.proofUrl,
          note: dto.note ?? null,
        },
        select: { id: true },
      });
      await tx.matchCharge.updateMany({
        where: { id: { in: chargeIds } },
        data: { payment_id: payment.id, payment_status: 'paid' },
      });
      return payment.id;
    });

    this.logger.log(
      `Payment ${paymentId} recorded by ${userId} in organization ${organizationId} for ${chargeIds.length} charges`,
    );
    return this.readPayment(paymentId);
  }

  /**
   * Input: userId + id tổ chức.
   * Output: Sổ chứng từ, mới nhất trước.
   *
   *         Owner thấy của cả tổ chức; member CHỈ thấy của mình — điều kiện này áp ở service
   *         chứ không ở query param, để không ai xem được lịch sử chuyển tiền của người khác
   *         bằng cách đổi URL.
   *
   *         Owner đọc để BIẾT ai đã trả, không phải để duyệt: không còn thao tác nào trên một
   *         row ở đây.
   */
  async list(userId: string, organizationId: string): Promise<PaymentSummary[]> {
    const role = await requireMembership(this.databaseService, userId, organizationId);

    const payments = await this.databaseService.payment.findMany({
      where: {
        organization_id: organizationId,
        ...(role === 'owner' ? {} : { user_id: userId }),
      },
      orderBy: [{ submitted_at: 'desc' }, { id: 'desc' }],
      include: this.paymentInclude(),
    });

    return payments.map((payment) => this.toSummary(payment));
  }

  /** Include dùng chung cho mọi truy vấn payment: người gửi + các khoản kèm ngữ cảnh trận. */
  private paymentInclude() {
    return {
      user: { select: { id: true, full_name: true, avatar_url: true } },
      charges: {
        orderBy: [{ id: 'asc' as const }],
        include: { match: { select: { id: true, court_name: true, start_at: true } } },
      },
    };
  }

  private async readPayment(paymentId: string): Promise<PaymentSummary> {
    const payment = await this.databaseService.payment.findUnique({
      where: { id: paymentId },
      include: this.paymentInclude(),
    });
    if (!payment) throw new AppException(ERROR_CODES.PAY_001);
    return this.toSummary(payment);
  }

  private toSummary(payment: {
    id: string;
    organization_id: string;
    user_id: string;
    proof_url: string;
    note: string | null;
    submitted_at: Date;
    user: { full_name: string | null; avatar_url: string | null };
    charges: {
      amount: number;
      match: { id: string; court_name: string; start_at: Date };
    }[];
  }): PaymentSummary {
    return {
      id: payment.id,
      organizationId: payment.organization_id,
      userId: payment.user_id,
      fullName: payment.user.full_name,
      avatarUrl: payment.user.avatar_url,
      proofUrl: payment.proof_url,
      note: payment.note,
      submittedAt: payment.submitted_at.toISOString(),
      // Tổng luôn CỘNG TỪ các khoản, không đọc cột lưu sẵn — vì không có cột nào cả.
      total: payment.charges.reduce((sum, charge) => sum + charge.amount, 0),
      items: payment.charges.map((charge) => ({
        matchId: charge.match.id,
        courtName: charge.match.court_name,
        startAt: charge.match.start_at.toISOString(),
        amount: charge.amount,
      })),
    };
  }

  private toChargeStatus(value: string): ChargePaymentStatus {
    return value === 'paid' ? 'paid' : 'unpaid';
  }
}
