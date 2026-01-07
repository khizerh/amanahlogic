"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { MemberNavigation } from "./MemberNavigation";

function MemberPortalContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/portal/login";

  // Login page has its own full-page layout
  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      <MemberNavigation />
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

export default function MemberPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <MemberPortalContent>{children}</MemberPortalContent>
    </Suspense>
  );
}
