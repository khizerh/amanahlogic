"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, AlertTriangle, Check, CheckCheck, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { calculateSegments } from "@/lib/sms/segments";
import type { SmsMessage, SmsStatus } from "@/lib/sms/types";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

interface MessageThreadProps {
  threadKey: string;         // member id OR `unknown:+1...`
  toNumber: string;
  memberId: string | null;
  memberName?: string | null;
  memberOptedOutAt?: string | null;
  onSent?: (msg: SmsMessage) => void;
  onUnknownLinkRequest?: () => void;
  /** Auto-refresh interval in ms; defaults to 15s. Set to 0 to disable. */
  pollMs?: number;
}

export function MessageThread({
  threadKey,
  toNumber,
  memberId,
  memberName,
  memberOptedOutAt,
  onSent,
  onUnknownLinkRequest,
  pollMs = 15000,
}: MessageThreadProps) {
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [showOverride, setShowOverride] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load + poll
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load(isInitial: boolean) {
      try {
        const res = await fetch(`/api/sms/threads/${encodeURIComponent(threadKey)}`);
        const data = await res.json();
        if (!alive) return;
        setMessages(data.messages || []);
      } finally {
        if (alive && isInitial) setLoading(false);
      }
      if (alive && pollMs > 0) timer = setTimeout(() => load(false), pollMs);
    }

    setLoading(true);
    load(true);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [threadKey, pollMs]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const segInfo = useMemo(() => calculateSegments(body), [body]);
  const isOptedOut = !!memberOptedOutAt;
  const isUnknown = !memberId;

  async function handleSend() {
    if (!body.trim() || sending) return;
    if (isOptedOut && !overrideReason.trim()) {
      setShowOverride(true);
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          toNumber,
          body: body.trim(),
          overrideReason: overrideReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setMessages((prev) => [...prev, data.message]);
      setBody("");
      setOverrideReason("");
      setShowOverride(false);
      onSent?.(data.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {isUnknown && (
        <Alert className="rounded-none border-x-0 border-t-0 border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <AlertDescription className="flex items-center justify-between gap-2 text-amber-900">
            <span>Sender not linked to a member ({toNumber}).</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onUnknownLinkRequest}>
                Link to existing member
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            {memberName
              ? `Start a conversation with ${memberName}`
              : "No messages yet — send the first one below"}
          </div>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const showDay =
            !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          return (
            <div key={m.id}>
              {showDay && <DaySeparator at={m.createdAt} />}
              <Bubble message={m} />
            </div>
          );
        })}
      </div>

      <div className="border-t bg-background">
        {isOptedOut && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-900 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {memberName || "Member"} opted out on{" "}
              {format(new Date(memberOptedOutAt!), "MMM d, yyyy")}. Manual override required.
            </span>
          </div>
        )}
        {showOverride && (
          <div className="px-4 py-2 bg-amber-100 border-b border-amber-300 flex items-center gap-2">
            <input
              className="flex-1 bg-white border border-amber-300 rounded px-2 py-1 text-sm"
              placeholder="Reason for sending despite opt-out (required, audit-logged)"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
            <Button size="sm" variant="ghost" onClick={() => setShowOverride(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="px-4 py-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a message…"
            rows={2}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>
              {segInfo.encoding} · {segInfo.length} chars ·{" "}
              {segInfo.segments} segment{segInfo.segments === 1 ? "" : "s"}
            </span>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!body.trim() || sending || (isOptedOut && !overrideReason.trim() && !showOverride)}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DaySeparator({ at }: { at: string }) {
  const d = new Date(at);
  const label = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "MMM d, yyyy");
  return (
    <div className="flex items-center my-2">
      <div className="flex-1 border-t" />
      <span className="text-xs text-muted-foreground px-3">{label}</span>
      <div className="flex-1 border-t" />
    </div>
  );
}

function Bubble({ message }: { message: SmsMessage }) {
  const isOut = message.direction === "outbound";
  const time = format(new Date(message.createdAt), "h:mm a");
  return (
    <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] ${isOut ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={`rounded-2xl px-4 py-2 whitespace-pre-wrap break-words text-sm ${
            isOut ? "bg-brand-teal text-white" : "bg-muted"
          }`}
        >
          {message.body}
        </div>
        <div className="flex items-center gap-1 mt-1 px-1 text-[11px] text-muted-foreground">
          <span>{time}</span>
          {isOut && <StatusIcon status={message.status} />}
          {message.overrideReason && (
            <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">
              override
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: SmsStatus }) {
  switch (status) {
    case "queued":
    case "sending":
      return <Clock className="h-3 w-3" aria-label="queued" />;
    case "sent":
      return <Check className="h-3 w-3" aria-label="sent" />;
    case "delivered":
      return <CheckCheck className="h-3 w-3" aria-label="delivered" />;
    case "failed":
    case "undelivered":
      return <AlertTriangle className="h-3 w-3 text-red-500" aria-label="failed" />;
    default:
      return null;
  }
}
