import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { requireMembership } from '../common/utils/membership';
import { DatabaseService } from '../database/database.service';
import {
  isOrgScopedFolder,
  organizationKeyPrefix,
  UPLOAD_IMAGE_CONTENT_TYPES,
  UPLOAD_KEY_PREFIX,
  UPLOAD_MAX_BYTES,
  UPLOAD_POLICY_EXPIRES_SECONDS,
  UploadFolder,
} from './upload.constants';

/** S3 giới hạn tối đa 1000 key mỗi lần gọi DeleteObjects. */
const S3_DELETE_BATCH_SIZE = 1000;

/** Kết quả presigned POST trả cho client. */
export interface PresignedPost {
  url: string;
  fields: Record<string, string>;
  key: string;
  publicUrl: string;
}

/**
 * Cấp presigned POST để client upload ảnh TRỰC TIẾP lên S3, không đi qua API.
 *
 * Chép cách làm của hub (apps/api-core/src/upload/upload.service.ts), khác ba điểm:
 *  - Config đọc LAZY: hub gọi `getRequiredConfig` trong constructor nên thiếu env là API không
 *    lên nổi. Ở đây thiếu env thì chỉ luồng upload trả UPLOAD_001, phần còn lại chạy bình thường.
 *  - Key có tiền tố `joytab/`: bucket đang dùng chung với hub.
 *  - Content-type nằm trong allowlist ở DTO, không nhận bất kỳ `image/*`.
 *
 * Vì sao presigned POST chứ không upload qua API: file 5MB đi qua Node là 5MB RAM và một
 * connection giữ suốt thời gian mạng của client — S3 làm việc đó tốt hơn, và API không phải
 * mở route nhận multipart.
 */
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint?: string;
  /** null khi thiếu env — mọi hàm public phải kiểm trước khi dùng. */
  private readonly s3: S3Client | null;

  constructor(
    config: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    this.region = config.get<string>('AWS_REGION') ?? '';
    this.bucket = config.get<string>('AWS_S3_BUCKET') ?? '';
    this.endpoint = config.get<string>('AWS_ENDPOINT') || undefined;

    const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY') ?? '';

    if (!this.region || !this.bucket || !accessKeyId || !secretAccessKey) {
      this.s3 = null;
      this.logger.warn('S3 chưa cấu hình đủ (AWS_*) — luồng tải ảnh sẽ trả UPLOAD_001');
      return;
    }

    this.s3 = new S3Client({
      region: this.region,
      credentials: { accessKeyId, secretAccessKey },
      // forcePathStyle cho LocalStack/MinIO: chúng không có DNS ảo theo tên bucket.
      ...(this.endpoint ? { endpoint: this.endpoint, forcePathStyle: true } : {}),
    });
  }

  /**
   * Input: thư mục đích, tên tệp gốc, loại MIME, userId đang xin presign, và `organizationId`
   *        khi thư mục thuộc nhóm gắn tổ chức (xem ORG_SCOPED_UPLOAD_FOLDERS).
   * Output: URL + fields để client POST thẳng ảnh lên S3, kèm `key` (để xoá sau) và `publicUrl`
   *         (để lưu vào DB và hiển thị).
   *
   *         Ràng buộc đặt TẠI S3 qua policy: dung lượng 1 byte–5MB và Content-Type phải khớp
   *         đúng cái client đã khai. Nhờ vậy client không thể xin presign cho ảnh 1KB rồi đẩy
   *         file 2GB, mà API cũng không phải nhìn thấy byte nào.
   *
   *         Thư mục gắn tổ chức thì BẮT BUỘC kiểm caller là thành viên của `organizationId` đó
   *         trước khi cấp quyền ghi — DTO chỉ đảm bảo `organizationId` có mặt, không đảm bảo
   *         caller thuộc về nó. Thiếu bước này thì bất kỳ ai đăng nhập cũng xin được presign ghi
   *         vào folder của một tổ chức bất kỳ.
   */
  async createImagePost(params: {
    folder: UploadFolder;
    filename: string;
    contentType: string;
    userId: string;
    organizationId?: string;
  }): Promise<PresignedPost> {
    const s3 = this.requireClient();
    if (isOrgScopedFolder(params.folder)) {
      // DTO đã ép organizationId bắt buộc cho nhóm folder này (@ValidateIf), nên tới đây nó
      // luôn có mặt — `as string` chỉ để TypeScript hết phàn nàn "possibly undefined".
      await requireMembership(this.databaseService, params.userId, params.organizationId as string);
    }
    const key = this.buildObjectKey(params.folder, params.filename, params.organizationId);

    const { url, fields } = await createPresignedPost(s3, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ['content-length-range', 1, UPLOAD_MAX_BYTES],
        ['eq', '$Content-Type', params.contentType],
      ],
      Fields: { 'Content-Type': params.contentType },
      Expires: UPLOAD_POLICY_EXPIRES_SECONDS,
    });

    return { url, fields, key, publicUrl: this.getPublicUrl(key) };
  }

  /**
   * Input: key của object.
   * Output: Xoá object. Dùng khi thay ảnh (dọn ảnh cũ) hoặc dọn ảnh mồ côi khi user bỏ giữa
   *         đường. S3 coi xoá key không tồn tại là thành công, nên gọi hai lần không sao.
   */
  async delete(key: string): Promise<void> {
    const s3 = this.requireClient();
    await s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /**
   * Input: URL công khai của một ảnh ĐANG lưu trong DB (có thể null, có thể không phải file
   *        của app này — vd ảnh Google của user đăng nhập bằng Google).
   * Output: Xoá file trên S3 nếu đó là file của app này. Lỗi xoá chỉ ghi log chứ KHÔNG ném: chỗ
   *         gọi hàm này luôn là dọn dẹp SAU MỘT thao tác đã thành công (đổi ảnh, xoá tổ chức...),
   *         làm hỏng thao tác đó vì một file rác là sai trọng tâm.
   *
   *         Gom một chỗ thay vì mỗi service tự chép `extractKey` + `delete` + log warn: trước
   *         đây `AuthService` có bản riêng, `OrganizationsService` sắp cần bản y hệt — hai bản
   *         chép tay là hai chỗ có thể lệch nhau khi sửa.
   */
  async deleteStoredImage(url: string | null | undefined): Promise<void> {
    const key = this.extractKey(url);
    if (!key) return;
    try {
      await this.delete(key);
    } catch (err) {
      this.logger.warn(`Không xoá được ảnh cũ ${key}: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Input: id tổ chức.
   * Output: Xoá SẠCH mọi object dưới `joytab/orgs/<organizationId>/` — mọi ảnh của tổ chức đó
   *         (QR, minh chứng thanh toán, và bất kỳ loại ảnh nào thêm sau này), không phải nhớ
   *         liệt kê từng trường ảnh trong DB.
   *
   *         Dùng khi xoá cả tổ chức. Không ném lỗi: tổ chức đã xoá xong ở DB, một lần dọn S3
   *         thất bại không được phép làm thao tác đó báo lỗi cho owner.
   *
   *         Phân trang bằng `ContinuationToken` vì `ListObjectsV2` trả tối đa 1000 key một lần;
   *         `DeleteObjects` cũng chỉ nhận tối đa 1000 key một lần nên xoá theo đúng từng trang.
   */
  async deleteOrganizationFolder(organizationId: string): Promise<void> {
    const s3 = this.requireClient();
    const prefix = `${organizationKeyPrefix(organizationId)}/`;

    try {
      let continuationToken: string | undefined;
      do {
        const page = await s3.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
            MaxKeys: S3_DELETE_BATCH_SIZE,
            ContinuationToken: continuationToken,
          }),
        );

        const keys = (page.Contents ?? []).flatMap((object) => (object.Key ? [{ Key: object.Key }] : []));
        if (keys.length > 0) {
          await s3.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys, Quiet: true } }));
        }

        continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (continuationToken);
    } catch (err) {
      this.logger.warn(`Không dọn hết ảnh của tổ chức ${organizationId}: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Input: URL công khai của một ảnh đã upload (thứ đang lưu trong DB).
   * Output: Key S3 tương ứng, hoặc null nếu URL không phải của bucket này.
   *
   *         Cần vì DB chỉ lưu URL: muốn xoá ảnh cũ lúc user đổi avatar thì phải suy ngược ra
   *         key. Trả null cho URL lạ (vd ảnh Google của user đăng nhập bằng Google) — đó không
   *         phải file của mình, không được xoá.
   */
  extractKey(publicUrl: string | null | undefined): string | null {
    if (!publicUrl) return null;
    const prefix = this.endpoint
      ? `${this.endpoint}/${this.bucket}/`
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com/`;
    if (!publicUrl.startsWith(prefix)) return null;

    const key = publicUrl.slice(prefix.length);
    // Chỉ nhận key của chính app này: bucket dùng chung với hub.
    return key.startsWith(`${UPLOAD_KEY_PREFIX}/`) ? key : null;
  }

  /**
   * Input: key S3 do client gửi lên (route xoá ảnh).
   * Output: true nếu key thuộc app này. Bucket dùng chung với hub, nên không lọc thì một request
   *         đủ để xoá ảnh của hub.
   */
  isOwnKey(key: string | null | undefined): boolean {
    return !!key && key.startsWith(`${UPLOAD_KEY_PREFIX}/`);
  }

  /** true khi env đủ để upload — FE không cần biết, nhưng test và log thì cần. */
  get isConfigured(): boolean {
    return this.s3 !== null;
  }

  /**
   * Input: Không nhận tham số.
   * Output: Client S3, hoặc ném UPLOAD_001 nếu môi trường chưa cấu hình. Gom một chỗ để mọi
   *         hàm public đều báo cùng một lỗi thay vì nổ `null.send is not a function`.
   */
  private requireClient(): S3Client {
    if (!this.s3) throw new AppException(ERROR_CODES.UPLOAD_001);
    return this.s3;
  }

  /**
   * Input: thư mục + tên tệp gốc + `organizationId` khi thư mục gắn tổ chức.
   * Output: Key duy nhất — `joytab/orgs/<organizationId>/<folder>/<slug>-<ts>-<uuid><ext>` cho
   *         thư mục gắn tổ chức, `joytab/<folder>/<slug>-<ts>-<uuid><ext>` cho `avatars`.
   *
   *         Không dùng lại tên tệp của client làm key: tên có thể chứa `../`, khoảng trắng,
   *         unicode, hoặc trùng tên tệp của người khác. Slug + timestamp + uuid vừa an toàn vừa
   *         không bao giờ trùng, mà vẫn đọc được là ảnh gì khi mở bucket ra xem.
   */
  private buildObjectKey(folder: UploadFolder, filename: string, organizationId?: string): string {
    const dot = filename.lastIndexOf('.');
    const ext = dot > 0 ? filename.slice(dot).toLowerCase() : '';
    const base = filename
      .slice(0, dot > 0 ? dot : filename.length)
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const folderPrefix =
      isOrgScopedFolder(folder) && organizationId
        ? `${organizationKeyPrefix(organizationId)}/${folder}`
        : `${UPLOAD_KEY_PREFIX}/${folder}`;

    return `${folderPrefix}/${base || 'image'}-${Date.now()}-${randomUUID()}${ext}`;
  }

  /**
   * Input: key của object.
   * Output: URL công khai — path-style khi có endpoint (LocalStack/MinIO), virtual-host khi
   *         chạy S3 thật.
   */
  private getPublicUrl(key: string): string {
    return this.endpoint
      ? `${this.endpoint}/${this.bucket}/${key}`
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}

/** Re-export để controller và test khỏi phải import từ constants. */
export { UPLOAD_IMAGE_CONTENT_TYPES };
