import { notFound } from "next/navigation";
import { AgreementSigningLinksService } from "@/lib/database/agreement-links";
import { AgreementsService } from "@/lib/database/agreements";
import { MembersService } from "@/lib/database/members";
import {
  AgreementTemplatesService,
  resolveTemplateUrl,
} from "@/lib/database/agreement-templates";
import { createServiceRoleClient } from "@/lib/supabase/server";
import SignClient from "./sign-client";

interface SignPageProps {
  params: Promise<{ token: string }>;
}

export default async function SignPage({ params }: SignPageProps) {
  const { token } = await params;
  const serviceClient = createServiceRoleClient();

  const link = await AgreementSigningLinksService.getActiveByToken(token);
  if (!link) {
    // Check if the link exists but was already used
    const usedLink = await AgreementSigningLinksService.getByToken(token);
    if (usedLink?.usedAt) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-900 via-slate-950 to-black text-white flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-xl bg-slate-900/70 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-md p-8 text-center space-y-4">
            <div className="text-5xl">✅</div>
            <h1 className="text-2xl font-semibold">Agreement Already Signed</h1>
            <p className="text-slate-300">
              This agreement has already been signed. No further action is needed.
            </p>
          </div>
        </div>
      );
    }
    notFound();
  }

  const agreement = await AgreementsService.getById(link.agreementId, serviceClient);
  if (!agreement) {
    notFound();
  }

  const member = await MembersService.getById(agreement.memberId, serviceClient);
  if (!member) {
    notFound();
  }

  // Try to resolve template from DB; fall back to static mapping
  const language = agreement.templateVersion.includes("fa") ? "fa" : "en";
  let pdfPath: string | null = null;

  const template = await AgreementTemplatesService.getByVersion(
    agreement.organizationId,
    agreement.templateVersion,
    serviceClient
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
