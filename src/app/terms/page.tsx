import Link from "next/link";
import Image from "next/image";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/">
            <Image src="/logos/logo-text.svg" alt="Amanah Logic" width={140} height={20} />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/portal/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2">
              Member Login
            </Link>
            <Link href="/login" className="text-sm font-medium text-white bg-[#00272B] hover:bg-[#013136] rounded-lg px-4 py-2 transition-colors">
              Admin Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="bg-gray-50 pt-8 pb-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-4">Terms of Service</h1>
          <p className="text-gray-600">Last updated: January 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-gray max-w-none">
          <p className="text-lg text-gray-600 leading-relaxed mb-8">
            Welcome to Amanah Logic. These Terms of Service ("Terms") govern your access to and use of the
            Amanah Logic platform, website, and services (collectively, the "Service"). Please read these
            Terms carefully before using our Service.
          </p>

          {/* Section 1 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-600 mb-4">
              By accessing or using the Service, you agree to be bound by these Terms. If you disagree with
              any part of the Terms, you may not access the Service.
            </p>
            <p className="text-gray-600">
              If you are using the Service on behalf of an organization, you represent and warrant that you
              have the authority to bind that organization to these Terms.
            </p>
          </section>

          {/* Section 2 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">2. Description of Service</h2>
            <p className="text-gray-600 mb-4">
              Amanah Logic is a membership management platform designed for Muslim community organizations
              managing burial benefit programs. Our Service includes:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li><strong>Member Management:</strong> Tools for managing member records, dependents, and membership status.</li>
              <li><strong>Payment Processing:</strong> Integrated payment solutions for collecting membership dues and fees.</li>
              <li><strong>Plot Management:</strong> Graveyard plot tracking, assignments, and availability management.</li>
              <li><strong>Member Portal:</strong> A member-facing portal for viewing profiles, making payments, and accessing agreements.</li>
              <li><strong>Agreement Management:</strong> Digital agreements and document management for memberships.</li>
            </ul>
            <p className="text-gray-600">
              We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time,
              with or without notice.
            </p>
          </section>

          {/* Section 3 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">3. Account Registration and Responsibilities</h2>
            <p className="text-gray-600 mb-4">
              To use certain features of the Service, you must register for an account. When you register, you agree to:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li><strong>Age Requirement:</strong> You must be at least 18 years old to create an account.</li>
              <li><strong>Accurate Information:</strong> Provide accurate, current, and complete information during registration.</li>
              <li><strong>Credential Security:</strong> Maintain the security of your password and account credentials.</li>
              <li><strong>Account Activity:</strong> You are solely responsible for all activities that occur under your account.</li>
            </ul>
            <p className="text-gray-600">
              We reserve the right to suspend or terminate your account if any information provided proves to be
              inaccurate, false, or outdated.
            </p>
          </section>

          {/* Section 4 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">4. Acceptable Use</h2>
            <p className="text-gray-600 mb-4">
              You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not to:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li><strong>Illegal Activity:</strong> Use the Service for any illegal purpose or in violation of any law.</li>
              <li><strong>System Abuse:</strong> Engage in any activity that interferes with or disrupts the Service.</li>
              <li><strong>Unauthorized Access:</strong> Attempt to gain unauthorized access to any portion of the Service.</li>
              <li><strong>Misrepresentation:</strong> Impersonate any person or entity, or misrepresent your affiliation.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">5. Payment Terms</h2>
            <p className="text-gray-600 mb-4">
              Access to certain features requires a paid subscription. By subscribing, you agree to:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li><strong>Billing:</strong> Payments are processed through Stripe. By providing payment information, you authorize us to charge your payment method.</li>
              <li><strong>Recurring Charges:</strong> Subscriptions automatically renew unless cancelled before the renewal date.</li>
              <li><strong>Cancellation:</strong> You may cancel at any time through your account settings. No refunds for partial billing periods.</li>
              <li><strong>Price Changes:</strong> We reserve the right to change fees with advance notice.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">6. Data and Content Ownership</h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li><strong>Your Data:</strong> You retain all rights to data you submit through the Service. Amanah Logic does not claim ownership of your content.</li>
              <li><strong>License:</strong> You grant Amanah Logic a non-exclusive license to use your content solely for the purpose of providing the Service.</li>
              <li><strong>Data Export:</strong> You have the right to export your data at any time.</li>
              <li><strong>Data Deletion:</strong> You may request deletion of your data at any time, subject to legal retention requirements.</li>
            </ul>
            <p className="text-gray-600">
              For more information, see our{" "}
              <Link href="/privacy" className="text-[#00272B] hover:underline">Privacy Policy</Link>.
            </p>
          </section>

          {/* Section 7 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">7. Third-Party Services</h2>
            <p className="text-gray-600 mb-4">
              The Service integrates with third-party services:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li><strong>Payment Processing:</strong> Stripe processes payments subject to their own terms and privacy policy.</li>
              <li><strong>Authentication:</strong> Supabase provides authentication services.</li>
              <li><strong>Email Services:</strong> We use email providers to send notifications and communications.</li>
            </ul>
            <p className="text-gray-600">
              Amanah Logic is not responsible for the availability or content of third-party services.
            </p>
          </section>

          {/* Section 8 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">8. Limitation of Liability</h2>
            <p className="text-gray-600 mb-4">TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:</p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li>THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND.</li>
              <li>WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE.</li>
              <li>IN NO EVENT SHALL AMANAH LOGIC BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.</li>
              <li>OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">9. Indemnification</h2>
            <p className="text-gray-600">
              You agree to defend, indemnify, and hold harmless Amanah Logic from any claims, liabilities,
              damages, or expenses arising out of your violation of these Terms, your use of the Service,
              or your violation of any rights of a third party.
            </p>
          </section>

          {/* Section 10 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">10. Termination</h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li><strong>By You:</strong> You may terminate your account at any time by contacting us.</li>
              <li><strong>By Us:</strong> We may terminate or suspend your account immediately for breach of these Terms.</li>
              <li><strong>Effect:</strong> Upon termination, your right to use the Service ceases immediately. We retain your data for 30 days for export purposes.</li>
            </ul>
          </section>

          {/* Section 11 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">11. Governing Law</h2>
            <p className="text-gray-600">
              These Terms shall be governed by the laws of the State of California, United States. Any disputes
              shall be resolved exclusively in the state or federal courts located in California.
            </p>
          </section>

          {/* Section 12 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">12. Changes to Terms</h2>
            <p className="text-gray-600 mb-4">
              We reserve the right to modify these Terms at any time. We will notify you of material changes by:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mb-4">
              <li>Updating the "Last updated" date on this page</li>
              <li>Sending an email notification to your account</li>
              <li>Displaying a notice within the Service</li>
            </ul>
          </section>

          {/* Section 13 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">13. Contact Information</h2>
            <p className="text-gray-600 mb-4">Questions about these Terms? Contact us:</p>
            <div className="bg-gray-50 rounded-lg p-6 text-gray-600">
              <p className="font-semibold text-gray-900 mb-2">Amanah Logic</p>
              <p>Email: legal@amanahlogic.com</p>
              <p>Website: www.amanahlogic.com</p>
            </div>
          </section>

          {/* Closing */}
          <div className="border-t border-gray-200 pt-8 mt-12">
            <p className="text-gray-600 text-center">
              By using Amanah Logic, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
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
