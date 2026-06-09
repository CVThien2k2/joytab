import { apiClient } from "@/api/client"

export type DemoUser = { id: string; email: string; fullName: string }

/**
 * [DEMO] Gọi GET /users nhưng CỐ TÌNH không gửi cookie (withCredentials:false) → BE trả 401.
 * 401 ở endpoint nghiệp vụ (non-/auth) → axios interceptor: AUTH_004 → popup, còn lại → /login.
 * Mô phỏng tình huống đang ở giữa phiên thì 1 client fetch bị 401.
 */
export async function fetchUsersWithoutCookie(): Promise<DemoUser[]> {
  const response = await apiClient.get<{ data: { users: DemoUser[] } }>("/users", {
    withCredentials: false,
  })
  return response.data.data.users
}
