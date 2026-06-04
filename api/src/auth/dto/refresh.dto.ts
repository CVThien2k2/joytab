import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  accountId!: string;
}
