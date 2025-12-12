"use client";

import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { DataTable } from "@/components/ui/data-table";
import { columns } from "./columns";
import { getOverdueMembers, formatCurrency, formatDate } from "@/lib/mock-data";
import { toast } from "sonner";
import { MembershipWithDetails } from "@/lib/types";

export default function OverduePaymentsPage() {
  const overdueMembers = getOverdueMembers(100); // Get all

  const handleExport = (filteredData: MembershipWithDetails[]) => {
    // Helper functions for CSV
    const getDaysOverdue = (nextPaymentDue: string | null): number => {
      if (!nextPaymentDue) return 0;
      const dueDate = new Date(nextPaymentDue);
      const today = new Date();
      const diffTime = today.getTime() - dueDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    };

    const getAmountDue = (membership: MembershipWithDetails): number => {
      const plan = membership.plan;
      switch (membership.billingFrequency) {
        case "annual":
          return plan.pricing.annual;
        case "biannual":
          return plan.pricing.biannual;
        default:
          return plan.pricing.monthly;
      }
    };

    // Create CSV content
    const headers = ["Member Name", "Plan", "Last Payment", "Amount Due", "Days Overdue"];
    const rows = filteredData.map((m) => [
      `${m.member.firstName} ${m.member.lastName}`,
      m.plan.name,
      formatDate(m.lastPaymentDate),
      formatCurrency(getAmountDue(m)),
      getDaysOverdue(m.nextPaymentDue).toString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `overdue-payments-report-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Overdue payments report exported successfully");
  };

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <Breadcrumb className="mb-4">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/reports">Reports</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Overdue Payments</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header */}
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">Overdue Payments</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Members with missed or overdue payments requiring follow-up
              </p>
            </div>
          </div>

          {/* Summary Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>Total members with overdue payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-orange-600">{overdueMembers.length}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Members requiring payment follow-up
              </p>
            </CardContent>
          </Card>

          {/* DataTable in Card */}
          <Card>
            <CardContent className="pt-6">
              <DataTable
                columns={columns}
                data={overdueMembers}
                searchColumn="member"
                searchPlaceholder="Search by member name..."
                onExport={handleExport}
                pageSize={20}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
