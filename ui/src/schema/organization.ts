import { z } from "zod"
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

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: organizationRoleSchema,
  /** null khi user chỉ là member — chỉ owner được thấy mã để chia sẻ. */
  joinCode: z.string().nullable(),
  joinByCodeEnabled: z.boolean(),
  memberCount: z.number(),
  joinedAt: z.string(),
})

/** GET /organizations */
export const organizationListResponseSchema = envelope(
  z.object({ organizations: z.array(organizationSchema) }),
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

/** Form tạo tổ chức. */
export const createOrganizationFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên tổ chức")
    .min(MIN_ORGANIZATION_NAME_LENGTH, `Tên tổ chức phải từ ${MIN_ORGANIZATION_NAME_LENGTH} ký tự`)
    .max(MAX_ORGANIZATION_NAME_LENGTH, `Tên tổ chức tối đa ${MAX_ORGANIZATION_NAME_LENGTH} ký tự`)
    .transform((value) => value.replace(/\s+/g, " ")),
})

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
