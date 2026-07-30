"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { VIETNAM_BOUNDS } from "@/lib/vietnam";
import type { LatLngTuple } from "@/lib/polyline";
import type { GeoPoint, RouteSlot } from "@/types/geo";

/** Trung tâm mặc định khi chưa chọn điểm nào — TP.HCM. */
const DEFAULT_CENTER: L.LatLngTuple = [10.7769, 106.7009];
const DEFAULT_ZOOM = 13;

/** Zoom khi mới đặt một điểm duy nhất (chưa có bounds để fit). */
const SINGLE_POINT_ZOOM = 15;

/**
 * Khung nhìn bị kẹp trong phạm vi Việt Nam. Nới thêm 0.5 độ để vùng biên không bị dính
 * sát rìa khung, vẫn kéo/zoom xem được Hà Giang hay Cà Mau cho thoải mái.
 */
const VIEW_PADDING_DEGREES = 0.5;

const MAP_MAX_BOUNDS = L.latLngBounds(
  [
    VIETNAM_BOUNDS.south - VIEW_PADDING_DEGREES,
    VIETNAM_BOUNDS.west - VIEW_PADDING_DEGREES,
  ],
  [
    VIETNAM_BOUNDS.north + VIEW_PADDING_DEGREES,
    VIETNAM_BOUNDS.east + VIEW_PADDING_DEGREES,
  ],
);

/** Zoom nhỏ nhất — dưới mức này là thấy cả Đông Nam Á, ngoài phạm vi cần thiết. */
const MIN_ZOOM = 5;

type RouteMapProps = {
  start: GeoPoint | null;
  end: GeoPoint | null;
  /** Toạ độ đường bộ từ Valhalla; null khi chưa có hoặc gọi lỗi. */
  routeCoordinates: LatLngTuple[] | null;
  /** Click lên bản đồ → gán toạ độ vào slot đang active. */
  onPickPoint: (lat: number, lng: number) => void;
  /** Kéo marker → cập nhật đúng slot của marker đó. */
  onMovePoint: (slot: RouteSlot, lat: number, lng: number) => void;
};

/**
 * Input: Nhãn hiển thị trong pin và biến thể màu.
 * Output: divIcon của Leaflet.
 *
 * Dùng divIcon thay cho icon mặc định vì icon mặc định trỏ tới file ảnh theo đường
 * dẫn tương đối của Leaflet — qua bundler là 404. Bonus: HTML nên ăn được token màu
 * của theme, đổi theme là pin đổi theo.
 */
