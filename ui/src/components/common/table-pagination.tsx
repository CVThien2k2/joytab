"use client"

import {
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PAGE_SIZE_OPTIONS } from "@/hooks/use-table-search"

/** Số ô trang hiện tối đa. Nhiều hơn thế thì hàng nút dài hơn cả bảng trên màn hẹp. */
const MAX_PAGES = 4

/**
 * Input: Trang hiện tại và tổng số trang (đếm từ 1).
 * Output: Cửa sổ tối đa MAX_PAGES số trang trượt theo trang đang xem, kèm "…" ở đầu/cuối khi
 *         còn trang nằm ngoài cửa sổ.
 *
 *         Chép nguyên thuật toán của hub (packages/ui/components/data-table/pagination.tsx):
 *         `start` được kéo lại lần hai sau khi tính `end` để cửa sổ luôn đủ MAX_PAGES ô, kể cả
 *         khi đang ở những trang cuối.
 */
function getPages(current: number, total: number): (number | "ellipsis")[] {
  if (total <= MAX_PAGES) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }
  let start = Math.max(1, current - Math.floor(MAX_PAGES / 2))
  const end = Math.min(total, start + MAX_PAGES - 1)
  start = Math.max(1, end - MAX_PAGES + 1)
  const window = Array.from({ length: end - start + 1 }, (_, index) => start + index)

  return [
    ...(start > 1 ? (["ellipsis"] as const) : []),
    ...window,
    ...(end < total ? (["ellipsis"] as const) : []),
  ]
}

/**
 * Input: Trạng thái phân trang + hai hàm đổi trang/đổi số dòng.
 * Output: Chân bảng: chọn số dòng mỗi trang bên trái, các nút trang bên phải.
 *
 *         Không render gì khi không có dòng nào: một hàng nút phân trang dưới bảng rỗng chỉ nói
 *         "có nhiều dữ liệu" trong khi thực tế không có gì.
 *
 *         Bố cục theo hub: dồn xuống một cột trên màn hẹp, và phần chọn số dòng ẩn dưới `sm`
 *         (ở đó chiều cao màn hình quan trọng hơn việc xem 50 dòng một trang).
 */
export function TablePagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  if (totalItems === 0) return null

  const pages = getPages(page, totalPages)

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="hidden items-center gap-2 sm:flex">
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger size="sm" className="w-fit" aria-label="Số dòng mỗi trang">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="start">
            {PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[12.5px] text-muted-foreground">
          dòng mỗi trang · {totalItems} dòng
        </span>
      </div>

      <Pagination className="mx-0 w-full justify-center sm:w-auto sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
          </PaginationItem>

          {pages.map((item, index) => (
            <PaginationItem key={item === "ellipsis" ? `ellipsis-${index}` : item}>
              {item === "ellipsis" ? (
                <PaginationEllipsis />
              ) : (
                <PaginationButton isActive={item === page} onClick={() => onPageChange(item)}>
                  {item}
                </PaginationButton>
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
