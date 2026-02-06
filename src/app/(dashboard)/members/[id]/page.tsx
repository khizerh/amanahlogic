import { Metadata } from "next";
import { MembersService } from "@/lib/database/members";

export const metadata: Metadata = {
  title: "Member Details",
};
import { PaymentsService } from "@/lib/database/payments";
import { EmailLogsService } from "@/lib/database/email-logs";
import { MemberDetailClient } from "./client";
import { AgreementsService } from "@/lib/database/agreements";
import { AgreementSigningLinksService } from "@/lib/database/agreement-links";
import {
  AgreementTemplatesService,
  resolveTemplateUrl,
} from "@/lib/database/agreement-templates";
import { OnboardingInvitesService } from "@/lib/database/onboarding-invites";
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
  const [memberData, payments, emailLogs, agreements, onboardingInvite] = await Promise.all([
    MembersService.getByIdWithMembership(id, organizationId),
    PaymentsService.getByMember(id, organizationId),
    EmailLogsService.getByMemberId(id, organizationId),
    AgreementsService.getByMemberId(id),
    OnboardingInvitesService.getByMemberIdWithDetails(id, organizationId),
  ]);

  // Get the most recent agreement (first in array since it's sorted by created_at desc)
  const agreement = agreements.length > 0 ? agreements[0] : null;

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

  // Resolve template URL for preview (fallback to public PDFs if not found)
  let agreementTemplateUrl: string | null = null;
  if (agreement?.templateVersion) {
    const template = await AgreementTemplatesService.getByVersion(organizationId, agreement.templateVersion);
    if (template) {
      agreementTemplateUrl = await resolveTemplateUrl(template.storagePath);
    } else {
      // Fallback to public files
      agreementTemplateUrl = agreement.templateVersion.includes("fa")
        ? "/Masjid Muhajireen Bylaws 2 (Dari).pdf"
        : "/Masjid Muhajireen Agreement.pdf";
    }
  }

  // Get the signing URL if agreement exists and isn't signed
  let agreementSignUrl: string | null = null;
  if (agreement && !agreement.signedAt) {
    const signingLink = await AgreementSigningLinksService.getActiveByAgreementId(agreement.id);
    if (signingLink) {
      agreementSignUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/sign/${signingLink.token}`;
    }
  }

  return (
    <MemberDetailClient
      initialMember={memberData}
      initialPayments={payments}
      initialEmails={emailLogs}
      initialAgreement={agreement || null}
      agreementTemplateUrl={agreementTemplateUrl}
      agreementSignUrl={agreementSignUrl}
      onboardingInvite={onboardingInvite}
    />
  );
}
