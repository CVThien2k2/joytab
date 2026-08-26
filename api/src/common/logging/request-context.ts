import { AsyncLocalStorage } from 'async_hooks';
import { randomBytes } from 'crypto';

/**
 * Ngữ cảnh của một request. `id` để nối mọi dòng log cùng một lượt gọi; `user` được gắn
 * sau khi JwtAuthGuard verify xong nên các dòng log trước đó (vd access log của request
 * chưa đăng nhập) chỉ có `id`.
 */
export type RequestContext = { id: string; email?: string; userId?: string };

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Input: Không nhận tham số.
 * Output: Context mới với id ngắn 8 ký tự hex — đủ phân biệt trong một file log ngày.
 */
export function createRequestContext(): RequestContext {
  return { id: randomBytes(4).toString('hex') };
}

/**
 * Input: Context và hàm cần chạy trong context đó.
 * Output: Chạy callback sao cho mọi log phát sinh bên trong (kể cả sau await) thấy được context.
 */
export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  return storage.run(context, callback);
}

/**
 * Input: email + userId lấy từ access token đã verify.
 * Output: Gắn danh tính vào context hiện tại. Không có context (vd log lúc bootstrap) thì bỏ qua.
 */
export function tagCurrentUser(email: string, userId: string): void {
  const context = storage.getStore();
  if (!context) return;
  context.email = email;
  context.userId = userId;
}

/**
 * Input: Không nhận tham số.
 * Output: Tag dạng `[req=<id>]`, có user thì `[req=<id> email=<email> id=<userId>]`;
 *         rỗng khi ngoài request. Mỗi trường có nhãn để grep theo đúng khoá
 *         (`grep 'email=a@b.com'`) chứ không phải đoán theo vị trí.
 *         PHẢI gọi đồng bộ tại thời điểm log — AppLogger ghi trễ qua queue nên nếu đọc ở lúc
 *         ghi thì context đã mất.
 */
export function currentLogTag(): string {
  const context = storage.getStore();
  if (!context) return '';
  const parts = [`req=${context.id}`];
  if (context.email) parts.push(`email=${context.email}`);
  if (context.userId) parts.push(`id=${context.userId}`);
  return `[${parts.join(' ')}]`;
}
