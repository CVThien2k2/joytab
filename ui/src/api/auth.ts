import { apiClient } from "@/api/client"
import {
  devicesResponseSchema,
  meResponseSchema,
} from "@/schema/auth"
import type { CurrentUser, DeviceSession } from "@/types/auth"

/**
 * Input: Không nhận tham số; dùng cookie session_id hiện tại.
 * Output: Đăng xuất account đang active — BE revoke session + xoá cookie session_id (giữ device_id).
 */
export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout")
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
