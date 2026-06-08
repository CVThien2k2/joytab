import { apiClient } from "@/api/client"
import {
  accountsResponseSchema,
  devicesResponseSchema,
  meResponseSchema,
  switchResponseSchema,
} from "@/schema/auth"
import type { CurrentUser, DeviceAccount, DeviceSession } from "@/types/auth"

/**
 * Input: Không nhận tham số; dùng cookie session_id hiện tại.
 * Output: Đăng xuất account đang active — BE revoke session + xoá cookie session_id (giữ device_id).
 */
export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout")
}

/**
 * Input: userId của account muốn chuyển sang (đã link trên thiết bị này).
 * Output: BE set lại cookie session_id sang account đó nếu còn phiên sống; ném lỗi (401) nếu cần đăng nhập lại.
 */
export async function switchAccount(userId: string): Promise<void> {
  const response = await apiClient.post("/auth/switch", { userId })
  switchResponseSchema.parse(response.data)
}

/**
 * Input: Không nhận tham số; dùng cookie device_id.
 * Output: Danh sách account đã đăng nhập trên thiết bị này kèm cờ needsRelogin.
 */
export async function fetchAccounts(): Promise<DeviceAccount[]> {
  const response = await apiClient.get("/auth/accounts")
  return accountsResponseSchema.parse(response.data).data.accounts
}

/**
 * Input: Không nhận tham số; dùng cookie session_id.
 * Output: Thông tin user của account đang active.
 */
export async function fetchMe(): Promise<CurrentUser> {
  const response = await apiClient.get("/auth/me")
  return meResponseSchema.parse(response.data).data
}

/**
 * Input: Không nhận tham số; dùng cookie session_id.
 * Output: Danh sách thiết bị/phiên của user hiện tại.
 */
export async function fetchDevices(): Promise<DeviceSession[]> {
  const response = await apiClient.get("/auth/devices")
  return devicesResponseSchema.parse(response.data).data.devices
}

/**
 * Input: sessionId của phiên cần thu hồi.
 * Output: Revoke phiên đó ở BE nếu thuộc về user hiện tại.
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/auth/sessions/${sessionId}`)
}
