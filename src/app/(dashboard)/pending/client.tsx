"use client";

import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { columns as pendingMemberColumns } from "./columns";
import { returningColumns } from "./returning-columns";
import type { MemberWithMembership, ReturningApplicationWithPlan } from "@/lib/types";

interface PendingPageClientProps {
  returningApplications: ReturningApplicationWithPlan[];
  pendingMembers: MemberWithMembership[];
}

export function PendingPageClient({
  returningApplications,
  pendingMembers,
}: PendingPageClientProps) {
  return (
    <div className="space-y-8">
      {/* Returning Member Applications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Returning Member Applications
            {returningApplications.length > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal px-2.5 py-0.5 text-xs font-semibold">
                {returningApplications.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {returningApplications.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No pending returning member applications
            </p>
          ) : (
            <DataTable
              columns={returningColumns}
              data={returningApplications}
              searchColumn="name"
              searchPlaceholder="Search by name or email..."
              pageSize={20}
            />
          )}
        </CardContent>
      </Card>

      {/* New Members Onboarding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            New Members Onboarding
            {pendingMembers.length > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-blue-50 text-blue-700 px-2.5 py-0.5 text-xs font-semibold">
                {pendingMembers.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No new members pending onboarding
            </p>
          ) : (
            <DataTable
              columns={pendingMemberColumns}
              data={pendingMembers}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
