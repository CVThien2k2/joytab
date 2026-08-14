import type { Metadata } from "next"
import { CreateOrganizationForm } from "./_components/create-organization-form"

export const metadata: Metadata = {
  title: "Tạo nhóm",
  robots: { index: false, follow: false },
}

export default function NewOrganizationPage() {
  return <CreateOrganizationForm />
}
