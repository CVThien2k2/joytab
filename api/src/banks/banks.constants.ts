/**
 * Nguồn sự thật cho danh sách ngân hàng nhận chuyển khoản qua VietQR.
 */

/**
 * Một ngân hàng trong danh sách VietQR.
 *
 * `bin` (6 số) mới là thứ đi vào mã QR — `code` chỉ để đọc bằng mắt và ghép URL logo.
 * Giữ cả hai vì đổi tên thương hiệu (VietCapitalBank → BVBank) làm `code`/`shortName` đổi
 * trong khi `bin` thì không: nó là số hiệu Napas cấp.
 */
export type Bank = {
  bin: string;
  code: string;
  shortName: string;
  name: string;
  logo: string;
};

/**
 * Chụp lại api.vietqr.io/v2/banks (chỉ các ngân hàng `transferSupported`) ngày 2026-09-11.
 *
 * Đây là ĐƯỜNG LÙI, không phải nguồn chính: `BanksService` gọi API thật rồi cache, danh sách
 * này chỉ lên tiếng khi lượt gọi đó hỏng. Vẫn phải có vì nó cũng là thứ để VALIDATE bin owner
 * gửi lên — không có nó thì lúc VietQR sập, owner lưu được bin rác vào DB và mã QR sinh ra sau
 * này dẫn tiền đi đâu không ai biết.
 *
 * Lọc `transferSupported`: ngân hàng không nhận được chuyển khoản thì bày ra chỉ để người ta
 * chọn nhầm.
 */
