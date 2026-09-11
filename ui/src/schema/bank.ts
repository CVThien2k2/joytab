import { z } from "zod"
import { envelope } from "@/schema/envelope"

/**
 * Một ngân hàng nhận chuyển khoản. Mirror của `Bank` ở BE (api/src/banks/banks.constants.ts).
 *
 * `bin` là thứ gửi lại cho BE và là thứ đi vào mã QR; `code`/`shortName` chỉ để hiển thị.
 */
export const bankSchema = z.object({
  bin: z.string(),
  code: z.string(),
  shortName: z.string(),
  name: z.string(),
  /** Chuỗi rỗng khi VietQR không có logo — component hiển thị phải chịu được điều đó. */
  logo: z.string(),
})

/** GET /banks */
export const bankListResponseSchema = envelope(z.object({ banks: z.array(bankSchema) }))

/**
 * Mirror ràng buộc số tài khoản của BE (api/src/banks/banks.constants.ts). BE vẫn là nguồn sự
 * thật — validate lại ở đây chỉ để user thấy lỗi ngay khi gõ.
 */
export const MIN_BANK_ACCOUNT_NO_LENGTH = 4
export const MAX_BANK_ACCOUNT_NO_LENGTH = 24

/**
 * Input: Số tài khoản user gõ hoặc dán vào.
 * Output: Chuỗi đã bỏ khoảng trắng và dấu phân cách.
 *
 *         Số tài khoản hay được chép từ tin nhắn dưới dạng "0123 4567 890" — cùng thuật toán
 *         với `normalizeBankAccountNo` ở BE, để thứ FE validate đúng bằng thứ BE nhận.
 */
export function normalizeBankAccountNo(value: string): string {
  return value.replace(/[\s.\-_]/g, "")
}

/**
 * Hai ô ngân hàng + số tài khoản, dùng chung ở form tạo và form sửa tổ chức.
 *
 * CẢ HAI cùng rỗng (chưa cấu hình) hoặc cùng có (đã cấu hình) — nửa cặp không dựng nổi mã QR.
 * Ràng buộc này ở `superRefine` chứ không ở từng field: nó nói về QUAN HỆ giữa hai ô, mà một
 * ô thì không nhìn thấy ô kia.
 */
export const bankAccountFormSchema = z
  .object({
    bankBin: z.string(),
    bankAccountNo: z.string().transform(normalizeBankAccountNo),
  })
  .superRefine((value, ctx) => {
    const hasBin = value.bankBin.length > 0
    const hasAccount = value.bankAccountNo.length > 0
    if (!hasBin && !hasAccount) return

    if (!hasBin) {
      ctx.addIssue({ code: "custom", path: ["bankBin"], message: "Vui lòng chọn ngân hàng" })
    }
    if (!hasAccount) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountNo"],
        message: "Vui lòng nhập số tài khoản",
      })
      return
    }
    if (!/^[0-9A-Za-z]+$/.test(value.bankAccountNo)) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountNo"],
        message: "Số tài khoản chỉ gồm chữ và số",
      })
    } else if (
      value.bankAccountNo.length < MIN_BANK_ACCOUNT_NO_LENGTH ||
      value.bankAccountNo.length > MAX_BANK_ACCOUNT_NO_LENGTH
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountNo"],
        message: `Số tài khoản phải từ ${MIN_BANK_ACCOUNT_NO_LENGTH} đến ${MAX_BANK_ACCOUNT_NO_LENGTH} ký tự`,
      })
    }
  })
