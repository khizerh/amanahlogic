"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MessageSquare, AlertTriangle, CheckCircle2 } from "lucide-react";
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
