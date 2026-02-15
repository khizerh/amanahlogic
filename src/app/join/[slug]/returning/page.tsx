import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { JoinForm } from "../join-form";
import { AgreementTemplatesService, resolveTemplateUrl } from "@/lib/database/agreement-templates";
import type { Plan, PlanPricing } from "@/lib/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface DbPlanRow {
  id: string;
  organization_id: string;
  type: string;
  name: string;
  description: string | null;
  pricing: PlanPricing;
  enrollment_fee: number;
  is_active: boolean;
}

export default async function ReturningMemberPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = createServiceRoleClient();

  // Fetch org by slug
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, slug, email, phone")
    .eq("slug", slug)
    .single();

  if (orgError || !org) {
    notFound();
  }

  // Fetch active plans for this org
  const { data: plansData, error: plansError } = await supabase
    .from("plans")
    .select("id, organization_id, type, name, description, pricing, enrollment_fee, is_active")
    .eq("organization_id", org.id)
    .eq("is_active", true)
    .order("type", { ascending: true });

  if (plansError || !plansData || plansData.length === 0) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{org.name}</h1>
        <p className="text-gray-600">
          This organization is not currently accepting new members online.
        </p>
      </div>
    );
  }

  const plans: Plan[] = plansData.map((p: DbPlanRow) => ({
    id: p.id,
    organizationId: p.organization_id,
    type: p.type,
    name: p.name,
    description: p.description || "",
    pricing: p.pricing,
    enrollmentFee: p.enrollment_fee,
    isActive: p.is_active,
    createdAt: "",
    updatedAt: "",
  }));

  // Fetch active agreement templates
  const [enTemplate, faTemplate] = await Promise.all([
    AgreementTemplatesService.getActiveByLanguage(org.id, "en", supabase),
    AgreementTemplatesService.getActiveByLanguage(org.id, "fa", supabase),
  ]);

  const agreements: { label: string; url: string }[] = [];
  if (enTemplate) {
    try {
      const url = await resolveTemplateUrl(enTemplate.storagePath, supabase);
      agreements.push({ label: "English", url });
    } catch {
      // Skip if URL generation fails
    }
  }
  if (faTemplate) {
    try {
      const url = await resolveTemplateUrl(faTemplate.storagePath, supabase);
      agreements.push({ label: "Dari/Farsi", url });
    } catch {
      // Skip if URL generation fails
    }
  }

  const orgEmail = org.email || null;
  const orgPhone = org.phone || null;

  return (
    <>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{org.name}</h1>
        <p className="mt-2 text-gray-600">Welcome Back</p>
      </div>

      {/* Requirements & help info */}
      <div className="mb-8 text-center">
        <p className="text-base text-gray-600">
          You&apos;ll need a valid email, phone number, and a credit card or bank account.
        </p>
        <p className="mt-2 text-base text-gray-600">
          <a href={`/join/${slug}`} className="text-brand-teal font-medium hover:underline">
            New member? Register here
          </a>
        </p>
        <p className="mt-1 text-base text-gray-600">
          Prefer to pay by cash/check/Zelle, or have questions?{" "}
          {orgEmail ? (
            <a href={`mailto:${orgEmail}`} className="text-brand-teal font-medium hover:underline">
              Contact us
            </a>
          ) : orgPhone ? (
            <a href={`tel:${orgPhone}`} className="text-brand-teal font-medium hover:underline">
              Contact us
            </a>
          ) : (
            <span className="font-medium text-brand-teal">Contact us</span>
          )}
          <span className="text-gray-600"> and we&apos;ll help you out.</span>
        </p>
      </div>

      {agreements.length > 0 && (
        <div className="mb-8 text-center">
          <p className="text-sm text-gray-500 mb-2">
            Review our membership agreement before joining:
          </p>
          <div className="flex items-center justify-center gap-4">
            {agreements.map((a) => (
              <a
                key={a.label}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-brand-teal font-medium hover:underline"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z"
                    clipRule="evenodd"
                  />
                </svg>
                {a.label}
              </a>
            ))}
          </div>
        </div>
      )}

      <JoinForm
        orgSlug={org.slug}
        orgName={org.name}
        plans={plans}
        returning={true}
      />

      {/* Existing member login link */}
      <p className="mt-10 text-center text-sm text-gray-400">
        Already a member?{" "}
        <a href="/portal/login" className="text-brand-teal font-medium hover:underline">
          Log in to your portal
        </a>
      </p>
    </>
  );
}
