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

export default async function ApproachingEligibilityPage() {
  const { organizationId, billingConfig } = await getOrgContext();
  const approachingMembers = await MembershipsService.getApproachingEligibility(organizationId, {
    eligibilityMonths: billingConfig.eligibilityMonths,
    limit: 100,
  });

  const minMonths = billingConfig.eligibilityMonths - 5;

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
                Members who are close to reaching the {billingConfig.eligibilityMonths}-month eligibility threshold
              </p>
            </div>
          </div>

          {/* Summary Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>Members approaching eligibility ({minMonths}-{billingConfig.eligibilityMonths - 1} months)</CardDescription>
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
                pageSize={20}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
