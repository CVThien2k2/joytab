"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { useRoute } from "@/hooks/use-route";
import { formatCoords, haversineDistanceKm } from "@/lib/geo";
import { isInsideVietnam } from "@/lib/vietnam";
import type {
  GeoPoint,
  PlaceResult,
  RouteSlot,
  TravelMode,
} from "@/types/geo";
import { RoutePanel } from "./route-panel";

/**
 * Leaflet chạm `window` ngay lúc import nên không render được ở server —
 * bắt buộc dynamic với ssr:false. Trong lúc tải chunk thì hiện skeleton.
 */
const RouteMap = dynamic(
  () => import("./route-map").then((mod) => mod.RouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="grid size-full animate-pulse place-items-center bg-muted">
        <span className="text-sm text-muted-foreground">Đang tải bản đồ…</span>
      </div>
    ),
  },
);

type Points = Record<RouteSlot, GeoPoint | null>;

const EMPTY_POINTS: Points = { start: null, end: null };

/**
 * Input: Không nhận props.
 * Output: Màn hình demo OpenStreetMap — panel chọn/tìm điểm bên cạnh bản đồ.
 *
 * State để ở đây (useState, không cần store toàn cục) vì không có màn nào khác cần
 * tới hai điểm này.
 */
export function RoutePlanner() {
  const [points, setPoints] = useState<Points>(EMPTY_POINTS);
  const [activeSlot, setActiveSlot] = useState<RouteSlot>("start");
  const [travelMode, setTravelMode] = useState<TravelMode>("auto");

  const distanceKm = useMemo(() => {
    if (!points.start || !points.end) return null;
    return haversineDistanceKm(points.start, points.end);
  }, [points.start, points.end]);

  const { route, isLoading, errorMessage } = useRoute(
    points.start,
    points.end,
    travelMode,
  );

  /**
   * Input: Slot cần gán và điểm mới.
   * Output: Cập nhật slot đó; nếu vừa gán A và B còn trống thì chuyển active sang B
   *         để lần click tiếp theo đặt luôn điểm B.
   */
  const assignPoint = (slot: RouteSlot, point: GeoPoint) => {
    setPoints((previous) => ({ ...previous, [slot]: point }));
    if (slot === "start" && !points.end) {
      setActiveSlot("end");
    }
  };

  /**
   * Input: Toạ độ từ cú click trên bản đồ.
   * Output: Gán vào slot đang active, nhãn là chính toạ độ (chưa reverse geocode).
   *         Bỏ qua nếu điểm nằm ngoài phạm vi Việt Nam.
   */
  const handlePickPoint = (lat: number, lng: number) => {
    if (!isInsideVietnam({ lat, lng })) {
      toast.error("Ngoài phạm vi", {
        description: "Demo này chỉ hỗ trợ các điểm trong phạm vi Việt Nam.",
      });
      return;
    }
    assignPoint(activeSlot, { lat, lng, label: formatCoords({ lat, lng }) });
  };

  /**
   * Input: Slot của marker vừa kéo và toạ độ mới.
   * Output: Cập nhật toạ độ, giữ nguyên nhãn cũ nếu nhãn đó là tên địa điểm; nếu nhãn
   *         chỉ là toạ độ thì cập nhật theo vị trí mới cho khỏi lệch.
   *
   * Kéo ra ngoài Việt Nam thì phải ghi lại state bằng OBJECT MỚI mang toạ độ cũ, không
   * được `return previous`: Leaflet đã tự dời marker khi thả, chỉ khi prop `position`
   * đổi tham chiếu thì react-leaflet mới gọi setLatLng để kéo nó về chỗ cũ.
   */
  const handleMovePoint = (slot: RouteSlot, lat: number, lng: number) => {
    const isOutside = !isInsideVietnam({ lat, lng });
    if (isOutside) {
      toast.error("Ngoài phạm vi", {
        description: "Demo này chỉ hỗ trợ các điểm trong phạm vi Việt Nam.",
      });
    }

    setPoints((previous) => {
      const current = previous[slot];
      if (!current) return previous;

      if (isOutside) {
        return { ...previous, [slot]: { ...current } };
      }

      const wasCoordLabel = current.label === formatCoords(current);
      return {
        ...previous,
        [slot]: {
          lat,
          lng,
          label: wasCoordLabel ? formatCoords({ lat, lng }) : current.label,
        },
      };
    });
  };

  /**
   * Input: Kết quả tìm kiếm người dùng chọn.
   * Output: Gán vào slot đang active, lấy display_name làm nhãn.
   */
  const handleSelectPlace = (place: PlaceResult) => {
    assignPoint(activeSlot, {
      lat: place.lat,
      lng: place.lng,
      label: place.label,
    });
  };

  /**
   * Input: Không nhận tham số.
   * Output: Đổi chỗ A ↔ B.
   */
  const handleSwap = () => {
    setPoints((previous) => ({ start: previous.end, end: previous.start }));
  };

  /**
   * Input: Không nhận tham số.
   * Output: Xoá cả hai điểm, active về A.
   */
  const handleClear = () => {
    setPoints(EMPTY_POINTS);
    setActiveSlot("start");
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:flex-row lg:gap-5 lg:p-5">
      <aside className="w-full shrink-0 lg:w-[340px]">
        <RoutePanel
          start={points.start}
          end={points.end}
          activeSlot={activeSlot}
          distanceKm={distanceKm}
          travelMode={travelMode}
          route={route}
          isRouteLoading={isLoading}
          routeErrorMessage={errorMessage}
          onActivateSlot={setActiveSlot}
          onSelectPlace={handleSelectPlace}
          onChangeTravelMode={setTravelMode}
          onSwap={handleSwap}
          onClear={handleClear}
        />
      </aside>

      <div className="min-h-[60vh] flex-1 overflow-hidden rounded-xl border shadow-sm lg:min-h-0">
        <RouteMap
          start={points.start}
          end={points.end}
          routeCoordinates={route?.coordinates ?? null}
          onPickPoint={handlePickPoint}
          onMovePoint={handleMovePoint}
        />
      </div>
    </div>
  );
}
