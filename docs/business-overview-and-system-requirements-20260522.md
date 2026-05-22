# Tổng quan nghiệp vụ

## 1. Đặt vấn đề (Problem Statement)

### 1.1 Bối cảnh
Trong thực tế, các team/tổ chức thường xuyên phát sinh hoạt động chung: thể thao (bóng đá, cầu lông, chạy bộ), ăn uống, team building, sự kiện nội bộ, hoạt động cộng đồng, hoặc các khoản chi vận hành nhóm. Thông thường sẽ có một người ứng tiền trước, sau đó các thành viên còn lại hoàn trả. Đồng thời, nhiều nhóm còn duy trì quỹ chung để phục vụ hoạt động định kỳ.

### 1.2 Pain points hiện tại
- Chia tiền thủ công:
  - Việc tính ai nợ ai, nợ bao nhiêu thường làm qua chat hoặc ghi chú rời rạc.
  - Dễ sai số, dễ bỏ sót, khó tra cứu lại lịch sử.
- Bất tiện trong thanh toán hoàn trả:
  - Thành viên thường phải xin lại thông tin chuyển khoản hoặc QR của người ứng tiền.
  - Tăng thao tác thủ công, làm chậm quá trình chốt chi phí.
- Quản lý quỹ thiếu minh bạch:
  - Ghi chép bằng sổ tay hoặc file rời dễ lệch dữ liệu.
  - Khó theo dõi lịch sử thu/chi và số dư quỹ theo thời gian.
- Onboarding kém tối ưu:
  - Quy trình đăng ký dài làm giảm tỷ lệ bắt đầu sử dụng ứng dụng.

## 2. Mục tiêu giải pháp
Xây dựng ứng dụng mobile/web tinh gọn cho **mọi loại team/tổ chức**, giúp xử lý nhanh luồng chia tiền và quản lý quỹ chung minh bạch.

### 2.1 Mục tiêu sản phẩm
- Onboarding nhanh:
  - Chỉ dùng đăng nhập Google để giảm ma sát khi bắt đầu.
- Split bill linh hoạt:
  - Hỗ trợ chia chi phí cho nhiều loại hoạt động (thể thao, sự kiện, sinh hoạt nhóm, ...).
- Thanh toán tiện lợi:
  - Lưu sẵn thông tin thanh toán/QR để hoàn trả nhanh.
- Quản lý quỹ rõ ràng:
  - Theo dõi thu/chi, lịch sử và số dư quỹ chung minh bạch.

## 3. Nhóm người dùng chính
| Vai trò | Mục tiêu chính | Nhu cầu cốt lõi |
|---|---|---|
| Thành viên team/tổ chức | Hoàn trả chi phí nhanh, đúng phần | Xem khoản nợ, thanh toán nhanh qua QR/STK, theo dõi trạng thái đã trả |
| Người ứng tiền | Thu hồi tiền chính xác | Tạo khoản chi, chia tiền tự động, theo dõi ai đã trả/chưa trả |
| Quản lý nhóm/quỹ | Quản trị tài chính hoạt động chung | Quản lý thu/chi quỹ, kiểm tra lịch sử giao dịch, kiểm soát số dư |

## 4. Luồng nghiệp vụ cấp cao
1. Người dùng đăng nhập bằng Google.
2. Người tạo giao dịch chọn loại hoạt động và tạo khoản chi chung.
3. Hệ thống chia chi phí theo thành viên tham gia.
4. Thành viên nhận thông tin thanh toán và hoàn trả.
5. Hệ thống cập nhật trạng thái thanh toán và lịch sử giao dịch.
6. Quản lý theo dõi quỹ chung, thu/chi và số dư theo thời gian.

## 5. Phạm vi triển khai

### 5.1 In scope
- Đăng nhập Google-only.
- Quản lý nhóm cơ bản (tạo nhóm, thêm thành viên, phân quyền cơ bản).
- Tạo khoản chi và chia tiền theo thành viên cho các hoạt động bất kỳ.
- Lưu thông tin thanh toán cá nhân (QR/STK) để tái sử dụng.
- Theo dõi trạng thái thanh toán từng khoản split bill.
- Quản lý quỹ chung: thu, chi, lịch sử, số dư hiện tại.

### 5.2 Out of scope
- Đối soát giao dịch ngân hàng tự động theo thời gian thực.
- Đa phương thức đăng nhập ngoài Google.
- Các nghiệp vụ kế toán doanh nghiệp chuyên sâu.

## 6. Tiêu chí thành công nghiệp vụ
- Giảm thời gian xử lý và quyết toán chi phí cho mỗi hoạt động nhóm.
- Tăng tỷ lệ hoàn trả đúng hạn trong các khoản ứng trước.
- Minh bạch quỹ chung, giảm tranh cãi về lịch sử thu/chi và số dư.
- Tăng tỷ lệ người dùng hoàn tất onboarding ngay lần đầu.
