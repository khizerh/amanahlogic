import { Metadata } from "next";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { RequestDemoForm } from "./request-demo-form";

export const metadata: Metadata = {
  title: "Request a Demo",
  description: "See how Amanah Logic runs a burial benefits membership program end to end.",
};

export default function RequestDemoPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNav />
      <main className="flex-1 bg-[#FFFBF2] pb-20 pt-12 sm:pt-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-brand-teal sm:text-4xl">
              Request a Demo
            </h1>
            <p className="text-lg leading-relaxed text-slate-600">
              Tell us about your organization and we&apos;ll walk you through the platform.
            </p>
          </div>
          <RequestDemoForm />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
