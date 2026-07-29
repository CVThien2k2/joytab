import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { RefreshToken } from '../generated/prisma/client';
import { REFRESH_TOKEN_BYTES, REFRESH_TOKEN_TTL_MS } from './auth.constants';

/** Cặp raw + row: raw đi vào cookie `rt`, row là bản ghi trong DB. */
type IssuedRefreshToken = { raw: string; row: { id: string } };

@Injectable()
export class RefreshTokenService {
  /**
   * Input: DatabaseService.
   * Output: Service quản lý vòng đời refresh token. RT là chuỗi random opaque — DB chỉ giữ
   *         SHA-256 nên DB bị lộ cũng không dựng lại được token gửi cho client.
   *         Service này KHÔNG biết gì về error code hay HTTP: nó trả row thô, controller tự
   *         quyết định từ chối thế nào.
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Input: userId.
   * Output: RT mới (raw để set cookie + row đã lưu). Một insert, không cần transaction.
   */
  async issue(userId: string): Promise<IssuedRefreshToken> {
    const raw = this.createRawToken();
    const row = await this.databaseService.refreshToken.create({
      data: {
        user_id: userId,
        token_hash: this.hashToken(raw),
        expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
      select: { id: true },
    });
    return { raw, row };
  }

  /**
   * Input: Chuỗi RT thô từ cookie `rt`.
   * Output: Row thô nếu hash khớp, ngược lại null. Không lọc revoked/expired — caller cần
   *         phân biệt "không tồn tại" với "đã revoke" (revoke = dấu hiệu token bị dùng lại).
   */
  async findByRawToken(raw: string): Promise<RefreshToken | null> {
    return this.databaseService.refreshToken.findUnique({ where: { token_hash: this.hashToken(raw) } });
  }

  /**
   * Input: id row cũ + userId chủ sở hữu.
   * Output: RT mới, đồng thời đánh dấu row cũ đã revoke và trỏ `replaced_by` sang row mới.
   *         Hai thao tác nằm trong 1 transaction: không được để tồn tại trạng thái vừa cấp
   *         token mới mà token cũ vẫn còn sống.
   */
  async rotate(oldId: string, userId: string): Promise<IssuedRefreshToken> {
    const raw = this.createRawToken();
    const row = await this.databaseService.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: {
          user_id: userId,
          token_hash: this.hashToken(raw),
          expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
        select: { id: true },
      });
      await tx.refreshToken.update({
        where: { id: oldId },
        data: { revoked_at: new Date(), replaced_by: created.id },
      });
      return created;
    });
    return { raw, row };
  }

  /**
   * Input: Chuỗi RT thô.
   * Output: Đánh dấu row tương ứng đã revoke. Bỏ qua im lặng nếu không khớp hoặc đã revoke —
   *         logout phải luôn thành công.
   */
  async revokeByRawToken(raw: string): Promise<void> {
    await this.databaseService.refreshToken.updateMany({
      where: { token_hash: this.hashToken(raw), revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  /**
   * Input: userId.
   * Output: Revoke mọi refresh token còn sống của user. Dùng khi phát hiện RT bị dùng lại —
   *         dấu hiệu token đã bị copy nên cắt sạch, buộc đăng nhập lại ở mọi nơi.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.databaseService.refreshToken.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  /**
   * Input: Không nhận tham số.
   * Output: Chuỗi random hex dùng làm RT gửi cho client (không bao giờ lưu nguyên văn).
   */
  private createRawToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  }

  /**
   * Input: Chuỗi RT thô.
   * Output: SHA-256 hex digest để tra/lưu DB. Token đã đủ entropy (32 bytes random) nên
   *         không cần salt hay KDF chậm — không có gì để brute-force.
   */
  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
