"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

export default function MemberLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

    // Login successful - do a full page reload to ensure server state is fresh
    window.location.href = "/portal";
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
          <h1 className="text-2xl font-semibold">Member Portal</h1>
          <p className="text-muted-foreground">
            Sign in to view your membership status and payments
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              required
              autoComplete="email"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/portal/forgot-password"
                className="text-sm text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-brand-teal hover:bg-brand-teal-hover"
            disabled={isLoading}
          >
            {isLoading && <Spinner className="mr-2" />}
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Need help? Contact your organization administrator.
        </p>
      </div>
    </div>
  );
}
