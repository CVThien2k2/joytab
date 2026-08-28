/** Một mục mã lỗi: mã nghiệp vụ ổn định + HTTP status + message mặc định. */
export interface ErrorCodeItem {
  code: string;
  status: number;
  message: string;
}

/**
 * Bộ mã lỗi chuẩn của dự án. `code` là hợp đồng ổn định giữa BE và FE — FE khớp theo
 * `code` để xử lý/hiển thị, KHÔNG dựa vào `message` (message có thể sửa hoặc đa ngôn ngữ).
 * `status` nhúng sẵn trong từng mã nên không còn bảng map code → status riêng.
 *
 * Chỉ giữ mã đang thực sự phát sinh trong code; thêm mã mới khi có nơi dùng.
 */
export const ERROR_CODES = {
  /** Token thiếu/sai chữ ký/malformed, hoặc user trong token không còn tồn tại. FE phải đăng nhập lại. */
  AUTH_001: { code: 'AUTH_001', status: 401, message: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.' },
  AUTH_002: { code: 'AUTH_002', status: 400, message: 'Không lấy được thông tin tài khoản Google.' },
  AUTH_003: { code: 'AUTH_003', status: 401, message: 'Mã đăng nhập Google không hợp lệ hoặc đã hết hạn.' },
  /**
   * Access token hết hạn — và CHỈ hết hạn. FE dựa vào đúng mã này để gọi /auth/refresh,
   * nên token sai chữ ký/malformed phải trả AUTH_001 chứ không phải mã này.
   */
  AUTH_005: { code: 'AUTH_005', status: 401, message: 'Phiên đăng nhập đã hết hạn.' },
  /** Refresh token thiếu/sai/hết hạn/không tồn tại/đã bị thu hồi. FE phải đăng nhập lại. */
  AUTH_006: { code: 'AUTH_006', status: 401, message: 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.' },

  /** Tổ chức không tồn tại, hoặc user không phải thành viên nên coi như không tồn tại. */
  ORG_001: { code: 'ORG_001', status: 404, message: 'Không tìm thấy tổ chức.' },
  /**
   * Mã tham gia không dùng được. Gộp CỐ Ý hai trường hợp "mã không tồn tại" và "mã đúng
   * nhưng tổ chức đang không cho vào bằng mã": tách ra thì người ngoài dò được mã nào có
   * thật chỉ bằng cách đọc mã lỗi.
   */
  ORG_002: { code: 'ORG_002', status: 404, message: 'Mã tham gia không dùng được hoặc tổ chức đang đóng cửa.' },
  /** Đã là thành viên của tổ chức đó. */
  ORG_003: { code: 'ORG_003', status: 409, message: 'Bạn đã là thành viên của tổ chức này.' },
  /** Là thành viên nhưng không phải owner — đổi cấu hình tổ chức chỉ owner được làm. */
  ORG_004: { code: 'ORG_004', status: 403, message: 'Chỉ chủ tổ chức mới làm được việc này.' },
  /**
   * Thao tác nhắm vào chủ tổ chức: owner tự rời, hoặc owner khác bị xoá. Chặn vì chưa có
   * chuyển quyền sở hữu — mất owner là để lại một tổ chức không ai vào sửa được. Owner muốn
   * dừng thì xoá cả tổ chức (DELETE /organizations/:id).
   */
  ORG_005: {
    code: 'ORG_005',
    status: 409,
    message: 'Chủ tổ chức không thể rời tổ chức. Hãy xoá tổ chức nếu không dùng nữa.',
  },

  /** Trận không tồn tại, hoặc user không thuộc tổ chức của trận nên coi như không tồn tại. */
  MATCH_001: { code: 'MATCH_001', status: 404, message: 'Không tìm thấy lịch thi đấu.' },
  /** Giờ kết thúc <= giờ bắt đầu, hoặc tạo trận ở quá khứ. */
  MATCH_002: { code: 'MATCH_002', status: 400, message: 'Thời gian thi đấu không hợp lệ.' },
  /** Mọi thao tác lên một trận đã bị huỷ. */
  MATCH_003: { code: 'MATCH_003', status: 409, message: 'Trận đấu đã bị huỷ.' },
  /** Đã đủ max_players. Vote đóng nhưng có thể mở lại nếu ai đó huỷ trước mốc 2 giờ. */
  MATCH_004: { code: 'MATCH_004', status: 409, message: 'Trận đấu đã đủ người.' },
  /** Đã quá giờ bắt đầu — không vote và cũng không huỷ vote được nữa. */
  MATCH_005: { code: 'MATCH_005', status: 409, message: 'Trận đấu đã bắt đầu, không đăng ký được nữa.' },
  /**
   * Đang vote một trận khác có khoảng thời gian giao với trận này — xét MỌI tổ chức.
   * Ràng buộc nằm ở con người chứ không ở cái sân: hai tổ chức khác nhau vẫn là cùng một
   * người, cùng một buổi tối.
   */
  MATCH_006: { code: 'MATCH_006', status: 409, message: 'Bạn đã đăng ký một trận khác trùng giờ.' },
  MATCH_007: { code: 'MATCH_007', status: 409, message: 'Bạn đã đăng ký trận này rồi.' },
  MATCH_008: { code: 'MATCH_008', status: 409, message: 'Bạn chưa đăng ký trận này.' },
  /** Chặn huỷ trong 2 giờ cuối: người khác đã tính vào danh sách đủ người để đi. */
  MATCH_009: { code: 'MATCH_009', status: 409, message: 'Không huỷ được khi còn dưới 2 giờ nữa là tới giờ chơi.' },
  MATCH_010: { code: 'MATCH_010', status: 409, message: 'Trận đấu chưa bắt đầu, chưa chốt được chi phí.' },
  /**
   * Sửa chia tiền khi đã có người gửi thanh toán. Một ảnh chuyển khoản có thể đang treo cho
   * nhiều trận, nên đổi tiền một trận sẽ làm ảnh đó không khớp với bất kỳ tổng nào — owner
   * phải từ chối lần thanh toán ấy trước.
   */
  MATCH_011: { code: 'MATCH_011', status: 409, message: 'Đã có người gửi thanh toán, không sửa được chia tiền.' },
  MATCH_012: { code: 'MATCH_012', status: 400, message: 'Trận chưa có người tham gia hoặc tổng chi phí bằng 0.' },
  /** Chưa chốt chi phí mà đã hỏi bảng chia tiền. */
  MATCH_013: { code: 'MATCH_013', status: 409, message: 'Trận đấu chưa chốt chi phí.' },

  /** Lần thanh toán không tồn tại, hoặc không thuộc tổ chức/người đang hỏi. */
  PAY_001: { code: 'PAY_001', status: 404, message: 'Không tìm thấy lần thanh toán.' },
  /** Có khoản trong danh sách đã nằm ở một lần thanh toán khác, hoặc không phải của người gửi. */
  PAY_002: { code: 'PAY_002', status: 409, message: 'Có khoản đã được gửi thanh toán rồi.' },
  /** Duyệt/từ chối một lần thanh toán đã được xử lý xong. */
  PAY_003: { code: 'PAY_003', status: 409, message: 'Lần thanh toán này đã được xử lý.' },
  PAY_004: { code: 'PAY_004', status: 400, message: 'Chưa chọn khoản nào để thanh toán.' },
  /** Tổ chức chưa có QR — không có chỗ để chuyển tiền tới. */
  PAY_005: { code: 'PAY_005', status: 409, message: 'Tổ chức chưa cấu hình mã QR thanh toán.' },

  /**
   * Kho ảnh (S3) chưa được cấu hình trên môi trường này. Là lỗi cấu hình nên 500, nhưng CỐ TÌNH
   * không kiểm lúc bootstrap: thiếu env thì chỉ luồng upload chết, không chặn cả API lên.
   */
  UPLOAD_001: {
    code: 'UPLOAD_001',
    status: 500,
    message: 'Chức năng tải ảnh chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
  },

  VALIDATION_001: { code: 'VALIDATION_001', status: 400, message: 'Dữ liệu gửi lên không hợp lệ.' },

  SYS_001: { code: 'SYS_001', status: 500, message: 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.' },
  SYS_404: { code: 'SYS_404', status: 404, message: 'Không tìm thấy đường dẫn này.' },
  /** Vượt giới hạn số request (ThrottlerGuard). Tách mã riêng để thay message tiếng Anh của Nest. */
  SYS_429: { code: 'SYS_429', status: 429, message: 'Bạn thao tác quá nhanh. Vui lòng chờ một lát rồi thử lại.' },

  // Lỗi cấu hình/hạ tầng: chỉ phát sinh lúc bootstrap hoặc khi hạ tầng chết, không phải
  // lỗi nghiệp vụ của client — luôn là 5xx.
  SYS_002: { code: 'SYS_002', status: 500, message: 'Thiếu cấu hình GOOGLE_CLIENT_ID.' },
  SYS_003: { code: 'SYS_003', status: 500, message: 'Thiếu cấu hình GOOGLE_CLIENT_SECRET.' },
  SYS_004: { code: 'SYS_004', status: 500, message: 'Thiếu cấu hình API_URL.' },
  SYS_005: { code: 'SYS_005', status: 500, message: 'Thiếu cấu hình DB_HOST.' },
  SYS_006: { code: 'SYS_006', status: 500, message: 'Thiếu cấu hình DB_USER.' },
  SYS_007: { code: 'SYS_007', status: 500, message: 'Thiếu cấu hình DB_PASSWORD.' },
  SYS_008: { code: 'SYS_008', status: 500, message: 'Thiếu cấu hình DB_NAME.' },
  SYS_013: { code: 'SYS_013', status: 500, message: 'Không kết nối được cơ sở dữ liệu.' },
  SYS_014: { code: 'SYS_014', status: 500, message: 'Thiếu cấu hình JWT_ACCESS_SECRET.' },
} as const satisfies Record<string, ErrorCodeItem>;
