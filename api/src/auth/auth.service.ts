import { Injectable, Logger } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { Gender, GENDERS, GoogleUser, UserProfile } from '../common/utils/types';
import { DatabaseService } from '../database/database.service';
import { UploadService } from '../upload/upload.service';
import { CompleteOnboardingDto, UpdateProfileDto } from './onboarding.dto';

type CurrentUser = { userId: string; user: UserProfile };

/** Cột cần cho UserProfile — dùng chung cho mọi truy vấn user của luồng auth. */
type UserRow = {
  provider_user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  age: number | null;
  gender: string | null;
  phone: string | null;
  onboarded: boolean;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Input: DatabaseService.
   * Output: Service nghiệp vụ user của luồng auth. Việc cấp/xoay token nằm ở AuthJwtService
   *         và RefreshTokenService — service này không biết gì về token.
   */
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * Input: Google profile đã validate.
   * Output: Upsert user theo provider_user_id, trả { userId, user }. Không tạo session,
   *         không ghi nhận thiết bị.
   *
   *         KHÔNG chạm tới age/gender/phone/onboarded: đó là dữ liệu user tự khai, Google
   *         không biết và login lại không được phép xoá.
   */
  async loginWithGoogle(googleUser: GoogleUser): Promise<CurrentUser> {
    const user = await this.upsertGoogleUser(googleUser);
    return { userId: user.id, user: this.toUserProfile(user) };
  }

  /**
   * Input: userId từ JwtAuthGuard hoặc từ claim `sub` của refresh token.
   * Output: Thông tin user hiện tại; AUTH_001 nếu user không còn tồn tại.
   */
  async getMe(userId: string): Promise<CurrentUser> {
    const user = await this.databaseService.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppException(ERROR_CODES.AUTH_001);
    return { userId: user.id, user: this.toUserProfile(user) };
  }

  /**
   * Input: userId đã xác thực + 4 field đã qua ValidationPipe.
   * Output: Ghi thông tin user tự khai và bật cờ `onboarded`, trả về user mới nhất.
   *
   *         Idempotent có chủ ý: gọi lại khi đã onboarded chỉ là cập nhật thông tin, không
   *         ném lỗi. Người dùng bấm submit hai lần (mạng chậm) không được nhận lỗi vô nghĩa.
   *
   *         `full_name` bị GHI ĐÈ bằng tên user tự xác nhận — kể từ đây tên trong Google
   *         không còn là nguồn sự thật; login lại chỉ đồng bộ email/avatar.
   */
  async completeOnboarding(userId: string, dto: CompleteOnboardingDto): Promise<CurrentUser> {
    const user = await this.databaseService.user.update({
      where: { id: userId },
      data: {
        full_name: dto.fullName,
        age: dto.age,
        gender: dto.gender,
        phone: dto.phone,
        onboarded: true,
      },
    });
    return { userId: user.id, user: this.toUserProfile(user) };
  }

  /**
   * Input: userId đã xác thực + các field cần đổi (đều tuỳ chọn).
   * Output: User sau khi cập nhật.
   *
   *         Chỉ ghi những field CÓ trong body: `undefined` = không đổi, còn `avatarUrl: null` =
   *         xoá ảnh. Nếu dựng data bằng cách trải nguyên dto thì Prisma coi `undefined` là
   *         không đổi (đúng), nhưng ta vẫn lọc tay để ý định đọc được từ code.
   *
   *         Ảnh cũ trên S3 bị xoá khi user đổi/xoá avatar — không dọn thì mỗi lần đổi ảnh là
   *         thêm một file mồ côi trong bucket, không ai biết để xoá. Ảnh Google (URL ngoài
   *         bucket) thì `extractKey` trả null nên không chạm tới.
   *
   *         KHÔNG đổi `onboarded`: đây là sửa thông tin, không phải bước xác nhận. User chưa
   *         onboarding cũng không vào được trang này (proxy đá về /onboarding).
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<CurrentUser> {
    const current = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { avatar_url: true },
    });
    if (!current) throw new AppException(ERROR_CODES.AUTH_001);

    const user = await this.databaseService.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined ? { full_name: dto.fullName } : {}),
        ...(dto.age !== undefined ? { age: dto.age } : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.avatarUrl !== undefined ? { avatar_url: dto.avatarUrl } : {}),
      },
    });

    if (dto.avatarUrl !== undefined && dto.avatarUrl !== current.avatar_url) {
      await this.deleteStoredImage(current.avatar_url);
    }

    return { userId: user.id, user: this.toUserProfile(user) };
  }

  /**
   * Input: URL ảnh cũ (có thể null, có thể là URL Google).
   * Output: Xoá file trên S3 nếu đó là file của app này. Lỗi xoá chỉ ghi log chứ KHÔNG ném:
   *         người dùng đã đổi ảnh thành công, làm họ thấy lỗi vì một file rác là sai trọng tâm.
   */
  private async deleteStoredImage(url: string | null): Promise<void> {
    const key = this.uploadService.extractKey(url);
    if (!key) return;
    try {
      await this.uploadService.delete(key);
    } catch (err) {
      this.logger.warn(`Không xoá được ảnh cũ ${key}: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Input: Row users vừa đọc/ghi.
   * Output: UserProfile trả cho FE.
   *
   *         `gender` lưu VarChar nên về nguyên tắc DB có thể chứa giá trị lạ (sửa tay, dữ
   *         liệu cũ) — lọc lại về null thay vì tin mù, để FE luôn nhận đúng union đã hẹn.
   */
  private toUserProfile(user: UserRow): UserProfile {
    return {
      provider: 'google',
      providerUserId: user.provider_user_id,
      email: user.email,
      fullName: user.full_name,
      avatarUrl: user.avatar_url,
      age: user.age,
      gender: this.toGender(user.gender),
      phone: user.phone,
      onboarded: user.onboarded,
    };
  }

  private toGender(value: string | null): Gender | null {
    return GENDERS.includes(value as Gender) ? (value as Gender) : null;
  }

  /**
   * Input: Google user đã validate.
   * Output: Upsert bản ghi users theo provider_user_id; trả user mới nhất.
   *
   *         `full_name` chỉ set ở `create`: user đã onboarding là đã tự xác nhận tên, login
   *         lại không được đè tên Google lên tên họ đã sửa.
   */
  private async upsertGoogleUser(googleUser: GoogleUser) {
    const now = new Date();
    return this.databaseService.user.upsert({
      where: { provider_user_id: googleUser.providerUserId },
      update: {
        provider: googleUser.provider,
        email: googleUser.email,
        avatar_url: googleUser.avatarUrl,
        status: 'active',
        last_login_at: now,
      },
      create: {
        provider: googleUser.provider,
        provider_user_id: googleUser.providerUserId,
        email: googleUser.email,
        full_name: googleUser.fullName,
        avatar_url: googleUser.avatarUrl,
        status: 'active',
        last_login_at: now,
      },
    });
  }
}
