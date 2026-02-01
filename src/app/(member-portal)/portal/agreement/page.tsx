import { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Agreement | Member Portal",
};
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, FileText, Download, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { AgreementSigningLinksService } from "@/lib/database/agreement-links";

function formatDate(dateString: string | null, timeZone?: string): string {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timeZone || "America/Los_Angeles",
  });
}

export default async function MemberAgreementPage() {
  const headersList = await headers();
  const memberId = headersList.get("x-member-id");
  const organizationId = headersList.get("x-organization-id");

  if (!memberId || !organizationId) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-amber-800">Login Required</h2>
              <p className="text-amber-700 mt-1">Please log in to view your agreement.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const serviceClient = createServiceRoleClient();

  // Fetch agreement, org, and member data using service role to bypass RLS
  const [agreementResult, orgResult] = await Promise.all([
    serviceClient
      .from("agreements")
      .select("id, signed_at, signed_name, pdf_url, template_version")
      .eq("member_id", memberId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    serviceClient
      .from("organizations")
      .select("name, email, timezone")
      .eq("id", organizationId)
      .single(),
  ]);

  const agreement = agreementResult.data
    ? {
        id: agreementResult.data.id as string,
        signedAt: agreementResult.data.signed_at as string | null,
        signedName: agreementResult.data.signed_name as string | null,
        pdfUrl: agreementResult.data.pdf_url as string | null,
        templateVersion: agreementResult.data.template_version as string,
      }
    : null;

  const organizationName = orgResult.data?.name || "Organization";
  const organizationEmail = orgResult.data?.email || "";
  const orgTimezone = orgResult.data?.timezone || "America/Los_Angeles";

  // Fetch signing link if agreement exists but not signed
  let signingLink: string | null = null;
  if (agreement && !agreement.signedAt) {
    try {
      const activeLink = await AgreementSigningLinksService.getActiveByAgreementId(
        agreement.id,
        serviceClient
      );
      if (activeLink) {
        signingLink = `/sign/${activeLink.token}`;
      }
    } catch {
      // Link not available
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Membership Agreement</h1>
        <p className="text-muted-foreground mt-1">
          View and download your signed membership agreement
        </p>
      </div>

      {agreement ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {organizationName} Membership Agreement
              </CardTitle>
              {agreement.signedAt ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Signed
                </Badge>
              ) : (
                <Badge className="bg-yellow-100 text-yellow-800">
                  <Clock className="w-3 h-3 mr-1" />
                  Pending Signature
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {agreement.signedAt ? (
              <>
                {/* Signed Agreement Details */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-800">Agreement Signed</p>
                      <p className="text-sm text-green-700 mt-1">
                        Signed by <strong>{agreement.signedName}</strong> on {formatDate(agreement.signedAt, orgTimezone)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Agreement Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Signed By</p>
                    <p className="font-medium">{agreement.signedName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date Signed</p>
                    <p className="font-medium">{formatDate(agreement.signedAt, orgTimezone)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Agreement Version</p>
                    <p className="font-medium">{agreement.templateVersion}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Agreement ID</p>
                    <p className="font-mono text-sm">{agreement.id.slice(0, 8)}</p>
                  </div>
                </div>

                {/* Download Button */}
                {agreement.pdfUrl && (
                  <div className="pt-4 border-t">
                    <Button asChild className="bg-brand-teal hover:bg-brand-teal-hover">
                      <a href={agreement.pdfUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4 mr-2" />
                        Download Signed Agreement (PDF)
                      </a>
                    </Button>
                  </div>
                )}
              </>
            ) : (
              /* Pending Signature */
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800">Signature Required</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        Your agreement is awaiting your signature. Please review and sign to complete your membership setup.
                      </p>
                    </div>
                  </div>
                </div>
                {signingLink ? (
                  <Button asChild className="bg-blue-600 hover:bg-blue-700">
                    <a href={signingLink}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Sign Agreement
                    </a>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Check your email for the signing link, or contact {organizationName} for assistance.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* No Agreement */
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-lg font-semibold text-gray-900">No Agreement Found</h2>
            <p className="text-muted-foreground mt-2">
              You don&apos;t have a membership agreement on file yet.
              Contact {organizationName} if you believe this is an error.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Help Card */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Questions about your agreement? Contact {organizationName} at{" "}
            <a href={`mailto:${organizationEmail}`} className="text-brand-teal hover:underline">
              {organizationEmail}
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
