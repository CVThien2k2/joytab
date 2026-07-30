"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchRoute, RoutingError } from "@/api/routing";
import type { GeoPoint, RouteResult, TravelMode } from "@/types/geo";

/** Tuyến đường không đổi theo thời gian → cache lâu, không refetch vô ích. */
const STALE_TIME_MS = 10 * 60 * 1000;

type UseRouteResult = {
  route: RouteResult | null;
  isLoading: boolean;
  /** Thông báo đã sẵn sàng hiển thị cho người dùng; null khi không có lỗi. */
  errorMessage: string | null;
};

/**
 * Input: Hai điểm (có thể null) và phương tiện.
 * Output: Tuyến đường theo đường bộ. Chỉ gọi API khi có đủ cả hai điểm.
 *
 * queryKey chứa toạ độ đã làm tròn 5 chữ số: kéo marker lệch dưới 1 m thì không tính là
 * tuyến mới, khỏi gọi lại Valhalla mỗi lần nhích chuột.
 */
export function useRoute(
  start: GeoPoint | null,
  end: GeoPoint | null,
  mode: TravelMode,
): UseRouteResult {
  const enabled = Boolean(start && end);

  const query = useQuery({
    queryKey: [
      "route",
      mode,
      start ? [start.lat.toFixed(5), start.lng.toFixed(5)] : null,
      end ? [end.lat.toFixed(5), end.lng.toFixed(5)] : null,
    ],
    queryFn: ({ signal }) => {
      // `enabled` đã chặn, nhánh này chỉ để TypeScript hẹp kiểu mà không cần `!`.
      if (!start || !end) {
        throw new Error("useRoute: gọi khi chưa đủ hai điểm");
      }
      return fetchRoute(start, end, mode, signal);
    },
    enabled,
    staleTime: STALE_TIME_MS,
    retry: 1,
  });

  return {
    route: query.data ?? null,
    isLoading: enabled && query.isFetching,
    errorMessage: query.error
      ? query.error instanceof RoutingError
        ? `Không tìm được đường đi: ${query.error.message}`
        : "Không gọi được dịch vụ tìm đường, thử lại sau."
      : null,
  };
}
