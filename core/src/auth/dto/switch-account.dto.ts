import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SwitchAccountDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  userId!: string;
}
