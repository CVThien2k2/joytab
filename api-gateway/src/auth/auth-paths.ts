/**
 * Route "public" — không bắt buộc session; gateway chỉ inject identity nếu có cookie hợp lệ.
 * Gồm OAuth, switch (dùng device cookie), logout, accounts.
 */
const PUBLIC_PREFIXES = [
  '/auth/google',
  '/auth/switch',
  '/auth/logout',
  '/auth/accounts',
];

/**
 * Input: path của request (vd '/auth/google/callback').
 * Output: true nếu là route public (không bắt buộc xác thực session).
 */
export function isPublicPath(path: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) =>
      path === prefix ||
      path.startsWith(`${prefix}/`) ||
      path.startsWith(`${prefix}?`),
  );
}
