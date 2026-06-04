import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ExchangeGoogleCodeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  deviceFingerprint!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceName?: string;
}
