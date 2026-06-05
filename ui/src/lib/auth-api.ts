import { z } from "zod"
import { apiClient } from "@/lib/api-client"
import { refreshDataSchema } from "@/lib/auth-callback"

/**
 * Input: Schema cho phần `data` của response.
 * Output: Schema bọc theo envelope chuẩn { success, message, data } của BE.
 */
function envelope<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    message: z.string(),
    data: dataSchema,
  })
}

const accountSchema = z.object({
  userId: z.string(),
  email: z.string(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isActive: z.boolean(),
})

const userSchema = z.object({
  provider: z.literal("google"),
  providerUserId: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
})

const accountsResponseSchema = envelope(
  z.object({ accounts: z.array(accountSchema) }),
)

const deviceSchema = z.object({
  sessionId: z.string(),
  deviceId: z.string(),
  deviceName: z.string().nullable(),
  platform: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
  createdAt: z.string(),
})

const devicesResponseSchema = envelope(
  z.object({ devices: z.array(deviceSchema) }),
)

const accountStatusSchema = z.object({
  accountId: z.string(),
  needsRelogin: z.boolean(),
})

const accountsStatusResponseSchema = envelope(
  z.object({ accounts: z.array(accountStatusSchema) }),
)

const refreshResponseSchema = envelope(refreshDataSchema)
const meResponseSchema = envelope(
  z.object({
    userId: z.string(),
    user: userSchema,
  }),
)

export type DeviceAccount = z.infer<typeof accountSchema>
export type DeviceSession = z.infer<typeof deviceSchema>
export type AccountStatus = z.infer<typeof accountStatusSchema>
export type CurrentUser = z.infer<typeof meResponseSchema>["data"]

/**
 * Input: accountId của account hiện tại cần refresh token.
 * Output: userId, accessToken mới và thời điểm hết hạn.
 */
export async function refreshAccount(accountId: string) {
  const response = await apiClient.post("/auth/refresh", { accountId }, { withCredentials: true })
  return refreshResponseSchema.parse(response.data).data
}

/**
 * Input: accountId của account cần logout.
 * Output: Revoke session của account đó ở BE và clear refresh cookie tương ứng.
 */
export async function logoutAccount(accountId: string): Promise<void> {
  await apiClient.post("/auth/logout", { accountId }, { withCredentials: true })
}

/**
 * Input: accountId của account đang active.
 * Output: Danh sách account đã link với thiết bị hiện tại.
 */
export async function fetchAccounts(accountId: string): Promise<DeviceAccount[]> {
  const response = await apiClient.get("/auth/accounts", {
    params: { accountId },
    withCredentials: true,
  })
  return accountsResponseSchema.parse(response.data).data.accounts
}

/**
 * Input: Không nhận tham số; browser tự đính kèm mọi cookie rt_<accountId>.
 * Output: Trạng thái relogin cho từng account browser đang giữ — read-only, không rotate/revoke ở BE.
 *         Chỉ trả account có cookie hợp lệ nên không lộ account người khác.
 */
export async function fetchAccountsStatus(): Promise<AccountStatus[]> {
  const response = await apiClient.post("/auth/accounts/status", undefined, { withCredentials: true })
  return accountsStatusResponseSchema.parse(response.data).data.accounts
}

/**
 * Input: Không nhận tham số; dùng access token (Bearer) đã gắn ở interceptor.
 * Output: Danh sách thiết bị/phiên của user hiện tại.
 */
export async function fetchDevices(): Promise<DeviceSession[]> {
  const response = await apiClient.get("/auth/devices")
  return devicesResponseSchema.parse(response.data).data.devices
}

/**
 * Input: Không nhận tham số; dùng access token của account active qua interceptor.
 * Output: Thông tin user hiện tại từ BE.
 */
export async function fetchMe(): Promise<CurrentUser> {
  const response = await apiClient.get("/auth/me")
  return meResponseSchema.parse(response.data).data
}

/**
 * Input: sessionId của phiên cần thu hồi.
 * Output: Revoke phiên đó ở BE nếu thuộc về user hiện tại.
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/auth/sessions/${sessionId}`)
}
