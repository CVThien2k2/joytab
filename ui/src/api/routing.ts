import {
  decodePolyline,
  VALHALLA_POLYLINE_PRECISION,
  type LatLngTuple,
} from "@/lib/polyline";
import {
  valhallaErrorSchema,
  valhallaRouteResponseSchema,
} from "@/schema/routing";
import type { GeoPoint, RouteResult, TravelMode } from "@/types/geo";

/**
 * Valhalla công khai của FOSSGIS — routing theo mạng đường bộ, miễn phí, không cần key.
 *
 * Vì sao KHÔNG dùng server demo của OSRM: server đó bỏ qua profile trong URL, `driving`
 * / `bike` / `foot` trả về y hệt một kết quả (đã kiểm chứng), tức nút chọn phương tiện
 * sẽ là nút giả. Valhalla có costing model riêng cho từng phương tiện nên số liệu khác
 * nhau thật.
 *
 * Đây là hạ tầng cộng đồng theo fair-use, đúng cho demo. Lên production cần self-host
 * Valhalla/OSRM hoặc chuyển sang provider có hợp đồng (OpenRouteService, GraphHopper).
 */
const VALHALLA_ROUTE_URL = "https://valhalla1.openstreetmap.de/route";

/** Nhãn tiếng Việt của từng phương tiện, dùng cho UI và thông báo lỗi. */
export const TRAVEL_MODE_LABEL: Record<TravelMode, string> = {
  auto: "Ô tô",
  bicycle: "Xe đạp",
  pedestrian: "Đi bộ",
};

/**
 * Lỗi Valhalla trả về có ý nghĩa với người dùng (vd không tìm được đường), tách riêng
 * để UI phân biệt với lỗi mạng.
 */
export class RoutingError extends Error {}

/**
 * Input: Hai điểm, phương tiện, AbortSignal.
 * Output: Tuyến đường theo đường bộ — quãng đường (km), thời gian (phút) và mảng toạ độ
 *         đã ở thứ tự [lat, lng].
 *
 * Throw RoutingError khi Valhalla từ chối (không có đường, điểm quá xa mạng đường), throw
 * Error thường khi lỗi mạng hoặc response sai shape.
 */
export async function fetchRoute(
  from: Pick<GeoPoint, "lat" | "lng">,
  to: Pick<GeoPoint, "lat" | "lng">,
  mode: TravelMode,
  signal?: AbortSignal,
): Promise<RouteResult> {
  const url = new URL(VALHALLA_ROUTE_URL);
  url.searchParams.set(
    "json",
    JSON.stringify({
      locations: [
        { lat: from.lat, lon: from.lng },
        { lat: to.lat, lon: to.lng },
      ],
      costing: mode,
      units: "kilometers",
      directions_options: { language: "vi-VN" },
    }),
  );

  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });

  const payload: unknown = await response.json();

  if (!response.ok) {
    const parsed = valhallaErrorSchema.safeParse(payload);
    throw new RoutingError(
      parsed.success ? parsed.data.error : `Valhalla trả HTTP ${response.status}`,
    );
  }

  const { trip } = valhallaRouteResponseSchema.parse(payload);

  // Nhiều leg khi có waypoint ở giữa; ở đây luôn 1 leg nhưng vẫn nối hết cho chắc.
  const coordinates: LatLngTuple[] = trip.legs.flatMap((leg) =>
    decodePolyline(leg.shape, VALHALLA_POLYLINE_PRECISION),
  );

  return {
    distanceKm: trip.summary.length,
    durationMinutes: trip.summary.time / 60,
    coordinates,
  };
}
