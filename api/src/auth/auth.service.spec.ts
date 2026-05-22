import { GoogleUser } from '../common/utils/types';
import { AuthService } from './auth.service';

describe('AuthService', () => {
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
