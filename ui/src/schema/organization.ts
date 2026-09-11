import { z } from "zod"
import { bankAccountFormSchema } from "@/schema/bank"
import { envelope } from "@/schema/envelope"

/** Khớp ORGANIZATION_ROLES ở BE (api/src/organizations/organizations.constants.ts). */
export const ORGANIZATION_ROLES = ["owner", "member"] as const

export const organizationRoleSchema = z.enum(ORGANIZATION_ROLES)

/**
 * Mirror của ràng buộc BE (api/src/organizations/organizations.constants.ts). BE vẫn là nguồn
 * sự thật — validate lại ở FE chỉ để user thấy lỗi ngay khi gõ. Lệch nhau thì BE thắng.
 */
export const MIN_ORGANIZATION_NAME_LENGTH = 2
export const MAX_ORGANIZATION_NAME_LENGTH = 100
export const JOIN_CODE_LENGTH = 8

/** Mã tham gia SAU khi chuẩn hoá: Crockford base32 (thiếu I, L, O, U). */
export const JOIN_CODE_REGEX = /^[0-9A-HJKMNP-TV-Z]{8}$/

/**
 * Input: Mã user gõ vào — cho phép chữ thường, khoảng trắng, gạch nối.
 * Output: Mã in hoa, bỏ ký tự phân cách, giải nhầm lẫn O→0 và I/L→1.
 *         Cùng thuật toán với normalizeJoinCode ở BE.
 */
export function normalizeJoinCode(value: string): string {
  return value
    .replace(/[\s\-_.]/g, "")
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
}

/**
 * Tài khoản nhận tiền của tổ chức, BE đã tra sẵn tên ngân hàng từ danh sách VietQR.
 * Mirror của `BankAccount` ở BE (api/src/common/utils/types.ts).
 *
 * `bankShortName` lùi về chính `bin` khi BE tra hụt, nên chỗ hiển thị luôn có gì đó để in ra.
 */
export const bankAccountSchema = z.object({
  bin: z.string(),
  accountNo: z.string(),
  bankCode: z.string(),
  bankShortName: z.string(),
  bankName: z.string(),
  bankLogo: z.string(),
})

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: organizationRoleSchema,
  /** null khi user chỉ là member — chỉ owner được thấy mã để chia sẻ. */
  joinCode: z.string().nullable(),
  joinByCodeEnabled: z.boolean(),
  memberCount: z.number(),
  /** Tài khoản nhận tiền; null = owner chưa cấu hình. Member cũng thấy — họ là người quét. */
  bankAccount: bankAccountSchema.nullable(),
  /** Hệ số nam mặc định cho trận mới (nữ là mốc 1). */
  maleRatio: z.number(),
  /** Giá trị fill sẵn cho ô tích ở màn chốt chi phí — xem settlementFormSchema.skipOwnerPayment. */
  skipOwnerPayment: z.boolean(),
  joinedAt: z.string(),
})

/** GET /organizations */
export const organizationListResponseSchema = envelope(
  z.object({
    organizations: z.array(organizationSchema),
    /**
     * Tổ chức xem lần gần nhất — BE đọc hộ từ cookie `org` (httpOnly nên JS không với tới) và
     * đã đối chiếu với danh sách này. `null` khi user chưa thuộc tổ chức nào.
     */
    activeOrganizationId: z.string().nullable(),
  }),
)

/** POST /organizations/active — trả lại đúng id vừa ghi vào cookie. */
export const activeOrganizationResponseSchema = envelope(
  z.object({ activeOrganizationId: z.string() }),
)

/**
 * GET /organizations/by-code/:code — thông tin tối thiểu để dựng màn hình link mời. Không có
 * `id` lẫn `joinCode`: người đang xem chưa phải thành viên.
 */
export const organizationPreviewSchema = z.object({
  name: z.string(),
  memberCount: z.number(),
  alreadyMember: z.boolean(),
})

export const organizationPreviewResponseSchema = envelope(
  z.object({ organization: organizationPreviewSchema }),
)

/** POST /organizations và POST /organizations/join dùng chung shape này. */
export const organizationResponseSchema = envelope(z.object({ organization: organizationSchema }))

/**
 * Một thành viên trong danh sách thành viên. `userId` là id user (không phải id row
 * membership) — FE so với user đang đăng nhập để đánh dấu "Bạn".
 */
export const organizationMemberSchema = z.object({
  userId: z.string(),
  fullName: z.string().nullable(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  role: organizationRoleSchema,
  joinedAt: z.string(),
})

/**
 * Meta phân trang của BE (common/utils/types.ts) — `page` đếm từ 1, `totalPages` tối thiểu 1
 * kể cả khi không tìm ra ai, nên FE luôn có một trang để hiện.
 */
export const paginationSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  totalItems: z.number(),
  totalPages: z.number(),
})

