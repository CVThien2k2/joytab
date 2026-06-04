import FingerprintJS, { type Agent } from "@fingerprintjs/fingerprintjs"

const DEVICE_FINGERPRINT_FALLBACK_KEY = "joytab-device-fingerprint"

// Khởi tạo agent một lần và tái sử dụng cho mọi lần lấy fingerprint.
let agentPromise: Promise<Agent> | null = null

/**
 * Input: Không nhận tham số.
 * Output: Promise agent FingerprintJS đã load, dùng chung toàn app.
 */
function getAgent(): Promise<Agent> {
  agentPromise ??= FingerprintJS.load()
  return agentPromise
}

/**
 * Input: Không nhận tham số; đọc/ghi localStorage trên client.
 * Output: UUID dự phòng ổn định khi FingerprintJS không lấy được visitorId.
 */
function getFallbackFingerprint(): string {
  if (typeof window === "undefined") {
    return ""
  }

  const existing = window.localStorage.getItem(DEVICE_FINGERPRINT_FALLBACK_KEY)
  if (existing) {
    return existing
  }

  const fallback = crypto.randomUUID()
  window.localStorage.setItem(DEVICE_FINGERPRINT_FALLBACK_KEY, fallback)
  return fallback
}

/**
 * Input: Không nhận tham số; chạy trên client.
 * Output: visitorId từ FingerprintJS; nếu lỗi thì trả UUID dự phòng từ localStorage.
 */
export async function getDeviceFingerprint(): Promise<string> {
  try {
    const agent = await getAgent()
    const result = await agent.get()
    return result.visitorId
  } catch {
    return getFallbackFingerprint()
  }
}
