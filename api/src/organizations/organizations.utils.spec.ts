import { buildInviteUrl, generateInviteToken, hashInviteToken, isInviteUsable } from './organizations.utils';

const NOW = new Date('2026-08-13T10:00:00Z');
const unlimited = { revoked_at: null, expires_at: null, max_uses: null, used_count: 0 };

describe('isInviteUsable', () => {
  it('link không hạn, không giới hạn lượt thì luôn dùng được', () => {
    expect(isInviteUsable(unlimited, NOW)).toBe(true);
  });

  it('đã thu hồi thì không dùng được, kể cả khi còn hạn và còn lượt', () => {
    expect(isInviteUsable({ ...unlimited, revoked_at: new Date('2026-08-12T00:00:00Z') }, NOW)).toBe(false);
  });

  it('trước hạn một giây vẫn dùng được', () => {
    expect(isInviteUsable({ ...unlimited, expires_at: new Date('2026-08-13T10:00:01Z') }, NOW)).toBe(true);
  });

  it('đúng mốc hết hạn là hết dùng được', () => {
    expect(isInviteUsable({ ...unlimited, expires_at: NOW }, NOW)).toBe(false);
  });

  it('quá hạn thì không dùng được', () => {
    expect(isInviteUsable({ ...unlimited, expires_at: new Date('2026-08-13T09:59:59Z') }, NOW)).toBe(false);
  });

  it('còn đúng một lượt cuối vẫn dùng được', () => {
    expect(isInviteUsable({ ...unlimited, max_uses: 5, used_count: 4 }, NOW)).toBe(true);
  });

  it('hết lượt thì không dùng được', () => {
    expect(isInviteUsable({ ...unlimited, max_uses: 5, used_count: 5 }, NOW)).toBe(false);
  });

  it('used_count vượt max (do dữ liệu cũ) vẫn bị chặn', () => {
    expect(isInviteUsable({ ...unlimited, max_uses: 5, used_count: 6 }, NOW)).toBe(false);
  });
});

describe('hashInviteToken', () => {
  it('cùng token cho cùng hash, khác token cho khác hash', () => {
    expect(hashInviteToken('abc')).toBe(hashInviteToken('abc'));
    expect(hashInviteToken('abc')).not.toBe(hashInviteToken('abd'));
  });

  it('hash không chứa token gốc — DB lộ cũng không dựng lại được link', () => {
    const token = generateInviteToken();
    expect(hashInviteToken(token)).toHaveLength(64);
    expect(hashInviteToken(token)).not.toContain(token);
  });
});

describe('generateInviteToken', () => {
  it('sinh 32 byte ngẫu nhiên dạng hex, không trùng nhau', () => {
    const first = generateInviteToken();
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(generateInviteToken());
  });
});

describe('buildInviteUrl', () => {
  it('dựng URL theo FRONTEND_ORIGIN', () => {
    expect(buildInviteUrl('https://joytab.vn', 'tok')).toBe('https://joytab.vn/invite/tok');
  });

  it('bỏ dấu / thừa ở cuối origin', () => {
    expect(buildInviteUrl('https://joytab.vn///', 'tok')).toBe('https://joytab.vn/invite/tok');
  });

  it('thiếu env thì fallback localhost', () => {
    expect(buildInviteUrl(undefined, 'tok')).toBe('http://localhost:3000/invite/tok');
    expect(buildInviteUrl('   ', 'tok')).toBe('http://localhost:3000/invite/tok');
  });
});
