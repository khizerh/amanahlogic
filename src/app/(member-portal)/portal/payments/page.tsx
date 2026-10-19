import { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Payments | Member Portal",
};
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { MemberPortalService } from "@/lib/database/member-portal";
import { PaymentsClient } from "./PaymentsClient";
import { BillingActions } from "./BillingActions";
import { monthsOwed, arrearsPeriodLabel } from "@/lib/billing/arrears";
import { getTodayInOrgTimezone } from "@/lib/billing/invoice-generator";

export default async function MemberPaymentsPage() {
  const headersList = await headers();
  const memberId = headersList.get("x-member-id");
  const organizationId = headersList.get("x-organization-id");

  if (!memberId || !organizationId) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-amber-800">Login Required</h2>
              <p className="text-amber-700 mt-1">Please log in to view your payments.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const [paymentHistory, portalData] = await Promise.all([
    MemberPortalService.getPaymentHistory(memberId, organizationId),
    MemberPortalService.getMemberById(memberId, organizationId),
  ]);

  const organizationName = portalData?.organization.name || "Organization";
  const membership = portalData?.membership ?? null;
  const isPending = membership?.status === "pending";
  const isManualPayment = !membership?.stripeCustomerId;

  // Months behind, for the billing card. Pending members haven't started yet.
  const today = getTodayInOrgTimezone(portalData?.organization.timezone || "America/Los_Angeles");
  const owed = membership && !isPending ? monthsOwed(membership.nextPaymentDue, today) : 0;
  const pastDue = owed > 0 ? { months: owed, period: arrearsPeriodLabel(membership?.nextPaymentDue, owed) } : null;

  return (
    <div className="space-y-6">
      {membership && !isPending && (
        <BillingActions
          organizationName={organizationName}
          autoPayEnabled={!!membership.autoPayEnabled}
          canRestartAutoPay={!!membership.stripeCustomerId && !membership.autoPayEnabled}
          isPayerManaged={!!membership.payerMemberId}
          pastDue={pastDue}
        />
      )}
      <PaymentsClient
        paymentHistory={paymentHistory}
        organizationName={organizationName}
        isPending={isPending}
        isManualPayment={isManualPayment}
        paidMonths={membership?.paidMonths ?? paymentHistory.totalMonthsCredited}
      />
    </div>
  );
}
