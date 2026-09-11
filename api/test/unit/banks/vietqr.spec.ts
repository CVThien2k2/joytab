import { buildVietQrPayload, crc16Ccitt, toTransferNote } from '../../../src/banks/banks.utils';

/**
 * Payload VietQR là chuỗi TLV của EMVCo: mỗi trường là `tag(2) + length(2) + value`.
 * Test dựng chuỗi kỳ vọng bằng cách GHÉP TAY từng mảnh, không gọi lại hàm đang test — sai
 * thứ tự trường hay sai độ dài là lộ ra ngay, chứ không cùng sai với implementation.
 */
describe('crc16Ccitt', () => {
  // Vector chuẩn của CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, không đảo bit).
  // Đây là chỗ duy nhất chứng minh thuật toán đúng — mọi test dưới đều dựa vào nó.
  it('khớp vector chuẩn "123456789" = 0x29B1', () => {
    expect(crc16Ccitt('123456789')).toBe(0x29b1);
  });

  it('chuỗi rỗng cho giá trị khởi tạo 0xFFFF', () => {
    expect(crc16Ccitt('')).toBe(0xffff);
  });
});

describe('buildVietQrPayload', () => {
  const bin = '970418';
  const accountNo = '1234567890';

  /** Ghép tay đúng thứ tự EMVCo để đối chiếu, không dùng lại hàm build. */
  function expectedPayload(options: { dynamic: boolean; amount?: string; note?: string }): string {
    const beneficiary = `0006${bin}` + `01${String(accountNo.length).padStart(2, '0')}${accountNo}`;
    const merchantAccount =
      '0010A000000727' +
      `01${String(beneficiary.length).padStart(2, '0')}${beneficiary}` +
      '0208QRIBFTTA';
    let body =
      '000201' +
      (options.dynamic ? '010212' : '010211') +
      `38${String(merchantAccount.length).padStart(2, '0')}${merchantAccount}` +
      '5303704';
    if (options.amount) body += `54${String(options.amount.length).padStart(2, '0')}${options.amount}`;
    body += '5802VN';
    if (options.note) {
      const additional = `08${String(options.note.length).padStart(2, '0')}${options.note}`;
      body += `62${String(additional.length).padStart(2, '0')}${additional}`;
    }
    const withCrcTag = `${body}6304`;
    return withCrcTag + crc16Ccitt(withCrcTag).toString(16).toUpperCase().padStart(4, '0');
  }

  it('không có số tiền thì là mã TĨNH (010211), quét bao nhiêu lần cũng được', () => {
    expect(buildVietQrPayload({ bin, accountNo })).toBe(expectedPayload({ dynamic: false }));
  });

  it('có số tiền thì là mã ĐỘNG (010212) và nhét số tiền vào trường 54', () => {
    expect(buildVietQrPayload({ bin, accountNo, amount: 180000 })).toBe(
      expectedPayload({ dynamic: true, amount: '180000' }),
    );
  });

  it('nội dung chuyển khoản nằm ở 62-08', () => {
    expect(buildVietQrPayload({ bin, accountNo, amount: 180000, note: 'JOYTAB NGUYEN VAN A' })).toBe(
      expectedPayload({ dynamic: true, amount: '180000', note: 'JOYTAB NGUYEN VAN A' }),
    );
  });

  it('CRC đứng cuối, 4 ký tự hex hoa, và tính TRÊN CẢ "6304"', () => {
    const payload = buildVietQrPayload({ bin, accountNo, amount: 180000 });
    const body = payload.slice(0, -4);
    expect(body.endsWith('6304')).toBe(true);
    expect(payload.slice(-4)).toMatch(/^[0-9A-F]{4}$/);
    expect(payload.slice(-4)).toBe(crc16Ccitt(body).toString(16).toUpperCase().padStart(4, '0'));
  });

  it('số tiền <= 0 bị bỏ qua, coi như không có — mã âm tiền thì app ngân hàng từ chối', () => {
    expect(buildVietQrPayload({ bin, accountNo, amount: 0 })).toBe(expectedPayload({ dynamic: false }));
  });

  it('số tiền lẻ tới đồng được làm tròn về số nguyên: VND không có phần thập phân', () => {
    expect(buildVietQrPayload({ bin, accountNo, amount: 111363.63 })).toBe(
      expectedPayload({ dynamic: true, amount: '111364' }),
    );
  });

  it('nội dung rỗng thì bỏ hẳn trường 62, không để một trường rỗng lửng lơ', () => {
    expect(buildVietQrPayload({ bin, accountNo, note: '   ' })).toBe(expectedPayload({ dynamic: false }));
  });
});

describe('toTransferNote', () => {
  it('bỏ dấu tiếng Việt và viết hoa — app ngân hàng nhiều nơi không nhận tiếng Việt có dấu', () => {
    expect(toTransferNote('Nguyễn Văn Á')).toBe('NGUYEN VAN A');
  });

  it('đ/Đ thành D — NFD không tách được chữ này', () => {
    expect(toTransferNote('Đặng Đình')).toBe('DANG DINH');
  });

  it('ký tự lạ thành khoảng trắng rồi gom lại, không để dính liền hai từ', () => {
    expect(toTransferNote('Lê   Anh_Tuấn (VIP)')).toBe('LE ANH TUAN VIP');
  });

  it('cắt bớt khi quá dài, không cắt giữa chừng một từ', () => {
    expect(toTransferNote('ABCDE FGHIJ KLMNO', 12)).toBe('ABCDE FGHIJ');
  });

  it('từ đầu tiên đã dài hơn giới hạn thì đành cắt cứng', () => {
    expect(toTransferNote('ABCDEFGHIJKLMNOP', 8)).toBe('ABCDEFGH');
  });

  it('không còn ký tự nào dùng được thì trả chuỗi rỗng', () => {
    expect(toTransferNote('!!! ???')).toBe('');
  });
});
