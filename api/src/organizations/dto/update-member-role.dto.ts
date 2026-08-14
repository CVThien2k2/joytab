import { IsEnum } from 'class-validator';
import { MemberRole } from '../../generated/prisma/enums';

export class UpdateMemberRoleDto {
  @IsEnum(MemberRole)
  role!: MemberRole;
}
