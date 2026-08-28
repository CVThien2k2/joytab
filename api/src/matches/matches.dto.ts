import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MALE_RATIO_DECIMALS,
  MAX_COURT_NAME_LENGTH,
  MAX_EXPENSE_LINES,
  MAX_EXPENSE_NAME_LENGTH,
  MAX_EXPENSE_QUANTITY,
  MAX_EXPENSE_UNIT_PRICE,
  MAX_MALE_RATIO,
  MAX_MATCH_NOTE_LENGTH,
  MAX_MAX_PLAYERS,
  MIN_COURT_NAME_LENGTH,
  MIN_MALE_RATIO,
  MIN_MAX_PLAYERS,
} from './matches.constants';

/** Bỏ khoảng trắng thừa; chuỗi rỗng sau khi trim coi như không gửi. */
function trimOrUndefined(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Param của các route lồng dưới tổ chức. */
export class MatchOrganizationParamDto {
  @IsUUID(undefined, { message: 'Id tổ chức không hợp lệ' })
  organizationId: string;
}

/** Param của các route thao tác lên một trận. */
export class MatchIdParamDto {
  @IsUUID(undefined, { message: 'Id lịch thi đấu không hợp lệ' })
  id: string;
}

/**
 * Query khoảng ngày của bộ lịch. Cả hai đều tuỳ chọn — không gửi thì service tự lấy khoảng
 * quanh hôm nay, để lần mở trang đầu tiên không cần FE tính gì.
 */
export class MatchRangeQueryDto {
  @IsOptional()
  @IsISO8601({}, { message: 'Ngày bắt đầu không hợp lệ' })
  from?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Ngày kết thúc không hợp lệ' })
  to?: string;
}

/**
 * Body của POST /organizations/:organizationId/matches.
 *
 * `maleRatio` tuỳ chọn: không gửi thì lấy mặc định của tổ chức. Gửi thì trận này dùng số
 * riêng, và về sau đổi mặc định của tổ chức cũng không đụng tới trận đã tạo.
 */
export class CreateMatchDto {
  @Transform(({ value }): unknown => trimOrUndefined(value))
  @IsString({ message: 'Tên sân không hợp lệ' })
  @Length(MIN_COURT_NAME_LENGTH, MAX_COURT_NAME_LENGTH, {
    message: `Tên sân tối đa ${MAX_COURT_NAME_LENGTH} ký tự`,
  })
  courtName: string;

  @IsISO8601({}, { message: 'Giờ bắt đầu không hợp lệ' })
  startAt: string;

  @IsISO8601({}, { message: 'Giờ kết thúc không hợp lệ' })
  endAt: string;

  @Type(() => Number)
  @IsInt({ message: 'Số người tối đa không hợp lệ' })
  @Min(MIN_MAX_PLAYERS, { message: `Số người tối đa phải từ ${MIN_MAX_PLAYERS}` })
  @Max(MAX_MAX_PLAYERS, { message: `Số người tối đa không quá ${MAX_MAX_PLAYERS}` })
  maxPlayers: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: MALE_RATIO_DECIMALS },
    { message: `Hệ số nam tối đa ${MALE_RATIO_DECIMALS} chữ số thập phân` },
  )
  @Min(MIN_MALE_RATIO, { message: `Hệ số nam phải từ ${MIN_MALE_RATIO}` })
  @Max(MAX_MALE_RATIO, { message: `Hệ số nam không quá ${MAX_MALE_RATIO}` })
  maleRatio?: number;

  @IsOptional()
  @Transform(({ value }): unknown => trimOrUndefined(value))
  @IsString({ message: 'Ghi chú không hợp lệ' })
  @MaxLength(MAX_MATCH_NOTE_LENGTH, {
    message: `Ghi chú tối đa ${MAX_MATCH_NOTE_LENGTH} ký tự`,
  })
  note?: string;
}

/**
 * Body của PATCH /matches/:id. Mọi field đều tuỳ chọn và độc lập — cũng là body mà thao tác
 * kéo thả trên lịch gửi lên (chỉ có startAt/endAt).
 *
 * `note` cho phép gửi chuỗi rỗng để XOÁ ghi chú, nên không dùng chung transform với create.
 */
