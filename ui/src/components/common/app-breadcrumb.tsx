"use client"

import { Fragment } from "react"
import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useBreadcrumb } from "@/hooks/use-breadcrumb"

/**
 * Input: Không nhận props.
 * Output: Breadcrumb của trang đang mở — vừa nói đang ở đâu, vừa là đường về cấp trên.
 *
 *         Không render gì khi không có mẩu nào: header trống còn hơn hiện một mẩu sai.
 *
 *         Chép khuôn từ hub (components/globals/app-breadcrumb.tsx), bỏ phần skeleton vì nhãn ở
 *         đây đến từ store (server đã fetch sẵn), không có nhịp chờ nào để lấp.
 */
export function AppBreadcrumb() {
  const crumbs = useBreadcrumb()

  if (crumbs.length === 0) return null

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => (
          <Fragment key={crumb.href}>
            {index > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem className="min-w-0">
              {crumb.current ? (
                <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild className="truncate">
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
