import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLiveOrganizations } from "@/lib/database/live-organizations";
import { OrgPicker } from "@/components/marketing/org-picker";

export const metadata: Metadata = {
  title: "Become a Member",
};

// Always read the live org list: this page redirects based on it.
export const dynamic = "force-dynamic";

/**
 * /join: the one URL to hand out ("go to amanahlogic.com/join"). With a single
 * live organization it goes straight to that org's registration; with several
 * it asks which one.
 */
export default async function JoinIndexPage() {
  const orgs = await getLiveOrganizations();

  if (orgs.length === 1) {
    redirect(`/join/${orgs[0].slug}`);
  }

  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Become a Member</h1>
      {orgs.length === 0 ? (
        <p className="mt-3 text-gray-600">
          Online registration is not available right now. Please contact your organization.
        </p>
      ) : (
        <>
          <p className="mb-6 mt-2 text-gray-600">Select your local organization to get started.</p>
          <div className="mx-auto max-w-xl text-left">
            <OrgPicker orgs={orgs} />
          </div>
        </>
      )}
      <p className="mt-10 text-sm text-gray-400">
        Already a member?{" "}
        <a href="/portal/login" className="font-medium text-brand-teal hover:underline">
          Log in to your portal
        </a>
      </p>
    </div>
  );
}
