"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/">
            <Image src="/logos/logo-new.svg" alt="Amanah Logic" width={100} height={30} />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/portal/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2">
              Member Login
            </Link>
            <Link href="/login" className="text-sm font-medium text-white bg-[#111827] hover:bg-[#1f2937] rounded-lg px-4 py-2 transition-colors">
              Admin Login
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Header */}
      <div className="bg-gray-50 pt-8 pb-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.h1 initial="hidden" animate="visible" variants={fadeIn} className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-4">
            Privacy Policy
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-gray-600">
            Last updated: January 2026
          </motion.p>
        </div>
      </div>

      {/* Content */}
      <main className="py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="prose prose-gray max-w-none">
            <section className="mb-12">
              <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                Amanah Logic (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is committed to protecting your privacy.
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information
                when you use our membership management platform and related services (collectively, the &ldquo;Service&rdquo;).
              </p>
              <p className="text-gray-700 leading-relaxed mt-4">
                By using our Service, you agree to the collection and use of information in accordance with
                this Privacy Policy.
              </p>
            </section>

            <nav className="mb-12 p-6 bg-gray-50 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Table of Contents</h2>
              <ul className="space-y-2">
                {[
                  { href: "#information-we-collect", label: "1. Information We Collect" },
                  { href: "#how-we-use-information", label: "2. How We Use Your Information" },
                  { href: "#third-party-services", label: "3. Third-Party Services" },
                  { href: "#ccpa-rights", label: "4. Your California Privacy Rights (CCPA)" },
                  { href: "#data-retention", label: "5. Data Retention" },
                  { href: "#security", label: "6. Security" },
                  { href: "#contact", label: "7. Contact Information" },
                  { href: "#updates", label: "8. Updates to This Policy" },
                ].map((item) => (
                  <li key={item.href}>
                    <a href={item.href} className="text-[#111827] hover:underline">{item.label}</a>
                  </li>
                ))}
              </ul>
            </nav>

            <section id="information-we-collect" className="mb-12 scroll-mt-24">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 pb-2 border-b border-gray-200">1. Information We Collect</h2>
              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Account Information</h3>
              <p className="text-gray-700 leading-relaxed mb-4">When you create an account, we collect:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                <li>Name and contact information (email address, phone number)</li>
                <li>Mailing address</li>
                <li>Login credentials (password is encrypted and stored securely)</li>
                <li>Account preferences and settings</li>
              </ul>
              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Membership Data</h3>
              <p className="text-gray-700 leading-relaxed mb-4">To provide our services, we store:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                <li>Member and dependent information (names, dates of birth, contact details)</li>
                <li>Membership status and plan details</li>
                <li>Plot assignments and burial benefit records</li>
                <li>Signed agreements and documents</li>
                <li>Payment history and invoices</li>
              </ul>
              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Payment Information</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Payment processing is handled by Stripe. We do not directly store your credit card numbers. Stripe collects:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Credit/debit card details (processed securely by Stripe)</li>
                <li>Billing address</li>
                <li>Transaction history and payment status</li>
              </ul>
            </section>

            <section id="how-we-use-information" className="mb-12 scroll-mt-24">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 pb-2 border-b border-gray-200">2. How We Use Your Information</h2>
              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Providing the Service</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                <li>Manage your membership and dependent records</li>
                <li>Process dues and payment transactions</li>
                <li>Assign and track burial plots</li>
                <li>Generate agreements and membership documents</li>
              </ul>
              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Communications</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                <li>Payment confirmations and receipts</li>
                <li>Membership status updates</li>
                <li>Important announcements from your organization</li>
              </ul>
            </section>

            <section id="third-party-services" className="mb-12 scroll-mt-24">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 pb-2 border-b border-gray-200">3. Third-Party Services</h2>
              <p className="text-gray-700 leading-relaxed mb-6">We work with trusted third-party providers:</p>
              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Payment Processing (Stripe)</h3>
              <p className="text-gray-700 leading-relaxed mb-6">
                Your payment information is sent directly to Stripe per their{" "}
                <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#111827] hover:underline">Privacy Policy</a>.
                Stripe is PCI-DSS compliant.
              </p>
              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Authentication (Supabase)</h3>
              <p className="text-gray-700 leading-relaxed mb-6">Your login credentials are securely managed through Supabase infrastructure.</p>
              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Email Services</h3>
              <p className="text-gray-700 leading-relaxed">We use email providers to send notifications solely on our behalf.</p>
            </section>

            <section id="ccpa-rights" className="mb-12 scroll-mt-24">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 pb-2 border-b border-gray-200">4. Your California Privacy Rights (CCPA)</h2>
              <p className="text-gray-700 leading-relaxed mb-6">If you are a California resident, the CCPA provides you with specific rights:</p>
              {[
                { title: "Right to Know", text: "You have the right to request disclosure of what personal information we collect and why." },
                { title: "Right to Delete", text: "You have the right to request deletion of your personal information, subject to certain exceptions." },
                { title: "Right to Opt-Out of Sale", text: "We do not sell your personal information. Amanah Logic does not sell, rent, or trade your data." },
                { title: "Right to Non-Discrimination", text: "We will not discriminate against you for exercising any of your CCPA rights." },
              ].map((item) => (
                <div key={item.title} className="bg-[#F8CC58]/5 border-l-4 border-[#F8CC58] p-6 rounded-r-lg mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-700">{item.text}</p>
                </div>
              ))}
              <p className="text-gray-700 leading-relaxed">
                To exercise your rights, email{" "}
                <a href="mailto:privacy@amanahlogic.com" className="text-[#111827] hover:underline">privacy@amanahlogic.com</a>.
              </p>
            </section>

            <section id="data-retention" className="mb-12 scroll-mt-24">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 pb-2 border-b border-gray-200">5. Data Retention</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Account Data:</strong> Retained while active. Deleted within 90 days of closure.</li>
                <li><strong>Membership Data:</strong> Retained while active and for a reasonable period afterward.</li>
                <li><strong>Payment Records:</strong> Retained as required by law.</li>
                <li><strong>Usage Data:</strong> Anonymized data may be retained for analytics.</li>
              </ul>
            </section>

            <section id="security" className="mb-12 scroll-mt-24">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 pb-2 border-b border-gray-200">6. Security</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                <li>Encryption of data in transit (TLS/SSL) and at rest</li>
                <li>Access controls and authentication mechanisms</li>
                <li>Secure cloud infrastructure with industry-leading providers</li>
                <li>Regular backups and disaster recovery procedures</li>
              </ul>
            </section>

            <section id="contact" className="mb-12 scroll-mt-24">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 pb-2 border-b border-gray-200">7. Contact Information</h2>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-700 mb-2"><strong>Amanah Logic</strong></p>
                <p className="text-gray-700">Email: <a href="mailto:privacy@amanahlogic.com" className="text-[#111827] hover:underline">privacy@amanahlogic.com</a></p>
              </div>
            </section>

            <section id="updates" className="mb-12 scroll-mt-24">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 pb-2 border-b border-gray-200">8. Updates to This Policy</h2>
              <p className="text-gray-700 leading-relaxed">
                We may update this Privacy Policy from time to time. We will update the &ldquo;Last updated&rdquo; date
                and notify you of material changes via email or through the Service.
              </p>
            </section>
          </div>
        </div>
      </main>

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
