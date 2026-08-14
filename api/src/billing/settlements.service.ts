import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { DatabaseService } from '../database/database.service';
import { MemberStatus } from '../generated/prisma/enums';
import { splitAmountLargestRemainder } from './billing.utils';
import { DebtStatus, resolveDebtStatus } from './billing.constants';

type TransactionClient = Parameters<Parameters<DatabaseService['$transaction']>[0]>[0];

type CreateForEventInput = {
  eventId: string;
  /** Đã sắp xếp tất định bởi caller — thứ tự quyết định ai chịu thêm 1 đồng lẻ. */
  userIds: string[];
  totalAmount: number;
};

type DebtLine = {
  settlementId: string;
  eventId: string;
  eventTitle: string;
  eventStartAt: Date;
  amount: number;
  paidAmount: number;
  remaining: number;
  status: DebtStatus;
};

type MemberDebtSummary = {
  userId: string;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  totalAmount: number;
  totalPaid: number;
  remaining: number;
};

/**
 * Cửa duy nhất để module `events` chạm vào bảng công nợ: nhận sẵn transaction client từ
 * caller nên finalize/reopen vẫn nguyên tử. Service này KHÔNG bao giờ ghi ngược vào `events`.
 */
@Injectable()
export class SettlementsService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Input: Transaction client, eventId, danh sách người chịu tiền và tổng chi phí.
   * Output: Các dòng công nợ vừa tạo với `paid_amount = 0`.
   */
  async createForEvent(tx: TransactionClient, input: CreateForEventInput) {
    const amounts = splitAmountLargestRemainder(input.totalAmount, input.userIds.length);
    const rows = input.userIds.map((userId, index) => ({
      event_id: input.eventId,
      user_id: userId,
      amount: amounts[index],
    }));
    await tx.eventSettlement.createMany({ data: rows });

    return {
      totalAmount: input.totalAmount,
      items: rows.map((row) => ({ userId: row.user_id, amount: row.amount })),
    };
  }

  /**
   * Input: Transaction client và eventId.
   * Output: Xoá sạch công nợ của trận, sau khi chắc chắn chưa ai trả đồng nào (EVT_006).
   */
  async removeForEvent(tx: TransactionClient, eventId: string): Promise<void> {
    const paid = await tx.eventSettlement.count({ where: { event_id: eventId, paid_amount: { gt: 0 } } });
    if (paid > 0) throw new AppException(ERROR_CODES.EVT_006);

    await tx.eventSettlement.deleteMany({ where: { event_id: eventId } });
  }

  /**
   * Input: orgId và userId.
   * Output: Từng khoản nợ của user trong tổ chức + tổng. Trạng thái nợ tính lúc đọc từ
   *         `paid_amount` chứ không lưu cột riêng.
   */
  async listMyDebts(organizationId: string, userId: string) {
    const settlements = await this.databaseService.eventSettlement.findMany({
      where: { user_id: userId, event: { organization_id: organizationId } },
      orderBy: { event: { start_at: 'asc' } },
      select: {
        id: true,
        amount: true,
        paid_amount: true,
        event: { select: { id: true, title: true, start_at: true } },
      },
    });

    const items: DebtLine[] = settlements.map((settlement) => ({
      settlementId: settlement.id,
      eventId: settlement.event.id,
      eventTitle: settlement.event.title,
      eventStartAt: settlement.event.start_at,
      amount: settlement.amount,
      paidAmount: settlement.paid_amount,
      remaining: settlement.amount - settlement.paid_amount,
      status: resolveDebtStatus(settlement.amount, settlement.paid_amount),
    }));

    return {
      items,
      totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
      totalPaid: items.reduce((sum, item) => sum + item.paidAmount, 0),
      remaining: items.reduce((sum, item) => sum + item.remaining, 0),
    };
  }

  /**
   * Input: orgId.
   * Output: Tổng công nợ theo từng thành viên ACTIVE, người nợ nhiều nhất lên đầu.
   *         Thành viên chưa từng bị chia tiền vẫn xuất hiện với số 0 — màn công nợ của admin
   *         cần thấy đủ danh sách chứ không chỉ người đang nợ.
   */
  async listOrgDebts(organizationId: string): Promise<MemberDebtSummary[]> {
    const members = await this.databaseService.organizationMember.findMany({
      where: { organization_id: organizationId, status: MemberStatus.ACTIVE },
      select: { user_id: true, user: { select: { full_name: true, email: true, avatar_url: true } } },
    });
    const grouped = await this.databaseService.eventSettlement.groupBy({
      by: ['user_id'],
      where: { event: { organization_id: organizationId } },
      _sum: { amount: true, paid_amount: true },
    });
    const totalsByUser = new Map(grouped.map((row) => [row.user_id, row._sum]));

    return members
      .map((member) => {
        const totals = totalsByUser.get(member.user_id);
        const totalAmount = totals?.amount ?? 0;
        const totalPaid = totals?.paid_amount ?? 0;
        return {
          userId: member.user_id,
          fullName: member.user.full_name,
          email: member.user.email,
          avatarUrl: member.user.avatar_url,
          totalAmount,
          totalPaid,
          remaining: totalAmount - totalPaid,
        };
      })
      .sort((left, right) => right.remaining - left.remaining);
  }
}
