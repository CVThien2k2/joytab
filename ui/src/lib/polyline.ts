/**
 * Giải mã encoded polyline (thuật toán của Google).
 *
 * Valhalla dùng precision 6 (nhân 1e6) chứ KHÔNG phải 5 như Google/OSRM. Decode sai
 * precision không báo lỗi gì — toạ độ chỉ lệch đi 10 lần, ví dụ 10.77 thành 107.7,
 * đường vẽ bay ra khỏi bản đồ. Vì vậy precision là tham số bắt buộc, không mặc định.
 */

/** Toạ độ [lat, lng] — đúng thứ tự Leaflet mong đợi. */
export type LatLngTuple = [number, number];

/**
 * Input: Chuỗi encoded polyline và số chữ số thập phân đã dùng khi encode.
 * Output: Mảng [lat, lng]. Chuỗi rỗng → mảng rỗng.
 */
export function decodePolyline(
  encoded: string,
  precision: number,
): LatLngTuple[] {
  const factor = 10 ** precision;
  const points: LatLngTuple[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / factor, lng / factor]);
  }

  return points;
}

/** Precision của shape trong response Valhalla. */
export const VALHALLA_POLYLINE_PRECISION = 6;
