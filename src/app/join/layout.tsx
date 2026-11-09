export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-off-white">
      {/* Header banner - matches dashboard */}
      <div className="bg-brand-teal">
        <div className="mx-auto max-w-2xl px-4">
          <div className="flex items-center justify-center h-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/logo-white.svg"
              alt="Amanah Logic"
              className="h-8"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        {children}
      </div>
    </div>
  );
}
