import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Shield, Users, CreditCard, MapPin } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/">
            <Image src="/logos/logo-text.svg" alt="Amanah Logic" width={140} height={20} />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/portal/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2"
            >
              Member Login
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-white bg-[#00272B] hover:bg-[#013136] rounded-lg px-4 py-2 transition-colors"
            >
              Admin Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 sm:pt-40 sm:pb-28 bg-gradient-to-b from-[#F7F9FC] to-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-6">
            <span className="block">Community Burial Benefits,</span>
            <span className="block text-[#00272B]">Managed Simply</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-600 leading-relaxed mb-10">
            The membership management platform built for Muslim community organizations.
            Handle members, payments, plots, and agreements — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/portal/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-white bg-[#00272B] hover:bg-[#013136] rounded-lg px-6 py-3 transition-colors"
            >
              Member Portal
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#00272B] border border-[#00272B] hover:bg-[#00272B] hover:text-white rounded-lg px-6 py-3 transition-colors"
            >
              Admin Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#00272B]/60 mb-3">
              Everything You Need
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
              Built for community organizations
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Users,
                title: "Member Management",
                description: "Track members, dependents, and membership status with a complete member directory.",
              },
              {
                icon: CreditCard,
                title: "Payment Processing",
                description: "Collect dues online with Stripe. Automatic receipts, payment history, and reminders.",
              },
              {
                icon: MapPin,
                title: "Plot Management",
                description: "Manage graveyard plots, assignments, and availability with visual tracking.",
              },
              {
                icon: Shield,
                title: "Member Portal",
                description: "Members can view their profile, make payments, and access agreements online.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-gray-200 p-6 hover:border-[#00272B]/30 hover:shadow-sm transition-all"
              >
                <div className="h-10 w-10 rounded-lg bg-[#00272B]/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-5 w-5 text-[#00272B]" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#00272B] text-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
            Ready to get started?
          </h2>
          <p className="text-lg text-white/70 leading-relaxed mb-10 max-w-2xl mx-auto">
            Simplify how your organization manages memberships, payments, and burial plots.
          </p>
          <Link
            href="/portal/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#00272B] bg-white hover:bg-gray-100 rounded-lg px-6 py-3 transition-colors"
          >
            Access Member Portal
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col items-center md:items-start gap-1">
              <Image src="/logos/logo-icon-white.svg" alt="Amanah Logic" width={100} height={31} />
              <p className="text-sm mt-2">&copy; {new Date().getFullYear()} Amanah Logic. All rights reserved.</p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
