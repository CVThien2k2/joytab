import { IsNotEmpty, IsString } from 'class-validator';

export class ExchangeGoogleCodeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}
