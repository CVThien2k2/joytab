import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentMembership } from '../common/decorators/current-membership.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../common/guards/org-member.guard';
import { CommonParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { RequestMembership } from '../common/utils/types';
import { MemberRole } from '../generated/prisma/enums';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { PaymentsService } from './payments.service';
import { SettlementsService } from './settlements.service';

@Controller('organizations/:orgId')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class OrganizationBillingController {
  constructor(
    private readonly settlementsService: SettlementsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Input: orgId.
   * Output: Từng khoản nợ của tôi trong nhóm + tổng.
   */
  @Get('debts/me')
  listMyDebts(@CurrentMembership() membership: RequestMembership) {
    return this.settlementsService.listMyDebts(membership.organizationId, membership.userId);
  }

  /**
   * Input: orgId.
   * Output: Công nợ theo từng thành viên (ADMIN).
   */
  @Get('debts')
  @OrgRoles(MemberRole.ADMIN)
  listOrgDebts(@CurrentMembership() membership: RequestMembership) {
    return this.settlementsService.listOrgDebts(membership.organizationId);
  }

  /**
   * Input: orgId + thông tin thanh toán.
   * Output: Payment vừa tạo. MEMBER → PENDING chờ duyệt; ADMIN → CONFIRMED ngay.
   */
  @Post('payments')
  createPayment(@CurrentMembership() membership: RequestMembership, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(membership.organizationId, membership.userId, membership.role, dto);
  }

  /**
   * Input: orgId + bộ lọc.
   * Output: Danh sách payment. MEMBER chỉ thấy của mình.
   */
  @Get('payments')
  listPayments(@CurrentMembership() membership: RequestMembership, @Query() query: ListPaymentsQueryDto) {
    return this.paymentsService.list(membership.organizationId, membership.userId, membership.role, query);
  }
}

/**
 * Route `:paymentId` không có `:orgId` trên URL nên không dùng OrgMemberGuard được —
 * PaymentsService tự suy org từ payment rồi kiểm tra quyền.
 */
@Controller('payments/:paymentId')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Input: paymentId.
   * Output: Chi tiết payment kèm phân bổ. MEMBER chỉ xem được của mình.
   */
  @Get()
  getDetail(@Param('paymentId', CommonParseUuidPipe) paymentId: string, @CurrentUser() userId: string) {
    return this.paymentsService.getDetail(paymentId, userId);
  }

  /**
   * Input: paymentId.
   * Output: Duyệt thanh toán (ADMIN) — cộng `paid_amount` sau khi validate lại phân bổ.
   */
  @Post('confirm')
  confirm(@Param('paymentId', CommonParseUuidPipe) paymentId: string, @CurrentUser() userId: string) {
    return this.paymentsService.confirm(paymentId, userId);
  }

  /**
   * Input: paymentId.
   * Output: Từ chối thanh toán (ADMIN) — giữ allocation làm dấu vết, không đụng `paid_amount`.
   */
  @Post('reject')
  reject(@Param('paymentId', CommonParseUuidPipe) paymentId: string, @CurrentUser() userId: string) {
    return this.paymentsService.reject(paymentId, userId);
  }
}
