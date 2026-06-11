/**
 * Route "public" — không bắt buộc session; gateway chỉ inject identity nếu có cookie hợp lệ.
 * Gồm OAuth, switch (dùng device cookie), logout, accounts.
 */
const PUBLIC_PREFIXES = [
  '/api/v1/auth/google',
  '/api/v1/auth/switch',
  '/api/v1/auth/logout',
  '/api/v1/auth/accounts',
];

/**
 * Input: path của request (vd '/api/v1/auth/google/callback').
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
