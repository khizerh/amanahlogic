import { Metadata } from "next";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Dashboard",
};
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { MembersService } from "@/lib/database/members";
import { MembershipsService } from "@/lib/database/memberships";
import { PaymentsService } from "@/lib/database/payments";
import { OrganizationsService } from "@/lib/database/organizations";
import { getOrgContext } from "@/lib/auth/get-organization-id";
import {
  formatCurrency,
  formatDate,
  formatStatus,
} from "@/lib/utils/formatters";

export default async function DashboardPage() {
  // Get org context with billing config
  const { organizationId, billingConfig } = await getOrgContext();

  // Fetch all data in parallel using org config
  const [organization, membersWithMembership, paymentStats, overdueMembers, recentPayments] = await Promise.all([
    OrganizationsService.getById(organizationId),
    MembersService.getAllWithMembership(organizationId),
    PaymentsService.getStats(organizationId),
    MembershipsService.getOverdue(organizationId, billingConfig.lapseDays),
    PaymentsService.getRecent(organizationId, 10),
  ]);

  // Calculate stats from real data
  // "current" status = good standing (was "active" or "waiting_period")
  const stats = {
    totalMembers: membersWithMembership.length,
    activeMembers: membersWithMembership.filter(m => m.membership?.status === 'current').length,
    lapsed: membersWithMembership.filter(m => m.membership?.status === 'lapsed').length,
    monthlyRevenue: paymentStats.totalCollected,
  };

  // Build recent activity feed combining signups and payments
  type ActivityItem = {
    id: string;
    type: 'signup' | 'payment';
    date: string;
    memberName: string;
    memberId: string;
    detail: string;
    amount?: number;
  };

  const recentSignups: ActivityItem[] = [...membersWithMembership]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map(member => ({
      id: `signup-${member.id}`,
      type: 'signup' as const,
      date: member.createdAt,
      memberName: `${member.firstName} ${member.lastName}`,
      memberId: member.id,
      detail: 'New member signup',
    }));

  const paymentActivity: ActivityItem[] = recentPayments.map(payment => ({
    id: `payment-${payment.id}`,
    type: 'payment' as const,
    date: payment.paidAt || payment.createdAt,
    memberName: payment.member ? `${payment.member.firstName} ${payment.member.lastName}` : 'Unknown',
    memberId: payment.memberId,
    detail: payment.type === 'enrollment_fee' ? 'Enrollment fee' : `${payment.monthsCredited} month${payment.monthsCredited > 1 ? 's' : ''} dues`,
    amount: payment.amount,
  }));

  const recentActivity = [...recentSignups, ...paymentActivity]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">{organization?.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Overview of members and payments
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalMembers}</div>
                <p className="text-xs text-muted-foreground">Registered members</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Active Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.activeMembers}</div>
                <p className="text-xs text-muted-foreground">Eligible for burial benefit</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Lapsed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{stats.lapsed}</div>
                <p className="text-xs text-muted-foreground">Need attention</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.monthlyRevenue)}</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Access */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Quick Access</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link href="/members">
                <Card className="hover:border-primary transition-colors cursor-pointer h-full flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-base">Members</CardTitle>
                    <CardDescription>
                      View and manage all members, plans, eligibility, and payment history
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <Button variant="outline" size="sm" className="w-full">
                      View Members
                    </Button>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/payments">
                <Card className="hover:border-primary transition-colors cursor-pointer h-full flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-base">Payments</CardTitle>
                    <CardDescription>
                      Record payments, view history, and manage billing
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <Button variant="outline" size="sm" className="w-full">
                      View Payments
                    </Button>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/plans">
                <Card className="hover:border-primary transition-colors cursor-pointer h-full flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-base">Plans</CardTitle>
                    <CardDescription>
                      Manage membership plans and pricing options
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <Button variant="outline" size="sm" className="w-full">
                      View Plans
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>

          {/* Overdue Payments */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Overdue Payments</h2>
              <Link href="/payments">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </div>
            <Card>
              <CardContent className="pt-6">
                {overdueMembers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No overdue payments
                  </p>
                ) : (
                  <div className="space-y-4">
                    {overdueMembers.slice(0, 5).map((membership) => (
                      <div key={membership.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                        <div className="flex-1">
                          <Link href={`/members/${membership.member.id}`} className="font-medium hover:underline">
                            {membership.member.firstName} {membership.member.lastName}
                          </Link>
                          <div className="text-sm text-muted-foreground">
                            {membership.lastPaymentDate ? `Last payment: ${formatDate(membership.lastPaymentDate)}` : 'No payments yet'}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <Badge variant="withdrawn">
                            {formatStatus(membership.status)}
                          </Badge>
                          {membership.nextPaymentDue && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Due: {formatDate(membership.nextPaymentDue)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Recent Activity</h2>
              <Link href="/payments">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </div>
            <Card>
              <CardContent className="pt-6">
                {recentActivity.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No recent activity</p>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                        <div className="flex-1">
                          <Link href={`/members/${activity.memberId}`} className="font-medium hover:underline">
                            {activity.memberName}
                          </Link>
                          <div className="text-sm text-muted-foreground">{activity.detail}</div>
                        </div>
                        <div className="text-right ml-4">
                          {activity.type === 'payment' && activity.amount && (
                            <div className="font-medium text-green-600">{formatCurrency(activity.amount)}</div>
                          )}
                          {activity.type === 'signup' && (
                            <Badge variant="info">New</Badge>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatDate(activity.date)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
