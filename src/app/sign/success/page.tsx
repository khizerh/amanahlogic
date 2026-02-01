import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SignSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-900 via-slate-950 to-black text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl bg-slate-900/70 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-md p-8 text-center space-y-4">
        <div className="text-5xl">✅</div>
        <h1 className="text-2xl font-semibold">Agreement signed</h1>
        <p className="text-slate-300">
          Thank you. Your signature has been recorded and a copy has been saved.
        </p>
        <div className="pt-4">
          <Button asChild>
            <Link href="/portal">Return to portal</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
