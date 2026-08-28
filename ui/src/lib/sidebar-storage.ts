/**
 * Nơi ghi nhớ sidebar đang mở hay đang thu, và đoạn script đọc nó ra trước khi trang được vẽ.
 *
 * Để ở `lib` — một module THƯỜNG, không `"use client"` — là có lý do, không phải cho gọn: hằng
 * số khai trong file `"use client"` mà đem import vào server component thì Next không chuyển giá
 * trị sang, nó chuyển một *client reference*. Bản cũ dính đúng bẫy này: layout đọc
 * `cookieStore.get(SIDEBAR_COOKIE)` với `SIDEBAR_COOKIE` là một object client-reference, nên
 * không bao giờ tìm thấy cookie và luôn render ra trạng thái mở.
 */

/** Khoá localStorage. Giá trị: `"1"` đang mở / `"0"` đang thu. */
export const SIDEBAR_STORAGE_KEY = "sb"

/** Giá trị khi chưa ai chọn gì — vào lần đầu thì thấy đủ nav, không phải đi tìm nút mở. */
export const SIDEBAR_DEFAULT_OPEN = true

/**
 * Script chạy đồng bộ, TRƯỚC khung hình đầu tiên: đọc localStorage rồi đóng dấu
 * `data-sidebar="open" | "closed"` lên thẻ `<html>`.
 *
 * Phải là script chặn render chứ không phải effect của React: localStorage không tới được
 * server, nên nếu chờ React mount mới biết trạng thái thì mọi lần tải đều vẽ cột mở trước rồi
 * mới giật về thu. Cùng cách next-themes chống nháy sáng/tối.
 *
 * Mọi class phụ thuộc trạng thái thu đều treo vào chính cái dấu này qua biến `sidebar-closed`
 * (globals.css), nên khung hình đầu tiên đã đúng — React hydrate sau đó chỉ việc khớp theo.
 *
 * Bọc try/catch vì `localStorage` NÉM khi bị chặn (cửa sổ riêng tư, thiết lập chặn site data);
 * ném ở đây là chặn luôn script, tức là mất cả thẻ `<html>` đúng trạng thái.
 */
export const SIDEBAR_PREPAINT_SCRIPT = `try{document.documentElement.dataset.sidebar=localStorage.getItem(${JSON.stringify(
  SIDEBAR_STORAGE_KEY,
)})==="0"?"closed":"open"}catch(e){}`
