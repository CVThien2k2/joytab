import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  accountId!: string;
}
