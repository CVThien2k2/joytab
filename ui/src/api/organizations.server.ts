import { cookies } from "next/headers"
import { organizationListResponseSchema } from "@/schema/organization"
import type { Organization } from "@/types/organization"

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
      return {
        organizations: null,
        error: `GET ${API_BASE_URL}/organizations → ${response.status}`,
      }
    }
    const parsed = organizationListResponseSchema.parse(await response.json())
    return { organizations: parsed.data.organizations, error: null }
  } catch (err) {
    return { organizations: null, error: describeError(err) }
  }
}

/**
 * Input: Lỗi bất kỳ từ fetch/zod.
 * Output: Chuỗi có kèm `cause` — fetch của undici chỉ trả "fetch failed", nguyên nhân thật
 *         (ECONNREFUSED khi BE chưa chạy) nằm trong cause.
 */
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const cause = err.cause
  if (cause instanceof Error) return `${err.message} (${cause.message})`
  return err.message
}
