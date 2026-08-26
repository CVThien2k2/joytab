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

/** POST /organizations và POST /organizations/join dùng chung shape này. */
export const organizationResponseSchema = envelope(
  z.object({ organization: organizationSchema }),
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
