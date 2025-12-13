import { MembersService } from "@/lib/database/members";
import { PaymentsService } from "@/lib/database/payments";
import { EmailLogsService } from "@/lib/database/email-logs";
import { MemberDetailClient } from "./client";
import { getOrganizationId } from "@/lib/auth/get-organization-id";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface MemberDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MemberDetailPage({ params }: MemberDetailPageProps) {
  const { id } = await params;
  const organizationId = await getOrganizationId();

  // Fetch all data in parallel - with org scoping for security
  const [memberData, payments, emailLogs] = await Promise.all([
    MembersService.getByIdWithMembership(id, organizationId),
    PaymentsService.getByMember(id, organizationId),
    EmailLogsService.getByMemberId(id, organizationId),
  ]);

  if (!memberData) {
    return (
      <>
        <Header />
        <div className="min-h-screen">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Member not found</p>
              <Button asChild className="mt-4">
                <Link href="/members">Back to Members</Link>
              </Button>
            </Card>
          </div>
        </div>
      </>
    );
  }

  return (
    <MemberDetailClient
      initialMember={memberData}
      initialPayments={payments}
      initialEmails={emailLogs}
    />
  );
}
