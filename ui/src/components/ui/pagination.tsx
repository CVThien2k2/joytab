import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Bản pagination gọn hơn của shadcn: chỉ giữ những mảnh joytab thật sự dùng, và các nút là
 * `<button>` chứ không `<a href>` — phân trang ở đây đổi state của một query React Query, không
 * điều hướng URL, nên link sẽ là link đi tới chính trang đang đứng.
 */
function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="Phân trang"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  )
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />
}

/**
 * Input: `isActive` để tô trang đang xem, còn lại là props của `<button>`.
 * Output: Một ô trang. Trang đang xem dùng variant `outline` + `aria-current` — người dùng
 *         chuột thấy khung, người dùng screen reader nghe "trang hiện tại".
 */
function PaginationButton({
  className,
  isActive = false,
  size = "icon-sm",
  ...props
}: React.ComponentProps<"button"> & {
  isActive?: boolean
  size?: React.ComponentProps<typeof Button>["size"]
}) {
  return (
    <button
      type="button"
      data-slot="pagination-button"
      aria-current={isActive ? "page" : undefined}
      data-active={isActive}
      className={cn(buttonVariants({ variant: isActive ? "outline" : "ghost", size }), className)}
      {...props}
    />
  )
}

function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<typeof PaginationButton>) {
  return (
    <PaginationButton aria-label="Trang trước" className={cn(className)} {...props}>
      <ChevronLeft aria-hidden="true" />
    </PaginationButton>
  )
}

function PaginationNext({ className, ...props }: React.ComponentProps<typeof PaginationButton>) {
  return (
    <PaginationButton aria-label="Trang sau" className={cn(className)} {...props}>
      <ChevronRight aria-hidden="true" />
    </PaginationButton>
  )
}

/** Dấu "còn trang nữa ở phía này" — không bấm được nên là span, không phải button. */
function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      data-slot="pagination-ellipsis"
      className={cn("flex size-7 items-center justify-center text-muted-foreground", className)}
      {...props}
    >
      <MoreHorizontal className="size-4" />
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationButton,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
}
