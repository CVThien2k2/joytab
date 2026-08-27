import { cookies } from "next/headers"
import {
  organizationListResponseSchema,
  organizationMemberListResponseSchema,
  organizationPreviewResponseSchema,
} from "@/schema/organization"
import type {
  Organization,
  OrganizationMember,
  OrganizationPreview,
} from "@/types/organization"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:9000"

/** Mảng rỗng là kết quả HỢP LỆ (chưa vào tổ chức nào), khác hoàn toàn với `error`. */
export type OrganizationListResult =
  | { organizations: Organization[]; error: null }
  | { organizations: null; error: string }

/**
 * Input: Không nhận tham số; đọc cookie của request hiện tại.
 * Output: Danh sách tổ chức của user, cũ nhất trước. CHỈ chạy trên Next server (dùng
 *         next/headers) nên cookie httpOnly phải forward tay.
 *         Không throw: page cần hiện lý do lỗi chứ không cần error boundary.
 */
export async function fetchOrganizations(): Promise<OrganizationListResult> {
  const cookieStore = await cookies()
  try {
    const response = await fetch(`${API_BASE_URL}/organizations`, {
      headers: { cookie: cookieStore.toString() },
      cache: "no-store",
    })
    if (!response.ok) {
      const code = await readErrorCode(response)
      return { organizations: null, error: `Không tải được danh sách tổ chức (${code})` }
    }
    const parsed = organizationListResponseSchema.parse(await response.json())
    return { organizations: parsed.data.organizations, error: null }
  } catch (err) {
    return { organizations: null, error: describeError(err) }
  }
}

export type OrganizationMemberListResult =
  | { members: OrganizationMember[]; error: null }
  | { members: null; error: string }

/**
 * Input: id tổ chức.
 * Output: Danh sách thành viên, owner trước. Không bao giờ rỗng khi thành công — người đang
 *         hỏi cũng nằm trong đó, nên mảng rỗng ở đây là dấu hiệu BE sai chứ không phải
 *         trạng thái hợp lệ (khác hẳn fetchOrganizations).
 *
 *         BE trả 404 (ORG_001) cho cả "không có tổ chức đó" lẫn "bạn không phải thành viên" —
 *         hai trường hợp này với người dùng là một: đường dẫn không dành cho họ.
 */
export async function fetchOrganizationMembers(
  organizationId: string,
): Promise<OrganizationMemberListResult> {
  const cookieStore = await cookies()
  try {
    const response = await fetch(
      `${API_BASE_URL}/organizations/${encodeURIComponent(organizationId)}/members`,
      { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
    )
    if (!response.ok) {
      const code = await readErrorCode(response)
      return { members: null, error: `Không tải được danh sách thành viên (${code})` }
    }
    const parsed = organizationMemberListResponseSchema.parse(await response.json())
    return { members: parsed.data.members, error: null }
  } catch (err) {
    return { members: null, error: describeError(err) }
  }
}

/**
 * Tên cookie ghi nhớ tổ chức user xem lần gần nhất. Chỉ là BỘ NHỚ, không phải nguồn sự thật:
 * trang đang xem luôn do `/orgs/[orgId]` trên URL quyết định, nên hai tab mở hai tổ chức vẫn
 * chạy đúng. Cookie chỉ được đọc đúng một chỗ: lúc vào `/` để biết đưa user về đâu.
 */
export const ACTIVE_ORGANIZATION_COOKIE = "org"

/** Một năm — chọn tổ chức là thói quen dài hạn, không phải trạng thái của một phiên. */
export const ACTIVE_ORGANIZATION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/**
 * Input: Không nhận tham số; đọc cookie của request hiện tại.
 * Output: id tổ chức xem lần gần nhất, hoặc null nếu chưa từng chọn.
 *         KHÔNG kiểm tra id còn hợp lệ hay không — người gọi phải đối chiếu với danh sách
 *         thật, vì user có thể đã rời tổ chức đó từ máy khác.
 */
export async function readActiveOrganizationId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value ?? null
}

/** Mã lỗi nghiệp vụ của BE cho "mã sai hoặc tổ chức đang đóng cửa" (api ERROR_CODES.ORG_002). */
export const JOIN_CODE_UNUSABLE_CODE = "ORG_002"

/**
 * `unusable` tách riêng khỏi `error`: mã sai/tổ chức đóng cửa là kết quả BÌNH THƯỜNG của một
 * link mời cũ, phải hiện màn hình giải thích tử tế; còn `error` là BE chết/parse hỏng.
 */
export type OrganizationPreviewResult =
  | { preview: OrganizationPreview; unusable: false; error: null }
  | { preview: null; unusable: true; error: null }
  | { preview: null; unusable: false; error: string }

/**
 * Input: Mã tham gia lấy từ URL của link mời.
 * Output: Tên + số thành viên của tổ chức để dựng màn hình xác nhận.
 *
 *         Chạy trên Next server nên phải forward cookie tay, giống fetchOrganizations. Proxy
 *         đã chặn request không đăng nhập trước khi tới đây, nên 401 ở đây là phiên vừa chết.
 */
export async function fetchOrganizationPreview(
  joinCode: string,
): Promise<OrganizationPreviewResult> {
  const cookieStore = await cookies()
  try {
    const response = await fetch(
      `${API_BASE_URL}/organizations/by-code/${encodeURIComponent(joinCode)}`,
      { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
    )
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { code?: string } | null
      // 400 = mã sai định dạng ngay từ URL: với người dùng thì cũng chỉ là link hỏng.
      if (body?.code === JOIN_CODE_UNUSABLE_CODE || response.status === 400) {
        return { preview: null, unusable: true, error: null }
      }
      return {
        preview: null,
        unusable: false,
        error: `Không tải được thông tin lời mời (${body?.code ?? response.status})`,
      }
    }
    const parsed = organizationPreviewResponseSchema.parse(await response.json())
    return { preview: parsed.data.organization, unusable: false, error: null }
  } catch (err) {
    return { preview: null, unusable: false, error: describeError(err) }
  }
}

/**
 * Input: Response lỗi từ BE.
 * Output: Mã lỗi nghiệp vụ (vd AUTH_001) để hiện kèm câu tiếng Việt; không đọc được thì lấy
 *         HTTP status. Người dùng đọc câu chữ, còn mã là thứ để đối chiếu với log.
 */
async function readErrorCode(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { code?: string } | null
  return body?.code ?? String(response.status)
}

/**
 * Input: Lỗi bất kỳ từ fetch/zod.
 * Output: Chuỗi có kèm `cause` — fetch của undici chỉ trả "fetch failed", nguyên nhân thật
 *         (ECONNREFUSED khi BE chưa chạy) nằm trong cause.
 */
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return `Không gọi được máy chủ: ${String(err)}`
  const cause = err.cause
  if (cause instanceof Error) return `Không gọi được máy chủ: ${err.message} (${cause.message})`
  return `Không gọi được máy chủ: ${err.message}`
}
