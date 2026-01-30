"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

export default function TermsOfServicePage() {
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
            <Image src="/logos/logo-text.svg" alt="Amanah Logic" width={140} height={20} />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/portal/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2">
              Member Login
            </Link>
            <Link href="/login" className="text-sm font-medium text-white bg-[#0638A8] hover:bg-[#021786] rounded-lg px-4 py-2 transition-colors">
              Admin Login
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Header */}
      <div className="bg-gray-50 pt-8 pb-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.h1 initial="hidden" animate="visible" variants={fadeIn} className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-4">
            Terms of Service
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-gray-600">
            Last updated: January 2026
          </motion.p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-gray max-w-none">
          <p className="text-lg text-gray-600 leading-relaxed mb-8">
            Welcome to Amanah Logic. These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the
            Amanah Logic platform, website, and services (collectively, the &ldquo;Service&rdquo;).
          </p>

          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-600 mb-4">
              By accessing or using the Service, you agree to be bound by these Terms. If you are using the Service
              on behalf of an organization, you represent that you have authority to bind that organization.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">2. Description of Service</h2>
            <p className="text-gray-600 mb-4">
              Amanah Logic is a membership management platform for Muslim community organizations managing burial benefit programs:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li><strong>Member Management:</strong> Tools for managing member records, dependents, and membership status.</li>
              <li><strong>Payment Processing:</strong> Integrated payment solutions for collecting membership dues.</li>
              <li><strong>Plot Management:</strong> Graveyard plot tracking, assignments, and availability.</li>
              <li><strong>Member Portal:</strong> A member-facing portal for profiles, payments, and agreements.</li>
              <li><strong>Agreement Management:</strong> Digital agreements and document management.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">3. Account Registration</h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li><strong>Age Requirement:</strong> You must be at least 18 years old.</li>
              <li><strong>Accurate Information:</strong> Provide accurate, current, and complete information.</li>
              <li><strong>Credential Security:</strong> Maintain the security of your password and credentials.</li>
              <li><strong>Account Activity:</strong> You are responsible for all activities under your account.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">4. Acceptable Use</h2>
            <p className="text-gray-600 mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li>Use the Service for any illegal purpose or in violation of any law.</li>
              <li>Engage in any activity that interferes with or disrupts the Service.</li>
              <li>Attempt to gain unauthorized access to any portion of the Service.</li>
              <li>Impersonate any person or entity, or misrepresent your affiliation.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">5. Payment Terms</h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li><strong>Billing:</strong> Payments are processed through Stripe.</li>
              <li><strong>Recurring Charges:</strong> Subscriptions auto-renew unless cancelled.</li>
              <li><strong>Cancellation:</strong> Cancel anytime. No refunds for partial periods.</li>
              <li><strong>Price Changes:</strong> We reserve the right to change fees with advance notice.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">6. Data and Content Ownership</h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li><strong>Your Data:</strong> You retain all rights to data you submit. We do not claim ownership.</li>
              <li><strong>License:</strong> You grant us a non-exclusive license to use your content to provide the Service.</li>
              <li><strong>Data Export:</strong> You can export your data at any time.</li>
              <li><strong>Data Deletion:</strong> Request deletion at any time, subject to legal requirements.</li>
            </ul>
            <p className="text-gray-600">
              See our <Link href="/privacy" className="text-[#0638A8] hover:underline">Privacy Policy</Link> for more.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">7. Third-Party Services</h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li><strong>Stripe:</strong> Processes payments per their own terms and privacy policy.</li>
              <li><strong>Supabase:</strong> Provides authentication services.</li>
              <li><strong>Email Providers:</strong> Send notifications and communications on our behalf.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">8. Limitation of Liability</h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li>THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTIES OF ANY KIND.</li>
              <li>WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE.</li>
              <li>WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES.</li>
              <li>OUR TOTAL LIABILITY SHALL NOT EXCEED FEES PAID IN THE 12 MONTHS PRECEDING THE CLAIM.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">9. Indemnification</h2>
            <p className="text-gray-600">
              You agree to defend, indemnify, and hold harmless Amanah Logic from any claims arising from your
              violation of these Terms or your use of the Service.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">10. Termination</h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li><strong>By You:</strong> Terminate your account at any time by contacting us.</li>
              <li><strong>By Us:</strong> We may terminate for breach of these Terms.</li>
              <li><strong>Effect:</strong> We retain your data for 30 days for export purposes.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">11. Governing Law</h2>
            <p className="text-gray-600">
              These Terms are governed by the laws of the State of California, United States. Disputes shall be
              resolved in the state or federal courts located in California.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">12. Changes to Terms</h2>
            <p className="text-gray-600">
              We may modify these Terms at any time. We will notify you of material changes by updating the date on
              this page, sending an email, or displaying a notice within the Service.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">13. Contact</h2>
            <div className="bg-gray-50 rounded-lg p-6 text-gray-600">
              <p className="font-semibold text-gray-900 mb-2">Amanah Logic</p>
              <p>Email: legal@amanahlogic.com</p>
              <p>Website: www.amanahlogic.com</p>
            </div>
          </section>

          <div className="border-t border-gray-200 pt-8 mt-12">
            <p className="text-gray-600 text-center">
              By using Amanah Logic, you acknowledge that you have read, understood, and agree to these Terms of Service.
            </p>
          </div>
        </div>
      </div>

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
