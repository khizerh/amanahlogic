"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "signature_pad";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

interface SignClientProps {
  token: string;
  memberName: string;
  organizationId: string;
  templateVersion: string;
  language: "en" | "fa";
  pdfPath: string;
}

export default function SignClient({
  token,
  memberName,
  templateVersion,
  language,
  pdfPath,
}: SignClientProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);
  const [signedName, setSignedName] = useState(memberName);
  const [consentChecked, setConsentChecked] = useState(false);
  const [hasReadAgreement, setHasReadAgreement] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPdfEmbed, setShowPdfEmbed] = useState(true);

  const isRtl = language === "fa";

  // Initialize signature pad
  useEffect(() => {
    if (canvasRef.current && !sigPadRef.current) {
      sigPadRef.current = new SignaturePad(canvasRef.current, {
        penColor: "rgb(255, 255, 255)",
        backgroundColor: "transparent",
      });

      // Handle canvas resize
      const resizeCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas && sigPadRef.current) {
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          const rect = canvas.getBoundingClientRect();
          canvas.width = rect.width * ratio;
          canvas.height = rect.height * ratio;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.scale(ratio, ratio);
          }
          sigPadRef.current.clear();
        }
      };

      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);
      return () => window.removeEventListener("resize", resizeCanvas);
    }
  }, []);

  const handleClear = () => {
    sigPadRef.current?.clear();
  };

  const handleSubmit = async () => {
    setError(null);

    if (!hasReadAgreement) {
      setError(language === "fa"
        ? "لطفاً تأیید کنید که قرارداد را خوانده‌اید."
        : "Please confirm that you have read the agreement.");
      return;
    }

    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      setError(language === "fa" ? "لطفاً امضا کنید." : "Please provide a signature.");
      return;
    }

    if (!consentChecked) {
      setError(language === "fa" ? "لطفاً رضایت خود را تأیید کنید." : "Please confirm your consent.");
      return;
    }

    setIsSubmitting(true);
    try {
      const signatureDataUrl = sigPadRef.current.toDataURL("image/png");
      const payload = {
        token,
        signedName,
        signatureDataUrl,
        consentChecked,
        userAgent: navigator.userAgent,
        language,
      };

      const res = await fetch("/api/agreements/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to sign");
      }

      router.push(`/sign/success?agreement=${templateVersion}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white px-4 py-8"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <p className="text-sm uppercase tracking-[0.25em] text-slate-400">
            {language === "fa" ? "قرارداد عضویت" : "Membership Agreement"}
          </p>
          <h1 className="text-2xl font-semibold mt-2">
            {language === "fa" ? "مسجد جامع مهاجرین" : "Masjid Muhajireen"}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {language === "fa" ? `امضا کننده: ${memberName}` : `Signer: ${memberName}`}
          </p>
        </motion.div>

        {/* Agreement Document Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/70 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden"
        >
          <div
            className="flex items-center justify-between p-4 border-b border-slate-800 cursor-pointer hover:bg-slate-800/50 transition-colors"
            onClick={() => setShowPdfEmbed(!showPdfEmbed)}
          >
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-400" />
              <span className="font-medium">
                {language === "fa" ? "متن قرارداد" : "Agreement Document"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={pdfPath}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                {language === "fa" ? "باز کردن PDF" : "Open PDF"}
                <ExternalLink className="h-3 w-3" />
              </a>
              {showPdfEmbed ? (
                <ChevronUp className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              )}
            </div>
          </div>

          {showPdfEmbed && (
            <div className="p-4">
              <iframe
                src={`${pdfPath}#view=FitH`}
                className="w-full h-[500px] rounded-lg border border-slate-700 bg-white"
                title="Agreement PDF"
              />
            </div>
          )}

          {/* Read Confirmation */}
          <div className="p-4 border-t border-slate-800 bg-slate-800/30">
            <label className="flex items-center gap-3 text-sm cursor-pointer">
              <Checkbox
                checked={hasReadAgreement}
                onCheckedChange={(v) => setHasReadAgreement(!!v)}
              />
              <span className={isRtl ? "text-right" : ""}>
                {language === "fa"
                  ? "من قرارداد فوق را به طور کامل خوانده و درک کرده‌ام."
                  : "I have read and understand the agreement above."}
              </span>
            </label>
          </div>
        </motion.div>

        {/* Signature Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900/70 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-md p-6 space-y-6"
        >
          <h2 className="text-lg font-semibold">
            {language === "fa" ? "امضای الکترونیکی" : "Electronic Signature"}
          </h2>

          {/* Signed Name */}
          <div>
            <label className="text-sm text-slate-300 mb-2 block">
              {language === "fa" ? "نام کامل" : "Full Name"}
            </label>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={signedName}
              onChange={(e) => setSignedName(e.target.value)}
              placeholder={language === "fa" ? "نام خود را وارد کنید" : "Type your full name"}
              dir={isRtl ? "rtl" : "ltr"}
            />
          </div>

          {/* Signature Pad */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-slate-300">
                {language === "fa" ? "امضا" : "Signature"}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white"
                onClick={handleClear}
              >
                {language === "fa" ? "پاک کردن" : "Clear"}
              </Button>
            </div>
            <div className="rounded-md border border-slate-700 bg-slate-900 overflow-hidden">
              <canvas
                ref={canvasRef}
                className="w-full h-48 touch-none"
                style={{ touchAction: "none" }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {language === "fa" ? "امضای خود را در کادر بالا بکشید" : "Draw your signature in the box above"}
            </p>
          </div>

          {/* Consent Checkbox */}
          <label className="flex items-start gap-3 text-sm text-slate-200 cursor-pointer">
            <Checkbox
              checked={consentChecked}
              onCheckedChange={(v) => setConsentChecked(!!v)}
              className="mt-0.5"
            />
            <span className={isRtl ? "text-right" : ""}>
              {language === "fa"
                ? "من با شرایط قرارداد عضویت موافقم. موافقت می‌کنم که امضای الکترونیکی من از نظر قانونی الزام‌آور است."
                : "I agree to the terms of the Membership Agreement. I consent to use of my electronic signature and understand it is legally binding."}
            </span>
          </label>

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full"
            size="lg"
          >
            {isSubmitting
              ? (language === "fa" ? "در حال ارسال..." : "Submitting...")
              : (language === "fa" ? "تکمیل امضا" : "Complete Signing")}
          </Button>
        </motion.div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500">
          {language === "fa"
            ? "این سند به صورت الکترونیکی امضا شده و طبق قوانین ESIGN/UETA از نظر قانونی الزام‌آور است."
            : "This document is electronically signed and legally binding under ESIGN/UETA."}
        </p>
      </div>
    </div>
  );
}
