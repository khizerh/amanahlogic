"use client";

import { DataTable } from "@/components/ui/data-table";
import { columns } from "./columns";
import { MemberWithMembership } from "@/lib/types";

interface PendingMembersTableProps {
  members: MemberWithMembership[];
}

export function PendingMembersTable({ members }: PendingMembersTableProps) {
  return (
    <DataTable
      columns={columns}
      data={members}
      searchColumn="name"
      searchPlaceholder="Search by name, email, or phone..."
      filterColumns={[
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
      ]}
      pageSize={20}
    />
  );
}
