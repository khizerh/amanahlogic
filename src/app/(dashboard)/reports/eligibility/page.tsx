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
import { getMemberships, formatCurrency, formatDate } from "@/lib/mock-data";
import { toast } from "sonner";
import { MembershipWithDetails } from "@/lib/types";

export default function EligibilityReportPage() {
  const eligibleMembers = getMemberships().filter((m) => m.paidMonths >= 60);

  const handleExport = (filteredData: MembershipWithDetails[]) => {
    // Create CSV content
    const headers = ["Member Name", "Email", "Phone", "Plan", "Paid Months", "Eligible Since"];
    const rows = filteredData.map((m) => [
      `${m.member.firstName} ${m.member.lastName}`,
      m.member.email,
      m.member.phone,
      m.plan.name,
      m.paidMonths.toString(),
      formatDate(m.eligibleDate),
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
    link.download = `eligibility-report-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Eligibility report exported successfully");
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
                <BreadcrumbPage>Eligibility</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header */}
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">Eligibility Report</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Members who have completed 60+ months of paid membership
              </p>
            </div>
          </div>

          {/* Summary Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>Total eligible members</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600">{eligibleMembers.length}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Members currently eligible for burial benefit
              </p>
            </CardContent>
          </Card>

          {/* DataTable in Card */}
          <Card>
            <CardContent className="pt-6">
              <DataTable
                columns={columns}
                data={eligibleMembers}
                searchColumn="member"
                searchPlaceholder="Search by member name or email..."
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
