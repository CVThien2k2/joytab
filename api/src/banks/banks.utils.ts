/**
 * Dựng chuỗi mã QR chuyển khoản theo chuẩn VietQR (EMVCo QR Code Specification for Payment
 * Systems, phần Napas VietQR).
 *
 * Ở đây là hàm THUẦN, không đụng DB và không đụng mạng: chuỗi này đi vào cả màn thanh toán của
 * FE lẫn test, nên nó phải tái lập được từ đúng bốn tham số.
 */

/** GUID Napas đăng ký với EMVCo — hằng số của chuẩn, không phải của tổ chức nào. */
const VIETQR_GUID = 'A000000727';

/** Chuyển khoản tới SỐ TÀI KHOẢN (khác QRIBFTTC là tới số thẻ). */
const SERVICE_CODE_ACCOUNT = 'QRIBFTTA';

/** 704 = VND theo ISO 4217. */
const CURRENCY_VND = '704';
const COUNTRY_VN = 'VN';

/**
 * `11` = mã dùng nhiều lần (không mang số tiền), `12` = mã một lần (đã chốt số tiền).
 * Khai sai thì app ngân hàng vẫn quét ra, nhưng có app cảnh báo mã đã dùng.
 */
const INITIATION_STATIC = '11';
const INITIATION_DYNAMIC = '12';

/** Độ dài của EMVCo là 2 chữ số, nên không trường nào dài quá 99 ký tự. */
const MAX_FIELD_LENGTH = 99;

/** Nội dung chuyển khoản: chuẩn cho tới 99, nhưng nhiều app ngân hàng cắt quanh mốc này. */
export const MAX_TRANSFER_NOTE_LENGTH = 50;

/**
 * Input: Tag 2 ký tự và giá trị của nó.
 * Output: Một trường TLV `tag + độ dài 2 chữ số + giá trị`.
 *
 *         Ném lỗi khi giá trị dài quá 99: EMVCo không có chỗ ghi độ dài 3 chữ số, cắt bớt cho
 *         qua thì sinh ra một mã QR quét được nhưng chuyển sai số tài khoản.
 */
function field(tag: string, value: string): string {
  if (value.length > MAX_FIELD_LENGTH) {
    throw new Error(`VietQR field ${tag} too long: ${value.length} characters`);
  }
  return `${tag}${String(value.length).padStart(2, '0')}${value}`;
}

/**
 * Input: Chuỗi payload (đã gồm cả `6304` của chính trường CRC).
 * Output: CRC-16/CCITT-FALSE — poly 0x1021, khởi tạo 0xFFFF, KHÔNG đảo bit vào/ra, không XOR
 *         kết quả. Đây đúng là biến thể chuẩn EMVCo chỉ định; dùng nhầm biến thể khác (CRC-16/
 *         ARC, XMODEM) cho ra 4 ký tự cuối khác và app ngân hàng từ chối cả mã.
 *
 *         Tính trên từng byte của mã ký tự: payload VietQR chỉ chứa ASCII sau khi đã bỏ dấu.
 */
export function crc16Ccitt(input: string): number {
  let crc = 0xffff;
  for (let index = 0; index < input.length; index += 1) {
    crc ^= input.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

/**
 * Input: Chuỗi bất kỳ (tên người trả, tên tổ chức) và độ dài tối đa.
 * Output: Chuỗi IN HOA KHÔNG DẤU, chỉ còn chữ-số-khoảng trắng, cắt theo RANH GIỚI TỪ.
 *
 *         Nội dung chuyển khoản đi qua hệ thống liên ngân hàng, nơi tiếng Việt có dấu về tới
 *         sao kê thành ký tự hỏng — mà sao kê chính là thứ chủ tổ chức dùng để đối soát.
 *
 *         Cắt theo ranh giới từ vì "NGUYEN VAN A TRA TIEN SA" đọc khó hơn hẳn "NGUYEN VAN A
 *         TRA TIEN". Chỉ khi riêng từ đầu đã quá dài mới cắt cứng — lúc đó không còn lựa chọn.
 */
export function toTransferNote(input: string, maxLength: number = MAX_TRANSFER_NOTE_LENGTH): string {
  const ascii = input
    .normalize('NFD')
    // Dấu thanh và dấu phụ nằm ở khối U+0300-U+036F sau khi NFD tách ra.
    .replace(/[̀-ͯ]/g, '')
    // đ/Đ là chữ cái riêng trong Unicode, NFD không tách được nên phải đổi tay.
    .replace(/[đĐ]/g, 'D')
    .toUpperCase()
    .replace(/[^0-9A-Z]+/g, ' ')
    .trim();

  if (ascii.length <= maxLength) return ascii;

  const cutAtSpace = ascii.lastIndexOf(' ', maxLength);
  return cutAtSpace > 0 ? ascii.slice(0, cutAtSpace) : ascii.slice(0, maxLength);
}

export type VietQrInput = {
  /** BIN Napas 6 số của ngân hàng nhận. */
  bin: string;
  accountNo: string;
  /** VND. Bỏ trống / <= 0 thì sinh mã tĩnh, người trả tự gõ số tiền. */
  amount?: number;
  /** Nội dung chuyển khoản, đã qua `toTransferNote`. Bỏ trống thì không có trường 62. */
  note?: string;
};

/**
 * Input: Ngân hàng nhận, số tài khoản, và (tuỳ chọn) số tiền + nội dung.
 * Output: Chuỗi để vẽ thành mã QR.
 *
 *         Có số tiền là khác biệt DUY NHẤT đáng giá so với ảnh QR tĩnh mà tổ chức tự tải lên
 *         trước đây: người trả quét xong không phải gõ lại số tiền, nên không còn chuyện
 *         chuyển thiếu 1.000đ rồi hai bên đi tìm nhau.
 *
 *         Thứ tự trường theo đúng EMVCo (00, 01, 38, 53, 54, 58, 62, 63) — CRC tính trên cả
 *         chuỗi ĐÃ có sẵn `6304` ở cuối, đây là chỗ hay làm sai nhất của chuẩn này.
 */
export function buildVietQrPayload({ bin, accountNo, amount, note }: VietQrInput): string {
  const beneficiary = field('00', bin) + field('01', accountNo);
  const merchantAccount =
    field('00', VIETQR_GUID) + field('01', beneficiary) + field('02', SERVICE_CODE_ACCOUNT);

  // Làm tròn về đồng: VND không có phần thập phân, mà trường 54 có dấu chấm thì app từ chối.
  const roundedAmount = amount !== undefined && amount > 0 ? Math.round(amount) : 0;
  const trimmedNote = note?.trim() ?? '';

  let payload =
    field('00', '01') +
    field('01', roundedAmount > 0 ? INITIATION_DYNAMIC : INITIATION_STATIC) +
    field('38', merchantAccount) +
    field('53', CURRENCY_VND);
  if (roundedAmount > 0) payload += field('54', String(roundedAmount));
  payload += field('58', COUNTRY_VN);
  if (trimmedNote) payload += field('62', field('08', trimmedNote));

  const withCrcTag = `${payload}6304`;
  return withCrcTag + crc16Ccitt(withCrcTag).toString(16).toUpperCase().padStart(4, '0');
}
