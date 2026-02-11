"use client";

import { DataTable } from "@/components/ui/data-table";
import { columns } from "./columns";
import { MemberWithMembership } from "@/lib/types";
import { formatDate } from "@/lib/utils/formatters";

interface MembersTableProps {
  members: MemberWithMembership[];
}

export function MembersTable({ members }: MembersTableProps) {
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
  );
}
