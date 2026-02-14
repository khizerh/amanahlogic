import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { JoinForm } from "./join-form";
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

export default async function JoinPage({ params }: PageProps) {
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

  const orgEmail = org.email || null;
  const orgPhone = org.phone || null;

  return (
    <>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{org.name}</h1>
        <p className="mt-2 text-gray-600">Become a member</p>
      </div>

      {/* Requirements & help info */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5 text-sm">
        <p className="font-medium text-text-dark-slate mb-2">What you&apos;ll need:</p>
        <ul className="list-disc list-inside text-gray-600 space-y-1 mb-4">
          <li>A valid email address</li>
          <li>A phone number</li>
          <li>A credit card or bank account for payment</li>
        </ul>
        <p className="text-gray-500">
          If you&apos;re a returning member, prefer to pay by cash, check, or Zelle,
          need to join without an email address, or have questions about
          sponsorships and family plans, please{" "}
          {orgEmail ? (
            <a href={`mailto:${orgEmail}`} className="text-brand-teal font-medium hover:underline">
              contact us
            </a>
          ) : orgPhone ? (
            <a href={`tel:${orgPhone}`} className="text-brand-teal font-medium hover:underline">
              contact us
            </a>
          ) : (
            <span className="font-medium">contact us</span>
          )}
          {" "}directly so we can assist you personally.
        </p>
      </div>

      <JoinForm
        orgSlug={org.slug}
        orgName={org.name}
        plans={plans}
      />
    </>
  );
}
