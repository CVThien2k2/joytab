import type { GeoPoint } from "@/types/geo";

/** Bán kính trung bình Trái Đất (km) — hằng số chuẩn của công thức haversine. */
const EARTH_RADIUS_KM = 6371;

/**
 * Input: Góc theo độ.
 * Output: Góc theo radian.
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Input: Hai điểm có lat/lng (độ).
 * Output: Khoảng cách great-circle (km) theo công thức haversine — tức đường
 *         chim bay trên mặt cầu, KHÔNG phải quãng đường đi theo đường bộ.
 */
export function haversineDistanceKm(
  from: Pick<GeoPoint, "lat" | "lng">,
  to: Pick<GeoPoint, "lat" | "lng">,
): number {
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Input: Khoảng cách (km).
 * Output: Chuỗi hiển thị — dưới 1 km thì quy ra mét cho dễ đọc.
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(2)} km`;
}

/**
 * Input: Thời lượng (phút).
 * Output: Chuỗi hiển thị — dưới 1 giờ thì chỉ phút, từ 1 giờ trở lên thì "1 giờ 20 phút".
 */
export function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) {
    return `${rounded} phút`;
  }

  const hours = Math.floor(rounded / 60);
  const restMinutes = rounded % 60;
  return restMinutes === 0 ? `${hours} giờ` : `${hours} giờ ${restMinutes} phút`;
}

/**
 * Input: Toạ độ.
 * Output: Chuỗi lat, lng rút gọn 5 chữ số thập phân (~1 m độ phân giải).
 */
export function formatCoords(point: Pick<GeoPoint, "lat" | "lng">): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}
