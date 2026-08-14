import type { EventListFilters } from "@/api/events"
import type { PaymentStatus } from "@/types/billing"

/**
 * Nguồn sự thật duy nhất cho query key. Gom về một chỗ để `invalidateQueries` sau mutation
 * không bao giờ gõ lệch key so với lúc `useQuery` — lỗi kiểu đó không báo lỗi, chỉ im lặng
 * không refetch.
 */
export const queryKeys = {
  orgs: () => ["orgs"] as const,
  org: (orgId: string) => ["org", orgId] as const,
  members: (orgId: string) => ["members", orgId] as const,
  invites: (orgId: string) => ["invites", orgId] as const,
  invitePreview: (token: string) => ["invite-preview", token] as const,
  templates: (orgId: string) => ["templates", orgId] as const,
  events: (orgId: string, filters: EventListFilters) =>
    ["events", orgId, filters] as const,
  event: (eventId: string) => ["event", eventId] as const,
  myDebts: (orgId: string) => ["debts", orgId, "me"] as const,
  orgDebts: (orgId: string) => ["debts", orgId] as const,
  payments: (orgId: string, filters: { status?: PaymentStatus }) =>
    ["payments", orgId, filters] as const,
}
