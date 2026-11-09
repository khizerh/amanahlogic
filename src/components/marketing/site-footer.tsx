import Link from "next/link";
import Image from "next/image";

const SECTIONS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Become a Member", href: "/join" },
      { label: "Sign In", href: "/portal/login" },
    ],
  },
  {
    title: "Company",
    links: [{ label: "Request a Demo", href: "/request-demo" }],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

/** Footer for the public marketing pages. */
export function SiteFooter() {
  return (
    <footer className="bg-brand-teal text-slate-300">
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 pb-8 pt-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-between gap-12">
          <div className="flex max-w-xs flex-col gap-3">
            <Image src="/logos/logo-icon-white.svg" alt="Amanah Logic" width={100} height={31} />
            <p className="text-sm leading-relaxed">
              Secure. Simple. Purpose-built for your community.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-16 gap-y-10">
            {SECTIONS.map((section) => (
              <div key={section.title} className="flex flex-col gap-3">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-white">
                  {section.title}
                </h4>
                {section.links.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="text-sm transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-white/10 pt-6 text-sm">
          &copy; {new Date().getFullYear()} Amanah Logic. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
