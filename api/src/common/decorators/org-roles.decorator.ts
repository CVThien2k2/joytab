import { SetMetadata } from '@nestjs/common';
import { MemberRole } from '../../generated/prisma/enums';

export const ORG_ROLES_KEY = 'orgRoles';

/**
 * Input: Danh sách role được phép trên handler/controller.
 * Output: Gắn metadata cho OrgMemberGuard đối chiếu. Không có decorator = mọi thành viên
 *         ACTIVE đều vào được.
 */
export const OrgRoles = (...roles: MemberRole[]) => SetMetadata(ORG_ROLES_KEY, roles);
