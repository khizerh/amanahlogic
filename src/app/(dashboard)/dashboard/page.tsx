import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DashboardPage() {
  // TODO: Fetch real stats from database
  const stats = {
    totalMembers: 0,
    activeMembers: 0,
    waitingPeriod: 0,
    lapsed: 0,
    monthlyRevenue: 0,
  };

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

          {/* Two Column Layout */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Approaching Eligibility */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Approaching Eligibility</h2>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground py-8">
                    Members with 55+ paid months will appear here
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Overdue Payments */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Overdue Payments</h2>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground py-8">
                    No overdue payments
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Recent Sign-ups */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Recent Sign-ups</h2>
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground py-8">
                  No recent sign-ups
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
