"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Search,
  UserPlus,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Organization, Plan, BillingFrequency, MemberWithMembership } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/formatters";
import { toast } from "sonner";

// =============================================================================
// Types
// =============================================================================

interface TerminalReader {
  id: string;
  label: string;
  status: string;
  deviceType: string;
}

type Step = "search" | "configure" | "payment" | "success";

interface EnrollClientProps {
  organization: Organization;
  plans: Plan[];
}

// =============================================================================
// Main Component
// =============================================================================

export function EnrollClient({ organization, plans }: EnrollClientProps) {
  // Step state
  const [step, setStep] = useState<Step>("search");

  // Search/Select state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemberWithMembership[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberWithMembership | null>(null);

  // Configure state
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id || "");
  const [billingFrequency, setBillingFrequency] = useState<BillingFrequency>("monthly");
  const [includeEnrollmentFee, setIncludeEnrollmentFee] = useState(true);

  // Reader state
  const [readers, setReaders] = useState<TerminalReader[]>([]);
  const [selectedReaderId, setSelectedReaderId] = useState("");
  const [loadingReaders, setLoadingReaders] = useState(false);

  // Payment state
  const [paymentIntentId, setPaymentIntentId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<string>("");
  const [paymentError, setPaymentError] = useState<string>("");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [completingEnrollment, setCompletingEnrollment] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Success state
  const [enrollmentResult, setEnrollmentResult] = useState<{
    subscriptionId: string;
    cardLast4: string;
    cardBrand: string;
    monthsCredited: number;
  } | null>(null);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const terminalConfigured = !!organization.terminalLocationId;

  // Load readers
  const loadReaders = useCallback(async () => {
    if (!terminalConfigured) return;
    setLoadingReaders(true);
    try {
      const res = await fetch("/api/stripe/terminal/readers");
      const data = await res.json();
      if (data.readers) {
        setReaders(data.readers);
        // Auto-select first online reader
        const online = data.readers.find((r: TerminalReader) => r.status === "online");
        if (online) setSelectedReaderId(online.id);
      }
    } catch {
      // silent
    } finally {
      setLoadingReaders(false);
    }
  }, [terminalConfigured]);

  useEffect(() => {
    loadReaders();
  }, [loadReaders]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Load all members once for client-side search (matches members page pattern)
  const [allMembers, setAllMembers] = useState<MemberWithMembership[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);

  useEffect(() => {
    async function loadMembers() {
      try {
        const res = await fetch("/api/members");
        const data = await res.json();
        setAllMembers(data.members || []);
      } catch {
        // silent
      } finally {
        setMembersLoaded(true);
      }
    }
    loadMembers();
  }, []);

  // Client-side search (same pattern as members page)
  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const query = searchQuery.trim().toLowerCase();
    const results = allMembers.filter((m) => {
      const searchable = `${m.firstName} ${m.middleName || ""} ${m.lastName} ${m.email || ""} ${m.phone}`.toLowerCase();
      return searchable.includes(query);
    });
    setSearchResults(results.slice(0, 10));
    setSearching(false);
  };

  // Select member and move to configure step
  const handleSelectMember = (member: MemberWithMembership) => {
    setSelectedMember(member);

    // If member already has a membership, pre-fill from it
    if (member.membership) {
      setSelectedPlanId(member.membership.planId);
      setBillingFrequency(member.membership.billingFrequency);
    }

    setStep("configure");
  };

  // Calculate total
  const getTotal = () => {
    if (!selectedPlan) return 0;
    const duesAmount = selectedPlan.pricing[billingFrequency] || 0;
    const enrollmentFee = includeEnrollmentFee ? selectedPlan.enrollmentFee : 0;
    return duesAmount + enrollmentFee;
  };

  // Initiate payment
  const handleChargeNow = async () => {
    if (!selectedMember?.membership || !selectedReaderId) return;

    setProcessingPayment(true);
    setPaymentError("");
    setStep("payment");
    setPaymentStatus("initiating");

    try {
      const res = await fetch("/api/stripe/terminal/collect-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId: selectedMember.membership.id,
          memberId: selectedMember.id,
          readerId: selectedReaderId,
          includeEnrollmentFee,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setPaymentIntentId(data.paymentIntentId);
      setPaymentStatus("waiting_for_card");

      // Start polling for payment status
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(
            `/api/stripe/terminal/payment-status?paymentIntentId=${data.paymentIntentId}`
          );
          const statusData = await statusRes.json();

          if (statusData.status === "succeeded") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setPaymentStatus("succeeded");
            // Auto-complete enrollment
            handleCompleteEnrollment(data.paymentIntentId);
          } else if (statusData.status === "canceled") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setPaymentStatus("canceled");
            setPaymentError("Payment was canceled");
            setProcessingPayment(false);
          } else if (statusData.error) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setPaymentStatus("failed");
            setPaymentError(statusData.error);
            setProcessingPayment(false);
          }
        } catch {
          // Network hiccup — keep polling
        }
      }, 2000);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to initiate payment";
      setPaymentError(msg);
      setPaymentStatus("failed");
      setProcessingPayment(false);
    }
  };

  // Complete enrollment after payment succeeds
  const handleCompleteEnrollment = async (piId: string) => {
    if (!selectedMember?.membership) return;

    setCompletingEnrollment(true);
    setPaymentStatus("completing");

    try {
      const res = await fetch("/api/stripe/terminal/complete-enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIntentId: piId,
          membershipId: selectedMember.membership.id,
          memberId: selectedMember.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setEnrollmentResult({
        subscriptionId: data.subscriptionId,
        cardLast4: data.paymentMethodLast4,
        cardBrand: data.paymentMethodBrand,
        monthsCredited: data.monthsCredited,
      });
      setStep("success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to complete enrollment";
      setPaymentError(msg);
      setPaymentStatus("enrollment_failed");
    } finally {
      setCompletingEnrollment(false);
      setProcessingPayment(false);
    }
  };

  // Cancel in-progress payment
  const handleCancelPayment = async () => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    try {
      await fetch("/api/stripe/terminal/cancel-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readerId: selectedReaderId }),
      });
    } catch {
      // Best effort
    }

    setPaymentStatus("canceled");
    setProcessingPayment(false);
    setStep("configure");
  };

  // Reset for next enrollment
  const handleNewEnrollment = () => {
    setStep("search");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedMember(null);
    setPaymentIntentId("");
    setPaymentStatus("");
    setPaymentError("");
    setEnrollmentResult(null);
    setIncludeEnrollmentFee(true);
  };

  // Not configured guard
  if (!terminalConfigured) {
    return (
      <>
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Stripe Terminal is not set up. Go to{" "}
              <a href="/settings" className="underline font-medium">
                Settings → Terminal
              </a>{" "}
              to configure it first.
            </AlertDescription>
          </Alert>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">In-Person Enrollment</h1>
          <p className="text-muted-foreground">
            Enroll a member and charge their card on the spot
          </p>
        </div>

        {/* ── Step 1: Search/Select Member ── */}
        {step === "search" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Find Member
              </CardTitle>
              <CardDescription>
                Search for an existing member or create a new one first
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={searching}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSelectMember(member)}
                    >
                      <div>
                        <p className="font-medium">
                          {member.firstName} {member.middleName ? `${member.middleName} ` : ""}
                          {member.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {member.email || member.phone}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {member.membership && (
                          <Badge variant={member.membership.status === "current" ? "default" : "secondary"}>
                            {member.membership.status}
                          </Badge>
                        )}
                        <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchResults.length === 0 && searchQuery && !searching && (
                <div className="text-center py-4 text-muted-foreground">
                  <p>No members found</p>
                  <Button variant="outline" size="sm" className="mt-2" asChild>
                    <a href="/members">
                      <UserPlus className="h-4 w-4 mr-1" /> Create New Member
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Configure Plan & Payment ── */}
        {step === "configure" && selectedMember && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep("search")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to search
            </Button>

            {/* Member Info */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">
                    {selectedMember.firstName[0]}
                    {selectedMember.lastName[0]}
                  </div>
                  <div>
                    <p className="font-medium">
                      {selectedMember.firstName} {selectedMember.middleName ? `${selectedMember.middleName} ` : ""}
                      {selectedMember.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedMember.email || selectedMember.phone}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Plan & Frequency */}
            <Card>
              <CardHeader>
                <CardTitle>Membership</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Plan</Label>
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Billing Frequency</Label>
                  <RadioGroup
                    value={billingFrequency}
                    onValueChange={(v) => setBillingFrequency(v as BillingFrequency)}
                    className="grid grid-cols-3 gap-3 mt-2"
                  >
                    {(["monthly", "biannual", "annual"] as BillingFrequency[]).map((freq) => (
                      <div
                        key={freq}
                        className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer ${
                          billingFrequency === freq ? "border-primary bg-primary/5" : ""
                        }`}
                        onClick={() => setBillingFrequency(freq)}
                      >
                        <RadioGroupItem value={freq} id={freq} />
                        <div>
                          <Label htmlFor={freq} className="cursor-pointer text-sm font-medium">
                            {freq === "monthly" ? "Monthly" : freq === "biannual" ? "Biannual" : "Annual"}
                          </Label>
                          {selectedPlan && (
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(selectedPlan.pricing[freq])}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>

            {/* Charge Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Charge Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedPlan && includeEnrollmentFee && selectedPlan.enrollmentFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Enrollment Fee</span>
                    <span>{formatCurrency(selectedPlan.enrollmentFee)}</span>
                  </div>
                )}
                {selectedPlan && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      First {billingFrequency === "monthly" ? "Month" : billingFrequency === "biannual" ? "6 Months" : "Year"} Dues
                    </span>
                    <span>{formatCurrency(selectedPlan.pricing[billingFrequency])}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>{formatCurrency(getTotal())}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Card will be saved for automatic recurring payments
                </p>
              </CardContent>
            </Card>

            {/* Reader Selection & Charge Button */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label>Reader</Label>
                  {loadingReaders ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading readers...
                    </div>
                  ) : readers.length === 0 ? (
                    <Alert className="mt-2">
                      <AlertDescription>
                        No readers found. Register one in{" "}
                        <a href="/settings" className="underline">Settings → Terminal</a>.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Select value={selectedReaderId} onValueChange={setSelectedReaderId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select reader" />
                      </SelectTrigger>
                      <SelectContent>
                        {readers.map((reader) => (
                          <SelectItem key={reader.id} value={reader.id}>
                            <span className="flex items-center gap-2">
                              {reader.status === "online" ? (
                                <Wifi className="h-3 w-3 text-green-600" />
                              ) : (
                                <WifiOff className="h-3 w-3 text-muted-foreground" />
                              )}
                              {reader.label} ({reader.status})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <Button
                  className="w-full h-12 text-lg"
                  onClick={handleChargeNow}
                  disabled={!selectedReaderId || !selectedPlan || processingPayment}
                >
                  <CreditCard className="h-5 w-5 mr-2" />
                  Charge {formatCurrency(getTotal())}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Step 3: Payment In Progress ── */}
        {step === "payment" && (
          <Card>
            <CardContent className="pt-8 pb-8">
              <div className="text-center space-y-6">
                {(paymentStatus === "initiating" || paymentStatus === "waiting_for_card") && (
                  <>
                    <div className="mx-auto h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center animate-pulse">
                      <CreditCard className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">
                        {paymentStatus === "initiating"
                          ? "Connecting to reader..."
                          : "Waiting for card..."}
                      </h2>
                      <p className="text-muted-foreground mt-1">
                        {paymentStatus === "waiting_for_card"
                          ? "Ask the member to tap or insert their card on the reader"
                          : "Sending payment to the reader"}
                      </p>
                    </div>
                    <Button variant="outline" onClick={handleCancelPayment}>
                      Cancel
                    </Button>
                  </>
                )}

                {(paymentStatus === "succeeded" || paymentStatus === "completing") && (
                  <>
                    <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                      {completingEnrollment ? (
                        <Loader2 className="h-8 w-8 text-green-600 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">
                        {completingEnrollment ? "Setting up subscription..." : "Payment successful!"}
                      </h2>
                      <p className="text-muted-foreground mt-1">
                        {completingEnrollment
                          ? "Saving card and creating recurring subscription"
                          : "Processing complete"}
                      </p>
                    </div>
                  </>
                )}

                {(paymentStatus === "failed" || paymentStatus === "enrollment_failed") && (
                  <>
                    <div className="mx-auto h-16 w-16 bg-red-100 rounded-full flex items-center justify-center">
                      <XCircle className="h-8 w-8 text-red-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">
                        {paymentStatus === "enrollment_failed" ? "Enrollment Failed" : "Payment Failed"}
                      </h2>
                      <p className="text-destructive mt-1">{paymentError}</p>
                      {paymentStatus === "enrollment_failed" && (
                        <p className="text-sm text-muted-foreground mt-2">
                          The card was charged but subscription setup failed. Contact support.
                        </p>
                      )}
                    </div>
                    <Button onClick={() => setStep("configure")}>Try Again</Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 4: Success ── */}
        {step === "success" && enrollmentResult && selectedMember && (
          <Card>
            <CardContent className="pt-8 pb-8">
              <div className="text-center space-y-6">
                <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Enrollment Complete</h2>
                  <p className="text-muted-foreground mt-1">
                    {selectedMember.firstName} {selectedMember.lastName} is now an active member
                  </p>
                </div>

                <div className="inline-block text-left bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between gap-8 text-sm">
                    <span className="text-muted-foreground">Card</span>
                    <span className="font-mono">
                      {enrollmentResult.cardBrand} ····{enrollmentResult.cardLast4}
                    </span>
                  </div>
                  <div className="flex justify-between gap-8 text-sm">
                    <span className="text-muted-foreground">Recurring</span>
                    <span>Auto-pay enabled</span>
                  </div>
                  <div className="flex justify-between gap-8 text-sm">
                    <span className="text-muted-foreground">Months credited</span>
                    <span>{enrollmentResult.monthsCredited}</span>
                  </div>
                </div>

                <div className="flex gap-3 justify-center">
                  <Button onClick={handleNewEnrollment}>Enroll Another</Button>
                  <Button variant="outline" asChild>
                    <a href={`/members/${selectedMember.id}`}>View Member</a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
