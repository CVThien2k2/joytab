"use client"

import { useState } from "react"
import { useDebounce } from "@/hooks/use-debounce"

/** Số dòng mỗi trang mặc định — khớp MEMBERS_DEFAULT_PAGE_SIZE ở BE. */
export const DEFAULT_PAGE_SIZE = 20

/** Các mức số dòng cho người dùng chọn. Trần 100 là giới hạn BE (MEMBERS_MAX_PAGE_SIZE). */
export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const SEARCH_DEBOUNCE_MS = 300

/**
 * Input: Số dòng mỗi trang ban đầu (tuỳ chọn).
 * Output: Gom trạng thái phân trang + tìm kiếm cho bảng đọc dữ liệu từ server:
 *  - `search` là chữ đang gõ (hiện tức thì trên ô nhập).
 *  - `query` là chữ đã debounce + trim — thứ DUY NHẤT được đưa vào queryKey/API.
 *  - `page` đếm từ 1, khớp hợp đồng BE.
 *
 *         Đổi từ khoá hoặc đổi số dòng thì về trang 1: đang ở trang 5 mà lọc còn 2 trang thì
 *         không reset sẽ ra một trang rỗng, người dùng tưởng không tìm thấy gì.
 *
 *         Reset ngay TRONG hàm đổi giá trị, không qua useEffect: react-compiler (đang bật ở
 *         project này) cấm setState trong effect vì nó tạo một lượt render dây chuyền. Nhân đây
 *         cũng đúng hơn về mặt thời điểm — trang về 1 ngay lúc gõ, còn request thì vẫn chờ
 *         debounce, nên không có nhịp nào bảng gọi API với trang cũ và từ khoá mới.
 *
 *         Lấy ý từ hub (hooks/use-table-search.ts), bỏ `PaginationState` của TanStack — ở đây
 *         chỉ cần hai con số.
 */
export function useTableSearch(initialPageSize: number = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [search, setSearch] = useState("")
  const query = useDebounce(search.trim(), SEARCH_DEBOUNCE_MS)

  /**
   * Input: Chữ mới trên ô tìm kiếm.
   * Output: Cập nhật ô nhập và đưa về trang đầu.
   */
  function changeSearch(value: string): void {
    setSearch(value)
    setPage(1)
  }

  /**
   * Input: Số dòng mỗi trang mới.
   * Output: Đổi số dòng và đưa về trang đầu — trang 5 của cỡ 10 không tương ứng trang nào của
   *         cỡ 50.
   */
  function changePageSize(value: number): void {
    setPageSize(value)
    setPage(1)
  }

  return {
    page,
    setPage,
    pageSize,
    setPageSize: changePageSize,
    search,
    setSearch: changeSearch,
    query,
  }
}
