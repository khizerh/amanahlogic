import { Metadata } from "next";
import { PaymentsService, type OutstandingPaymentInfo } from "@/lib/database/payments";

export const metadata: Metadata = {
  title: "Payments",
};
import { OnboardingInvitesService } from "@/lib/database/onboarding-invites";
import { PaymentsPageClient } from "./client";
import { getOrgContext } from "@/lib/auth/get-organization-id";

export default async function PaymentsPage() {
  const { organizationId, billingConfig } = await getOrgContext();

  // Fetch all data in parallel using org config
  const [payments, outstandingPayments, onboardingInvites] = await Promise.all([
    PaymentsService.getAllDetailed(organizationId),
    PaymentsService.getOutstanding(organizationId, billingConfig.lapseDays),
    OnboardingInvitesService.getAllWithDetails(organizationId),
  ]);

  // Calculate aging buckets from outstanding payments
  const agingBuckets = [
    { range: "1-7 days", count: 0, totalAmount: 0 },
    { range: "8-14 days", count: 0, totalAmount: 0 },
    { range: "15-30 days", count: 0, totalAmount: 0 },
    { range: "31-60 days", count: 0, totalAmount: 0 },
    { range: "60+ days", count: 0, totalAmount: 0 },
  ];

  outstandingPayments.forEach((payment: OutstandingPaymentInfo) => {
    const days = payment.daysOverdue;
    const amount = payment.amountDue;

    if (days <= 7) {
      agingBuckets[0].count++;
      agingBuckets[0].totalAmount += amount;
    } else if (days <= 14) {
      agingBuckets[1].count++;
      agingBuckets[1].totalAmount += amount;
    } else if (days <= 30) {
      agingBuckets[2].count++;
      agingBuckets[2].totalAmount += amount;
    } else if (days <= 60) {
      agingBuckets[3].count++;
      agingBuckets[3].totalAmount += amount;
    } else {
      agingBuckets[4].count++;
      agingBuckets[4].totalAmount += amount;
    }
  });

  const pendingInvitesCount = onboardingInvites.filter((i) => i.status === "pending").length;
  const totalOutstanding = outstandingPayments.reduce((sum: number, p: OutstandingPaymentInfo) => sum + p.amountDue, 0);
  const failedChargesCount = outstandingPayments.filter((p: OutstandingPaymentInfo) => p.type === "failed").length;

  return (
    <PaymentsPageClient
      organizationId={organizationId}
      initialPayments={payments}
      initialOutstandingPayments={outstandingPayments}
      initialAgingBuckets={agingBuckets}
      initialOnboardingInvites={onboardingInvites}
      pendingInvitesCount={pendingInvitesCount}
      totalOutstanding={totalOutstanding}
      failedChargesCount={failedChargesCount}
    />
  );
}
