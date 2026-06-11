import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SessionStoreModule } from './session/session-store.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SessionStoreModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
