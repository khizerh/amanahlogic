"use client";

import { useState } from "react";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { RecordPaymentDialog } from "@/components/payments/record-payment-dialog";
import { columns } from "./columns";
import { getPayments } from "@/lib/mock-data";

export default function PaymentsPage() {
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const data = getPayments();

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Payments</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                View payment history and record manual payments
              </p>
            </div>
            <Button onClick={() => setRecordDialogOpen(true)}>
              Record Payment
            </Button>
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
                    column: "type",
                    label: "Type",
                    options: [
                      { label: "All Types", value: "all" },
                      { label: "Enrollment Fee", value: "enrollment_fee" },
                      { label: "Dues", value: "dues" },
                      { label: "Back Dues", value: "back_dues" },
                    ],
                  },
                  {
                    column: "method",
                    label: "Method",
                    options: [
                      { label: "All Methods", value: "all" },
                      { label: "Card", value: "card" },
                      { label: "ACH", value: "ach" },
                      { label: "Cash", value: "cash" },
                      { label: "Check", value: "check" },
                      { label: "Zelle", value: "zelle" },
                    ],
                  },
                  {
                    column: "status",
                    label: "Status",
                    options: [
                      { label: "All Statuses", value: "all" },
                      { label: "Completed", value: "completed" },
                      { label: "Pending", value: "pending" },
                      { label: "Failed", value: "failed" },
                      { label: "Refunded", value: "refunded" },
                    ],
                  },
                ]}
                pageSize={20}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Record Payment Dialog */}
      <RecordPaymentDialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen} />
    </>
  );
}
