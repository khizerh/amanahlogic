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
import { MembershipsService } from "@/lib/database/memberships";
import { getOrgContext } from "@/lib/auth/get-organization-id";

export default async function OverduePaymentsPage() {
  const { organizationId, billingConfig } = await getOrgContext();
  const overdueMembers = await MembershipsService.getOverdue(organizationId, billingConfig.lapseDays);

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
                pageSize={20}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
