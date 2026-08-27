import {
  buildFrontendUrl,
  buildOnboardingRedirectUrl,
  sanitizeReturnToPath,
} from '../../../src/auth/auth.utils';

const FE = 'http://localhost:3005';

/**
 * `returnTo` là đích user cần quay lại sau khi đăng nhập. Nó đi từ FE → BE → Google → BE,
 * nên tới lúc dùng thì phải coi như dữ liệu của người ngoài: cho lọt một giá trị trỏ ra
 * ngoài là có open-redirect ngay trên luồng đăng nhập.
 */
describe('sanitizeReturnToPath', () => {
  it.each([
    ['/', '/'],
    ['/join/ABCD1234', '/join/ABCD1234'],
    ['/onboarding?next=/join/ABCD1234', '/onboarding?next=/join/ABCD1234'],
    ['  /join/ABCD1234  ', '/join/ABCD1234'],
  ])('nhận path nội bộ: %s', (input, expected) => {
    expect(sanitizeReturnToPath(input)).toBe(expected);
  });

  it.each([
    ['//evil.com/steal', 'host khác núp dưới dạng path'],
    ['https://evil.com', 'URL tuyệt đối'],
    ['http://localhost:3005/join/X', 'URL tuyệt đối kể cả đúng origin'],
    ['/a://evil.com', 'có "://" ở giữa'],
    ['/\\evil.com', 'dấu \\ — một số browser coi như /'],
    ['javascript:alert(1)', 'scheme thực thi mã'],
    ['join/ABCD1234', 'path tương đối không có / đầu'],
    ['/join/<script>', 'ký tự ngoài bảng cho phép'],
    ['/join/A B', 'khoảng trắng ở giữa'],
    ['', 'chuỗi rỗng'],
  ])('loại %s (%s)', (input) => {
    expect(sanitizeReturnToPath(input)).toBeNull();
  });

  it.each([undefined, null, 123, {}, []])('loại giá trị không phải chuỗi: %p', (input) => {
    expect(sanitizeReturnToPath(input)).toBeNull();
  });

  it('path đã lọc luôn dựng ra URL nằm trên origin của FE', () => {
    const safe = sanitizeReturnToPath('/join/ABCD1234');
    expect(new URL(buildFrontendUrl(FE, safe as string)).origin).toBe(FE);
  });
});

describe('buildOnboardingRedirectUrl', () => {
  it('không có returnTo → /onboarding trơn', () => {
    expect(buildOnboardingRedirectUrl(FE)).toBe(`${FE}/onboarding`);
  });

  it('có returnTo → gắn ?next= để khai xong đi tiếp đúng chỗ', () => {
    const url = new URL(buildOnboardingRedirectUrl(FE, '/join/ABCD1234'));
    expect(url.pathname).toBe('/onboarding');
    expect(url.searchParams.get('next')).toBe('/join/ABCD1234');
  });

  it('FRONTEND_ORIGIN thiếu/dư dấu / vẫn ra URL hợp lệ', () => {
    expect(buildOnboardingRedirectUrl('http://localhost:3005///')).toBe(`${FE}/onboarding`);
    expect(new URL(buildOnboardingRedirectUrl(undefined)).pathname).toBe('/onboarding');
  });
});
