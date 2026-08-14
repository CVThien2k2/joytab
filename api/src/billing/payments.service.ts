import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { DatabaseService } from '../database/database.service';
import { MemberRole, MemberStatus, PaymentMethod, PaymentStatus } from '../generated/prisma/enums';
import { AllocationInputDto, CreatePaymentDto } from './dto/create-payment.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { planAutoAllocations } from './billing.utils';

type TransactionClient = Parameters<Parameters<DatabaseService['$transaction']>[0]>[0];

type AllocationView = {
  settlementId: string;
  eventId: string;
  eventTitle: string;
  amount: number;
};

type PaymentView = {
  id: string;
  organizationId: string;
  userId: string;
  userFullName: string | null;
  userEmail: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  note: string | null;
  allocations: AllocationView[];
  createdBy: string;
  confirmedBy: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
};

/** Một settlement đã khoá row, đủ dữ liệu để validate phân bổ. */
type LockedSettlement = {
  id: string;
  user_id: string;
  amount: number;
  paid_amount: number;
  organization_id: string;
};

@Injectable()
export class PaymentsService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Input: orgId, người gọi (kèm role) và thông tin thanh toán.
   * Output: Payment vừa tạo kèm phân bổ.
   *
   * ADMIN tạo → CONFIRMED ngay trong cùng transaction (tiền mặt tại sân, không việc gì phải
   * tự duyệt cho chính mình). MEMBER tạo → PENDING chờ admin duyệt.
   */
  async create(organizationId: string, actorUserId: string, actorRole: MemberRole, dto: CreatePaymentDto) {
    const isAdmin = actorRole === MemberRole.ADMIN;
    // MEMBER không được thu tiền hộ người khác — bỏ qua `userId` thay vì báo lỗi, vì FE của
    // member không bao giờ gửi field này.
    const targetUserId = isAdmin ? (dto.userId ?? actorUserId) : actorUserId;

    const paymentId = await this.databaseService.$transaction(async (tx) => {
      await this.requireActiveMember(tx, organizationId, targetUserId);

      const settlements = await this.lockSettlementsForUser(tx, organizationId, targetUserId);
      const allocations = this.resolveAllocations(dto, settlements);
      this.assertAllocationsValid(dto.amount, allocations, settlements, targetUserId);

      const payment = await tx.payment.create({
        data: {
          organization_id: organizationId,
          user_id: targetUserId,
          amount: dto.amount,
          method: dto.method,
          status: isAdmin ? PaymentStatus.CONFIRMED : PaymentStatus.PENDING,
          note: dto.note ?? null,
          created_by: actorUserId,
          ...(isAdmin ? { confirmed_by: actorUserId, confirmed_at: new Date() } : {}),
          allocations: {
            createMany: {
              data: allocations.map((allocation) => ({
                settlement_id: allocation.settlementId,
                amount: allocation.amount,
              })),
            },
          },
        },
      });

      // paid_amount CHỈ đổi ở đây và ở confirm() — không có đường ghi nào khác. Payment
      // PENDING chưa cộng gì cả, nên tiền chỉ vào sổ khi đã thực sự được xác nhận.
      if (isAdmin) await this.applyAllocations(tx, allocations);

      return payment.id;
    });

    return this.getById(paymentId);
  }

  /**
   * Input: orgId, người gọi (kèm role) và bộ lọc.
   * Output: Danh sách payment. MEMBER chỉ thấy payment của chính mình, bất kể query truyền gì.
   */
  async list(organizationId: string, actorUserId: string, actorRole: MemberRole, query: ListPaymentsQueryDto) {
    const userFilter = actorRole === MemberRole.ADMIN ? query.userId : actorUserId;
    const payments = await this.databaseService.payment.findMany({
      where: {
        organization_id: organizationId,
        ...(query.status ? { status: query.status } : {}),
        ...(userFilter ? { user_id: userFilter } : {}),
      },
      orderBy: { created_at: 'desc' },
      include: this.paymentInclude(),
    });

    return payments.map((payment) => this.toPaymentView(payment));
  }

  /**
   * Input: paymentId và người gọi.
   * Output: Chi tiết payment. MEMBER chỉ xem được payment của chính mình.
   */
  async getDetail(paymentId: string, actorUserId: string): Promise<PaymentView> {
    const payment = await this.getById(paymentId);
    const membership = await this.databaseService.organizationMember.findUnique({
      where: { organization_id_user_id: { organization_id: payment.organizationId, user_id: actorUserId } },
      select: { role: true, status: true },
    });
    if (!membership || membership.status !== MemberStatus.ACTIVE) throw new AppException(ERROR_CODES.ORG_002);
    if (membership.role !== MemberRole.ADMIN && payment.userId !== actorUserId) {
      throw new AppException(ERROR_CODES.ORG_003);
    }

    return payment;
  }

  /**
   * Input: paymentId và admin duyệt.
   * Output: Payment đã CONFIRMED, `paid_amount` của các settlement đã cộng thêm.
   *
   * Validate LẠI toàn bộ phân bổ ở đây là bắt buộc, không phải thừa: giữa lúc tạo và lúc
   * duyệt có thể đã có payment khác trả cùng khoản nợ đó, phân bổ cũ giờ vượt số còn thiếu.
   */
  async confirm(paymentId: string, adminUserId: string): Promise<PaymentView> {
    await this.databaseService.$transaction(async (tx) => {
      const payment = await this.lockPayment(tx, paymentId);
      await this.requireAdmin(tx, payment.organization_id, adminUserId);
      if (payment.status !== PaymentStatus.PENDING) throw new AppException(ERROR_CODES.PAY_002);

      const allocations = await tx.paymentAllocation.findMany({
        where: { payment_id: paymentId },
        select: { settlement_id: true, amount: true },
      });
      const plans = allocations.map((allocation) => ({
        settlementId: allocation.settlement_id,
        amount: allocation.amount,
      }));

      const settlements = await this.lockSettlementsForUser(tx, payment.organization_id, payment.user_id);
      this.assertAllocationsValid(payment.amount, plans, settlements, payment.user_id);
      await this.applyAllocations(tx, plans);

      await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.CONFIRMED, confirmed_by: adminUserId, confirmed_at: new Date() },
      });
    });

    return this.getById(paymentId);
  }

  /**
   * Input: paymentId và admin từ chối.
   * Output: Payment đã REJECTED. KHÔNG đụng `paid_amount` (payment PENDING chưa từng cộng
   *         vào đó) và giữ nguyên allocation để làm dấu vết.
   */
  async reject(paymentId: string, adminUserId: string): Promise<PaymentView> {
    await this.databaseService.$transaction(async (tx) => {
      const payment = await this.lockPayment(tx, paymentId);
      await this.requireAdmin(tx, payment.organization_id, adminUserId);
      if (payment.status !== PaymentStatus.PENDING) throw new AppException(ERROR_CODES.PAY_002);

      await tx.payment.update({ where: { id: paymentId }, data: { status: PaymentStatus.REJECTED } });
    });

    return this.getById(paymentId);
  }

  /**
   * Input: DTO và các settlement đã khoá của user.
   * Output: Phân bổ do client chỉ định, hoặc tự phân bổ nợ cũ trước khi client bỏ trống.
   */
  private resolveAllocations(dto: CreatePaymentDto, settlements: LockedSettlement[]): AllocationInputDto[] {
    if (dto.allocations?.length) return dto.allocations;

    return planAutoAllocations(
      dto.amount,
      settlements
        .filter((settlement) => settlement.paid_amount < settlement.amount)
        .map((settlement) => ({
          settlementId: settlement.id,
          remaining: settlement.amount - settlement.paid_amount,
        })),
    );
  }

  /**
   * Input: Số tiền payment, phân bổ, settlement đã khoá và user chủ payment.
   * Output: Ném lỗi nếu phân bổ không hợp lệ. Áp dụng cho CẢ lúc tạo lẫn lúc confirm.
   *
   * - SUM(allocations) phải bằng đúng `amount` — không cho tiền treo lơ lửng (PAY_003).
   * - Settlement phải thuộc đúng user và đúng org (SET_001).
   * - Mỗi dòng không được vượt phần còn thiếu — không cho trả dư (PAY_004).
   */
  private assertAllocationsValid(
    paymentAmount: number,
    allocations: { settlementId: string; amount: number }[],
    settlements: LockedSettlement[],
    ownerUserId: string,
  ): void {
    const allocatedTotal = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    if (allocatedTotal !== paymentAmount) throw new AppException(ERROR_CODES.PAY_003);

    const settlementById = new Map(settlements.map((settlement) => [settlement.id, settlement]));
    for (const allocation of allocations) {
      const settlement = settlementById.get(allocation.settlementId);
      if (!settlement || settlement.user_id !== ownerUserId) throw new AppException(ERROR_CODES.SET_001);
      if (allocation.amount > settlement.amount - settlement.paid_amount) {
        throw new AppException(ERROR_CODES.PAY_004);
      }
    }
  }

  /**
   * Input: Transaction client và các dòng phân bổ đã validate.
   * Output: Cộng `paid_amount` cho từng settlement tương ứng.
   */
  private async applyAllocations(
    tx: TransactionClient,
    allocations: { settlementId: string; amount: number }[],
  ): Promise<void> {
    for (const allocation of allocations) {
      await tx.eventSettlement.update({
        where: { id: allocation.settlementId },
        data: { paid_amount: { increment: allocation.amount } },
      });
    }
  }

  /**
   * Input: Transaction client, orgId và user.
   * Output: Mọi settlement của user trong org, ĐÃ KHOÁ row, sắp nợ cũ trước (theo giờ đánh).
   *
   * Khoá cả cụm thay vì từng dòng vì cùng một thứ tự (org, user, start_at) ở mọi luồng —
   * hai payment của cùng một người không thể xen kẽ nhau giữa chừng, và không có deadlock
   * chéo vì thứ tự khoá là tất định.
   */
  private async lockSettlementsForUser(
    tx: TransactionClient,
    organizationId: string,
    userId: string,
  ): Promise<LockedSettlement[]> {
    return tx.$queryRaw<LockedSettlement[]>`
      SELECT s.id, s.user_id, s.amount, s.paid_amount, e.organization_id
      FROM event_settlements s
      JOIN events e ON e.id = s.event_id
      WHERE e.organization_id = ${organizationId}::uuid AND s.user_id = ${userId}::uuid
      ORDER BY e.start_at ASC, s.id ASC
      FOR UPDATE OF s`;
  }

  private async lockPayment(tx: TransactionClient, paymentId: string) {
    const rows = await tx.$queryRaw<
      { id: string; organization_id: string; user_id: string; amount: number; status: PaymentStatus }[]
    >`SELECT id, organization_id, user_id, amount, status
      FROM payments
      WHERE id = ${paymentId}::uuid
      FOR UPDATE`;
    if (rows.length === 0) throw new AppException(ERROR_CODES.PAY_001);

    return rows[0];
  }

  private async requireActiveMember(tx: TransactionClient, organizationId: string, userId: string): Promise<void> {
    const membership = await tx.organizationMember.findUnique({
      where: { organization_id_user_id: { organization_id: organizationId, user_id: userId } },
      select: { status: true },
    });
    if (!membership || membership.status !== MemberStatus.ACTIVE) throw new AppException(ERROR_CODES.ORG_002);
  }

  /**
   * Input: Transaction client, orgId và người gọi.
   * Output: Ném ORG_002/ORG_003 nếu không phải ADMIN đang ACTIVE.
   *
   * Route `/payments/:paymentId/*` không có `:orgId` trên URL nên OrgMemberGuard không dùng
   * được — org suy ra từ chính payment.
   */
  private async requireAdmin(tx: TransactionClient, organizationId: string, userId: string): Promise<void> {
    const membership = await tx.organizationMember.findUnique({
      where: { organization_id_user_id: { organization_id: organizationId, user_id: userId } },
      select: { role: true, status: true },
    });
    if (!membership || membership.status !== MemberStatus.ACTIVE) throw new AppException(ERROR_CODES.ORG_002);
    if (membership.role !== MemberRole.ADMIN) throw new AppException(ERROR_CODES.ORG_003);
  }

  private async getById(paymentId: string): Promise<PaymentView> {
    const payment = await this.databaseService.payment.findUnique({
      where: { id: paymentId },
      include: this.paymentInclude(),
    });
    if (!payment) throw new AppException(ERROR_CODES.PAY_001);

    return this.toPaymentView(payment);
  }

  private paymentInclude() {
    return {
      user: { select: { full_name: true, email: true } },
      allocations: {
        select: {
          settlement_id: true,
          amount: true,
          settlement: { select: { event: { select: { id: true, title: true } } } },
        },
      },
    };
  }

  private toPaymentView(payment: {
    id: string;
    organization_id: string;
    user_id: string;
    amount: number;
    method: PaymentMethod;
    status: PaymentStatus;
    note: string | null;
    created_by: string;
    confirmed_by: string | null;
    confirmed_at: Date | null;
    created_at: Date;
    user: { full_name: string | null; email: string };
    allocations: {
      settlement_id: string;
      amount: number;
      settlement: { event: { id: string; title: string } };
    }[];
  }): PaymentView {
    return {
      id: payment.id,
      organizationId: payment.organization_id,
      userId: payment.user_id,
      userFullName: payment.user.full_name,
      userEmail: payment.user.email,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      note: payment.note,
      allocations: payment.allocations.map((allocation) => ({
        settlementId: allocation.settlement_id,
        eventId: allocation.settlement.event.id,
        eventTitle: allocation.settlement.event.title,
        amount: allocation.amount,
      })),
      createdBy: payment.created_by,
      confirmedBy: payment.confirmed_by,
      confirmedAt: payment.confirmed_at,
      createdAt: payment.created_at,
    };
  }
}
