import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { DatabaseService } from '../database/database.service';
import { CreateEventTemplateDto } from './dto/create-event-template.dto';
import { UpdateEventTemplateDto } from './dto/update-event-template.dto';
import { formatTimeOfDay, parseTimeOfDay } from './events.utils';

type TemplateView = {
  id: string;
  organizationId: string;
  name: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  locationName: string | null;
  locationAddress: string | null;
  courtCost: number;
  maxParticipants: number;
  voteLockMinutesBefore: number;
  active: boolean;
  createdAt: Date;
};

@Injectable()
export class TemplatesService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Input: orgId, admin tạo và cấu hình lịch định kỳ.
   * Output: Template mới. Cron sẽ tự sinh event từ nó ở lần chạy kế tiếp; muốn thấy ngay
   *         thì gọi POST /organizations/:orgId/templates/:id/generate.
   */
  async create(organizationId: string, createdBy: string, dto: CreateEventTemplateDto): Promise<TemplateView> {
    const template = await this.databaseService.eventTemplate.create({
      data: {
        organization_id: organizationId,
        name: dto.name,
        day_of_week: dto.dayOfWeek,
        start_time: parseTimeOfDay(dto.startTime),
        end_time: parseTimeOfDay(dto.endTime),
        location_name: dto.locationName ?? null,
        location_address: dto.locationAddress ?? null,
        court_cost: dto.courtCost,
        max_participants: dto.maxParticipants,
        vote_lock_minutes_before: dto.voteLockMinutesBefore ?? 0,
        active: dto.active ?? true,
        created_by: createdBy,
      },
    });

    return this.toTemplateView(template);
  }

  /**
   * Input: orgId.
   * Output: Toàn bộ template của tổ chức, template đang bật xếp trước.
   */
  async list(organizationId: string): Promise<TemplateView[]> {
    const templates = await this.databaseService.eventTemplate.findMany({
      where: { organization_id: organizationId },
      orderBy: [{ active: 'desc' }, { day_of_week: 'asc' }, { start_time: 'asc' }],
    });

    return templates.map((template) => this.toTemplateView(template));
  }

  /**
   * Input: orgId và id template.
   * Output: Template sau khi cập nhật. Field không truyền thì giữ nguyên.
   */
  async update(organizationId: string, templateId: string, dto: UpdateEventTemplateDto): Promise<TemplateView> {
    await this.requireTemplate(organizationId, templateId);
    const updated = await this.databaseService.eventTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.dayOfWeek !== undefined ? { day_of_week: dto.dayOfWeek } : {}),
        ...(dto.startTime !== undefined ? { start_time: parseTimeOfDay(dto.startTime) } : {}),
        ...(dto.endTime !== undefined ? { end_time: parseTimeOfDay(dto.endTime) } : {}),
        ...(dto.locationName !== undefined ? { location_name: dto.locationName } : {}),
        ...(dto.locationAddress !== undefined ? { location_address: dto.locationAddress } : {}),
        ...(dto.courtCost !== undefined ? { court_cost: dto.courtCost } : {}),
        ...(dto.maxParticipants !== undefined ? { max_participants: dto.maxParticipants } : {}),
        ...(dto.voteLockMinutesBefore !== undefined ? { vote_lock_minutes_before: dto.voteLockMinutesBefore } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });

    return this.toTemplateView(updated);
  }

  /**
   * Input: orgId và id template.
   * Output: Xoá template. Các event đã sinh KHÔNG bị xoá theo — `source_template_id` chuyển
   *         về null (onDelete: SetNull), buổi đánh đã có người vote vẫn nguyên vẹn.
   */
  async remove(organizationId: string, templateId: string): Promise<{ id: string }> {
    await this.requireTemplate(organizationId, templateId);
    await this.databaseService.eventTemplate.delete({ where: { id: templateId } });

    return { id: templateId };
  }

  /**
   * Input: orgId và id template.
   * Output: Template; không thuộc org hoặc không tồn tại → TPL_001.
   */
  async requireTemplate(organizationId: string, templateId: string) {
    const template = await this.databaseService.eventTemplate.findFirst({
      where: { id: templateId, organization_id: organizationId },
    });
    if (!template) throw new AppException(ERROR_CODES.TPL_001);

    return template;
  }

  private toTemplateView(template: {
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
    active: boolean;
    created_at: Date;
  }): TemplateView {
    return {
      id: template.id,
      organizationId: template.organization_id,
      name: template.name,
      dayOfWeek: template.day_of_week,
      startTime: formatTimeOfDay(template.start_time),
      endTime: formatTimeOfDay(template.end_time),
      locationName: template.location_name,
      locationAddress: template.location_address,
      courtCost: template.court_cost,
      maxParticipants: template.max_participants,
      voteLockMinutesBefore: template.vote_lock_minutes_before,
      active: template.active,
      createdAt: template.created_at,
    };
  }
}
