/**
 * Phạm vi địa lý Việt Nam — dùng để giới hạn tìm kiếm, khung nhìn bản đồ và điểm chọn.
 *
 * Số liệu lấy từ `boundingbox` của relation hành chính "Việt Nam" trên OpenStreetMap
 * (Nominatim `?country=Vietnam`), không phải số tự đặt. Cạnh đông 114.857 là do OSM
 * tính cả quần đảo Trường Sa vào relation này.
 */
export const VIETNAM_BOUNDS = {
  south: 7.6920852,
  west: 102.1438643,
  north: 23.3926918,
  east: 114.8572578,
} as const;

/** Mã quốc gia ISO 3166-1 alpha-2, dùng cho tham số `countrycodes` của Nominatim. */
export const VIETNAM_COUNTRY_CODE = "vn";

/**
 * Input: Toạ độ.
 * Output: true nếu nằm trong bounding box Việt Nam.
 *
 * Đây là phép kiểm hình chữ nhật, KHÔNG phải kiểm theo đường biên giới thật — một điểm
 * bên trong bbox vẫn có thể thuộc Lào hoặc Campuchia. Đủ dùng để chặn người dùng bấm
 * sang tận châu Âu, không dùng để khẳng định chủ quyền hay xác định quốc gia của điểm.
 */
export function isInsideVietnam(point: { lat: number; lng: number }): boolean {
  return (
    point.lat >= VIETNAM_BOUNDS.south &&
    point.lat <= VIETNAM_BOUNDS.north &&
    point.lng >= VIETNAM_BOUNDS.west &&
    point.lng <= VIETNAM_BOUNDS.east
  );
}
