"use client";

import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { columns } from "./columns";
import { getMemberships } from "@/lib/mock-data";

export default function MembershipsPage() {
  const data = getMemberships();

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Memberships</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage membership plans, track paid months, and monitor eligibility status
            </p>
          </div>

          {/* DataTable in Card */}
          <Card>
            <CardContent className="pt-6">
              <DataTable
                columns={columns}
                data={data}
                searchColumn="member"
                searchPlaceholder="Search by member name or email..."
                filterColumns={[
                  {
                    column: "status",
                    label: "Status",
                    options: [
                      { label: "All Statuses", value: "all" },
                      { label: "Pending", value: "pending" },
                      { label: "Awaiting Signature", value: "awaiting_signature" },
                      { label: "Waiting Period", value: "waiting_period" },
                      { label: "Active", value: "active" },
                      { label: "Lapsed", value: "lapsed" },
                      { label: "Cancelled", value: "cancelled" },
                    ],
                  },
                ]}
                pageSize={20}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
