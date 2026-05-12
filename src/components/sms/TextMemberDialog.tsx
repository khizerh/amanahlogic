"use client";

import Link from "next/link";
import { ExternalLink, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MessageThread } from "./MessageThread";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
  phone: string | null;
  smsOptedOutAt?: string | null;
}

/**
 * Modal that embeds the same MessageThread used on /messages. Opened from the
 * member detail page so admins can text without losing scroll/context.
 */
export function TextMemberDialog({
  open,
  onOpenChange,
  memberId,
  memberName,
  phone,
  smsOptedOutAt,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 flex flex-col h-[85vh] max-h-[700px]">
        <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <DialogTitle className="text-base">{memberName}</DialogTitle>
            {phone && <span className="text-sm text-muted-foreground">· {phone}</span>}
            {smsOptedOutAt && (
              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 ml-1">
                opted out
              </Badge>
            )}
          </div>
          <Link
            href={`/messages?to=${memberId}`}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mr-6"
          >
            Open in inbox <ExternalLink className="h-3 w-3" />
          </Link>
        </DialogHeader>
        {phone ? (
          <MessageThread
            threadKey={memberId}
            toNumber={phone}
            memberId={memberId}
            memberName={memberName}
            memberOptedOutAt={smsOptedOutAt ?? null}
            pollMs={open ? 15000 : 0}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-8">
            No phone number on file for this member.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
