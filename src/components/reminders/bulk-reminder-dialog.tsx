"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Mail, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReminderRecipient {
  id: string;
  name: string;
  email: string;
  language: "en" | "fa";
  detail?: string; // e.g. "Agreement + Payment" or "Payment setup"
}

export interface EmailDescription {
  label: string;
  summary: string;
}

export interface SkippedRecipient {
  id: string;
  name: string;
  reason: string;
}

export interface ReminderResult {
  memberId: string;
  memberName: string;
  success: boolean;
  error?: string;
  type?: string;
}

export interface BulkReminderResults {
  sent: number;
  failed: number;
  skipped: number;
  results: ReminderResult[];
}

interface BulkReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  emailDescriptions: EmailDescription[];
  recipients: ReminderRecipient[];
  skipped: SkippedRecipient[];
  onConfirm: () => Promise<BulkReminderResults>;
  isLoading: boolean;
  results: BulkReminderResults | null;
  onReset: () => void;
}

export function BulkReminderDialog({
  open,
  onOpenChange,
  title,
  description,
  emailDescriptions,
  recipients,
  skipped,
  onConfirm,
  isLoading,
  results,
  onReset,
}: BulkReminderDialogProps) {
  const handleOpenChange = (value: boolean) => {
    if (!isLoading) {
      onOpenChange(value);
      if (!value) {
        onReset();
      }
    }
  };

  // Results view
  if (results) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Reminders Sent
            </DialogTitle>
            <DialogDescription>
              Summary of bulk reminder operation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-green-50 p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{results.sent}</div>
                <div className="text-xs text-green-600">Sent</div>
              </div>
              <div className="rounded-lg border bg-red-50 p-3 text-center">
                <div className="text-2xl font-bold text-red-700">{results.failed}</div>
                <div className="text-xs text-red-600">Failed</div>
              </div>
              <div className="rounded-lg border bg-amber-50 p-3 text-center">
                <div className="text-2xl font-bold text-amber-700">{results.skipped}</div>
                <div className="text-xs text-amber-600">Skipped</div>
              </div>
            </div>

            {/* Failed details */}
            {results.results.some((r) => !r.success) && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-600">Failed:</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {results.results
                    .filter((r) => !r.success)
                    .map((r) => (
                      <div
                        key={r.memberId}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        <span>{r.memberName}</span>
                        {r.error && (
                          <span className="text-xs text-red-400">— {r.error}</span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Confirmation / sending view
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Email descriptions */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Emails that will be sent:</p>
            {emailDescriptions.map((desc) => (
              <div
                key={desc.label}
                className="rounded-lg border bg-blue-50 px-3 py-2"
              >
                <p className="text-sm font-medium text-blue-900">{desc.label}</p>
                <p className="text-xs text-blue-700 mt-0.5">{desc.summary}</p>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Each member receives the email in their preferred language (English or Farsi).
            </p>
          </div>

          <Separator />

          {/* Recipients summary */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {recipients.length} member{recipients.length !== 1 ? "s" : ""} will receive reminders
              </span>
            </div>

            {recipients.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1 mt-3">
                {recipients.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between text-sm py-1"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{r.name}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {r.email}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          r.language === "fa"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        )}
                      >
                        {r.language === "fa" ? "FA" : "EN"}
                      </Badge>
                      {r.detail && (
                        <Badge variant="outline" className="text-xs">
                          {r.detail}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Skipped section */}
          {skipped.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">
                  {skipped.length} member{skipped.length !== 1 ? "s" : ""} will be skipped
                </span>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1 mt-2">
                {skipped.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between text-sm py-0.5"
                  >
                    <span className="text-amber-800 truncate">{s.name}</span>
                    <span className="text-xs text-amber-600 shrink-0 ml-2">
                      {s.reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading || recipients.length === 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending reminders...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Reminders
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
