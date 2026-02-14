import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join",
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        {children}
      </div>
    </div>
  );
}
