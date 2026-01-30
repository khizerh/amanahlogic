"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle } from "lucide-react";

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [inviteData, setInviteData] = useState<{
    email: string;
    memberName: string;
    orgName: string;
  } | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const supabase = createClient();

  useEffect(() => {
    const verifyInvite = async () => {
      if (!token) {
        setError("Invalid invite link");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/members/verify-invite?token=${token}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Invalid or expired invite");
          setLoading(false);
          return;
        }

        setInviteData(data);
        setLoading(false);
      } catch {
        setError("Failed to verify invite");
        setLoading(false);
      }
    };

    verifyInvite();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      setSubmitting(false);
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      setSubmitting(false);
      return;
    }

    try {
      // Create the Supabase auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: inviteData!.email,
        password,
      });

      if (authError) {
        // If user already exists, try to sign in
        if (authError.message.includes("already registered")) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: inviteData!.email,
            password,
          });

          if (signInError) {
            toast.error("Account exists. Please use the login page.");
            setSubmitting(false);
            return;
          }
        } else {
          toast.error(authError.message);
          setSubmitting(false);
          return;
        }
      }

      // Link the member to the auth user
      const userId = authData?.user?.id;
      if (userId) {
        const response = await fetch("/api/members/link-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, userId }),
        });

        if (!response.ok) {
          const data = await response.json();
          toast.error(data.error || "Failed to link account");
          setSubmitting(false);
          return;
        }
      }

      setSuccess(true);

      // Redirect to portal after a short delay
      setTimeout(() => {
        router.push("/portal");
      }, 2000);
    } catch {
      toast.error("An unexpected error occurred");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-white">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error && !inviteData) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 bg-white">
        <div className="w-full max-w-md space-y-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto" />
          <h1 className="text-2xl font-semibold text-red-800">Invalid Invite</h1>
          <p className="text-muted-foreground">{error}</p>
          <Link
            href="/portal/login"
            className="inline-block text-brand-teal hover:underline"
          >
            Go to Login
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
          <h1 className="text-2xl font-semibold">Account Created!</h1>
          <p className="text-muted-foreground">
            Redirecting to your portal...
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
          <h1 className="text-2xl font-semibold">Create Your Account</h1>
          <p className="text-muted-foreground">
            Welcome, {inviteData?.memberName}! Create a password to access your member portal at {inviteData?.orgName}.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={inviteData?.email || ""}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Create Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
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
              disabled={submitting}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-brand-teal hover:bg-brand-teal-hover"
            disabled={submitting}
          >
            {submitting && <Spinner className="mr-2" />}
            {submitting ? "Creating Account..." : "Create Account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/portal/login" className="text-brand-teal hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
