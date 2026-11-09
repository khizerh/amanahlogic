import Link from "next/link";
import Image from "next/image";

/** Top navigation for the public marketing pages: Features | Sign In. */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/">
          <Image src="/logos/logo-new.svg" alt="Amanah Logic" width={100} height={30} priority />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-2 sm:gap-5">
          <Link
            href="/#features"
            className="px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            Features
          </Link>
          <Link
            href="/portal/login"
            className="inline-flex min-h-[40px] items-center rounded-lg bg-brand-teal px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-teal-hover"
          >
            Sign In
          </Link>
        </nav>
      </div>
    </header>
  );
}
