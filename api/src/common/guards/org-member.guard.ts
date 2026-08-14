import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { DatabaseService } from '../../database/database.service';
import { MemberRole, MemberStatus } from '../../generated/prisma/enums';
import { ERROR_CODES } from '../constants/error-codes.constant';
import { ORG_ROLES_KEY } from '../decorators/org-roles.decorator';
import { AppException } from '../exceptions/app.exception';

/** Tên param chứa id tổ chức trên URL. Mọi route lồng trong org đều phải dùng đúng tên này. */
const ORG_ID_PARAM = 'orgId';

@Injectable()
export class OrgMemberGuard implements CanActivate {
  /**
   * Input: DatabaseService để tra membership, Reflector để đọc metadata @OrgRoles.
   * Output: Guard cho mọi route có `:orgId` trên URL. Luôn chạy SAU JwtAuthGuard.
   *
   * Route thao tác trên `:eventId` / `:paymentId` (không có `:orgId`) KHÔNG dùng guard này —
   * guard không đoán được org từ id lồng nhau, service tự nạp bản ghi rồi kiểm tra.
   */
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly reflector: Reflector,
  ) {}

  /**
   * Input: ExecutionContext của request HTTP.
   * Output: true nếu user là thành viên ACTIVE của org và role thoả @OrgRoles; đồng thời
   *         gắn `request.membership`. Không phải thành viên → ORG_002, sai role → ORG_003.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.userId;
    if (!userId) throw new AppException(ERROR_CODES.AUTH_001);

    const organizationId = (request.params as Record<string, string | undefined>)[ORG_ID_PARAM];
    if (!organizationId) throw new AppException(ERROR_CODES.ORG_001);

    const membership = await this.databaseService.organizationMember.findUnique({
      where: { organization_id_user_id: { organization_id: organizationId, user_id: userId } },
      select: { role: true, status: true },
    });
    if (!membership || membership.status !== MemberStatus.ACTIVE) {
      throw new AppException(ERROR_CODES.ORG_002);
    }

    const requiredRoles = this.reflector.getAllAndOverride<MemberRole[] | undefined>(ORG_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles?.length && !requiredRoles.includes(membership.role)) {
      throw new AppException(ERROR_CODES.ORG_003);
    }

    request.membership = { organizationId, userId, role: membership.role };
    return true;
  }
}
