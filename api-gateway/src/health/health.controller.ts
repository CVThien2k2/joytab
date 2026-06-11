import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  /**
   * Input: Không có.
   * Output: 200 { status: 'ok' } cho liveness probe của gateway (không proxy xuống core).
   */
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
