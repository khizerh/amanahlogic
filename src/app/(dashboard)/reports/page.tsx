import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ReportsPage() {
  const reports = [
    {
      title: "Eligibility Report",
      description: "All members with 60+ paid months",
      href: "/reports/eligibility",
    },
    {
      title: "Approaching Eligibility",
      description: "Members at 50-59 paid months",
      href: "/reports/approaching",
    },
    {
      title: "Overdue Payments",
      description: "Members with missed payments",
      href: "/reports/overdue",
    },
    {
      title: "Revenue Report",
      description: "Revenue breakdown by period",
      href: "/reports/revenue",
    },
  ];

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Reports</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              View and export detailed reports for your organization
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
            {reports.map((report) => (
              <Card key={report.href} className="hover:border-primary transition-colors">
                <CardHeader>
                  <CardTitle className="text-xl">{report.title}</CardTitle>
                  <CardDescription>{report.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={report.href}>
                    <Button className="w-full">View Report</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
