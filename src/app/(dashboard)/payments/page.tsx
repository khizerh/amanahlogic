import { PaymentsService } from "@/lib/database/payments";
import { AutoPayInvitesService } from "@/lib/database/auto-pay-invites";
import { PaymentsPageClient } from "./client";
import { getOrgContext } from "@/lib/auth/get-organization-id";

export default async function PaymentsPage() {
  const { organizationId, billingConfig } = await getOrgContext();

  // Fetch all data in parallel using org config
  const [payments, overduePayments, autoPayInvites] = await Promise.all([
    PaymentsService.getAllDetailed(organizationId),
    PaymentsService.getOverdue(organizationId, billingConfig.lapseDays),
    AutoPayInvitesService.getAllWithDetails(organizationId),
  ]);

  // Calculate aging buckets from overdue payments
  const now = new Date();
  const agingBuckets = [
    { range: "1-7 days", count: 0, totalAmount: 0 },
    { range: "8-14 days", count: 0, totalAmount: 0 },
    { range: "15-30 days", count: 0, totalAmount: 0 },
    { range: "31-60 days", count: 0, totalAmount: 0 },
    { range: "60+ days", count: 0, totalAmount: 0 },
  ];

  overduePayments.forEach((payment) => {
    if (!payment.dueDate) return;
    const dueDate = new Date(payment.dueDate);
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const amount = payment.amount;

    if (daysOverdue <= 7) {
      agingBuckets[0].count++;
      agingBuckets[0].totalAmount += amount;
    } else if (daysOverdue <= 14) {
      agingBuckets[1].count++;
      agingBuckets[1].totalAmount += amount;
    } else if (daysOverdue <= 30) {
      agingBuckets[2].count++;
      agingBuckets[2].totalAmount += amount;
    } else if (daysOverdue <= 60) {
      agingBuckets[3].count++;
      agingBuckets[3].totalAmount += amount;
    } else {
      agingBuckets[4].count++;
      agingBuckets[4].totalAmount += amount;
    }
  });

  // Transform overdue payments for the UI
  const overduePaymentsForUI = overduePayments.map((payment) => {
    return {
      id: payment.id,
      memberId: payment.memberId,
      memberName: payment.member ? `${payment.member.firstName} ${payment.member.lastName}` : "Unknown",
      memberEmail: payment.member?.email || "",
      planName: payment.membership?.plan?.name || "Unknown Plan",
      amountDue: payment.amount,
      dueDate: payment.dueDate || "",
      daysOverdue: payment.daysPastDue,
      reminderCount: 0, // TODO: Get from payments table
      remindersPaused: false,
    };
  });

  const pendingInvitesCount = autoPayInvites.filter((i) => i.status === "pending").length;

  return (
    <PaymentsPageClient
      initialPayments={payments}
      initialOverduePayments={overduePaymentsForUI}
      initialAgingBuckets={agingBuckets}
      initialAutoPayInvites={autoPayInvites}
      pendingInvitesCount={pendingInvitesCount}
    />
  );
}
