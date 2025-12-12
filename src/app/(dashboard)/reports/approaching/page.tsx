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
import { getApproachingEligibility, formatDate } from "@/lib/mock-data";
import { toast } from "sonner";
import { MembershipWithDetails } from "@/lib/types";

export default function ApproachingEligibilityPage() {
  const approachingMembers = getApproachingEligibility(100); // Get all

  const handleExport = (filteredData: MembershipWithDetails[]) => {
    // Create CSV content
    const headers = ["Member Name", "Plan", "Paid Months", "Months Remaining", "Estimated Eligibility"];
    const rows = filteredData.map((m) => {
      const monthsRemaining = 60 - m.paidMonths;
      let estimatedEligibility = "-";
      if (m.lastPaymentDate) {
        const lastPayment = new Date(m.lastPaymentDate);
        const estimatedDate = new Date(lastPayment);
        estimatedDate.setMonth(estimatedDate.getMonth() + monthsRemaining);
        estimatedEligibility = formatDate(estimatedDate.toISOString());
      }
      return [
        `${m.member.firstName} ${m.member.lastName}`,
        m.plan.name,
        m.paidMonths.toString(),
        `${monthsRemaining}`,
        estimatedEligibility,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `approaching-eligibility-report-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Approaching eligibility report exported successfully");
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
                <BreadcrumbPage>Approaching Eligibility</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header */}
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">Approaching Eligibility</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Members who are close to reaching the 60-month eligibility threshold
              </p>
            </div>
          </div>

          {/* Summary Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>Members approaching eligibility (50-59 months)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-blue-600">{approachingMembers.length}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Members will become eligible within the next few months
              </p>
            </CardContent>
          </Card>

          {/* DataTable in Card */}
          <Card>
            <CardContent className="pt-6">
              <DataTable
                columns={columns}
                data={approachingMembers}
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
