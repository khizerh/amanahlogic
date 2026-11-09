"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { LiveOrganization } from "@/lib/database/live-organizations";

interface OrgPickerProps {
  orgs: LiveOrganization[];
  /** id for the <select>, so a surrounding <label> can point at it. */
  selectId?: string;
}

/**
 * "Select your organization" dropdown + Continue. Sends the visitor to that
 * org's join page. When only one org is live it is preselected, so Continue
 * works on the first tap.
 */
export function OrgPicker({ orgs, selectId = "org-picker" }: OrgPickerProps) {
  const router = useRouter();
  const [slug, setSlug] = useState(orgs.length === 1 ? orgs[0].slug : "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (slug) router.push(`/join/${slug}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2.5">
      <select
        id={selectId}
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        className="min-h-[50px] min-w-0 flex-[1_1_240px] rounded-lg border border-slate-300 bg-white px-3.5 text-base text-slate-900 focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
      >
        <option value="">Select your organization</option>
        {orgs.map((org) => (
          <option key={org.slug} value={org.slug}>
            {org.location ? `${org.name} (${org.location})` : org.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!slug}
        className="inline-flex min-h-[50px] flex-auto items-center sm:flex-none justify-center gap-2 rounded-lg bg-brand-teal px-6 text-base font-semibold text-white transition-colors hover:bg-brand-teal-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        Continue
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
