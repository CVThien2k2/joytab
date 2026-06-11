import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { SESSION_RENEW_THRESHOLD_MS, SESSION_TOKEN_BYTES, SESSION_TTL_MS } from './auth.constants';

@Injectable()
export class TokenService {
  /**
   * Input: Không nhận tham số.
   * Output: Cặp { raw, hash } cho session token — raw set vào cookie, hash lưu DB.
   */
  createSessionToken(): { raw: string; hash: string } {
    const raw = randomBytes(SESSION_TOKEN_BYTES).toString('hex');
    return { raw, hash: this.hashToken(raw) };
  }

  /**
   * Input: Chuỗi token raw.
   * Output: SHA-256 hex digest để tra/lưu DB.
   */
  hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Input: Không nhận tham số.
   * Output: TTL session (ms) để dựng expires_at.
   */
  getSessionTtlMs(): number {
    return SESSION_TTL_MS;
  }

  /**
   * Input: Không nhận tham số.
   * Output: Ngưỡng (ms) còn lại để kích hoạt sliding renew.
   */
  getSessionRenewThresholdMs(): number {
    return SESSION_RENEW_THRESHOLD_MS;
  }
}
