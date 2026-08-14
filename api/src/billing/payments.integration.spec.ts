import { createTestDatabaseService, createUser, resetDatabase } from '../../test/integration-db';
import { DatabaseService } from '../database/database.service';
import type { EventSettlement } from '../generated/prisma/client';
import { MemberRole, MemberStatus, PaymentMethod, PaymentStatus } from '../generated/prisma/enums';
import { PaymentsService } from './payments.service';
import { SettlementsService } from './settlements.service';

/**
 * Bất biến được canh ở đây: `paid_amount` của một settlement LUÔN bằng tổng allocation của
 * các payment CONFIRMED trỏ vào nó. Đây là cột dữ liệu dẫn xuất duy nhất được phép lưu, nên
 * nó phải có test đối chiếu riêng.
 */
describe('PaymentsService (Postgres thật)', () => {
  let db: DatabaseService;
  let paymentsService: PaymentsService;
  let settlementsService: SettlementsService;

  beforeAll(() => {
    db = createTestDatabaseService();
    paymentsService = new PaymentsService(db);
    settlementsService = new SettlementsService(db);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(db);
  });

  /**
   * Input: Danh sách số tiền nợ, mỗi số là một trận riêng (trận cũ nhất đứng đầu).
   * Output: Org có 1 admin + 1 member đang nợ đúng những khoản đó.
   */
  async function seedDebts(amounts: number[]) {
    const admin = await createUser(db, 'admin');
    const member = await createUser(db, 'member');
    const organization = await db.organization.create({ data: { name: 'Nhóm cầu lông', created_by: admin.id } });
    await db.organizationMember.createMany({
      data: [
        {
          organization_id: organization.id,
          user_id: admin.id,
          role: MemberRole.ADMIN,
          status: MemberStatus.ACTIVE,
        },
        {
          organization_id: organization.id,
          user_id: member.id,
          role: MemberRole.MEMBER,
          status: MemberStatus.ACTIVE,
        },
      ],
    });

    const settlements: EventSettlement[] = [];
    for (const [index, amount] of amounts.entries()) {
      const startAt = new Date(Date.UTC(2026, 0, index + 1, 12));
      const event = await db.event.create({
        data: {
          organization_id: organization.id,
          title: `Trận ${index + 1}`,
          start_at: startAt,
          end_at: new Date(startAt.getTime() + 2 * 60 * 60 * 1000),
          court_cost: amount,
          max_participants: 10,
          vote_locked_at: startAt,
          created_by: admin.id,
        },
      });
      settlements.push(await db.eventSettlement.create({ data: { event_id: event.id, user_id: member.id, amount } }));
    }

    return { admin, member, organization, settlements };
  }

  /**
   * Input: orgId.
   * Output: Đối chiếu `paid_amount` với tổng allocation của payment CONFIRMED cho TỪNG
   *         settlement. Đây là bất biến của cả module billing.
   */
  async function expectPaidAmountInvariant(organizationId: string): Promise<void> {
    const settlements = await db.eventSettlement.findMany({
      where: { event: { organization_id: organizationId } },
      include: { allocations: { include: { payment: { select: { status: true } } } } },
    });

    for (const settlement of settlements) {
      const confirmedTotal = settlement.allocations
        .filter((allocation) => allocation.payment.status === PaymentStatus.CONFIRMED)
        .reduce((sum, allocation) => sum + allocation.amount, 0);
      expect(settlement.paid_amount).toBe(confirmedTotal);
      expect(settlement.paid_amount).toBeLessThanOrEqual(settlement.amount);
    }
  }

  it('ADMIN tạo payment thì CONFIRMED ngay và cộng luôn paid_amount', async () => {
    const { admin, member, organization, settlements } = await seedDebts([50_000, 30_000]);

    const payment = await paymentsService.create(organization.id, admin.id, MemberRole.ADMIN, {
      userId: member.id,
      amount: 80_000,
      method: PaymentMethod.CASH,
    });

    expect(payment.status).toBe(PaymentStatus.CONFIRMED);
    expect(payment.allocations).toHaveLength(2);
    const refreshed = await db.eventSettlement.findMany({ where: { id: { in: settlements.map((s) => s.id) } } });
    expect(refreshed.every((settlement) => settlement.paid_amount === settlement.amount)).toBe(true);
    await expectPaidAmountInvariant(organization.id);
  });

  it('MEMBER tạo payment thì PENDING và CHƯA cộng paid_amount', async () => {
    const { member, organization } = await seedDebts([50_000]);

    const payment = await paymentsService.create(organization.id, member.id, MemberRole.MEMBER, {
      amount: 50_000,
      method: PaymentMethod.BANK_TRANSFER,
    });

    expect(payment.status).toBe(PaymentStatus.PENDING);
    const settlements = await db.eventSettlement.findMany({ where: { user_id: member.id } });
    expect(settlements.every((settlement) => settlement.paid_amount === 0)).toBe(true);
    await expectPaidAmountInvariant(organization.id);
  });

  it('tự phân bổ trả nợ cũ trước', async () => {
    const { member, organization, settlements } = await seedDebts([50_000, 30_000, 20_000]);

    const payment = await paymentsService.create(organization.id, member.id, MemberRole.MEMBER, {
      amount: 60_000,
      method: PaymentMethod.CASH,
    });

    expect(payment.allocations.map((allocation) => allocation.amount)).toEqual([50_000, 10_000]);
    expect(payment.allocations[0].settlementId).toBe(settlements[0].id);
    expect(payment.allocations[1].settlementId).toBe(settlements[1].id);
  });

  it('confirm cộng đúng paid_amount, confirm lần hai bị chặn bằng PAY_002', async () => {
    const { admin, member, organization } = await seedDebts([50_000, 30_000]);
    const pending = await paymentsService.create(organization.id, member.id, MemberRole.MEMBER, {
      amount: 60_000,
      method: PaymentMethod.CASH,
    });

    const confirmed = await paymentsService.confirm(pending.id, admin.id);
    expect(confirmed.status).toBe(PaymentStatus.CONFIRMED);
    await expectPaidAmountInvariant(organization.id);

    await expect(paymentsService.confirm(pending.id, admin.id)).rejects.toMatchObject({ code: 'PAY_002' });
    await expectPaidAmountInvariant(organization.id);
  });

  it('confirm hai lần đồng thời chỉ có một lần ăn tiền', async () => {
    const { admin, member, organization } = await seedDebts([50_000]);
    const pending = await paymentsService.create(organization.id, member.id, MemberRole.MEMBER, {
      amount: 50_000,
      method: PaymentMethod.CASH,
    });

    const results = await Promise.allSettled([
      paymentsService.confirm(pending.id, admin.id),
      paymentsService.confirm(pending.id, admin.id),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    await expectPaidAmountInvariant(organization.id);
  });

  it('payment thứ hai bị chặn khi khoản nợ đã được trả xong giữa lúc tạo và lúc duyệt', async () => {
    const { admin, member, organization } = await seedDebts([50_000]);
    // Hai người cùng báo trả trọn khoản nợ đó khi nó còn nguyên.
    const first = await paymentsService.create(organization.id, member.id, MemberRole.MEMBER, {
      amount: 50_000,
      method: PaymentMethod.CASH,
    });
    const second = await paymentsService.create(organization.id, member.id, MemberRole.MEMBER, {
      amount: 50_000,
      method: PaymentMethod.BANK_TRANSFER,
    });

    await paymentsService.confirm(first.id, admin.id);
    // Đây là lý do phải validate LẠI lúc confirm: phân bổ của `second` giờ đã vượt phần còn thiếu.
    await expect(paymentsService.confirm(second.id, admin.id)).rejects.toMatchObject({ code: 'PAY_004' });

    await expectPaidAmountInvariant(organization.id);
  });

  it('reject giữ nguyên allocation làm dấu vết nhưng không cộng paid_amount', async () => {
    const { admin, member, organization } = await seedDebts([50_000]);
    const pending = await paymentsService.create(organization.id, member.id, MemberRole.MEMBER, {
      amount: 50_000,
      method: PaymentMethod.CASH,
    });

    const rejected = await paymentsService.reject(pending.id, admin.id);

    expect(rejected.status).toBe(PaymentStatus.REJECTED);
    expect(rejected.allocations).toHaveLength(1);
    await expectPaidAmountInvariant(organization.id);
  });

  it('phân bổ không khớp số tiền thì bị chặn bằng PAY_003', async () => {
    const { member, organization, settlements } = await seedDebts([50_000]);

    await expect(
      paymentsService.create(organization.id, member.id, MemberRole.MEMBER, {
        amount: 50_000,
        method: PaymentMethod.CASH,
        allocations: [{ settlementId: settlements[0].id, amount: 30_000 }],
      }),
    ).rejects.toMatchObject({ code: 'PAY_003' });
  });

  it('trả dư một khoản nợ thì bị chặn bằng PAY_004', async () => {
    const { member, organization, settlements } = await seedDebts([50_000]);

    await expect(
      paymentsService.create(organization.id, member.id, MemberRole.MEMBER, {
        amount: 60_000,
        method: PaymentMethod.CASH,
        allocations: [{ settlementId: settlements[0].id, amount: 60_000 }],
      }),
    ).rejects.toMatchObject({ code: 'PAY_004' });
  });

  it('trả vào khoản nợ của người khác thì bị chặn bằng SET_001', async () => {
    const { admin, member, organization, settlements } = await seedDebts([50_000]);

    await expect(
      paymentsService.create(organization.id, admin.id, MemberRole.ADMIN, {
        userId: admin.id,
        amount: 50_000,
        method: PaymentMethod.CASH,
        allocations: [{ settlementId: settlements[0].id, amount: 50_000 }],
      }),
    ).rejects.toMatchObject({ code: 'SET_001' });

    expect(member.id).not.toBe(admin.id);
  });

  it('MEMBER không thu tiền hộ được — userId bị bỏ qua, payment luôn về chính mình', async () => {
    const { admin, member, organization } = await seedDebts([50_000]);

    const payment = await paymentsService.create(organization.id, member.id, MemberRole.MEMBER, {
      userId: admin.id,
      amount: 50_000,
      method: PaymentMethod.CASH,
    });

    expect(payment.userId).toBe(member.id);
  });

  it('công nợ của tôi tính đúng trạng thái UNPAID/PARTIAL/PAID', async () => {
    const { admin, member, organization, settlements } = await seedDebts([50_000, 30_000, 20_000]);
    await paymentsService.create(organization.id, admin.id, MemberRole.ADMIN, {
      userId: member.id,
      amount: 60_000,
      method: PaymentMethod.CASH,
    });

    const debts = await settlementsService.listMyDebts(organization.id, member.id);

    expect(debts.totalAmount).toBe(100_000);
    expect(debts.totalPaid).toBe(60_000);
    expect(debts.remaining).toBe(40_000);
    expect(debts.items.map((item) => item.status)).toEqual(['PAID', 'PARTIAL', 'UNPAID']);
    expect(debts.items.map((item) => item.settlementId)).toEqual(settlements.map((item) => item.id));
  });
});
