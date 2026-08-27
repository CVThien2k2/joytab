"use server"

import { cookies } from "next/headers"
import {
  ACTIVE_ORGANIZATION_COOKIE,
  ACTIVE_ORGANIZATION_COOKIE_MAX_AGE,
} from "@/api/organizations.server"

/**
 * Input: id tổ chức user vừa chuyển sang.
 * Output: Ghi cookie nhớ lựa chọn đó cho lần vào `/` sau. Không trả về gì, không điều hướng —
 *         điều hướng là việc của component gọi (router.push), tách ra để nút chuyển tổ chức
 *         không phải chờ round-trip mới bắt đầu chuyển trang nếu sau này muốn.
 *
 *         Phải là server action chứ không viết thẳng trong layout/page: `cookies().set` chỉ
 *         gọi được từ server action hoặc route handler — lúc render thì response đã chốt.
 *
 *         KHÔNG kiểm tra user có thuộc tổ chức này hay không: cookie chỉ ảnh hưởng đích của
 *         redirect ở `/`, và ở đó id luôn được đối chiếu lại với danh sách thật từ BE. Ghi id
 *         rác vào đây thì tệ nhất là redirect rơi về tổ chức đầu tiên.
 */
export async function setActiveOrganization(organizationId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ACTIVE_ORGANIZATION_COOKIE_MAX_AGE,
  })
}
