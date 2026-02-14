"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search, Check } from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string | null;
  membership?: {
    id: string;
    planId: string;
    status: string;
    autoPayEnabled: boolean;
    payerMemberId: string | null;
    paymentMethod: unknown;
  } | null;
  plan?: {
    name: string;
  } | null;
}

interface AssignPayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membershipId: string;
  currentMemberId: string;
  organizationId: string;
  onPayerAssigned: () => void;
}

export function AssignPayerDialog({
  open,
  onOpenChange,
  membershipId,
  currentMemberId,
  organizationId,
  onPayerAssigned,
}: AssignPayerDialogProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Fetch members when dialog opens
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedMember(null);
      return;
    }

    const fetchMembers = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/members");
        if (response.ok) {
          const data = await response.json();
          setMembers(data.members || data || []);
        }
      } catch {
        console.error("Failed to fetch members");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, [open]);

  // Filter members client-side
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Exclude current member
      if (m.id === currentMemberId) return false;
      // Exclude members who are paid-for by someone else
      if (m.membership?.payerMemberId) return false;
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const name = `${m.firstName} ${m.middleName ? m.middleName + ' ' : ''}${m.lastName}`.toLowerCase();
        const email = (m.email || "").toLowerCase();
        return name.includes(query) || email.includes(query);
      }
      return true;
    });
  }, [members, currentMemberId, searchQuery]);

  const handleAssign = useCallback(async () => {
    if (!selectedMember) return;

    setIsAssigning(true);
    try {
      const response = await fetch("/api/memberships/payer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId,
          payerMemberId: selectedMember.id,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to assign payer");
      }

      if (result.subscriptionCreated) {
        toast.success("Payer assigned", {
          description: `Subscription created immediately on ${selectedMember.firstName}'s card.`,
        });
      } else if (result.paymentLinkSent) {
        toast.success("Payment link sent", {
          description: `Payment setup link sent to ${result.payerEmail || selectedMember.email}.`,
        });
      }

      onPayerAssigned();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign payer");
    } finally {
      setIsAssigning(false);
    }
  }, [selectedMember, membershipId, onPayerAssigned]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Payer</DialogTitle>
          <DialogDescription>
            Select a member who will pay for this membership. If they have a card on file, the subscription will be created immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-64 overflow-y-auto border rounded-md">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Loading members...
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">
                {searchQuery ? "No members match your search" : "No eligible members found"}
              </div>
            ) : (
              filteredMembers.map((member) => {
                const hasCard = !!(member.membership?.autoPayEnabled && member.membership?.paymentMethod);
                return (
                  <button
                    key={member.id}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/50 border-b last:border-b-0 ${
                      selectedMember?.id === member.id ? "bg-blue-50" : ""
                    }`}
                    onClick={() => setSelectedMember(member)}
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {member.firstName} {member.middleName ? `${member.middleName} ` : ''}{member.lastName}
                        {selectedMember?.id === member.id && (
                          <Check className="inline h-4 w-4 ml-1 text-blue-600" />
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.email || "No email"}
                        {member.plan && ` · ${member.plan.name}`}
                      </p>
                    </div>
                    {hasCard && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                        Has card
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedMember || isAssigning}
          >
            {isAssigning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              "Assign Payer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
