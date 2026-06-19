"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MessageSquare, AlertTriangle, CheckCircle2, Wallet, RefreshCw } from "lucide-react";
import type { Organization } from "@/lib/types";

interface Props {
  organization: Organization;
  /**
   * Server-side check: are TWILIO_* env vars present? Determines whether the
   * provider is live or running on the stub. Passed in because the env can't be
   * read from a client component.
   */
  smsLive: boolean;
}

export function SmsSettings({ organization, smsLive }: Props) {
  const phone = organization.twilioPhoneNumber;
  const msvc = organization.twilioMessagingServiceSid;
  const brand = organization.twilioBrandSid;
  const campaign = organization.twilioCampaignSid;
  const fullyConfigured = !!(phone && msvc && brand && campaign && smsLive);

  const [balance, setBalance] = useState<{ balance: string; currency: string } | null>(null);
  const [balanceState, setBalanceState] = useState<"idle" | "loading" | "error">("idle");

  const loadBalance = useCallback(async () => {
    setBalanceState("loading");
    try {
      const res = await fetch("/api/sms/balance", { cache: "no-store" });
      const data = await res.json();
      if (data?.balance != null) {
        setBalance({ balance: data.balance, currency: data.currency || "USD" });
        setBalanceState("idle");
      } else {
        setBalance(null);
        setBalanceState("error");
      }
    } catch {
      setBalance(null);
      setBalanceState("error");
    }
  }, []);

  useEffect(() => {
    if (smsLive) loadBalance();
  }, [smsLive, loadBalance]);

  const formattedBalance = balance
    ? new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: balance.currency,
      }).format(Number(balance.balance))
    : null;

  // Surface a low-balance warning so a top-up isn't missed mid-campaign.
  const lowBalance = balance != null && Number(balance.balance) < 10;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS / Twilio
          </CardTitle>
          <CardDescription>
            Provider config for two-way text messaging with members.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            {fullyConfigured ? (
              <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100">
                <CheckCircle2 className="h-3 w-3" /> Live (Twilio)
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300 bg-amber-50">
                <AlertTriangle className="h-3 w-3" /> Stub provider — Twilio not configured
              </Badge>
            )}
          </div>

          {smsLive && (
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Account balance:</span>
                {balanceState === "loading" ? (
                  <span className="text-sm text-muted-foreground">Loading…</span>
                ) : balanceState === "error" ? (
                  <span className="text-sm italic text-muted-foreground">Unavailable</span>
                ) : (
                  <span
                    className={`text-sm font-semibold ${lowBalance ? "text-amber-700" : ""}`}
                  >
                    {formattedBalance}
                  </span>
                )}
                {lowBalance && (
                  <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300 bg-amber-50">
                    <AlertTriangle className="h-3 w-3" /> Low
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadBalance}
                disabled={balanceState === "loading"}
                className="h-7 gap-1 text-xs"
              >
                <RefreshCw className={`h-3 w-3 ${balanceState === "loading" ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          )}

          {smsLive && (
            <p className="text-xs text-muted-foreground -mt-2">
              Prepaid (pay-as-you-go) balance remaining on the Twilio account. Each SMS segment
              costs ~$0.008 + carrier fees. Top up or set Auto Recharge in the Twilio Console
              billing settings.
            </p>
          )}

          {!fullyConfigured && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <AlertDescription className="text-amber-900">
                Messages currently send via the stub provider — they appear in the inbox as
                &quot;sent&quot; but no real SMS is dispatched. To go live, set the{" "}
                <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">TWILIO_ACCOUNT_SID</code>{" "}
                and{" "}
                <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">TWILIO_AUTH_TOKEN</code>{" "}
                env vars and fill in the org config below (Mohib will provide these after the
                A2P 10DLC Brand + Campaign are approved).
              </AlertDescription>
            </Alert>
          )}

          <div className="grid sm:grid-cols-2 gap-4 pt-2">
            <ConfigRow label="Phone number" value={phone} fallback="Not provisioned" />
            <ConfigRow label="Messaging Service SID" value={msvc} fallback="Not set" mono />
            <ConfigRow label="A2P Brand SID" value={brand} fallback="Not registered" mono />
            <ConfigRow label="Campaign SID" value={campaign} fallback="Not registered" mono />
          </div>

          <div className="text-xs text-muted-foreground pt-2 border-t">
            These fields are populated by an admin script once Twilio Trust Hub approves the
            Brand + Campaign for this organization. They&apos;re displayed here for verification
            only — editing happens in the Twilio console + the org record.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigRow({
  label,
  value,
  fallback,
  mono,
}: {
  label: string;
  value: string | null;
  fallback: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      {value ? (
        <div className={`text-sm ${mono ? "font-mono text-xs" : "font-medium"} break-all`}>
          {value}
        </div>
      ) : (
        <div className="text-sm italic text-muted-foreground">{fallback}</div>
      )}
    </div>
  );
}
