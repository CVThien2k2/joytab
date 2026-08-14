import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MAX_COST_AMOUNT } from '../events.constants';

/** Một dòng chi phí phát sinh ngoài tiền sân: cầu, nước, thuê vợt… */
export class ExtraCostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsInt()
  @Min(0)
  @Max(MAX_COST_AMOUNT)
  amount!: number;
}
