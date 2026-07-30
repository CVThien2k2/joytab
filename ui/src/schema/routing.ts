import { z } from "zod";

/**
 * Response của Valhalla `/route`.
 *
 * Chỉ khai những field thực dùng. `units` được khai để CHẶN giả định ngầm: nếu server
 * đổi sang miles thì `length` mang nghĩa khác, phải fail sớm chứ không hiển thị sai số.
 */
export const valhallaRouteResponseSchema = z.object({
  trip: z.object({
    // Valhalla trả "kilometers" khi units=km. Khai literal để lệch là parse fail.
    units: z.literal("kilometers"),
    summary: z.object({
      /** Tổng chiều dài, đơn vị theo `units`. */
      length: z.number().nonnegative(),
      /** Tổng thời gian, giây. */
      time: z.number().nonnegative(),
    }),
    legs: z
      .array(
        z.object({
          /** Encoded polyline precision 6. */
          shape: z.string().min(1),
        }),
      )
      .min(1),
  }),
});

/** Valhalla báo lỗi bằng body JSON có `error`/`error_code` kèm HTTP 4xx. */
export const valhallaErrorSchema = z.object({
  error: z.string(),
  error_code: z.number().optional(),
});
