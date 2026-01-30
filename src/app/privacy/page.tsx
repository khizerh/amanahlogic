import Link from "next/link";
import Image from "next/image";

export default function PrivacyPolicyPage() {
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
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-4">Privacy Policy</h1>
          <p className="text-gray-600">Last updated: January 2026</p>
        </div>
      </div>

      {/* Content */}
      <main className="py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="prose prose-gray max-w-none">
            {/* Introduction */}
            <section className="mb-12">
              <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                Amanah Logic ("we," "us," or "our") is committed to protecting your privacy.
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information
                when you use our membership management platform and related services (collectively,
                the "Service").
              </p>
              <p className="text-gray-700 leading-relaxed mt-4">
                By using our Service, you agree to the collection and use of information in accordance with
                this Privacy Policy. If you do not agree with our policies and practices, please do not use
                our Service.
              </p>
            </section>

            {/* Table of Contents */}
            <nav className="mb-12 p-6 bg-gray-50 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Table of Contents</h2>
              <ul className="space-y-2">
                <li><a href="#information-we-collect" className="text-[#00272B] hover:underline">1. Information We Collect</a></li>
                <li><a href="#how-we-use-information" className="text-[#00272B] hover:underline">2. How We Use Your Information</a></li>
                <li><a href="#third-party-services" className="text-[#00272B] hover:underline">3. Third-Party Services</a></li>
                <li><a href="#ccpa-rights" className="text-[#00272B] hover:underline">4. Your California Privacy Rights (CCPA)</a></li>
                <li><a href="#data-retention" className="text-[#00272B] hover:underline">5. Data Retention</a></li>
                <li><a href="#security" className="text-[#00272B] hover:underline">6. Security</a></li>
                <li><a href="#contact" className="text-[#00272B] hover:underline">7. Contact Information</a></li>
                <li><a href="#updates" className="text-[#00272B] hover:underline">8. Updates to This Policy</a></li>
              </ul>
            </nav>

            {/* Section 1 */}
            <section id="information-we-collect" className="mb-12 scroll-mt-24">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 pb-2 border-b border-gray-200">
                1. Information We Collect
              </h2>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Account Information</h3>
              <p className="text-gray-700 leading-relaxed mb-4">When you create an account, we collect:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                <li>Name and contact information (email address, phone number)</li>
                <li>Mailing address</li>
                <li>Login credentials (password is encrypted and stored securely)</li>
                <li>Account preferences and settings</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Membership Data</h3>
              <p className="text-gray-700 leading-relaxed mb-4">To provide our membership management services, we store:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                <li>Member and dependent information (names, dates of birth, contact details)</li>
                <li>Membership status and plan details</li>
                <li>Plot assignments and burial benefit records</li>
                <li>Signed agreements and documents</li>
                <li>Payment history and invoices</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Payment Information</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Payment processing is handled by our third-party payment processor, Stripe. We do not directly
                store your complete credit card numbers or banking information. Stripe collects and processes:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Credit/debit card details (processed securely by Stripe)</li>
                <li>Billing address</li>
                <li>Transaction history and payment status</li>
              </ul>
            </section>

            {/* Section 2 */}
            <section id="how-we-use-information" className="mb-12 scroll-mt-24">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 pb-2 border-b border-gray-200">
                2. How We Use Your Information
              </h2>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Providing the Service</h3>
              <p className="text-gray-700 leading-relaxed mb-4">We use your information to:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                <li>Manage your membership and dependent records</li>
                <li>Process dues and payment transactions</li>
                <li>Assign and track burial plots</li>
                <li>Generate agreements and membership documents</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Communications</h3>
              <p className="text-gray-700 leading-relaxed mb-4">We send notifications to help manage your membership:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                <li>Payment confirmations and receipts</li>
                <li>Membership status updates</li>
                <li>Important announcements from your organization</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Service Improvement</h3>
              <p className="text-gray-700 leading-relaxed">
                We analyze usage patterns to improve the platform, fix bugs, and develop features
                that better serve community organizations.
              </p>
            </section>

            {/* Section 3 */}
            <section id="third-party-services" className="mb-12 scroll-mt-24">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 pb-2 border-b border-gray-200">
                3. Third-Party Services
              </h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                We work with trusted third-party service providers to deliver our Service. These providers
                have access to your information only to perform specific tasks on our behalf.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Payment Processing (Stripe)</h3>
              <p className="text-gray-700 leading-relaxed mb-6">
                We use Stripe for payment processing. Your payment information is sent directly to Stripe
                and processed according to their{" "}
                <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#00272B] hover:underline">
                  Privacy Policy
                </a>.
                Stripe is PCI-DSS compliant, ensuring your payment data is handled securely.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Authentication (Supabase)</h3>
              <p className="text-gray-700 leading-relaxed mb-6">
                We use Supabase for user authentication and database services. Your login credentials are
                securely managed through their infrastructure.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Email Services</h3>
              <p className="text-gray-700 leading-relaxed">
                We use email service providers to send notifications about your membership, payments, and
                important updates. These providers process your contact information solely for the purpose
                of delivering messages on our behalf.
              </p>
            </section>

            {/* Section 4 */}
            <section id="ccpa-rights" className="mb-12 scroll-mt-24">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 pb-2 border-b border-gray-200">
                4. Your California Privacy Rights (CCPA)
              </h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                If you are a California resident, the California Consumer Privacy Act (CCPA) provides you
                with specific rights regarding your personal information.
              </p>

              <div className="bg-[#00272B]/5 border-l-4 border-[#00272B] p-6 rounded-r-lg mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Right to Know</h3>
                <p className="text-gray-700">
                  You have the right to request that we disclose what personal information we have collected
                  about you, the categories of sources, and the business purpose for collecting it.
                </p>
              </div>

              <div className="bg-[#00272B]/5 border-l-4 border-[#00272B] p-6 rounded-r-lg mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Right to Delete</h3>
                <p className="text-gray-700">
                  You have the right to request that we delete the personal information we have collected
                  from you, subject to certain exceptions.
                </p>
              </div>

              <div className="bg-[#00272B]/5 border-l-4 border-[#00272B] p-6 rounded-r-lg mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Right to Opt-Out of Sale</h3>
                <p className="text-gray-700">
                  <strong>We do not sell your personal information.</strong> Amanah Logic does not sell, rent,
                  or trade your personal information to third parties for monetary or other valuable consideration.
                </p>
              </div>

              <div className="bg-[#00272B]/5 border-l-4 border-[#00272B] p-6 rounded-r-lg mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Right to Non-Discrimination</h3>
                <p className="text-gray-700">
                  We will not discriminate against you for exercising any of your CCPA rights.
                </p>
              </div>

              <h3 className="text-xl font-semibold text-gray-900 mt-8 mb-3">How to Exercise Your Rights</h3>
              <p className="text-gray-700 leading-relaxed">
                To exercise your CCPA rights, email us at{" "}
                <a href="mailto:privacy@amanahlogic.com" className="text-[#00272B] hover:underline">
                  privacy@amanahlogic.com
                </a>.
                We will verify your identity before processing your request and respond within 45 days.
              </p>
            </section>

            {/* Section 5 */}
            <section id="data-retention" className="mb-12 scroll-mt-24">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 pb-2 border-b border-gray-200">
                5. Data Retention
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We retain your personal information for as long as necessary to provide the Service:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Account Data:</strong> Retained while your account is active. Deleted within 90 days of account closure.</li>
                <li><strong>Membership Data:</strong> Retained while your membership is active and for a reasonable period afterward for record-keeping.</li>
                <li><strong>Payment Records:</strong> Retained as required by tax and legal obligations.</li>
                <li><strong>Usage Data:</strong> Anonymized usage data may be retained for analytics and improvement.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section id="security" className="mb-12 scroll-mt-24">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 pb-2 border-b border-gray-200">
                6. Security
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We implement appropriate technical and organizational measures to protect your information:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                <li>Encryption of data in transit (TLS/SSL) and at rest</li>
                <li>Access controls and authentication mechanisms</li>
                <li>Secure cloud infrastructure with industry-leading providers</li>
                <li>Regular backups and disaster recovery procedures</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                While we strive to protect your personal information, no method of transmission over the
                Internet is 100% secure. We continuously work to protect your information using commercially
                reasonable measures.
              </p>
            </section>

            {/* Section 7 */}
            <section id="contact" className="mb-12 scroll-mt-24">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 pb-2 border-b border-gray-200">
                7. Contact Information
              </h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                If you have questions about this Privacy Policy or want to exercise your privacy rights:
              </p>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-700 mb-2"><strong>Amanah Logic</strong></p>
                <p className="text-gray-700 mb-2">Privacy Inquiries</p>
                <p className="text-gray-700">
                  Email:{" "}
                  <a href="mailto:privacy@amanahlogic.com" className="text-[#00272B] hover:underline">
                    privacy@amanahlogic.com
                  </a>
                </p>
              </div>
            </section>

            {/* Section 8 */}
            <section id="updates" className="mb-12 scroll-mt-24">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 pb-2 border-b border-gray-200">
                8. Updates to This Policy
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We may update this Privacy Policy from time to time. When we make changes:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
                <li>We will update the "Last updated" date at the top of this page</li>
                <li>For material changes, we will notify you via email or through a notice in the Service</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                Your continued use of the Service after any changes constitutes your acceptance of the updated policy.
              </p>
            </section>

            {/* Final Note */}
            <section className="mt-12 p-6 bg-gray-50 rounded-lg">
              <p className="text-gray-600 text-sm">
                This Privacy Policy is effective as of January 2026. If you have any questions, contact us at{" "}
                <a href="mailto:privacy@amanahlogic.com" className="text-[#00272B] hover:underline">
                  privacy@amanahlogic.com
                </a>.
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
