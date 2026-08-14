import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { toDateOnly } from '../common/utils/timezone';
import { DatabaseService } from '../database/database.service';
import { EventStatus } from '../generated/prisma/enums';
import { EVENT_GENERATION_CRON, EVENT_GENERATION_TIMEZONE, EVENT_GENERATION_WINDOW_DAYS } from './events.constants';
import { buildOccurrenceTiming, computeOccurrenceDates } from './events.utils';

type GeneratableTemplate = {
  id: string;
  organization_id: string;
  name: string;
  day_of_week: number;
  start_time: Date;
  end_time: Date;
  location_name: string | null;
  location_address: string | null;
  court_cost: number;
  max_participants: number;
  vote_lock_minutes_before: number;
  created_by: string;
};

@Injectable()
export class EventGeneratorService {
  private readonly logger = new Logger(EventGeneratorService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Input: Không có — chạy 01:00 mỗi ngày theo giờ VN.
   * Output: Sinh event cho mọi template đang bật trong cửa sổ 14 ngày tới.
   *
   * Chạy nhiều instance API cùng lúc sẽ chạy cron nhiều lần — vô hại nhờ `skipDuplicates`
   * dựa trên UNIQUE (source_template_id, occurrence_date), nên không cần distributed lock.
   */
  @Cron(EVENT_GENERATION_CRON, { timeZone: EVENT_GENERATION_TIMEZONE })
  async generateForAllTemplates(): Promise<void> {
    const templates = await this.databaseService.eventTemplate.findMany({ where: { active: true } });
    let total = 0;
    for (const template of templates) {
      total += await this.generateForTemplate(template);
    }
    this.logger.log(`Generated ${total} event(s) from ${templates.length} active template(s)`);
  }

  /**
   * Input: Một template.
   * Output: Số event thực sự được tạo mới.
   *
   * Idempotent: chạy lại bao nhiêu lần cũng không đẻ trùng. Mọi trường đều copy từ template
   * để buổi đã sinh sống độc lập — sửa template sau này không đụng vào nó.
   */
  async generateForTemplate(template: GeneratableTemplate, from: Date = new Date()): Promise<number> {
    const occurrenceDates = computeOccurrenceDates(from, EVENT_GENERATION_WINDOW_DAYS, template.day_of_week);
    if (occurrenceDates.length === 0) return 0;

    const rows = occurrenceDates.map((occurrenceDate) => {
      const timing = buildOccurrenceTiming(template, occurrenceDate);
      return {
        organization_id: template.organization_id,
        title: template.name,
        start_at: timing.startAt,
        end_at: timing.endAt,
        location_name: template.location_name,
        location_address: template.location_address,
        court_cost: template.court_cost,
        extra_costs: [],
        max_participants: template.max_participants,
        vote_locked_at: timing.voteLockedAt,
        status: EventStatus.OPEN,
        source_template_id: template.id,
        occurrence_date: toDateOnly(occurrenceDate),
        created_by: template.created_by,
      };
    });

    const result = await this.databaseService.event.createMany({ data: rows, skipDuplicates: true });
    return result.count;
  }
}
