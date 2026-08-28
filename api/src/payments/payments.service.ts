import { Injectable, Logger } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { requireMembership, requireOwner } from '../common/utils/membership';
import {
  ChargePaymentStatus,
  OrganizationChargeGroup,
  PaymentStatus,
  PaymentSummary,
  UserChargeItem,
} from '../common/utils/types';
import { DatabaseService } from '../database/database.service';
import { CreatePaymentDto, ListPaymentsQueryDto } from './payments.dto';

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
   *         Chỉ trả khoản `unpaid` và `submitted`: đã đối soát xong thì thuộc về lịch sử
   *         thanh toán, không phải việc còn phải làm. Nhờ vậy danh sách này không phình theo
   *         số buổi đã chơi.
   */
  async listCharges(userId: string, organizationId: string): Promise<OrganizationChargeGroup[]> {
    await requireMembership(this.databaseService, userId, organizationId);

    const charges = await this.databaseService.matchCharge.findMany({
      where: {
        user_id: userId,
        payment_status: { in: ['unpaid', 'submitted'] },
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
        // Khoản bị từ chối GIỮ NGUYÊN payment_id (chỉ trạng thái quay về 'unpaid') — nhờ vậy
        // vẫn nói được vì sao owner báo chưa nhận. Xoá liên kết là xoá luôn lời giải thích.
        payment: { select: { status: true, reject_reason: true } },
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

      const status = this.toChargeStatus(charge.payment_status);
      const item: UserChargeItem = {
        chargeId: charge.id,
        matchId: charge.match.id,
        courtName: charge.match.court_name,
        startAt: charge.match.start_at.toISOString(),
        amount: charge.amount,
        paymentStatus: status,
        rejectReason:
          status === 'unpaid' && charge.payment?.status === 'rejected' ? charge.payment.reject_reason : null,
      };
      group.charges.push(item);
      if (status === 'unpaid') group.unpaidTotal += charge.amount;
    }

    return [...groups.values()];
  }

  /**
   * Input: userId + id tổ chức + danh sách khoản + ảnh chuyển khoản.
   * Output: Lần thanh toán vừa tạo.
   *
   *         Đây là thao tác DUY NHẤT của user trong luồng tiền. Gửi xong là xong: không tự
   *         huỷ, không sửa, không gỡ khoản ra. Khoản chỉ quay lại danh sách phải trả khi
   *         owner báo chưa nhận được — cho user tự rút lại thì hai bên sẽ có lúc nhìn hai sự
   *         thật khác nhau về cùng một lần chuyển khoản.
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
      // đã nằm trong lần gửi trước — cả ba đều nghĩa là ảnh user sắp gửi không khớp với số
      // tiền hệ thống định ghi. Trả về một phần còn tệ hơn: user tưởng đã trả hết.
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
        data: { payment_id: payment.id, payment_status: 'submitted' },
      });
      return payment.id;
    });

    this.logger.log(
      `Payment ${paymentId} submitted by ${userId} in organization ${organizationId} for ${chargeIds.length} charges`,
    );
    return this.readPayment(paymentId);
  }

  /**
   * Input: userId + id tổ chức + bộ lọc trạng thái.
   * Output: Các lần thanh toán, mới nhất trước.
   *
   *         Owner thấy của cả tổ chức (hàng đợi duyệt); member CHỈ thấy của mình — điều kiện
   *         này áp ở service chứ không ở query param, để không ai xem được lịch sử chuyển
   *         tiền của người khác bằng cách đổi URL.
   */
  async list(userId: string, organizationId: string, query: ListPaymentsQueryDto): Promise<PaymentSummary[]> {
    const role = await requireMembership(this.databaseService, userId, organizationId);

    const payments = await this.databaseService.payment.findMany({
      where: {
        organization_id: organizationId,
        ...(role === 'owner' ? {} : { user_id: userId }),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ submitted_at: 'desc' }, { id: 'desc' }],
      include: this.paymentInclude(),
    });

    return payments.map((payment) => this.toSummary(payment));
  }

  /**
   * Input: userId owner + id tổ chức + id lần thanh toán.
   * Output: Lần thanh toán sau khi duyệt; mọi khoản trong đó chuyển 'confirmed'.
   */
  async confirm(userId: string, organizationId: string, paymentId: string): Promise<PaymentSummary> {
    await requireOwner(this.databaseService, userId, organizationId);
    const payment = await this.requirePayment(organizationId, paymentId);
    if (payment.status !== 'submitted') throw new AppException(ERROR_CODES.PAY_003);

    await this.databaseService.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'confirmed', confirmed_at: new Date(), confirmed_by: userId },
      });
      await tx.matchCharge.updateMany({
        where: { payment_id: paymentId },
        data: { payment_status: 'confirmed' },
      });
    });

    this.logger.log(`Payment ${paymentId} confirmed by ${userId}`);
    return this.readPayment(paymentId);
  }

  /**
   * Input: userId owner + id tổ chức + id lần thanh toán + lý do.
   * Output: Lần thanh toán bị từ chối; mọi khoản trong đó quay về 'unpaid'.
   *
   *         GIỮ `payment_id` trên các khoản: đó là đường duy nhất để nói cho user biết vì sao
   *         khoản quay lại. Lần gửi sau sẽ ghi đè liên kết này.
   *
   *         Đây cũng là cửa duy nhất để sửa lại chia tiền một trận đã có người gửi thanh toán.
   */
  async reject(userId: string, organizationId: string, paymentId: string, reason: string): Promise<PaymentSummary> {
    await requireOwner(this.databaseService, userId, organizationId);
    const payment = await this.requirePayment(organizationId, paymentId);
    if (payment.status !== 'submitted') throw new AppException(ERROR_CODES.PAY_003);

    await this.databaseService.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'rejected', reject_reason: reason },
      });
      await tx.matchCharge.updateMany({
        where: { payment_id: paymentId },
        data: { payment_status: 'unpaid' },
      });
    });

    this.logger.log(`Payment ${paymentId} rejected by ${userId}`);
    return this.readPayment(paymentId);
  }

  /**
   * Input: userId owner + id tổ chức + id lần thanh toán.
   * Output: Lần thanh toán quay về 'submitted'; các khoản quay về 'submitted'.
   *
   *         Bỏ duyệt chứ không xoá: owner bấm nhầm là chuyện có thật, mà tiền thì user đã
   *         chuyển rồi — đưa nó về hàng đợi để xem lại, không đẩy ngược thành nợ.
   */
  async unconfirm(userId: string, organizationId: string, paymentId: string): Promise<PaymentSummary> {
    await requireOwner(this.databaseService, userId, organizationId);
    const payment = await this.requirePayment(organizationId, paymentId);
    if (payment.status !== 'confirmed') throw new AppException(ERROR_CODES.PAY_003);

    await this.databaseService.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'submitted', confirmed_at: null, confirmed_by: null },
      });
      await tx.matchCharge.updateMany({
        where: { payment_id: paymentId },
        data: { payment_status: 'submitted' },
      });
    });

    this.logger.log(`Payment ${paymentId} unconfirmed by ${userId}`);
    return this.readPayment(paymentId);
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

  /**
   * Input: id tổ chức + id lần thanh toán.
   * Output: Trạng thái hiện tại; không thuộc tổ chức đó thì PAY_001.
   *
   *         Kiểm cả `organization_id` chứ không chỉ id: owner của tổ chức A không được đụng
   *         vào lần thanh toán của tổ chức B chỉ vì đoán đúng một uuid.
   */
  private async requirePayment(organizationId: string, paymentId: string): Promise<{ status: string }> {
    const payment = await this.databaseService.payment.findFirst({
      where: { id: paymentId, organization_id: organizationId },
      select: { status: true },
    });
    if (!payment) throw new AppException(ERROR_CODES.PAY_001);
    return payment;
  }

  private toSummary(payment: {
    id: string;
    organization_id: string;
    user_id: string;
    proof_url: string;
    note: string | null;
    status: string;
    reject_reason: string | null;
    submitted_at: Date;
    confirmed_at: Date | null;
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
      status: this.toPaymentStatus(payment.status),
      rejectReason: payment.reject_reason,
      submittedAt: payment.submitted_at.toISOString(),
      confirmedAt: payment.confirmed_at ? payment.confirmed_at.toISOString() : null,
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

  private toPaymentStatus(value: string): PaymentStatus {
    return value === 'confirmed' || value === 'rejected' ? value : 'submitted';
  }

  private toChargeStatus(value: string): ChargePaymentStatus {
    return value === 'submitted' || value === 'confirmed' ? value : 'unpaid';
  }
}
