# Quy Tắc Cấu Trúc Dự Án

## Mục tiêu
Giữ ranh giới module rõ ràng để tránh sửa lan ngoài phạm vi.

## Quy tắc cấu trúc
- Mã backend chỉ nằm trong `api/`.
- Mã frontend chỉ nằm trong `ui/`.
- Nội dung tài liệu dự án chỉ nằm trong `docs/`.
- Cấu hình docs chỉ nằm trong `zensical.toml` và `.github/workflows/docs.yml`.

## Quy tắc vệ sinh repository
- Không đặt mã tính năng ở root repository.
- Không commit artifact sinh tự động như `site/`, thư mục build, cache runtime.
- Không đặt tài liệu dự án ở root (ngoại trừ file governance như `AGENTS.md`).

## Quy tắc khi tái cấu trúc
- Chỉ di chuyển file giữa `api`/`ui`/`docs` khi yêu cầu có nêu rõ tái cấu trúc.
- Mọi thay đổi cấu trúc phải kèm lý do ngắn gọn trong báo cáo bàn giao.
