import { Injectable, Logger } from '@nestjs/common';
import {
  Bank,
  BANK_BIN_REGEX,
  BANKS_CACHE_TTL_MS,
  FALLBACK_BANKS,
  VIETQR_BANKS_TIMEOUT_MS,
  VIETQR_BANKS_URL,
} from './banks.constants';

/** Hình dạng một dòng trong `data` của api.vietqr.io/v2/banks — chỉ khai những trường mình đọc. */
type VietQrBankRow = {
  bin?: unknown;
  code?: unknown;
  shortName?: unknown;
  name?: unknown;
  logo?: unknown;
  transferSupported?: unknown;
};

/**
 * Danh sách ngân hàng nhận chuyển khoản, lấy từ VietQR và giữ trong RAM.
 *
 * Giữ trong RAM chứ không lưu DB: đây là dữ liệu THAM CHIẾU của bên ngoài, không phải dữ liệu
 * của người dùng. Lưu vào DB là tự nhận trách nhiệm đồng bộ nó, trong khi mất trắng lúc restart
 * chỉ tốn đúng một lượt gọi HTTP.
 */
@Injectable()
export class BanksService {
  private readonly logger = new Logger(BanksService.name);

  private cache: { banks: Bank[]; fetchedAt: number } | null = null;

  /**
   * Lượt gọi đang bay. Mở dialog tạo tổ chức là vài chỗ cùng hỏi một lúc; không gom lại thì
   * mỗi chỗ bắn một request tới VietQR cho cùng một câu trả lời.
   */
  private inFlight: Promise<Bank[]> | null = null;

  /**
   * Input: Không nhận tham số.
   * Output: Danh sách ngân hàng, ưu tiên bản mới lấy từ VietQR.
   *
   *         KHÔNG BAO GIỜ ném lỗi: hàm này đứng sau ô "chọn ngân hàng" ở màn tạo tổ chức và
   *         màn sửa tổ chức. VietQR sập mà mình sập theo thì người dùng không tạo nổi tổ chức,
   *         trong khi 42 ngân hàng bundle sẵn thừa sức phục vụ họ.
   *
   *         Lượt gọi hỏng KHÔNG được ghi vào cache — ghi thì một cú timeout lúc khởi động khoá
   *         cả tiến trình vào danh sách cũ suốt 24 giờ.
   */
  async list(): Promise<Bank[]> {
    if (this.cache && Date.now() - this.cache.fetchedAt < BANKS_CACHE_TTL_MS) {
      return this.cache.banks;
    }

    this.inFlight ??= this.fetchBanks().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /**
   * Input: BIN 6 số người dùng gửi lên.
   * Output: Ngân hàng tương ứng, hoặc null nếu không có thật.
   *
   *         Đây là cửa kiểm duy nhất trước khi một bin được ghi vào DB — bin sai thì mã QR sinh
   *         ra sau này vẫn quét được nhưng chuyển tới một ngân hàng không tồn tại.
   */
  async findByBin(bin: string): Promise<Bank | null> {
    const banks = await this.list();
    return banks.find((bank) => bank.bin === bin) ?? null;
  }

  /**
   * Input: Không nhận tham số.
   * Output: Danh sách lấy từ VietQR (đã ghi cache), hoặc FALLBACK_BANKS khi lượt gọi hỏng.
   */
  private async fetchBanks(): Promise<Bank[]> {
    try {
      const response = await fetch(VIETQR_BANKS_URL, {
        signal: AbortSignal.timeout(VIETQR_BANKS_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`VietQR responded ${response.status}`);

      const body = (await response.json()) as { data?: unknown };
      const banks = Array.isArray(body.data) ? body.data.map(toBank).filter(isBank) : [];
      // Rỗng không phải một câu trả lời dùng được: hoặc VietQR đổi hình dạng response, hoặc
      // nó trả lỗi dưới dạng 200. Cả hai đều đáng dùng danh sách bundle sẵn hơn.
      if (banks.length === 0) throw new Error('VietQR returned no usable bank');

      // Sắp theo tên ngắn NGAY Ở ĐÂY, một lần cho mỗi lượt cache: VietQR trả về theo thứ tự
      // của họ (gần như là thứ tự thêm vào), mà ô chọn ngân hàng thì người ta dò bằng mắt theo
      // bảng chữ cái. Sắp ở FE là mỗi chỗ hiển thị phải nhớ sắp lại một lần.
      // `localeCompare` với locale `vi`: tên có dấu phải đứng đúng chỗ của nó.
      banks.sort((a, b) => a.shortName.localeCompare(b.shortName, 'vi'));

      this.cache = { banks, fetchedAt: Date.now() };
      return banks;
    } catch (error) {
      this.logger.warn(`Falling back to bundled bank list: ${(error as Error).message}`);
      return [...FALLBACK_BANKS];
    }
  }
}

/**
 * Input: Một dòng bất kỳ trong `data` của VietQR.
 * Output: `Bank` khi dòng đó dùng được, `null` khi không.
 *
 *         Đây là dữ liệu của bên thứ ba: thiếu trường, bin sai độ dài, hay ngân hàng chỉ tra
 *         cứu được chứ không nhận chuyển khoản — tất cả đều là chuyện bình thường, và tất cả
 *         đều phải bị loại TRƯỚC khi tới ô chọn của người dùng.
 */
function toBank(row: unknown): Bank | null {
  const { bin, code, shortName, name, logo, transferSupported } = (row ?? {}) as VietQrBankRow;
  if (transferSupported !== 1) return null;
  if (typeof bin !== 'string' || !BANK_BIN_REGEX.test(bin)) return null;
  if (typeof code !== 'string' || typeof shortName !== 'string' || typeof name !== 'string') return null;

  return { bin, code, shortName, name, logo: typeof logo === 'string' ? logo : '' };
}

function isBank(bank: Bank | null): bank is Bank {
  return bank !== null;
}
