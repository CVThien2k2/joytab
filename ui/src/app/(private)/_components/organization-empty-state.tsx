import { Building2 } from "lucide-react"
import { CreateOrganizationDialog } from "./create-organization-dialog"
import { JoinOrganizationDialog } from "./join-organization-dialog"

/**
 * Input: Không nhận props.
 * Output: Màn hình khi user chưa thuộc tổ chức nào — đúng hai lối đi: tham gia bằng mã, hoặc
 *         tạo tổ chức mới.
 *
 *         Là server component: hai dialog bên trong tự là client component, phần này chỉ xếp
 *         chỗ và viết chữ.
 *
 *         Cố tình KHÔNG có lối thứ ba (bỏ qua / dùng thử): mọi thứ trong Joytab đều thuộc một
 *         tổ chức, nên đây là ngã ba bắt buộc.
 */
export function OrganizationEmptyState() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Building2 className="size-6" aria-hidden="true" />
        </div>

        <h1 className="mt-4 text-base font-semibold tracking-tight">Bạn chưa thuộc tổ chức nào</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Tham gia tổ chức có sẵn bằng mã được chia sẻ, hoặc tạo tổ chức mới và mời người khác vào.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <JoinOrganizationDialog />
          <CreateOrganizationDialog />
        </div>
      </div>
    </main>
  )
}
