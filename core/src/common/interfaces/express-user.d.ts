import { GoogleUser } from '../utils/types';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends GoogleUser {}
  }
}

export {};
