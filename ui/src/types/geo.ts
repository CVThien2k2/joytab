import { z } from "zod";
import { nominatimPlaceSchema } from "@/schema/geocode";
import type { LatLngTuple } from "@/lib/polyline";

/** Một địa điểm đã chọn trên bản đồ. `label` để hiện trong panel. */
export type GeoPoint = {
  lat: number;
  lng: number;
  label: string;
};

/** Kết quả tìm kiếm đã chuẩn hoá từ response Nominatim. */
export type PlaceResult = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

export type NominatimPlace = z.infer<typeof nominatimPlaceSchema>;

/** Hai đầu của tuyến đường. Panel dùng key này làm slot đang active. */
export type RouteSlot = "start" | "end";

/** Phương tiện — dùng trực tiếp làm `costing` khi gọi Valhalla. */
export type TravelMode = "auto" | "bicycle" | "pedestrian";

/** Tuyến đường đã tính xong, toạ độ đã đổi sang thứ tự [lat, lng] của Leaflet. */
export type RouteResult = {
  distanceKm: number;
  durationMinutes: number;
  coordinates: LatLngTuple[];
};
