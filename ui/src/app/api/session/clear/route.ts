import { NextResponse } from "next/server"

/** Cookie phiên do BE ghi (api/src/auth/auth.constants.ts) — xoá phải khớp cả tên và path. */
const SESSION_COOKIES = ["at", "rt", "onb"]

/**
 * Input: Không nhận gì.
 * Output: 204 kèm Set-Cookie xoá cookie phiên NGAY TẠI WEB, không đi qua BE.
 *
 *         `at`/`rt`/`onb` đều httpOnly nên JS không xoá được, chỉ server xoá được. BE chết thì
 *         /auth/logout hỏng, cookie còn nguyên, và gác cổng cứ đá /login về `/` → người dùng
 *         không bao giờ ra được trang đăng nhập. Lượt này là đường cắt phiên không phụ thuộc
 *         BE; thu hồi refresh token ở server vẫn là việc của /auth/logout (gọi trước).
 *
 *         KHÔNG xoá cookie `org` (nhớ tổ chức xem lần gần nhất): nó không phải cookie phiên,
 *         và BE luôn đối chiếu lại với danh sách thật trước khi dùng.
 *
 *         `COOKIE_DOMAIN` phải khớp BE (nơi set cookie) — lệch là xoá không ăn. Ở dev không
 *         set thì cookie là host-only, cũng khớp vì BE cũng không set.
 */
export async function POST(): Promise<NextResponse> {
  const response = new NextResponse(null, { status: 204 })
  const domain = process.env.COOKIE_DOMAIN?.trim() || undefined

  for (const name of SESSION_COOKIES) {
    response.cookies.set({ name, value: "", path: "/", domain, maxAge: 0 })
  }

  return response
}