function createPinIcon(label: string, variant: RouteSlot): L.DivIcon {
  const background =
    variant === "start" ? "var(--color-primary)" : "var(--color-chart-3)";

  return L.divIcon({
    className: "!bg-transparent !border-0",
    html: `<div style="
      width: 28px; height: 28px; border-radius: 9999px;
      background: ${background};
      color: var(--color-primary-foreground);
      border: 2px solid var(--color-card);
      box-shadow: 0 2px 6px rgb(0 0 0 / 0.35);
      display: grid; place-items: center;
      font: 700 13px/1 var(--font-sans, sans-serif);
    ">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/**
 * Input: Hai điểm hiện tại.
 * Output: Không render gì; chỉ điều khiển viewport của map.
 *
 * Đủ 2 điểm → fitBounds cho thấy cả tuyến. Mới 1 điểm → bay tới điểm đó. Phải là
 * component con vì hook useMap() chỉ dùng được bên trong MapContainer.
 */
function ViewportController({
  start,
  end,
  routeCoordinates,
}: {
  start: GeoPoint | null;
  end: GeoPoint | null;
  routeCoordinates: LatLngTuple[] | null;
}) {
  const map = useMap();

  useEffect(() => {
    // Có route thì fit theo toàn bộ đường: đường bộ thường vòng ra ngoài khung
    // bao của hai marker, fit theo 2 marker sẽ cắt mất một phần đường.
    if (routeCoordinates && routeCoordinates.length > 1) {
      map.fitBounds(L.latLngBounds(routeCoordinates), { padding: [48, 48] });
      return;
    }

    if (start && end) {
      map.fitBounds(
        L.latLngBounds([start.lat, start.lng], [end.lat, end.lng]),
        { padding: [64, 64] },
      );
      return;
    }

    const single = start ?? end;
    if (single) {
      map.setView([single.lat, single.lng], SINGLE_POINT_ZOOM);
    }
  }, [map, start, end, routeCoordinates]);

  return null;
}

/**
 * Input: Callback nhận toạ độ khi click.
 * Output: Không render gì; chỉ lắng nghe event click của map.
 */
function ClickHandler({
  onPickPoint,
}: {
  onPickPoint: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (event) => onPickPoint(event.latlng.lat, event.latlng.lng),
  });

  return null;
}

/**
 * Input: Hai điểm + callback chọn/kéo điểm.
 * Output: Bản đồ OSM với pin A/B, đường thẳng nối 2 điểm.
 *
 * Component này CHỈ được nạp qua dynamic import với ssr:false (xem route-planner):
 * Leaflet chạm `window` ngay lúc import nên không chạy được ở server.
 */
export function RouteMap({
  start,
  end,
  routeCoordinates,
  onPickPoint,
  onMovePoint,
}: RouteMapProps) {
  const startIcon = useMemo(() => createPinIcon("A", "start"), []);
  const endIcon = useMemo(() => createPinIcon("B", "end"), []);

  const hasRoute = Boolean(routeCoordinates && routeCoordinates.length > 1);

  /**
   * Valhalla snap điểm về đường routable gần nhất, có thể cách marker vài trăm mét.
   * Nối marker với đầu/cuối route bằng nét đứt để không bị hiểu là đường vẽ lệch.
   */
  const connectors = useMemo(() => {
    if (!routeCoordinates || routeCoordinates.length < 2) return [];

    const segments: LatLngTuple[][] = [];
    const first = routeCoordinates[0];
    const last = routeCoordinates[routeCoordinates.length - 1];

    if (start) segments.push([[start.lat, start.lng], first]);
    if (end) segments.push([last, [end.lat, end.lng]]);

    return segments;
  }, [routeCoordinates, start, end]);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      className="size-full"
      maxBounds={MAP_MAX_BOUNDS}
      // 1.0 = chặn cứng, không cho kéo lố ra ngoài rồi nảy về.
      maxBoundsViscosity={1}
      minZoom={MIN_ZOOM}
    >
      {/* attribution là yêu cầu của license ODbL, không phải tuỳ chọn */}
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />

      <ClickHandler onPickPoint={onPickPoint} />
      <ViewportController
        start={start}
        end={end}
        routeCoordinates={routeCoordinates}
      />

      {start ? (
        <Marker
          position={[start.lat, start.lng]}
          icon={startIcon}
          draggable
          eventHandlers={{
            dragend: (event) => {
              const { lat, lng } = event.target.getLatLng();
              onMovePoint("start", lat, lng);
            },
          }}
        />
      ) : null}

      {end ? (
        <Marker
          position={[end.lat, end.lng]}
          icon={endIcon}
          draggable
          eventHandlers={{
            dragend: (event) => {
              const { lat, lng } = event.target.getLatLng();
              onMovePoint("end", lat, lng);
            },
          }}
        />
      ) : null}

      {/* Đường bộ do Valhalla trả về. */}
      {hasRoute && routeCoordinates ? (
        <Polyline
          positions={routeCoordinates}
          pathOptions={{
            color: "var(--color-primary)",
            weight: 5,
            opacity: 0.9,
          }}
        />
      ) : null}

      {/* Nét đứt nối marker với đầu/cuối đường bộ (phần Valhalla đã snap). */}
      {connectors.map((segment, index) => (
        <Polyline
          key={index}
          positions={segment}
          pathOptions={{
            color: "var(--color-primary)",
            weight: 2,
            opacity: 0.5,
            dashArray: "4 6",
          }}
        />
      ))}

      {/* Chưa có đường bộ (đang tải hoặc lỗi) thì vẫn nối thẳng để bản đồ không trống. */}
      {!hasRoute && start && end ? (
        <Polyline
          positions={[
            [start.lat, start.lng],
            [end.lat, end.lng],
          ]}
          pathOptions={{
            color: "var(--color-muted-foreground)",
            weight: 2,
            opacity: 0.6,
            dashArray: "6 8",
          }}
        />
      ) : null}
    </MapContainer>
  );
}
