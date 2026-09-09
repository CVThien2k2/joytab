import { IsIn, IsNotEmpty, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { isOrgScopedFolder, UPLOAD_FOLDERS, UPLOAD_IMAGE_CONTENT_TYPES, UploadFolder } from './upload.constants';

/** Body của POST /upload/presign — xin quyền upload MỘT ảnh lên S3. */
export class CreatePresignedUploadDto {
  /** Thư mục đích; chỉ nhận giá trị trong allowlist (xem UPLOAD_FOLDERS). */
  @IsIn(UPLOAD_FOLDERS, { message: 'Thư mục tải lên không hợp lệ' })
  folder: UploadFolder;

  /** Tên tệp gốc — chỉ dùng để suy đuôi file và slug hoá, không dùng làm key. */
  @IsString({ message: 'Tên tệp không hợp lệ' })
  @IsNotEmpty({ message: 'Tên tệp không hợp lệ' })
  @MaxLength(255, { message: 'Tên tệp quá dài' })
  filename: string;

  /**
   * Id tổ chức — bắt buộc khi `folder` thuộc nhóm gắn tổ chức (xem ORG_SCOPED_UPLOAD_FOLDERS),
   * bỏ qua với `avatars`. Service kiểm caller có phải thành viên của tổ chức này không TRƯỚC
   * khi cấp presign — thiếu kiểm tra này thì ai đăng nhập cũng xin được quyền ghi vào bất kỳ
   * tổ chức nào.
   */
  @ValidateIf((dto: CreatePresignedUploadDto) => isOrgScopedFolder(dto.folder))
  @IsUUID(undefined, { message: 'Id tổ chức không hợp lệ' })
  organizationId?: string;

  /**
   * Loại MIME của ảnh. Vào policy của S3 nên client gửi sai là S3 từ chối — nhưng vẫn phải
   * chặn ở đây: policy chỉ bảo đảm file khớp đúng loại client KHAI, không bảo đảm loại đó an toàn.
   */
  @IsIn(UPLOAD_IMAGE_CONTENT_TYPES, { message: 'Chỉ nhận ảnh JPEG, PNG, WebP hoặc GIF' })
  contentType: string;
}
