import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { GoogleUser } from '../common/utils/types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  buildGoogleLoginSuccessRedirectUrl,
  resolveGoogleLoginRedirectTarget,
} from './auth.utils';

describe('AuthModule unit tests', () => {
  const googleUser: GoogleUser = {
    provider: 'google',
    providerUserId: 'google-1',
    email: 'user@example.com',
    emailVerified: true,
    fullName: 'Test User',
    avatarUrl: 'https://example.com/avatar.png',
  };

  /**
   * Input: Mock DatabaseService với user.findUnique/update/create.
   * Output: Trả service sẵn sàng cho unit test mà không cần kết nối DB thật.
   */
  function createServiceWithDbMock() {
    const dbMock = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    const service = new AuthService(dbMock as never);
    return { service, dbMock };
  }

  /**
   * Input: Giá trị FRONTEND_ORIGIN giả lập cho test controller callback.
   * Output: Trả controller cùng mock service/config/response để xác nhận redirect sau login Google.
   */
  function createController(frontendOrigin = 'http://localhost:3000') {
    const loginWithGoogleMock = jest.fn().mockResolvedValue({
      success: true,
    });
    const authService = {
      loginWithGoogle: loginWithGoogleMock,
    } as unknown as AuthService;
    const configService = {
      get: jest.fn((key: string) =>
        key === 'FRONTEND_ORIGIN' ? frontendOrigin : null,
      ),
    } as unknown as ConfigService;

    const controller = new AuthController(authService, configService);
    const redirectMock = jest.fn();
    const response = {
      redirect: redirectMock,
    } as unknown as Response;

    return {
      controller,
      response,
      mocks: {
        loginWithGoogleMock,
        redirectMock,
      },
    };
  }

  describe('AuthService', () => {
    it('creates user when provider and email do not exist', async () => {
      const { service, dbMock } = createServiceWithDbMock();
      dbMock.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      dbMock.user.create.mockResolvedValue({
        id: 'user-id',
        email: googleUser.email,
        full_name: googleUser.fullName,
        avatar_url: googleUser.avatarUrl,
        provider: googleUser.provider,
        provider_user_id: googleUser.providerUserId,
        last_login_at: new Date(),
      });

      const result = await service.loginWithGoogle(googleUser);

      expect(dbMock.user.create).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.data.providerUserId).toBe(googleUser.providerUserId);
    });
  });

  describe('AuthController', () => {
    it('redirects to state redirectTo and appends success flags', async () => {
      const { controller, response, mocks } = createController(
        'http://localhost:3001',
      );
      const request = {
        user: { email: 'demo@joytab.dev' },
        query: {
          state: 'http://localhost:3001/dashboard?tab=1',
        },
      } as unknown as Request;

      await controller.googleCallback(request, response);

      expect(mocks.loginWithGoogleMock).toHaveBeenCalledWith(request.user);
      expect(mocks.redirectMock).toHaveBeenCalledWith(
        302,
        'http://localhost:3001/dashboard?tab=1&loginProvider=google&loginStatus=success',
      );
    });

    it('falls back to FE root when state redirect is missing', async () => {
      const { controller, response, mocks } = createController();
      const request = {
        user: { email: 'demo@joytab.dev' },
        query: {},
      } as unknown as Request;

      await controller.googleCallback(request, response);

      expect(mocks.redirectMock).toHaveBeenCalledWith(
        302,
        'http://localhost:3000?loginProvider=google&loginStatus=success',
      );
    });
  });

  describe('Auth utils', () => {
    it('resolves relative redirect path against FE base URL', () => {
      const target = resolveGoogleLoginRedirectTarget({
        redirectTo: '/dashboard?tab=1',
        frontendOrigin: 'http://localhost:3000',
      });

      expect(target).toBe('http://localhost:3000/dashboard?tab=1');
    });

    it('falls back to FE root when redirect target is external origin', () => {
      const target = resolveGoogleLoginRedirectTarget({
        redirectTo: 'https://evil.example.com/steal',
        frontendOrigin: 'http://localhost:3000',
      });

      expect(target).toBe('http://localhost:3000');
    });

    it('builds success redirect URL with required query flags', () => {
      const target = buildGoogleLoginSuccessRedirectUrl(
        'http://localhost:3001/dashboard',
      );
      const parsedUrl = new URL(target);

      expect(parsedUrl.searchParams.get('loginProvider')).toBe('google');
      expect(parsedUrl.searchParams.get('loginStatus')).toBe('success');
    });
  });
});
