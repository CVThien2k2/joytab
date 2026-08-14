import { GoogleUser, RequestMembership } from '../utils/types';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends GoogleUser {}

    /**
     * Các trường do guard gắn vào request. Khai ở đây thay vì ép kiểu tại chỗ
     * (`request as Request & { userId: string }`) để mọi controller đọc cùng một định nghĩa.
     *
     * Đều optional vì không phải route nào cũng qua guard; đọc trong handler đã đứng sau
     * guard thì chắc chắn có giá trị — đó là lý do @CurrentUser/@CurrentMembership tồn tại.
     */
    interface Request {
      userId?: string;
      userEmail?: string;
      membership?: RequestMembership;
    }
  }
}

export {};
