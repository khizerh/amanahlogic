import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "SMS / Text Message Program — Masjid Muhajireen",
  description:
    "How members opt in to SMS notifications from Masjid Muhajireen (operated by Islamic Association of Immigrants), what messages are sent, and how to opt out.",
};

/**
 * Public, single-screen SMS opt-in / Call-to-Action page for A2P 10DLC review.
 * Fully server-rendered so the campaign reviewer can verify the opt-in without
 * navigating the multi-step enrollment form. Shows every opt-in path, the exact
 * consent language, the consent UI, required disclosures, and legal links.
 */
export default function SmsOptInPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/">
            <Image src="/logos/logo-new.svg" alt="Amanah Logic" width={100} height={30} />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/privacy" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2">
              Terms
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="bg-gray-50 pt-8 pb-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            SMS / Text Message Program
          </h1>
          <p className="text-gray-600">
            <strong>Masjid Muhajireen</strong>, a membership program operated by{" "}
            <strong>Islamic Association of Immigrants</strong>.
          </p>
        </div>
      </div>

      <main className="py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-12 text-gray-700 leading-relaxed">
          {/* What we send */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">What messages we send</h2>
            <p>
              Enrolled members who opt in receive account notifications about their membership:
              payment receipts, payment failure alerts, eligibility milestone updates, and replies
              to their customer-support questions. This is an account-notification program, not
              marketing.
            </p>
            <p className="mt-4 font-medium text-gray-900">Example messages:</p>
            <ul className="mt-2 space-y-2">
              {[
                "Masjid Muhajireen: Hi Ahmad, your monthly dues payment of $40.00 was received. Thanks! Reply STOP to opt out, HELP for help.",
                "Masjid Muhajireen: Your payment of $40.00 couldn't be processed. Please update your card at amanahlogic.com/portal. Reply STOP to opt out, HELP for help.",
                "Masjid Muhajireen: You've reached 60 paid months and are now eligible for burial benefits. Contact the masjid with questions. Reply STOP to opt out, HELP for help.",
              ].map((m) => (
                <li key={m} className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                  {m}
                </li>
              ))}
            </ul>
          </section>

          {/* How to opt in — all paths */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">How members opt in</h2>
            <p>
              Opting in to SMS is <strong>optional</strong> and is never required to enroll or to
              pay. Only members who affirmatively opt in receive text messages. Consent is collected
              at the point we collect the member&apos;s phone number, through any of these paths:
            </p>
            <ol className="mt-4 space-y-3 list-decimal pl-5">
              <li>
                <strong>Online membership application.</strong> At{" "}
                <a
                  href="https://www.amanahlogic.com/join/masjid-muhajireen"
                  className="text-teal-700 underline"
                >
                  amanahlogic.com/join/masjid-muhajireen
                </a>
                , next to the phone-number field, an SMS consent checkbox (unchecked by default)
                appears. The form submits whether or not it is checked; only members who check it
                receive SMS.
              </li>
              <li>
                <strong>In person on a paper enrollment form.</strong> The same consent language
                appears on the paper form. A member who checks/signs the SMS box is entered into the
                same system with their consent recorded.
              </li>
              <li>
                <strong>In person during staff-assisted enrollment.</strong> When a member enrolls
                in person with masjid staff, the same SMS consent disclosure is presented and only
                recorded if the member affirmatively agrees.
              </li>
            </ol>
            <p className="mt-4">
              Members may opt out at any time by replying <strong>STOP</strong>, and can get help by
              replying <strong>HELP</strong>.
            </p>
          </section>

          {/* The exact consent UI + language */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">The opt-in, exactly as shown</h2>
            <p className="mb-4">
              When a member provides their phone number during enrollment, this is the consent
              shown directly beneath it:
            </p>
            <div className="rounded-xl border border-gray-300 p-5 bg-white shadow-sm">
              {/* Phone field (representation) */}
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <div className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-500 text-sm">
                (•••) ••• ••••
              </div>
              {/* Consent checkbox (representation) */}
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-4 w-4 shrink-0 rounded border border-gray-400 bg-white" aria-hidden />
                  <span className="text-sm text-gray-600">
                    <span className="font-semibold">Optional:</span> I agree to receive SMS text
                    messages from Masjid Muhajireen (operated by Islamic Association of Immigrants)
                    about my membership account, including payment receipts, payment failure alerts,
                    eligibility milestone updates, and customer support replies. This is not required
                    to enroll. Message frequency varies. Message and data rates may apply. Reply{" "}
                    <span className="font-semibold">STOP</span> to opt out,{" "}
                    <span className="font-semibold">HELP</span> for help. See our{" "}
                    <a href="/privacy" className="text-teal-700 underline">Privacy Policy</a> and{" "}
                    <a href="/terms" className="text-teal-700 underline">Terms of Service</a>.
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Disclosures */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Program details &amp; disclosures</h2>
            <ul className="space-y-2 list-disc pl-5">
              <li>Message frequency varies based on your account activity.</li>
              <li>Message and data rates may apply.</li>
              <li>Reply <strong>STOP</strong> to unsubscribe at any time.</li>
              <li>Reply <strong>HELP</strong> for help, or contact info@masjidmuhajireen.org.</li>
              <li>
                We do not share or sell your mobile number or message content with third parties or
                affiliates for marketing. See our{" "}
                <a href="/privacy" className="text-teal-700 underline">Privacy Policy</a>.
              </li>
              <li>
                Carriers are not liable for delayed or undelivered messages.
              </li>
            </ul>
          </section>

          <section className="border-t border-gray-200 pt-6 text-sm text-gray-500">
            <p>
              Program: Masjid Muhajireen membership account notifications. Operated by Islamic
              Association of Immigrants.{" "}
              <a href="/privacy" className="text-teal-700 underline">Privacy Policy</a> ·{" "}
              <a href="/terms" className="text-teal-700 underline">Terms of Service</a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
