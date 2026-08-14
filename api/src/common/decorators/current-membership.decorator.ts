import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { ERROR_CODES } from '../constants/error-codes.constant';
import { AppException } from '../exceptions/app.exception';
import { RequestMembership } from '../utils/types';

/**
 * Input: Request đã qua OrgMemberGuard.
 * Output: Tư cách thành viên trong org trên URL. Ném ORG_002 nếu handler quên gắn guard.
 */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestMembership => {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.membership) throw new AppException(ERROR_CODES.ORG_002);

    return request.membership;
  },
);
