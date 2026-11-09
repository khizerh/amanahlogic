"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MEMBERSHIP_SIZES } from "@/lib/demo-request";

const inputClass =
  "h-12 rounded-lg border-gray-300 bg-white px-4 text-gray-900 placeholder:text-gray-400";

export function RequestDemoForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const res = await fetch("/api/request-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setIsSuccess(true);
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="rounded-2xl border border-[#E8DDC4] bg-white p-8 text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
          <CheckCircle className="h-8 w-8" />
        </div>
        <h2 className="mb-2 text-2xl font-semibold text-brand-teal">
          Thanks! Your request is in.
        </h2>
        <p className="text-slate-600">We&apos;ll reach out shortly to set up your demo.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-[#E8DDC4] bg-white p-6 shadow-[0_12px_32px_-20px_rgba(0,39,43,0.3)] sm:p-8"
    >
      <div className="space-y-2">
        <Label htmlFor="organizationName">Organization Name</Label>
        <Input
          id="organizationName"
          name="organizationName"
          required
          maxLength={200}
          placeholder="Your masjid or organization"
          autoComplete="organization"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contactName">Your Name</Label>
          <Input
            id="contactName"
            name="contactName"
            required
            maxLength={200}
            placeholder="Full name"
            autoComplete="name"
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Input
            id="role"
            name="role"
            required
            maxLength={200}
            placeholder="e.g. Board member, Administrator"
            autoComplete="organization-title"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            maxLength={320}
            placeholder="you@example.com"
            autoComplete="email"
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            required
            maxLength={50}
            placeholder="(555) 555-5555"
            autoComplete="tel"
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="membershipSize">Membership Size</Label>
        <select
          id="membershipSize"
          name="membershipSize"
          required
          defaultValue=""
          className="h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-base text-gray-900 focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
        >
          <option value="" disabled>
            Select a range
          </option>
          {MEMBERSHIP_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} members
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">
          Notes <span className="font-normal text-gray-400">(optional)</span>
        </Label>
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          maxLength={5000}
          placeholder="Anything you'd like us to know"
          className="resize-none rounded-lg border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400"
        />
      </div>

      {/* Honeypot: hidden from people, tempting to bots */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-12 w-full rounded-lg bg-brand-teal font-semibold text-white hover:bg-brand-teal-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Sending..." : "Request a Demo"}
      </Button>
    </form>
  );
}
