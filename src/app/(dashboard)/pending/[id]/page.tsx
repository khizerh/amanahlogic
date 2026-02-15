import { Metadata } from "next";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ReturningApplicationsService } from "@/lib/database/returning-applications";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import { ApplicationDetailClient } from "./client";

export const metadata: Metadata = {
  title: "Review Application",
};

interface ApplicationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicationDetailPage({ params }: ApplicationDetailPageProps) {
  const { id } = await params;
  const organizationId = await getOrganizationId();

  const application = await ReturningApplicationsService.getByIdWithPlan(id);

  if (!application || application.organizationId !== organizationId) {
    return (
      <>
        <Header />
        <div className="min-h-screen">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Application not found</p>
              <Button asChild className="mt-4">
                <Link href="/pending">Back to Pending</Link>
              </Button>
            </Card>
          </div>
        </div>
      </>
    );
  }

  return <ApplicationDetailClient application={application} />;
}
