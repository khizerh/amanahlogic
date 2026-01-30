import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, Clock } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
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

      {/* Main Content */}
      <main className="flex-1 pt-12 pb-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-4">
              Get in touch
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              Have questions about Amanah Logic? We&apos;d love to hear from you.
            </p>
          </div>

          {/* Contact Cards */}
          <div className="space-y-6">
            <a
              href="mailto:support@amanahlogic.com"
              className="flex items-start gap-4 rounded-xl border border-gray-200 p-6 hover:border-[#00272B]/30 hover:shadow-sm transition-all"
            >
              <div className="h-10 w-10 rounded-lg bg-[#00272B]/10 flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-[#00272B]" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Email Us</h3>
                <p className="text-sm text-gray-600 mb-2">For general inquiries and support</p>
                <p className="text-sm font-medium text-[#00272B]">support@amanahlogic.com</p>
              </div>
            </a>

            <div className="flex items-start gap-4 rounded-xl border border-gray-200 p-6">
              <div className="h-10 w-10 rounded-lg bg-[#00272B]/10 flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5 text-[#00272B]" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Location</h3>
                <p className="text-sm text-gray-600">California, United States</p>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-xl border border-gray-200 p-6">
              <div className="h-10 w-10 rounded-lg bg-[#00272B]/10 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-[#00272B]" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Response Time</h3>
                <p className="text-sm text-gray-600">We typically respond within 24 hours</p>
              </div>
            </div>
          </div>

          {/* Additional contacts */}
          <div className="mt-12 p-6 bg-gray-50 rounded-xl">
            <h3 className="font-semibold text-gray-900 mb-4">Other Inquiries</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <p>
                <strong className="text-gray-900">Privacy concerns:</strong>{" "}
                <a href="mailto:privacy@amanahlogic.com" className="text-[#00272B] hover:underline">privacy@amanahlogic.com</a>
              </p>
              <p>
                <strong className="text-gray-900">Legal inquiries:</strong>{" "}
                <a href="mailto:legal@amanahlogic.com" className="text-[#00272B] hover:underline">legal@amanahlogic.com</a>
              </p>
            </div>
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
