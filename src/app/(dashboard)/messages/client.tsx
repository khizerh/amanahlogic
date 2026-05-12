"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { ConversationList, type Conversation } from "@/components/sms/ConversationList";
import { MessageThread } from "@/components/sms/MessageThread";
import { SimulateInboundDialog } from "@/components/sms/SimulateInboundDialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

interface Props {
  memberOptions: { id: string; name: string; phone: string | null }[];
  smsLive: boolean;
  isDev: boolean;
}

export function MessagesClient({ memberOptions, smsLive, isDev }: Props) {
  const searchParams = useSearchParams();
  const deepLinkMemberId = searchParams.get("to");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/sms/conversations");
    const data = await res.json();
    setConversations(data.conversations || []);
    setLoaded(true);
  }, []);

  // Initial load + poll every 30s
  useEffect(() => {
    loadConversations();
    const id = setInterval(loadConversations, 30000);
    return () => clearInterval(id);
  }, [loadConversations]);

  // Keep selected in sync if its row updated server-side
  useEffect(() => {
    if (!selected) return;
    const fresh = conversations.find((c) => c.key === selected.key);
    if (fresh) setSelected(fresh);
  }, [conversations, selected]);

  // Deep-link from member detail page: ?to=<memberId> auto-selects that thread.
  // If the member has no prior messages yet, synthesize a placeholder conversation.
  useEffect(() => {
    if (!loaded || !deepLinkMemberId || selected?.key === deepLinkMemberId) return;
    const existing = conversations.find((c) => c.key === deepLinkMemberId);
    if (existing) {
      setSelected(existing);
      return;
    }
    const m = memberOptions.find((x) => x.id === deepLinkMemberId);
    if (m) {
      setSelected({
        key: m.id,
        memberId: m.id,
        memberName: m.name,
        memberOptedOutAt: null,
        phoneNumber: m.phone || "",
        latestBody: "",
        latestAt: new Date().toISOString(),
        latestDirection: "outbound",
        unreadCount: 0,
      });
    }
  }, [loaded, deepLinkMemberId, conversations, memberOptions, selected]);

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <h1 className="text-2xl font-bold">Messages</h1>
              {!smsLive && (
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                  Stub provider — Twilio not configured
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isDev && (
                <SimulateInboundDialog
                  members={memberOptions}
                  onSimulated={loadConversations}
                />
              )}
            </div>
          </div>

          <Card className="overflow-hidden p-0 grid grid-cols-1 md:grid-cols-[320px_1fr] h-[calc(100vh-220px)]">
            <ConversationList
              conversations={conversations}
              selectedKey={selected?.key ?? null}
              onSelect={(c) => setSelected(c)}
            />

            {selected ? (
              <MessageThread
                key={selected.key}
                threadKey={selected.key}
                toNumber={selected.phoneNumber}
                memberId={selected.memberId}
                memberName={selected.memberName}
                memberOptedOutAt={selected.memberOptedOutAt}
                onSent={loadConversations}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-8">
                <MessageSquare className="h-10 w-10 opacity-30 mb-3" />
                <p className="text-sm">
                  {loaded && conversations.length === 0
                    ? "No conversations yet — click \"Text\" on any member to start one."
                    : "Pick a conversation on the left"}
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
