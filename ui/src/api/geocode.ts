import { nominatimSearchResponseSchema } from "@/schema/geocode";
import { VIETNAM_COUNTRY_CODE } from "@/lib/vietnam";
import type { PlaceResult } from "@/types/geo";

/**
 * Nominatim của OpenStreetMap — geocoding miễn phí, không cần API key.
 *
 * CỐ Ý không dùng `apiClient`: instance đó có `withCredentials: true` (sẽ gửi cookie
 * `at`/`rt` sang domain lạ) và interceptor 401 tự `forceLogin()` — một cái 401 từ
 * Nominatim sẽ đăng xuất người dùng oan. Đây là service ngoài nên dùng fetch trần.
 */
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

/** Số kết quả tối đa mỗi lần tìm — đủ cho dropdown, không làm nặng Nominatim. */
const SEARCH_LIMIT = 5;

/** Dưới ngưỡng này thì không gọi API (tránh query rác kiểu 1-2 ký tự). */
export const MIN_SEARCH_LENGTH = 3;

/**
 * Input: Từ khoá tìm kiếm và AbortSignal (huỷ khi người dùng gõ tiếp).
 * Output: Danh sách địa điểm trong phạm vi Việt Nam, đã chuẩn hoá. Throw nếu network
 *         lỗi, HTTP không ok, hoặc response không đúng shape mong đợi.
 *
 * Giới hạn bằng `countrycodes=vn` thay vì `viewbox`+`bounded`: lọc theo quốc gia chính
 * xác hơn lọc theo hình chữ nhật, vì bbox Việt Nam trùm cả một phần Lào và Campuchia.
 *
 * Usage policy của Nominatim yêu cầu ≤1 req/s cho toàn bộ traffic của site — phần
 * ngưỡng ký tự và cache do use-place-search lo.
 */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceResult[]> {
  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(SEARCH_LIMIT));
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("countrycodes", VIETNAM_COUNTRY_CODE);
  // Ưu tiên tên tiếng Việt trong display_name thay vì tên phiên âm/tiếng Anh.
  url.searchParams.set("accept-language", "vi");

  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Nominatim trả về HTTP ${response.status}`);
  }

  const places = nominatimSearchResponseSchema.parse(await response.json());

  return places.map((place) => ({
    id: String(place.place_id),
    label: place.display_name,
    lat: place.lat,
    lng: place.lon,
  }));
}
