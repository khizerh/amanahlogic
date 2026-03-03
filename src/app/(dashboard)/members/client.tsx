"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { columns } from "./columns";
import { MemberWithMembership } from "@/lib/types";
import { formatDate } from "@/lib/utils/formatters";
import {
  BulkReminderDialog,
  type BulkReminderResults,
  type ReminderRecipient,
  type SkippedRecipient,
  type EmailDescription,
} from "@/components/reminders/bulk-reminder-dialog";
import { Send } from "lucide-react";
import { toast } from "sonner";

interface MembersTableProps {
  members: MemberWithMembership[];
}

export function MembersTable({ members }: MembersTableProps) {
  const router = useRouter();

  // Bulk reminder dialog state
  const [bulkReminderOpen, setBulkReminderOpen] = useState(false);
  const [bulkReminderLoading, setBulkReminderLoading] = useState(false);
  const [bulkReminderResults, setBulkReminderResults] = useState<BulkReminderResults | null>(null);

  // Compute pending members for bulk reminders
  const { reminderRecipients, reminderSkipped } = useMemo(() => {
    const recipients: ReminderRecipient[] = [];
    const skipped: SkippedRecipient[] = [];

    for (const member of members) {
      if (member.membership?.status !== "pending") continue;

      const name = `${member.firstName} ${member.lastName}`;
      const membership = member.membership;

      if (!member.email) {
        skipped.push({ id: member.id, name, reason: "No email" });
        continue;
      }

      const needsAgreement = !membership.agreementSignedAt;
      const needsPayment = !membership.autoPayEnabled && !membership.stripeSubscriptionId;

      if (!needsAgreement && !needsPayment) {
        continue; // Nothing to remind about
      }

      const details: string[] = [];
      if (needsAgreement) details.push("Agreement");
      if (needsPayment) details.push("Payment");

      recipients.push({
        id: member.id,
        name,
        email: member.email,
        language: member.preferredLanguage || "en",
        detail: details.join(" + "),
      });
    }

    return { reminderRecipients: recipients, reminderSkipped: skipped };
  }, [members]);

  const handleBulkReminder = async (): Promise<BulkReminderResults> => {
    setBulkReminderLoading(true);
    try {
      const res = await fetch("/api/reminders/pending-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send reminders");
      }
      const results: BulkReminderResults = data;
      setBulkReminderResults(results);
      if (results.sent > 0) {
        toast.success(`Sent reminders to ${results.sent} member${results.sent !== 1 ? "s" : ""}`);
      }
      router.refresh();
      return results;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to send reminders";
      toast.error(errorMsg);
      const fallback: BulkReminderResults = { sent: 0, failed: 0, skipped: 0, results: [] };
      setBulkReminderResults(fallback);
      return fallback;
    } finally {
      setBulkReminderLoading(false);
    }
  };

  const handleExport = (data: MemberWithMembership[]) => {
    // Build CSV content
    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Plan",
      "Status",
      "Paid Months",
      "Eligible",
      "Join Date",
    ];

    const rows = data.map((member) => {
      const paidMonths = member.membership?.paidMonths || 0;
      const isEligible = paidMonths >= 60 && member.membership?.status !== "cancelled";

      return [
        member.firstName,
        member.lastName,
        member.email || "",
        member.phone || "",
        member.plan?.name || "",
        member.membership?.status || "",
        paidMonths.toString(),
        isEligible ? "Yes" : "No",
        member.membership?.joinDate ? formatDate(member.membership.joinDate) : "",
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    // Trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `members-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBulkReminderOpen(true)}
          disabled={reminderRecipients.length === 0}
        >
          <Send className="mr-2 h-4 w-4" />
          Send Reminders
          {reminderRecipients.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {reminderRecipients.length}
            </Badge>
          )}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={members}
        searchColumn="name"
        searchPlaceholder="Search by name, email, or phone..."
        filterColumns={[
          {
            column: "status",
            label: "Status",
            options: [
              { label: "All Statuses", value: "all" },
              { label: "Pending", value: "pending" },
              { label: "Current", value: "current" },
              { label: "Lapsed", value: "lapsed" },
              { label: "Cancelled", value: "cancelled" },
            ],
          },
          {
            column: "planType",
            label: "Plan",
            options: [
              { label: "All Plans", value: "all" },
              { label: "Single", value: "single" },
              { label: "Married", value: "married" },
              { label: "Widow", value: "widow" },
            ],
          },
          {
            column: "eligibility",
            label: "Eligibility",
            options: [
              { label: "All Eligibility", value: "all" },
              { label: "Eligible", value: "eligible" },
              { label: "Not Eligible", value: "not_eligible" },
            ],
          },
        ]}
        pageSize={20}
        onExport={handleExport}
      />

      <BulkReminderDialog
        open={bulkReminderOpen}
        onOpenChange={setBulkReminderOpen}
        title="Send Pending Member Reminders"
        description="Send reminder emails to pending members who haven't completed their agreement and/or payment setup."
        emailDescriptions={[
          {
            label: "Sign Your Membership Agreement",
            summary: "Asks the member to review and sign their membership agreement via a secure signing link.",
          },
          {
            label: "Complete Your Membership Setup",
            summary: "Asks the member to complete their Stripe payment setup — includes their plan name, enrollment fee, and recurring dues amount.",
          },
        ]}
        recipients={reminderRecipients}
        skipped={reminderSkipped}
        onConfirm={handleBulkReminder}
        isLoading={bulkReminderLoading}
        results={bulkReminderResults}
        onReset={() => setBulkReminderResults(null)}
      />
    </>
  );
}
