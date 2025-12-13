import { notFound } from "next/navigation";
import { AgreementSigningLinksService } from "@/lib/database/agreement-links";
import { AgreementsService } from "@/lib/database/agreements";
import { MembersService } from "@/lib/database/members";
import {
  AgreementTemplatesService,
  resolveTemplateUrl,
} from "@/lib/database/agreement-templates";
import SignClient from "./sign-client";

interface SignPageProps {
  params: Promise<{ token: string }>;
}

export default async function SignPage({ params }: SignPageProps) {
  const { token } = await params;

  const link = await AgreementSigningLinksService.getActiveByToken(token);
  if (!link) {
    notFound();
  }

  const agreement = await AgreementsService.getById(link.agreementId);
  if (!agreement) {
    notFound();
  }

  const member = await MembersService.getById(agreement.memberId);
  if (!member) {
    notFound();
  }

  // Try to resolve template from DB; fall back to static mapping
  const language = agreement.templateVersion.includes("fa") ? "fa" : "en";
  let pdfPath: string | null = null;

  const template = await AgreementTemplatesService.getByVersion(
    agreement.organizationId,
    agreement.templateVersion
  );

  if (template) {
    pdfPath = await resolveTemplateUrl(template.storagePath);
  }

  if (!pdfPath) {
    const fallback =
      language === "fa" ? "/Masjid Muhajireen Bylaws 2 (Dari).pdf" : "/Masjid Muhajireen Agreement.pdf";
    pdfPath = fallback;
  }

  return (
    <SignClient
      token={token}
      memberName={`${member.firstName} ${member.lastName}`}
      organizationId={agreement.organizationId}
      templateVersion={agreement.templateVersion}
      language={language}
      pdfPath={pdfPath}
    />
  );
}
