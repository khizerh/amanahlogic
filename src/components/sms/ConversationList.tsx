"use client";

import { useMemo, useState } from "react";
import { Search, Inbox } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export interface Conversation {
  key: string;
  memberId: string | null;
  memberName: string | null;
  memberOptedOutAt: string | null;
  phoneNumber: string;
  latestBody: string;
  latestAt: string;
  latestDirection: string;
  unreadCount: number;
}

type Filter = "all" | "unread" | "unknown";

interface Props {
  conversations: Conversation[];
  selectedKey: string | null;
  onSelect: (c: Conversation) => void;
}

export function ConversationList({ conversations, selectedKey, onSelect }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "unread" && c.unreadCount === 0) return false;
      if (filter === "unknown" && c.memberId) return false;
      if (!q) return true;
      const hay = `${c.memberName || ""} ${c.phoneNumber} ${c.latestBody}`.toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, filter, query]);

  return (
    <div className="flex flex-col h-full border-r">
      <div className="p-3 border-b space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations…"
            className="pl-8"
          />
        </div>
        <div className="flex gap-1 text-sm">
          <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </FilterPill>
          <FilterPill active={filter === "unread"} onClick={() => setFilter("unread")}>
            Unread
          </FilterPill>
          <FilterPill active={filter === "unknown"} onClick={() => setFilter("unknown")}>
            Unknown
          </FilterPill>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="text-center py-12 px-4 text-muted-foreground">
            <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {conversations.length === 0
                ? "No conversations yet"
                : "No conversations match your filter"}
            </p>
          </div>
        )}
        {filtered.map((c) => {
          const selected = c.key === selectedKey;
          const display = c.memberName || `Unknown · ${c.phoneNumber}`;
          return (
            <button
              key={c.key}
              onClick={() => onSelect(c)}
              className={`w-full text-left px-3 py-3 border-b hover:bg-muted/50 transition-colors ${
                selected ? "bg-muted" : ""
              }`}
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span
                  className={`text-sm truncate ${
                    c.unreadCount > 0 ? "font-semibold" : "font-medium"
                  }`}
                >
                  {display}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(c.latestAt), { addSuffix: false })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground truncate">
                  {c.latestDirection === "outbound" ? "You: " : ""}
                  {c.latestBody}
                </p>
                <div className="flex gap-1 shrink-0">
                  {c.memberOptedOutAt && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                      opted out
                    </Badge>
                  )}
                  {c.unreadCount > 0 && (
                    <Badge className="text-[10px] h-4 px-1 bg-red-500 hover:bg-red-500">
                      {c.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded-md text-xs transition-colors ${
        active ? "bg-foreground text-background" : "hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
