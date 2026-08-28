import { z } from "zod"
import { envelope } from "@/schema/envelope"

/**
 * Mirror của ràng buộc BE (api/src/matches/matches.constants.ts). BE vẫn là nguồn sự thật —
 * validate ở FE chỉ để user thấy lỗi ngay khi gõ. Lệch nhau thì BE thắng.
 */
export const MIN_MAX_PLAYERS = 2
export const MAX_MAX_PLAYERS = 100
export const MIN_MALE_RATIO = 0.1
export const MAX_MALE_RATIO = 10
export const MAX_COURT_NAME_LENGTH = 120
export const MAX_MATCH_NOTE_LENGTH = 500
export const MAX_EXPENSE_LINES = 50
export const MAX_EXPENSE_NAME_LENGTH = 120
export const MAX_EXPENSE_QUANTITY = 9999
export const MAX_EXPENSE_UNIT_PRICE = 100_000_000
/** Không huỷ vote được khi còn dưới ngần này giờ — dùng để giải thích, BE mới là chỗ chặn. */
export const MATCH_CANCEL_LOCK_HOURS = 2
/** Mọi khoản chia cho từng người đều là bội của số này. */
export const MONEY_ROUNDING_UNIT = 1000

export const MATCH_STATUSES = ["open", "settled", "canceled"] as const
export const matchStatusSchema = z.enum(MATCH_STATUSES)

/** Vì sao vote đang đóng; null = đang mở. */
export const voteClosedReasonSchema = z.enum(["full", "started", "canceled"]).nullable()

export const chargePaymentStatusSchema = z.enum(["unpaid", "submitted", "confirmed"])

export const genderSchema = z.enum(["male", "female", "other"])

export const matchSummarySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  /** Chỉ có ở lịch cá nhân (xuyên tổ chức) — chip phải nói rõ trận của tổ chức nào. */
  organizationName: z.string().optional(),
  courtName: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  maxPlayers: z.number(),
  playerCount: z.number(),
  maleRatio: z.number(),
  note: z.string().nullable(),
  status: matchStatusSchema,
  voted: z.boolean(),
  voteClosedReason: voteClosedReasonSchema,
  myAmount: z.number().nullable(),
  myPaymentStatus: chargePaymentStatusSchema.nullable(),
})

export const matchParticipantSchema = z.object({
  userId: z.string(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  gender: genderSchema.nullable(),
  votedAt: z.string(),
})

export const matchDetailSchema = matchSummarySchema.extend({
  participants: z.array(matchParticipantSchema),
  canCancelVote: z.boolean(),
})

export const matchVoteEventSchema = z.object({
  action: z.enum(["join", "cancel"]),
  userId: z.string(),
  fullName: z.string().nullable(),
  createdAt: z.string(),
})

/** Một dòng chi phí. `unitPrice` là ĐƠN GIÁ — thành tiền = quantity × unitPrice. */
export const matchExpenseSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
})

export const matchChargeSchema = z.object({
  userId: z.string(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  gender: genderSchema.nullable(),
  ratio: z.number(),
  amount: z.number(),
  paymentStatus: chargePaymentStatusSchema,
})

export const matchSettlementSchema = z.object({
  matchId: z.string(),
  settled: z.boolean(),
  maleRatio: z.number(),
  expenses: z.array(matchExpenseSchema),
  total: z.number(),
  charges: z.array(matchChargeSchema),
  surplus: z.number(),
  editable: z.boolean(),
})

export const matchListResponseSchema = envelope(z.object({ matches: z.array(matchSummarySchema) }))
export const matchResponseSchema = envelope(z.object({ match: matchSummarySchema }))
export const matchDetailResponseSchema = envelope(z.object({ match: matchDetailSchema }))
export const matchHistoryResponseSchema = envelope(
  z.object({ events: z.array(matchVoteEventSchema) }),
)
export const matchSettlementResponseSchema = envelope(
  z.object({ settlement: matchSettlementSchema }),
)

/** HH:mm — đúng thứ input type="time" trả về. */
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Form tạo/sửa lịch.
 *
 * Một NGÀY + hai GIỜ chứ không hai ô datetime: một buổi đá nằm gọn trong một ngày, bắt người
 * ta chọn ngày hai lần chỉ để hai lần đó luôn giống nhau là bắt làm việc thừa. Cũng vì vậy
 * không có trận qua đêm — giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.
 *
 * `maleRatio` để trống = dùng mặc định của tổ chức, nên nó là chuỗi rỗng chứ không phải 0.
 */
export const matchFormSchema = z
  .object({
    courtName: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập tên sân")
      .max(MAX_COURT_NAME_LENGTH, `Tên sân tối đa ${MAX_COURT_NAME_LENGTH} ký tự`),
    date: z.string().min(1, "Vui lòng chọn ngày"),
    startTime: z.string().regex(TIME_REGEX, "Giờ bắt đầu không hợp lệ"),
    endTime: z.string().regex(TIME_REGEX, "Giờ kết thúc không hợp lệ"),
    maxPlayers: z.coerce
      .number()
      .int("Số người phải là số nguyên")
      .min(MIN_MAX_PLAYERS, `Cần ít nhất ${MIN_MAX_PLAYERS} người`)
      .max(MAX_MAX_PLAYERS, `Tối đa ${MAX_MAX_PLAYERS} người`),
    maleRatio: z
      .string()
      .trim()
      .refine(
        (value) =>
          value === "" ||
          (Number.isFinite(Number(value)) &&
            Number(value) >= MIN_MALE_RATIO &&
            Number(value) <= MAX_MALE_RATIO),
        `Hệ số nam từ ${MIN_MALE_RATIO} đến ${MAX_MALE_RATIO}`,
      ),
    note: z
      .string()
      .trim()
      .max(MAX_MATCH_NOTE_LENGTH, `Ghi chú tối đa ${MAX_MATCH_NOTE_LENGTH} ký tự`),
  })
  .refine((values) => values.endTime > values.startTime, {
    message: "Giờ kết thúc phải sau giờ bắt đầu",
    path: ["endTime"],
  })

/** Một dòng trong bảng chi phí lúc chốt tiền. Số nhập dạng chuỗi vì input trả chuỗi. */
export const expenseLineFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nhập tên khoản chi")
    .max(MAX_EXPENSE_NAME_LENGTH, `Tối đa ${MAX_EXPENSE_NAME_LENGTH} ký tự`),
  quantity: z.coerce
    .number()
    .int("Số lượng phải là số nguyên")
    .min(1, "Số lượng từ 1")
    .max(MAX_EXPENSE_QUANTITY, `Số lượng tối đa ${MAX_EXPENSE_QUANTITY}`),
  unitPrice: z.coerce
    .number()
    .int("Đơn giá phải là số nguyên (đồng)")
    .min(0, "Đơn giá không được âm")
    .max(MAX_EXPENSE_UNIT_PRICE, "Đơn giá quá lớn"),
})

export const settlementFormSchema = z.object({
  maleRatio: z.coerce
    .number()
    .min(MIN_MALE_RATIO, `Hệ số nam từ ${MIN_MALE_RATIO}`)
    .max(MAX_MALE_RATIO, `Hệ số nam tối đa ${MAX_MALE_RATIO}`),
  expenses: z
    .array(expenseLineFormSchema)
    .min(1, "Cần ít nhất một khoản chi")
    .max(MAX_EXPENSE_LINES, `Tối đa ${MAX_EXPENSE_LINES} khoản chi`),
})