export class UpdateMatchDto {
  @IsOptional()
  @Transform(({ value }): unknown => trimOrUndefined(value))
  @IsString({ message: 'Tên sân không hợp lệ' })
  @Length(MIN_COURT_NAME_LENGTH, MAX_COURT_NAME_LENGTH, {
    message: `Tên sân tối đa ${MAX_COURT_NAME_LENGTH} ký tự`,
  })
  courtName?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Giờ bắt đầu không hợp lệ' })
  startAt?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Giờ kết thúc không hợp lệ' })
  endAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số người tối đa không hợp lệ' })
  @Min(MIN_MAX_PLAYERS, { message: `Số người tối đa phải từ ${MIN_MAX_PLAYERS}` })
  @Max(MAX_MAX_PLAYERS, { message: `Số người tối đa không quá ${MAX_MAX_PLAYERS}` })
  maxPlayers?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: MALE_RATIO_DECIMALS },
    { message: `Hệ số nam tối đa ${MALE_RATIO_DECIMALS} chữ số thập phân` },
  )
  @Min(MIN_MALE_RATIO, { message: `Hệ số nam phải từ ${MIN_MALE_RATIO}` })
  @Max(MAX_MALE_RATIO, { message: `Hệ số nam không quá ${MAX_MALE_RATIO}` })
  maleRatio?: number;

  @IsOptional()
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Ghi chú không hợp lệ' })
  @MaxLength(MAX_MATCH_NOTE_LENGTH, {
    message: `Ghi chú tối đa ${MAX_MATCH_NOTE_LENGTH} ký tự`,
  })
  note?: string;
}

/** Một dòng chi phí. `unitPrice` là ĐƠN GIÁ — thành tiền do BE nhân với `quantity`. */
export class ExpenseLineDto {
  @Transform(({ value }): unknown => trimOrUndefined(value))
  @IsString({ message: 'Tên khoản chi không hợp lệ' })
  @Length(1, MAX_EXPENSE_NAME_LENGTH, {
    message: `Tên khoản chi tối đa ${MAX_EXPENSE_NAME_LENGTH} ký tự`,
  })
  name: string;

  @Type(() => Number)
  @IsInt({ message: 'Số lượng không hợp lệ' })
  @Min(1, { message: 'Số lượng phải từ 1' })
  @Max(MAX_EXPENSE_QUANTITY, { message: `Số lượng không quá ${MAX_EXPENSE_QUANTITY}` })
  quantity: number;

  @Type(() => Number)
  @IsInt({ message: 'Đơn giá phải là số nguyên (đồng)' })
  @Min(0, { message: 'Đơn giá không được âm' })
  @Max(MAX_EXPENSE_UNIT_PRICE, { message: 'Đơn giá quá lớn' })
  unitPrice: number;
}

/**
 * Body của POST /matches/:id/settlement — chốt chi phí.
 *
 * Gửi TOÀN BỘ danh sách chi phí mỗi lần, không patch từng dòng: chốt lại là ghi đè cả bảng,
 * nên nửa danh sách cũ trộn nửa mới là trạng thái không ai muốn có.
 */
export class SettleMatchDto {
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: MALE_RATIO_DECIMALS },
    { message: `Hệ số nam tối đa ${MALE_RATIO_DECIMALS} chữ số thập phân` },
  )
  @Min(MIN_MALE_RATIO, { message: `Hệ số nam phải từ ${MIN_MALE_RATIO}` })
  @Max(MAX_MALE_RATIO, { message: `Hệ số nam không quá ${MAX_MALE_RATIO}` })
  maleRatio: number;

  @IsArray({ message: 'Danh sách chi phí không hợp lệ' })
  @ArrayMinSize(1, { message: 'Cần ít nhất một khoản chi' })
  @ArrayMaxSize(MAX_EXPENSE_LINES, { message: `Tối đa ${MAX_EXPENSE_LINES} khoản chi` })
  @ValidateNested({ each: true })
  @Type(() => ExpenseLineDto)
  expenses: ExpenseLineDto[];
}
