import axios from "axios"
import type { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:9000"

/** Endpoint refresh — không bao giờ được tự refresh lại chính nó (vòng lặp vô hạn). */
const REFRESH_URL = "/auth/refresh"

/**
 * Endpoint KHÔNG xoay token khi 401 và KHÔNG bị đá về /logout:
 *  - /auth/refresh: xoay chính nó thì thành vòng lặp; refresh fail là caller tự quyết.
 *  - /auth/logout: 401 ở đây là chuyện bình thường (phiên đã chết) và nó đang được gọi TỪ
 *    trang /logout — đá về /logout nữa là tự nạp lại trang đó mãi không thôi.
 */
const NO_RETRY_URLS = [REFRESH_URL, "/auth/logout"]

/** Access token hết hạn — mã DUY NHẤT đáng để thử refresh. */
const ACCESS_TOKEN_EXPIRED_CODE = "AUTH_005"

/** Đánh dấu request đã retry sau refresh, để không retry lần hai. */
type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

/**
 * Input: Không nhận input runtime; dùng NEXT_PUBLIC_API_BASE_URL.
 * Output: axios instance dùng chung — luôn gửi kèm cookie `at`/`rt` (withCredentials).
 *
 * Xử lý 401 — đây là chỗ DUY NHẤT lo việc token còn hạn hay không (proxy chỉ đọc cookie để
 * định hướng, không gọi BE):
 *  - code AUTH_005 (AT hết hạn) → gọi /auth/refresh rồi retry đúng request đó một lần.
 *  - code khác (AUTH_001 token rác/thiếu, AUTH_006 RT chết) → về /logout.
 *  - /auth/refresh và /auth/logout: xem NO_RETRY_URLS.
 */
function createApiClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    withCredentials: true,
  })

  /**
   * Promise refresh đang bay (single-flight).
   *
   * Nhiều request song song cùng nhận 401 sẽ cùng await một promise thay vì mỗi cái gọi
   * /auth/refresh một lần. Bắt buộc phải vậy vì refresh token xoay vòng: hai lần refresh
   * đồng thời thì lần thứ hai dùng RT đã bị revoke → BE coi là token reuse và revoke sạch
   * toàn bộ token của user, đăng xuất oan.
   */
  let refreshPromise: Promise<void> | null = null

  /**
   * Input: Không nhận tham số.
   * Output: Gọi /auth/refresh đúng một lần cho mọi caller đồng thời.
   */
  function refreshOnce(): Promise<void> {
    refreshPromise ??= instance
      .post(REFRESH_URL)
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null
      })
    return refreshPromise
  }

  /** Đã kết luận phiên chết thì thôi thử lại, khỏi nạp lại trang nhiều lần. */
  let sessionEnded = false

  /**
   * Input: Không nhận tham số.
   * Output: Đưa browser về /logout bằng full page load.
   *
   * KHÔNG đi thẳng /login: `rt` lúc này có thể vẫn còn trong browser (nó chết ở phía BE chứ
   * không phải hết hạn ở client), mà gác cổng thấy còn `rt` là đá /login về `/` → quay lại
   * đúng trang vừa lỗi và lặp vô tận. /logout cắt cookie trước rồi mới sang /login.
   *
   * Không xoá store ở đây: store tạo theo request qua context (không còn instance toàn cục để
   * với tới từ ngoài React), và full page load thì cũng dựng lại store từ đầu.
   */
  function endSession(): void {
    if (sessionEnded || typeof window === "undefined") return
    sessionEnded = true
    window.location.href = "/logout"
  }

  instance.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (!axios.isAxiosError(error) || error.response?.status !== 401) {
        return Promise.reject(error)
      }

      const config = error.config as RetriableConfig | undefined
      const url = config?.url ?? ""

      if (NO_RETRY_URLS.some((path) => url.includes(path))) {
        return Promise.reject(error)
      }

      const code = (error.response.data as { code?: string } | undefined)?.code
      if (code !== ACCESS_TOKEN_EXPIRED_CODE) {
        endSession()
        return Promise.reject(error)
      }

      if (!config || config._retried) {
        endSession()
        return Promise.reject(error)
      }

      try {
        await refreshOnce()
      } catch {
        endSession()
        return Promise.reject(error)
      }

      config._retried = true
      return instance.request(config as AxiosRequestConfig)
    },
  )

  return instance
}

export const apiClient = createApiClient()
