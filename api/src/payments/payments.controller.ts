import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreatePaymentDto, PaymentOrganizationParamDto } from './payments.dto';
import { PaymentsService } from './payments.service';

/**
 * Thanh toán luôn nằm trong phạm vi một tổ chức: QR là của tổ chức, nên một lần chuyển khoản
 * chỉ trả được cho các trận của cùng tổ chức đó.
 */
@Controller('organizations/:organizationId')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Input: cookie `at` + id tổ chức.
   * Output: { groups } — công nợ của chính người gọi trong tổ chức này (một phần tử). Trả
   *         dạng NHÓM (một phần tử) chứ không phải mảng khoản phẳng: nhóm mang theo mã QR và
   *         tổng nợ — đúng những thứ hộp thoại thanh toán cần.
   */
  @Get('charges/me')
  async myCharges(@Req() request: Request & { userId: string }, @Param() params: PaymentOrganizationParamDto) {
    return {
      groups: await this.paymentsService.listCharges(request.userId, params.organizationId),
    };
  }

  /**
   * Input: cookie `at` + id tổ chức.
   * Output: { payments } — owner thấy của cả tổ chức, member chỉ thấy của mình (service ép,
   *         không phụ thuộc tham số client gửi).
   *
   *         Không còn ?status: mọi row ở đây đều là một lần đã chuyển tiền, không có hàng đợi
   *         nào để lọc ra.
   */
  @Get('payments')
  async list(@Req() request: Request & { userId: string }, @Param() params: PaymentOrganizationParamDto) {
    return {
      payments: await this.paymentsService.list(request.userId, params.organizationId),
    };
  }

  /**
   * Input: cookie `at` + id tổ chức + { chargeIds, proofUrl, note? }.
   * Output: { payment } — lần chuyển khoản vừa gửi.
   *
   *         Gửi danh sách KHOẢN chứ không gửi số tiền: số tiền do BE cộng từ các khoản đó.
   *         Đây là thao tác duy nhất của user trong luồng tiền — không có route huỷ.
   */
  @Post('payments')
  async create(
    @Req() request: Request & { userId: string },
    @Param() params: PaymentOrganizationParamDto,
    @Body() dto: CreatePaymentDto,
  ) {
    return {
      payment: await this.paymentsService.create(request.userId, params.organizationId, dto),
    };
  }
}
