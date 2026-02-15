"use client";

import { DataTable } from "@/components/ui/data-table";
import { returningColumns } from "./returning-columns";
import type { ReturningApplicationWithPlan } from "@/lib/types";

interface ReturningApplicationsTableProps {
  applications: ReturningApplicationWithPlan[];
}

export function ReturningApplicationsTable({ applications }: ReturningApplicationsTableProps) {
  if (applications.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No pending applications
      </p>
    );
  }

  return (
    <DataTable
      columns={returningColumns}
      data={applications}
      searchColumn="name"
      searchPlaceholder="Search by name or email..."
      pageSize={20}
    />
  );
}
