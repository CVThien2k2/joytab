import { randomInt } from 'node:crypto';
import { JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH } from './organizations.constants';

/**
 * Input: Không nhận tham số.
 * Output: Mã tham gia 8 ký tự lấy từ JOIN_CODE_ALPHABET.
 *
 *         Dùng crypto.randomInt chứ không Math.random: mã này là thứ duy nhất chắn giữa
 *         người ngoài và một tổ chức đang mở cửa, nên nó phải không đoán được.
 *         randomInt tránh modulo bias vì 32 chia hết cho biên của nó — nhưng kể cả không,
 *         hàm này đã tự loại bỏ bias sẵn.
 */
export function generateJoinCode(): string {
  let code = '';
  for (let index = 0; index < JOIN_CODE_LENGTH; index++) {
    code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Input: Mã người dùng gõ vào — cho phép chữ thường, khoảng trắng, gạch nối.
 * Output: Mã đã chuẩn hoá để so khớp: in hoa, bỏ ký tự phân cách, và giải nhầm lẫn theo
 *         quy ước Crockford (O→0, I/L→1).
 *
 *         Chuẩn hoá TRƯỚC khi validate là có chủ ý: "seed-0001" và "SEED0001" là cùng một mã,
 *         người dùng không nên bị từ chối vì cách gõ. Giữ nguyên input nếu còn ký tự lạ để
 *         @Matches báo lỗi thay vì âm thầm bóp méo.
 */
export function normalizeJoinCode(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value
    .replace(/[\s\-_.]/g, '')
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

/**
 * Input: Giá trị thô của field `name`.
 * Output: Chuỗi đã trim và gộp khoảng trắng liên tiếp; giá trị không phải string đi qua
 *         nguyên vẹn để @IsString báo lỗi.
 */
export function normalizeOrganizationName(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.trim().replace(/\s+/g, ' ');
}
