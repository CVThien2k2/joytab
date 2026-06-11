import { Global, Module } from '@nestjs/common';
import { SessionStoreService } from './session-store.service';

/**
 * Input: Không có.
 * Output: Module global cung cấp SessionStoreService cho middleware auth.
 */
@Global()
@Module({
  providers: [SessionStoreService],
  exports: [SessionStoreService],
})
export class SessionStoreModule {}
