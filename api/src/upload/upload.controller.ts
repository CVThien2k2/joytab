import { Body, Controller, Delete, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreatePresignedUploadDto } from './upload.dto';
import { UploadService } from './upload.service';

/**
 * Cấp quyền upload ảnh lên S3 cho client đã đăng nhập.
 *
 * Mọi route đều cần đăng nhập: presign là quyền GHI vào bucket, phát cho người lạ thì bucket
 * thành chỗ chứa file miễn phí của Internet.
 */
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * Input: cookie `at` + { folder, filename, contentType, organizationId? }.
   * Output: { url, fields, key, publicUrl } — client POST multipart thẳng lên `url`.
   *
   *         `organizationId` bắt buộc khi `folder` gắn tổ chức (DTO ép), và service kiểm caller
   *         có phải thành viên tổ chức đó không trước khi cấp quyền ghi.
   */
  @Post('presign')
  async presign(@Req() request: Request & { userId: string }, @Body() dto: CreatePresignedUploadDto) {
    return this.uploadService.createImagePost({ ...dto, userId: request.userId });
  }

  /**
   * Input: cookie `at` + ?key=...
   * Output: Envelope rỗng. Dùng để dọn ảnh mồ côi khi user chọn ảnh rồi bỏ giữa đường.
   *
   *         CHỈ xoá được key có tiền tố của app này — nếu không thì một request đủ để xoá ảnh
   *         của hub trong cùng bucket. Key không thuộc joytab thì im lặng bỏ qua chứ không báo
   *         lỗi: người gọi không cần biết key đó có tồn tại hay không.
   */
  @Delete()
  async remove(@Query('key') key?: string) {
    if (this.uploadService.isOwnKey(key)) await this.uploadService.delete(key as string);
  }
}
