import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  getDashboardStats,
  getRecentSignups,
  getApproachingEligibility,
  getOverdueMembers,
  formatCurrency,
  formatDate,
  formatStatus,
  getStatusVariant,
} from "@/lib/mock-data";

export default function DashboardPage() {
  const stats = getDashboardStats();
  const recentSignups = getRecentSignups(5);
  const approachingEligibility = getApproachingEligibility(5);
  const overdueMembers = getOverdueMembers(5);

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Overview of members, memberships, and payments
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5 mb-8">
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
                <CardTitle className="text-sm font-medium">In Waiting Period</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.waitingPeriod}</div>
                <p className="text-xs text-muted-foreground">Building toward 60 months</p>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Link href="/members">
                <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="text-base">Members</CardTitle>
                    <CardDescription>
                      View and manage all members, contact info, and dependents
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" className="w-full">
                      View Members
                    </Button>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/memberships">
                <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="text-base">Memberships</CardTitle>
                    <CardDescription>
                      Manage plans, track paid months, and eligibility status
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" className="w-full">
                      View Memberships
                    </Button>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/payments">
                <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="text-base">Payments</CardTitle>
                    <CardDescription>
                      Record payments, view history, and manage billing
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" className="w-full">
                      View Payments
                    </Button>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/reports">
                <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="text-base">Reports</CardTitle>
                    <CardDescription>
                      Eligibility reports, overdue payments, and analytics
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" className="w-full">
                      View Reports
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>

          {/* Recent Sign-ups */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Recent Sign-ups</h2>
              <Link href="/members">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </div>
            <Card>
              <CardContent className="pt-6">
                {recentSignups.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No recent sign-ups</p>
                ) : (
                  <div className="space-y-4">
                    {recentSignups.map((member) => (
                      <div key={member.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                        <div className="flex-1">
                          <Link href={`/members/${member.id}`} className="font-medium hover:underline">
                            {member.firstName} {member.lastName}
                          </Link>
                          <div className="text-sm text-muted-foreground">{member.email}</div>
                        </div>
                        <div className="text-right ml-4">
                          {member.membership && (
                            <Badge variant={getStatusVariant(member.membership.status)}>
                              {formatStatus(member.membership.status)}
                            </Badge>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            Joined {formatDate(member.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Two Column Layout */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Approaching Eligibility */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Approaching Eligibility</h2>
                <Link href="/reports/approaching">
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </div>
              <Card>
                <CardContent className="pt-6">
                  {approachingEligibility.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Members with 50-59 paid months will appear here
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {approachingEligibility.map((membership) => (
                        <div key={membership.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                          <div className="flex-1">
                            <Link href={`/members/${membership.member.id}`} className="font-medium hover:underline">
                              {membership.member.firstName} {membership.member.lastName}
                            </Link>
                            <div className="text-sm text-muted-foreground">{membership.plan.name} Plan</div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="font-semibold text-blue-600">{membership.paidMonths} months</div>
                            <div className="text-xs text-muted-foreground">{60 - membership.paidMonths} to go</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Overdue Payments */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Overdue Payments</h2>
                <Link href="/reports/overdue">
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
                      {overdueMembers.map((membership) => (
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
          </div>
        </div>
      </div>
    </>
  );
}
