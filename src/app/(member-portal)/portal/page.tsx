import { headers } from "next/headers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Clock, CreditCard, Calendar, TrendingUp } from "lucide-react";
import { MemberPortalService } from "@/lib/database/member-portal";
import { formatCurrency } from "@/lib/utils/currency";

function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "current":
      return <Badge className="bg-green-100 text-green-800">Active</Badge>;
    case "lapsed":
      return <Badge className="bg-yellow-100 text-yellow-800">Lapsed</Badge>;
    case "pending":
      return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
    case "cancelled":
      return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default async function MemberDashboardPage() {
  const headersList = await headers();
  const memberId = headersList.get("x-member-id");
  const organizationId = headersList.get("x-organization-id");

  if (!memberId || !organizationId) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-amber-800">Login Required</h2>
              <p className="text-amber-700 mt-1">Please log in to access your member portal.</p>
              <a
                href="/portal/login"
                className="inline-block mt-3 text-sm font-medium text-amber-800 underline hover:text-amber-900"
              >
                Go to Login
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const dashboardData = await MemberPortalService.getDashboardData(memberId, organizationId);

  if (!dashboardData) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-red-800">Error Loading Data</h2>
              <p className="text-red-700 mt-1">Unable to load your membership data. Please try again later.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { member, membership, plan, organization, stats } = dashboardData;
  const progressPercent = Math.min(100, (stats.paidMonths / stats.eligibilityMonths) * 100);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {member.firstName}
        </h1>
        <p className="text-muted-foreground mt-1">
          {organization.name} Member Portal
        </p>
      </div>

      {/* Eligibility Status Card */}
      <Card className={stats.isEligible ? "border-green-200 bg-green-50" : ""}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              {stats.isEligible ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingUp className="w-5 h-5 text-brand-teal" />
              )}
              Eligibility Status
            </CardTitle>
            {membership && getStatusBadge(membership.status)}
          </div>
        </CardHeader>
        <CardContent>
          {stats.isEligible ? (
            <div className="text-green-800">
              <p className="text-xl font-semibold">You are eligible for benefits!</p>
              <p className="text-sm mt-1">
                You have completed {stats.paidMonths} months of membership.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">{stats.paidMonths} of {stats.eligibilityMonths} months</span>
                  <span className="text-muted-foreground">{stats.monthsRemaining} months remaining</span>
                </div>
                <Progress value={progressPercent} className="h-3" />
              </div>
              <p className="text-sm text-muted-foreground">
                Continue making payments to reach eligibility for benefits.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Plan Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Your Plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{plan?.name || "No Plan"}</p>
            {membership && (
              <p className="text-sm text-muted-foreground capitalize">
                Billed {membership.billingFrequency}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Member Since Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Member Since
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{formatDate(stats.memberSince)}</p>
          </CardContent>
        </Card>

        {/* Next Payment Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Next Payment Due
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{formatDate(stats.nextPaymentDue)}</p>
            {plan && membership && (
              <p className="text-sm text-muted-foreground">
                {formatCurrency(
                  membership.billingFrequency === "monthly"
                    ? plan.pricing.monthly
                    : membership.billingFrequency === "biannual"
                    ? plan.pricing.biannual
                    : plan.pricing.annual
                )}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <a
              href="/portal/payments"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              View Payment History
            </a>
            <a
              href="/portal/profile"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              Update Profile
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Need Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Contact {organization.name} for assistance:
          </p>
          <div className="mt-2 space-y-1 text-sm">
            <p>
              <span className="font-medium">Email:</span>{" "}
              <a href={`mailto:${organization.email}`} className="text-brand-teal hover:underline">
                {organization.email}
              </a>
            </p>
            <p>
              <span className="font-medium">Phone:</span>{" "}
              <a href={`tel:${organization.phone}`} className="text-brand-teal hover:underline">
                {organization.phone}
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