export const FALLBACK_BANKS: readonly Bank[] = [
  { bin: "970425", code: "ABB", shortName: "ABBANK", name: "Ngân hàng TMCP An Bình", logo: "https://cdn.vietqr.io/img/ABB.png" },
  { bin: "970416", code: "ACB", shortName: "ACB", name: "Ngân hàng TMCP Á Châu", logo: "https://cdn.vietqr.io/img/ACB.png" },
  { bin: "970405", code: "VBA", shortName: "Agribank", name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam", logo: "https://cdn.vietqr.io/img/VBA.png" },
  { bin: "970409", code: "BAB", shortName: "BacABank", name: "Ngân hàng TMCP Bắc Á", logo: "https://cdn.vietqr.io/img/BAB.png" },
  { bin: "970438", code: "BVB", shortName: "BaoVietBank", name: "Ngân hàng TMCP Bảo Việt", logo: "https://cdn.vietqr.io/img/BVB.png" },
  { bin: "970418", code: "BIDV", shortName: "BIDV", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam", logo: "https://cdn.vietqr.io/img/BIDV.png" },
  { bin: "546034", code: "CAKE", shortName: "CAKE", name: "TMCP Việt Nam Thịnh Vượng - Ngân hàng số CAKE by VPBank", logo: "https://cdn.vietqr.io/img/CAKE.png" },
  { bin: "422589", code: "CIMB", shortName: "CIMB", name: "Ngân hàng TNHH MTV CIMB Việt Nam", logo: "https://cdn.vietqr.io/img/CIMB.png" },
  { bin: "970446", code: "COOPBANK", shortName: "COOPBANK", name: "Ngân hàng Hợp tác xã Việt Nam", logo: "https://cdn.vietqr.io/img/COOPBANK.png" },
  { bin: "970431", code: "EIB", shortName: "Eximbank", name: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam", logo: "https://cdn.vietqr.io/img/EIB.png" },
  { bin: "970437", code: "HDB", shortName: "HDBank", name: "Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh", logo: "https://cdn.vietqr.io/img/HDB.png" },
  { bin: "668888", code: "KBank", shortName: "KBank", name: "Ngân hàng Đại chúng TNHH Kasikornbank", logo: "https://cdn.vietqr.io/img/KBANK.png" },
  { bin: "970452", code: "KLB", shortName: "KienLongBank", name: "Ngân hàng TMCP Kiên Long", logo: "https://cdn.vietqr.io/img/KLB.png" },
  { bin: "970449", code: "LPB", shortName: "LPBank", name: "Ngân hàng TMCP Lộc Phát Việt Nam", logo: "https://cdn.vietqr.io/img/LPB.png" },
  { bin: "970422", code: "MB", shortName: "MBBank", name: "Ngân hàng TMCP Quân đội", logo: "https://cdn.vietqr.io/img/MB.png" },
  { bin: "970414", code: "MBV", shortName: "MBV", name: "Ngân hàng TNHH MTV Việt Nam Hiện Đại", logo: "https://cdn.vietqr.io/img/MBV.png" },
  { bin: "971025", code: "momo", shortName: "MoMo", name: "CTCP Dịch Vụ Di Động Trực Tuyến", logo: "https://cdn.vietqr.io/img/momo.png" },
  { bin: "970426", code: "MSB", shortName: "MSB", name: "Ngân hàng TMCP Hàng Hải Việt Nam", logo: "https://cdn.vietqr.io/img/MSB.png" },
  { bin: "970428", code: "NAB", shortName: "NamABank", name: "Ngân hàng TMCP Nam Á", logo: "https://cdn.vietqr.io/img/NAB.png" },
  { bin: "970419", code: "NCB", shortName: "NCB", name: "Ngân hàng TMCP Quốc Dân", logo: "https://cdn.vietqr.io/img/NCB.png" },
  { bin: "970448", code: "OCB", shortName: "OCB", name: "Ngân hàng TMCP Phương Đông", logo: "https://cdn.vietqr.io/img/OCB.png" },
  { bin: "970430", code: "PGB", shortName: "PGBank", name: "Ngân hàng TMCP Thịnh vượng và Phát triển", logo: "https://cdn.vietqr.io/img/PGB.png" },
  { bin: "970412", code: "PVCB", shortName: "PVcomBank", name: "Ngân hàng TMCP Đại Chúng Việt Nam", logo: "https://cdn.vietqr.io/img/PVCB.png" },
  { bin: "971133", code: "PVDB", shortName: "PVcomBank Pay", name: "Ngân hàng TMCP Đại Chúng Việt Nam Ngân hàng số", logo: "https://cdn.vietqr.io/img/PVCB.png" },
  { bin: "970403", code: "STB", shortName: "Sacombank", name: "Ngân hàng TMCP Sài Gòn Thương Tín", logo: "https://cdn.vietqr.io/img/STB.png" },
  { bin: "970400", code: "SGICB", shortName: "SaigonBank", name: "Ngân hàng TMCP Sài Gòn Công Thương", logo: "https://cdn.vietqr.io/img/SGICB.png" },
  { bin: "970429", code: "SCB", shortName: "SCB", name: "Ngân hàng TMCP Sài Gòn", logo: "https://cdn.vietqr.io/img/SCB.png" },
  { bin: "970440", code: "SEAB", shortName: "SeABank", name: "Ngân hàng TMCP Đông Nam Á", logo: "https://cdn.vietqr.io/img/SEAB.png" },
  { bin: "970443", code: "SHB", shortName: "SHB", name: "Ngân hàng TMCP Sài Gòn - Hà Nội", logo: "https://cdn.vietqr.io/img/SHB.png" },
  { bin: "970424", code: "SHBVN", shortName: "ShinhanBank", name: "Ngân hàng TNHH MTV Shinhan Việt Nam", logo: "https://cdn.vietqr.io/img/SHBVN.png" },
  { bin: "970407", code: "TCB", shortName: "Techcombank", name: "Ngân hàng TMCP Kỹ thương Việt Nam", logo: "https://cdn.vietqr.io/img/TCB.png" },
  { bin: "963388", code: "TIMO", shortName: "Timo", name: "Ngân hàng số Timo by Ban Viet Bank (Timo by Ban Viet Bank)", logo: "https://vietqr.net/portal-service/resources/icons/TIMO.png" },
  { bin: "970423", code: "TPB", shortName: "TPBank", name: "Ngân hàng TMCP Tiên Phong", logo: "https://cdn.vietqr.io/img/TPB.png" },
  { bin: "546035", code: "Ubank", shortName: "Ubank", name: "TMCP Việt Nam Thịnh Vượng - Ngân hàng số Ubank by VPBank", logo: "https://cdn.vietqr.io/img/UBANK.png" },
  { bin: "970441", code: "VIB", shortName: "VIB", name: "Ngân hàng TMCP Quốc tế Việt Nam", logo: "https://cdn.vietqr.io/img/VIB.png" },
  { bin: "970427", code: "VAB", shortName: "VietABank", name: "Ngân hàng TMCP Việt Á", logo: "https://cdn.vietqr.io/img/VAB.png" },
  { bin: "970433", code: "VIETBANK", shortName: "VietBank", name: "Ngân hàng TMCP Việt Nam Thương Tín", logo: "https://cdn.vietqr.io/img/VIETBANK.png" },
  { bin: "970454", code: "VCCB", shortName: "VietCapitalBank", name: "Ngân hàng TMCP Bản Việt", logo: "https://cdn.vietqr.io/img/VCCB.png" },
  { bin: "970436", code: "VCB", shortName: "Vietcombank", name: "Ngân hàng TMCP Ngoại Thương Việt Nam", logo: "https://cdn.vietqr.io/img/VCB.png" },
  { bin: "970415", code: "ICB", shortName: "VietinBank", name: "Ngân hàng TMCP Công thương Việt Nam", logo: "https://cdn.vietqr.io/img/ICB.png" },
  { bin: "970432", code: "VPB", shortName: "VPBank", name: "Ngân hàng TMCP Việt Nam Thịnh Vượng", logo: "https://cdn.vietqr.io/img/VPB.png" },
  { bin: "970457", code: "WVN", shortName: "Woori", name: "Ngân hàng TNHH MTV Woori Việt Nam", logo: "https://cdn.vietqr.io/img/WVN.png" },
];

/** Cache sống 24h: danh sách ngân hàng cả năm mới thêm một dòng, gọi lại mỗi request là phí. */
export const BANKS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Nguồn chính. Đổi được qua env `VIETQR_BANKS_URL` để test không phải ra internet thật. */
export const VIETQR_BANKS_URL = 'https://api.vietqr.io/v2/banks';

/**
 * Hỏng thì rơi về FALLBACK_BANKS ngay, nên không cần kiên nhẫn: người dùng đang đứng chờ
 * dialog tạo tổ chức mở ra.
 */
export const VIETQR_BANKS_TIMEOUT_MS = 5_000;

/** BIN Napas luôn 6 chữ số. */
export const BANK_BIN_REGEX = /^\d{6}$/;

/**
 * Số tài khoản: chữ và số, không dấu cách. Dài nhất thực tế là 19-20 (Vietcombank, VPBank),
 * để 24 cho dư. Ngắn nhất 4 — dưới nữa thì chắc chắn là gõ thiếu.
 */
export const MIN_BANK_ACCOUNT_NO_LENGTH = 4;
export const MAX_BANK_ACCOUNT_NO_LENGTH = 24;
export const BANK_ACCOUNT_NO_REGEX = /^[0-9A-Za-z]+$/;

/**
 * Biến thể CHO PHÉP CHUỖI RỖNG, dùng ở PATCH /organizations/:id.
 *
 * Chuỗi rỗng ở đó có nghĩa là GỠ tài khoản — một ý định hợp lệ, khác hẳn với không gửi field
 * (giữ nguyên). Tách thành regex riêng thay vì nới regex gốc: regex gốc còn canh cổng cho
 * POST /organizations, nơi chuỗi rỗng chỉ có thể là lỗi.
 */
export const OPTIONAL_BANK_BIN_REGEX = /^(\d{6})?$/;
export const OPTIONAL_BANK_ACCOUNT_NO_REGEX = /^[0-9A-Za-z]*$/;
