import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CHARGE_PAYMENT_STATUSES } from '../payments/payments.constants';
import {
  MALE_RATIO_DECIMALS,
  MATCH_HISTORY_CURSOR_REGEX,
  MATCH_HISTORY_DEFAULT_LIMIT,
  MATCH_HISTORY_MAX_LIMIT,
  MATCH_HISTORY_STATUSES,
  MAX_COURT_NAME_LENGTH,
  MAX_MATCH_ADDRESS_LENGTH,
  MAX_EXPENSE_LINES,
  MAX_EXPENSE_NAME_LENGTH,
  MAX_EXPENSE_QUANTITY,
  MAX_EXPENSE_UNIT_PRICE,
  MAX_MALE_RATIO,
  MATCH_UPCOMING_CURSOR_REGEX,
  MATCH_UPCOMING_DEFAULT_LIMIT,
  MATCH_UPCOMING_MAX_LIMIT,
  ORGANIZATION_HISTORY_SCOPES,
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

/**
 * Ép một giá trị query về mảng.
 *
 * `?status=settled&status=canceled` thì Express đã gom sẵn thành mảng, nhưng gửi đúng MỘT giá
 * trị thì nó là chuỗi trần — mà `@IsIn({ each: true })` trên chuỗi lại xét từng KÝ TỰ.
 */
function toArrayOrUndefined(value: unknown): unknown {
  if (value === undefined) return value;
  return Array.isArray(value) ? value : [value];
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
 * Query của GET /organizations/:organizationId/matches/history.
 *
 * Khác DTO của bộ lịch ở ba chỗ, và cả ba đều vì lịch sử là để CUỘN chứ không phải để xem một
 * kỳ: khoảng ngày không gửi nghĩa là cả quá khứ (không có mặc định quanh hôm nay, không có
 * trần `MATCH_RANGE_MAX_DAYS`), có hai bộ lọc trạng thái, và đi theo `cursor` thay vì số trang.
 */
/**
 * Query của GET /organizations/:organizationId/matches/upcoming.
 *
 * Không có bộ lọc nào: danh sách này luôn là "mọi buổi chưa kết thúc của tổ chức, sớm nhất
 * trước". Muốn lọc thì đó là việc của lịch sử.
 */
export class MatchUpcomingQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số dòng mỗi lô không hợp lệ' })
  @Min(1, { message: 'Số dòng mỗi lô phải từ 1' })
  @Max(MATCH_UPCOMING_MAX_LIMIT, {
    message: `Số dòng mỗi lô tối đa ${MATCH_UPCOMING_MAX_LIMIT}`,
  })
  limit: number = MATCH_UPCOMING_DEFAULT_LIMIT;

  /** Mốc cuộn do lô trước trả về. Xem MATCH_UPCOMING_CURSOR_REGEX. */
  @IsOptional()
  @Matches(MATCH_UPCOMING_CURSOR_REGEX, { message: 'Mốc cuộn không hợp lệ' })
  cursor?: string;
}

export class MatchHistoryQueryDto {
  /** Lọc trên `start_at`, biên nửa mở `[from, to)` — cùng quy ước với bộ lịch. */
  @IsOptional()
  @IsISO8601({}, { message: 'Ngày bắt đầu không hợp lệ' })
  from?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Ngày kết thúc không hợp lệ' })
  to?: string;

  /** Không gửi = cả hai trạng thái của lịch sử. */
  @IsOptional()
  @Transform(({ value }): unknown => toArrayOrUndefined(value))
  @IsArray({ message: 'Trạng thái không hợp lệ' })
  @IsIn(MATCH_HISTORY_STATUSES, { each: true, message: 'Trạng thái không hợp lệ' })
  status?: (typeof MATCH_HISTORY_STATUSES)[number][];

  /**
   * Không gửi = không lọc theo thanh toán.
   *
   * Lọc theo khoản của CHÍNH người hỏi, nên trận mình không tham gia (không có khoản nào) rơi
   * ra ngoài kết quả — nó không "chưa trả", nó không có gì để trả.
   */
  @IsOptional()
  @Transform(({ value }): unknown => toArrayOrUndefined(value))
  @IsArray({ message: 'Trạng thái thanh toán không hợp lệ' })
  @IsIn(CHARGE_PAYMENT_STATUSES, { each: true, message: 'Trạng thái thanh toán không hợp lệ' })
  paymentStatus?: (typeof CHARGE_PAYMENT_STATUSES)[number][];

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số dòng mỗi lô không hợp lệ' })
  @Min(1, { message: 'Số dòng mỗi lô phải từ 1' })
  @Max(MATCH_HISTORY_MAX_LIMIT, {
    message: `Số dòng mỗi lô tối đa ${MATCH_HISTORY_MAX_LIMIT}`,
  })
  limit: number = MATCH_HISTORY_DEFAULT_LIMIT;

  /** Mốc cuộn do lô trước trả về. Xem MATCH_HISTORY_CURSOR_REGEX. */
  @IsOptional()
  @Matches(MATCH_HISTORY_CURSOR_REGEX, { message: 'Mốc cuộn không hợp lệ' })
  cursor?: string;
}

/**
 * Query của GET /organizations/:organizationId/matches/org-history.
 *
 * Gọn hơn `MatchHistoryQueryDto` một cách CÓ CHỦ Ý: không khoảng ngày, không mảng trạng thái,
 * không trạng thái thanh toán — chỉ một lát cắt. Sổ của tổ chức là chỗ chủ tổ chức tìm việc
 * còn treo, mà ba trục lọc cho một câu hỏi như vậy thì hai trục sẽ luôn để trống.
 */
export class OrganizationHistoryQueryDto {
  /** Không gửi = `all`. Xem ORGANIZATION_HISTORY_SCOPES. */
  @IsOptional()
  @IsIn(ORGANIZATION_HISTORY_SCOPES, { message: 'Lát cắt lịch sử không hợp lệ' })
  scope: (typeof ORGANIZATION_HISTORY_SCOPES)[number] = 'all';

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số dòng mỗi lô không hợp lệ' })
  @Min(1, { message: 'Số dòng mỗi lô phải từ 1' })
  @Max(MATCH_HISTORY_MAX_LIMIT, {
    message: `Số dòng mỗi lô tối đa ${MATCH_HISTORY_MAX_LIMIT}`,
  })
  limit: number = MATCH_HISTORY_DEFAULT_LIMIT;

  /** Cùng shape mốc cuộn với lịch sử cá nhân — cùng một kiểu keyset trên (start_at, id). */
  @IsOptional()
  @Matches(MATCH_HISTORY_CURSOR_REGEX, { message: 'Mốc cuộn không hợp lệ' })
  cursor?: string;
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

  @IsOptional()
  @Transform(({ value }): unknown => trimOrUndefined(value))
  @IsString({ message: 'Địa chỉ không hợp lệ' })
  @MaxLength(MAX_MATCH_ADDRESS_LENGTH, {
    message: `Địa chỉ tối đa ${MAX_MATCH_ADDRESS_LENGTH} ký tự`,
  })
  address?: string;

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
  @Transform(({ value }): unknown => trimOrUndefined(value))
  @IsString({ message: 'Địa chỉ không hợp lệ' })
  @MaxLength(MAX_MATCH_ADDRESS_LENGTH, {
    message: `Địa chỉ tối đa ${MAX_MATCH_ADDRESS_LENGTH} ký tự`,
  })
  address?: string;

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

  /**
   * BẬT thì khoản của chủ tổ chức (nếu có tham gia trận) được tạo thẳng ở trạng thái đã trả —
   * không đổi cách chia tiền, chỉ đổi trạng thái khoản đó. FE fill sẵn từ cài đặt tổ chức
   * nhưng owner tự tích/bỏ được ở từng lần chốt. Mặc định TẮT nếu không gửi field, để client
   * cũ (và các lần gọi settlement có sẵn) không phải biết tới field mới này mới chốt được.
   */
  @IsOptional()
  @IsBoolean({ message: 'Giá trị bật/tắt không hợp lệ' })
  skipOwnerPayment: boolean = false;

  @IsArray({ message: 'Danh sách chi phí không hợp lệ' })
  @ArrayMinSize(1, { message: 'Cần ít nhất một khoản chi' })
  @ArrayMaxSize(MAX_EXPENSE_LINES, { message: `Tối đa ${MAX_EXPENSE_LINES} khoản chi` })
  @ValidateNested({ each: true })
  @Type(() => ExpenseLineDto)
  expenses: ExpenseLineDto[];
}
