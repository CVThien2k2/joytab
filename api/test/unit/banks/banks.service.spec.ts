import { BanksService } from '../../../src/banks/banks.service';
import { BANKS_CACHE_TTL_MS, FALLBACK_BANKS } from '../../../src/banks/banks.constants';

/**
 * Mọi test ở đây đều thay `fetch` — không có test nào được ra internet thật, vì một bài test
 * chỉ xanh khi api.vietqr.io còn sống thì nó không kiểm tra code của mình nữa.
 */
describe('BanksService', () => {
  const remoteBank = {
    bin: '970422',
    code: 'MB',
    shortName: 'MBBank',
    name: 'Ngân hàng TMCP Quân đội',
    logo: 'https://cdn.vietqr.io/img/MB.png',
    transferSupported: 1,
  };

  let service: BanksService;
  let fetchMock: jest.Mock;

  function respondWith(banks: unknown[]): void {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ code: '00', data: banks }),
    });
  }

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new BanksService();
  });

  it('lấy danh sách từ VietQR và giữ lại đúng những trường mình dùng', async () => {
    respondWith([remoteBank]);

    await expect(service.list()).resolves.toEqual([
      {
        bin: '970422',
        code: 'MB',
        shortName: 'MBBank',
        name: 'Ngân hàng TMCP Quân đội',
        logo: 'https://cdn.vietqr.io/img/MB.png',
      },
    ]);
  });

  it('bỏ ngân hàng không nhận chuyển khoản — bày ra chỉ để người ta chọn nhầm', async () => {
    respondWith([remoteBank, { ...remoteBank, bin: '970999', code: 'XXX', transferSupported: 0 }]);

    const banks = await service.list();
    expect(banks.map((bank) => bank.bin)).toEqual(['970422']);
  });

  it('bỏ dòng thiếu bin hoặc bin sai định dạng: bin rác lọt vào là mã QR dẫn tiền đi đâu không biết', async () => {
    respondWith([remoteBank, { ...remoteBank, bin: '97042' }, { ...remoteBank, bin: null }]);

    const banks = await service.list();
    expect(banks.map((bank) => bank.bin)).toEqual(['970422']);
  });

  it('gọi lần hai KHÔNG bắn request mới khi cache còn hạn', async () => {
    respondWith([remoteBank]);

    await service.list();
    await service.list();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('hết hạn cache thì lấy lại', async () => {
    respondWith([remoteBank]);
    await service.list();

    const later = Date.now() + BANKS_CACHE_TTL_MS + 1;
    jest.spyOn(Date, 'now').mockReturnValue(later);
    await service.list();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('hai lượt gọi cùng lúc chỉ bắn MỘT request — mở dialog là vài component cùng hỏi một lúc', async () => {
    let release: (value: unknown) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const first = service.list();
    const second = service.list();
    release({ ok: true, json: async () => ({ code: '00', data: [remoteBank] }) });
    await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('VietQR hỏng thì rơi về danh sách bundle sẵn, KHÔNG ném lỗi: không chọn được ngân hàng thì cả màn tạo tổ chức đứng', async () => {
    fetchMock.mockRejectedValue(new Error('ETIMEDOUT'));

    await expect(service.list()).resolves.toEqual(FALLBACK_BANKS);
  });

  it('VietQR trả HTTP lỗi cũng rơi về fallback', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

    await expect(service.list()).resolves.toEqual(FALLBACK_BANKS);
  });

  it('VietQR trả danh sách RỖNG cũng rơi về fallback — rỗng không phải một câu trả lời dùng được', async () => {
    respondWith([]);

    await expect(service.list()).resolves.toEqual(FALLBACK_BANKS);
  });

  it('lượt gọi hỏng KHÔNG được cache lại thành 24h dùng fallback', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ETIMEDOUT'));
    await service.list();

    respondWith([remoteBank]);
    const banks = await service.list();

    expect(banks.map((bank) => bank.bin)).toEqual(['970422']);
  });

  it('findByBin trả đúng ngân hàng, và null khi bin không có thật', async () => {
    respondWith([remoteBank]);

    await expect(service.findByBin('970422')).resolves.toMatchObject({ shortName: 'MBBank' });
    await expect(service.findByBin('123456')).resolves.toBeNull();
  });
});
