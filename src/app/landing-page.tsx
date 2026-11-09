"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Check,
  ClipboardCheck,
  CreditCard,
  FileSignature,
  MessagesSquare,
  UserRound,
  Users,
} from "lucide-react";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { OrgPicker } from "@/components/marketing/org-picker";
import type { LiveOrganization } from "@/lib/database/live-organizations";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const FEATURES = [
  {
    icon: Users,
    title: "Member Management",
    description: "Track members, dependents, and status with a complete directory.",
  },
  {
    icon: CreditCard,
    title: "Payment Processing",
    description: "Collect dues online with Stripe. Receipts, history, and reminders.",
  },
  {
    icon: MessagesSquare,
    title: "Two-Way SMS",
    description: "Stay connected with members through seamless two-way texting.",
  },
  {
    icon: FileSignature,
    title: "Digital Forms and Agreements",
    description: "Enrollment and consent forms, signed online.",
  },
  {
    icon: UserRound,
    title: "Member Portal",
    description: "Members view their profile, make payments, and access agreements.",
  },
  {
    icon: ClipboardCheck,
    title: "Enrollment Approvals",
    description: "New and returning member applications land in a review queue for your approval.",
  },
];

const OUTCOMES = [
  {
    title: "No More In-Person Payment Visits",
    description: "Members pay dues online, any time, from any device.",
  },
  {
    title: "No Cash Handling",
    description: "Every payment is processed securely through Stripe.",
  },
  {
    title: "No Manual Bookkeeping",
    description: "Receipts, payment history, and dues status are tracked automatically.",
  },
];

export function LandingPage({ orgs }: { orgs: LiveOrganization[] }) {
  return (
    <div className="min-h-screen bg-white">
      <SiteNav />

      {/* Hero: plain markup, no entrance animation, so the join box is usable
          the moment the HTML arrives (slow phones, flaky masjid wifi) */}
      <section className="bg-[#FFFBF2]">
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 sm:pt-24 lg:px-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            <p className="inline-flex items-center gap-2 rounded-full bg-[#F6EFDF] px-4 py-2 text-xs font-medium text-brand-teal sm:text-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C9A24A]" />
              Built for Masajid &amp; Muslim Community Organizations
            </p>

            <h1 className="text-4xl font-extrabold tracking-tight text-brand-teal sm:text-5xl lg:text-6xl">
              Community Burial Benefits, Managed Simply
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-slate-600">
              The all-in-one platform to manage memberships, payments, forms, and records from one
              dashboard
            </p>

            {/* Become a member */}
            <div
              id="join"
              className="mt-2 flex w-full max-w-xl scroll-mt-24 flex-col gap-3 rounded-2xl border border-[#E8DDC4] bg-white p-5 text-left shadow-[0_12px_32px_-20px_rgba(0,39,43,0.3)] sm:p-6"
            >
              {orgs.length > 0 && (
                <>
                  <label
                    htmlFor="hero-org"
                    className="text-center text-base font-bold text-brand-teal"
                  >
                    Become a Member of Your Local Organization
                  </label>
                  <OrgPicker orgs={orgs} selectId="hero-org" />
                </>
              )}
              <p className="text-center text-sm text-slate-600">
                Already a member?{" "}
                <Link href="/portal/login" className="font-semibold text-brand-teal hover:underline">
                  Sign In
                </Link>
              </p>
            </div>

            <p className="text-[15px] text-slate-600">
              Run a masjid or community organization?{" "}
              <Link href="/request-demo" className="font-semibold text-[#87661C] hover:underline">
                Request a Demo
              </Link>
            </p>

            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 pt-1 text-sm text-slate-700">
              {["Secure payments via Stripe", "Member self-service portal", "Digital agreements"].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-brand-teal" strokeWidth={2.5} />
                    {item}
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeIn}
            className="mb-12 text-center"
          >
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[#87661C]">
              Everything You Need
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight text-brand-teal sm:text-4xl">
              Built for Community Organizations
            </h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {FEATURES.map((feature) => (
              <motion.div
                key={feature.title}
                variants={staggerItem}
                whileHover={{ y: -4 }}
                className="rounded-2xl border border-gray-200 bg-white p-7 transition-shadow hover:border-[#C9A24A]/60 hover:shadow-lg hover:shadow-amber-100/50"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#F6EFDF]">
                  <feature.icon className="h-5 w-5 text-brand-teal" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-brand-teal">{feature.title}</h3>
                <p className="text-[15px] leading-relaxed text-slate-600">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* In use today */}
      <section className="border-y border-gray-200 bg-slate-50 py-24">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="flex flex-col gap-4"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-[#87661C]">
              In Use Today
            </p>
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-brand-teal sm:text-4xl">
              Running at Masjid Muhajireen in Hayward, CA
            </h2>
            <p className="text-[17px] leading-relaxed text-slate-600">
              Masjid Muhajireen manages its burial benefits program on AmanahLogic: members enroll,
              pay, and sign agreements online, and the admin team runs everything from one
              dashboard.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="flex flex-col gap-3.5"
          >
            {OUTCOMES.map((outcome) => (
              <motion.div
                key={outcome.title}
                variants={staggerItem}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white px-5 py-5"
              >
                <Check className="mt-0.5 h-6 w-6 flex-none text-brand-teal" strokeWidth={2.25} />
                <div className="flex flex-col gap-1">
                  <h3 className="text-[17px] font-semibold text-brand-teal">{outcome.title}</h3>
                  <p className="text-[15px] leading-relaxed text-slate-600">{outcome.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Demo CTA */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="flex flex-col items-center gap-4 rounded-3xl bg-brand-teal px-6 py-16 text-center sm:px-12"
          >
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              See Amanah in Action
            </h2>
            <p className="max-w-lg text-lg leading-relaxed text-slate-300">
              Request a demo and we&apos;ll walk you through the platform.
            </p>
            <Link
              href="/request-demo"
              className="mt-2 inline-flex min-h-[48px] items-center rounded-lg bg-white px-7 text-base font-semibold text-brand-teal transition-colors hover:bg-slate-100"
            >
              Request a Demo
            </Link>
          </motion.div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
