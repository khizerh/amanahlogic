"use client";

import { useState } from "react";
import { Wrench, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface MemberOption {
  id: string;
  name: string;
  phone: string | null;
}

interface Props {
  members: MemberOption[];
  onSimulated?: () => void;
}

export function SimulateInboundDialog({ members, onSimulated }: Props) {
  const [open, setOpen] = useState(false);
  const [fromNumber, setFromNumber] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  function pickMember(m: MemberOption) {
    setFromNumber(m.phone || "");
  }

  async function submit() {
    if (!fromNumber.trim() || !body.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/sms/simulate-inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromNumber: fromNumber.trim(), body: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Simulate failed");
      toast.success("Inbound message recorded");
      setBody("");
      setOpen(false);
      onSimulated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Simulate failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Wrench className="h-3.5 w-3.5" /> Simulate inbound
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Simulate inbound SMS</DialogTitle>
          <DialogDescription>
            Dev-only — fakes a Twilio webhook delivery so the UI can be tested before the provider is live.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Pick a member (auto-fills phone)</Label>
            <select
              className="w-full border rounded px-2 py-1.5 text-sm bg-background"
              defaultValue=""
              onChange={(e) => {
                const m = members.find((x) => x.id === e.target.value);
                if (m) pickMember(m);
              }}
            >
              <option value="" disabled>Select a member…</option>
              {members
                .filter((m) => m.phone)
                .slice(0, 200)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.phone})
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>From phone (E.164)</Label>
            <Input
              value={fromNumber}
              onChange={(e) => setFromNumber(e.target.value)}
              placeholder="+15551234567"
            />
            <p className="text-xs text-muted-foreground">
              If this matches a member&apos;s phone exactly, the message links to them.
              Otherwise it lands in the &quot;Unknown&quot; bucket.
            </p>
          </div>
          <div className="space-y-1">
            <Label>Message body</Label>
            <Textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="hi! my payment didn't go through"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!fromNumber.trim() || !body.trim() || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record inbound"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