/** GET /organizations/:id/members?page&pageSize&q */
export const organizationMemberListResponseSchema = envelope(
  z.object({
    members: z.array(organizationMemberSchema),
    pagination: paginationSchema,
  }),
)

/** Ràng buộc hệ số nam, mirror của BE (api/src/matches/matches.constants.ts). */
export const MIN_MALE_RATIO = 0.1
export const MAX_MALE_RATIO = 10

/**
 * Hệ số của tổ chức mới. Trùng với `@default(1.0)` của cột `male_ratio` trong schema.prisma —
 * form tạo phải fill sẵn đúng giá trị BE sẽ tự đặt, để người bỏ qua ô này và người gõ tay
 * "1" nhận về cùng một tổ chức.
 */
export const DEFAULT_MALE_RATIO = 1

/**
 * Ô hệ số nhận CHUỖI (input trả chuỗi) rồi mới ép số, nên `z.input` khác `z.output` — form
 * dùng hệ số phải khai riêng hai kiểu này.
 */
export const maleRatioSchema = z.coerce
  .number()
  .min(MIN_MALE_RATIO, `Hệ số nam từ ${MIN_MALE_RATIO}`)
  .max(MAX_MALE_RATIO, `Hệ số nam tối đa ${MAX_MALE_RATIO}`)

/** Chỉ phần tên, tách riêng để form sửa tổ chức dùng lại cùng một ràng buộc. */
export const organizationNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên tổ chức")
    .min(MIN_ORGANIZATION_NAME_LENGTH, `Tên tổ chức phải từ ${MIN_ORGANIZATION_NAME_LENGTH} ký tự`)
    .max(MAX_ORGANIZATION_NAME_LENGTH, `Tên tổ chức tối đa ${MAX_ORGANIZATION_NAME_LENGTH} ký tự`)
    .transform((value) => value.replace(/\s+/g, " ")),
})

/**
 * Form tạo tổ chức: tên + tài khoản nhận tiền + hệ số nam + "chủ tổ chức đã ứng tiền".
 *
 * Hỏi cả bốn ngay ở màn tạo vì đó là những thứ người lập nhóm đã quyết trong đầu rồi ("tiền
 * vào tài khoản nào, nam đóng gấp mấy, tôi có ứng trước không"). Chỉ TÊN là bắt buộc — ba thứ
 * còn lại bỏ trống được và sửa sau ở màn cài đặt.
 *
 * `z.intersection` chứ không `.extend`: `bankAccountFormSchema` có `superRefine` nên nó là
 * ZodEffects, mà ZodEffects thì không `.extend` được.
 */
export const createOrganizationFormSchema = z.intersection(
  organizationNameSchema.extend({
    maleRatio: maleRatioSchema,
    skipOwnerPayment: z.boolean(),
  }),
  bankAccountFormSchema,
)

/**
 * Bốn con số của trang chủ, đều là của CHÍNH người đang đăng nhập.
 * Mirror của `OrganizationOverview` ở BE (api/src/common/utils/types.ts).
 */
export const organizationOverviewSchema = z.object({
  unpaidTotal: z.number(),
  unpaidCount: z.number(),
  paidTotal: z.number(),
  playedCount: z.number(),
  /** Của cả tổ chức, kể cả buổi mình chưa đăng ký — xem chú thích ở BE. */
  upcomingCount: z.number(),
})

export const organizationOverviewResponseSchema = envelope(
  z.object({ overview: organizationOverviewSchema }),
)

/**
 * Form sửa tổ chức: ĐÚNG BẰNG form tạo.
 *
 * Cố ý là một bí danh chứ không phải một schema riêng: hai màn hỏi cùng bốn thứ, viết lại
 * ràng buộc lần hai chỉ mở đường cho chúng lệch nhau (một bên cho số tài khoản 24 ký tự, bên
 * kia 20, và không ai phát hiện cho tới lúc owner sửa xong thì không lưu được).
 *
 * Giữ tên riêng vì hai form là hai ý định khác nhau — nếu sau này màn sửa hỏi thêm thứ màn tạo
 * không hỏi, chỗ cần đổi đã có sẵn ở đây.
 */
export const editOrganizationFormSchema = createOrganizationFormSchema

/**
 * Form tham gia bằng mã. Chuẩn hoá NGAY trong schema để payload gửi BE đúng thứ FE đã
 * validate — user gõ "seed-0001" thì BE nhận "SEED0001".
 */
export const joinOrganizationFormSchema = z.object({
  joinCode: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập mã tham gia")
    .transform(normalizeJoinCode)
    .refine(
      (value) => JOIN_CODE_REGEX.test(value),
      `Mã tham gia gồm ${JOIN_CODE_LENGTH} ký tự chữ và số`,
    ),
})
