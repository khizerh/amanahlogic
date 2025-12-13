import { notFound } from "next/navigation";
import { AgreementSigningLinksService } from "@/lib/database/agreement-links";
import { AgreementsService } from "@/lib/database/agreements";
import { MembersService } from "@/lib/database/members";
import SignClient from "./sign-client";

interface SignPageProps {
  params: Promise<{ token: string }>;
}

// Map template versions to PDF paths
const PDF_PATHS: Record<string, string> = {
  "v1-en": "/Masjid Muhajireen Agreement.pdf",
  "v1-fa": "/Masjid Muhajireen Bylaws 2 (Dari).pdf",
};

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

  // Determine language from template version
  const language = agreement.templateVersion.includes("fa") ? "fa" : "en";
  const pdfPath = PDF_PATHS[agreement.templateVersion] || PDF_PATHS["v1-en"];

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
