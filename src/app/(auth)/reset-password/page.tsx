"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const extractTokensAndSetSession = async () => {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);

      const errorParam = params.get("error");
      const errorCode = params.get("error_code");
      const errorDescription = params.get("error_description");

      if (errorParam) {
        const message =
          errorCode === "otp_expired"
            ? "This reset link has expired. Please request a new one."
            : errorDescription?.replace(/\+/g, " ") ||
              "Invalid reset link. Please request a new one.";
        setError(message);
        setChecking(false);
        return;
      }

      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          setError("Invalid or expired reset link. Please request a new one.");
          setChecking(false);
          return;
        }

        // Clean the hash from the URL
        window.history.replaceState(null, "", window.location.pathname);
        setChecking(false);
        return;
      }

      // No hash tokens — check if there's already a session (e.g. page refresh)
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Invalid or expired reset link. Please request a new one.");
      }
      setChecking(false);
    };

    extractTokensAndSetSession();
  }, [supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 2000);
  };

  if (checking) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-white">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error && !password) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 bg-white">
        <div className="w-full max-w-md space-y-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto" />
          <h1 className="text-2xl font-semibold text-red-800">Invalid Link</h1>
          <p className="text-muted-foreground">{error}</p>
          <Link
            href="/forgot-password"
            className="inline-block text-brand-teal hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 bg-white">
        <div className="w-full max-w-md space-y-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
          <h1 className="text-2xl font-semibold">Password Updated!</h1>
          <p className="text-muted-foreground">
            Redirecting to dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 bg-white">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="space-y-4 text-center">
          <div className="mx-auto flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/logo-new.svg"
              alt="Amanah Logic"
              className="h-10"
            />
          </div>
          <h1 className="text-2xl font-semibold">Set New Password</h1>
          <p className="text-muted-foreground">
            Enter your new password below
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={8}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-brand-teal hover:bg-brand-teal-hover"
            disabled={isLoading}
          >
            {isLoading && <Spinner className="mr-2" />}
            {isLoading ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
