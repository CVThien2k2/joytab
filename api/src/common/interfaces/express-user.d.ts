import { GoogleUser } from '../utils/types';

declare global {
  namespace Express {
    interface User extends GoogleUser {}
  }
}

export {};
