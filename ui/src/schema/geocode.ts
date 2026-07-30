import { z } from "zod";

/**
 * Một phần tử trong response của Nominatim `/search?format=jsonv2`.
 *
 * `lat`/`lon` Nominatim trả về dạng CHUỖI ("10.7769") nên phải coerce sang number.
 * Chỉ khai những field thực sự dùng; các field khác của họ bị bỏ qua.
 */
export const nominatimPlaceSchema = z.object({
  place_id: z.union([z.number(), z.string()]),
  display_name: z.string().min(1),
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

/** Response của Nominatim là một array phẳng, không có envelope. */
export const nominatimSearchResponseSchema = z.array(nominatimPlaceSchema);
