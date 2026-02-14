"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Plan, BillingFrequency } from "@/lib/types";

// =============================================================================
// Types
// =============================================================================

interface JoinFormProps {
  orgSlug: string;
  orgName: string;
  plans: Plan[];
}

interface Child {
  id: string;
  name: string;
  dateOfBirth: string;
}

// =============================================================================
// Constants
// =============================================================================

const STEPS = ["Plan Selection", "Personal Information", "Additional Details"];

const FREQUENCY_LABELS: Record<BillingFrequency, string> = {
  monthly: "Monthly",
  biannual: "Every 6 Months",
  annual: "Annually",
};

const FREQUENCY_SHORT: Record<BillingFrequency, string> = {
  monthly: "/mo",
  biannual: "/6mo",
  annual: "/yr",
};

// =============================================================================
// Component
// =============================================================================

export function JoinForm({ orgSlug, orgName, plans }: JoinFormProps) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Plan Selection
  const [selectedPlanId, setSelectedPlanId] = useState(plans.length === 1 ? plans[0].id : "");
  const [billingFrequency, setBillingFrequency] = useState<BillingFrequency>("monthly");

  // Step 2: Personal Info
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<"en" | "fa">("en");

  // Step 3: Additional Details
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [spouseName, setSpouseName] = useState("");
  const [spouseDateOfBirth, setSpouseDateOfBirth] = useState("");
  const [children, setChildren] = useState<Child[]>([]);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelationship, setEmergencyRelationship] = useState("");

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function getPriceForFrequency(plan: Plan, freq: BillingFrequency): number {
    return plan.pricing[freq];
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }

  function addChild() {
    setChildren((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", dateOfBirth: "" },
    ]);
  }

  function removeChild(id: string) {
    setChildren((prev) => prev.filter((c) => c.id !== id));
  }

  function updateChild(id: string, field: "name" | "dateOfBirth", value: string) {
    setChildren((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  function validateStep1(): string | null {
    if (!selectedPlanId) return "Please select a plan";
    return null;
  }

  function validateStep2(): string | null {
    if (!firstName.trim()) return "First name is required";
    if (!lastName.trim()) return "Last name is required";
    if (!email.trim()) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Please enter a valid email address";
    if (!phone.trim()) return "Phone number is required";
    return null;
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  function handleNext() {
    if (step === 0) {
      const err = validateStep1();
      if (err) { toast.error(err); return; }
    }
    if (step === 1) {
      const err = validateStep2();
      if (err) { toast.error(err); return; }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit() {
    const err1 = validateStep1();
    if (err1) { toast.error(err1); setStep(0); return; }
    const err2 = validateStep2();
    if (err2) { toast.error(err2); setStep(1); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/join/${orgSlug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          middleName: middleName.trim() || undefined,
          lastName: lastName.trim(),
          email: email.trim(),
          phone,
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          zip: zip.trim(),
          spouseName: spouseName.trim() || undefined,
          emergencyName: emergencyName.trim(),
          emergencyPhone,
          planId: selectedPlanId,
          billingFrequency,
          preferredLanguage,
          children: children.filter((c) => c.name.trim()),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Registration failed");
        return;
      }

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const stepVariants = {
    enter: { opacity: 0, x: 20 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors shadow-sm ${
                    i < step
                      ? "bg-brand-teal text-white"
                      : i === step
                      ? "bg-brand-teal text-white ring-4 ring-brand-teal/20"
                      : "bg-white text-gray-400 border border-gray-200"
                  }`}
                >
                  {i < step ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className={`mt-2 text-xs font-medium hidden sm:block ${
                  i <= step ? "text-brand-teal" : "text-gray-400"
                }`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-3 rounded-full transition-colors ${
                  i < step ? "bg-brand-teal" : "bg-gray-200"
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2 }}
        >
          {/* ============================================================= */}
          {/* Step 1: Plan Selection                                        */}
          {/* ============================================================= */}
          {step === 0 && (
            <div className="space-y-6">
              {/* Plan cards */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Choose Your Plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={selectedPlanId}
                    onValueChange={setSelectedPlanId}
                    className="grid gap-3"
                  >
                    {plans.map((plan) => {
                      const price = getPriceForFrequency(plan, billingFrequency);
                      const isSelected = selectedPlanId === plan.id;
                      return (
                        <label key={plan.id} htmlFor={`plan-${plan.id}`} className="cursor-pointer">
                          <div
                            className={`relative rounded-lg border-2 p-4 transition-all ${
                              isSelected
                                ? "border-brand-teal bg-brand-teal/5"
                                : "border-gray-200 hover:border-gray-300 bg-white"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <RadioGroupItem value={plan.id} id={`plan-${plan.id}`} className="mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <h3 className="font-semibold text-text-dark-slate">{plan.name}</h3>
                                  <div className="text-right shrink-0">
                                    <span className="text-xl font-bold text-brand-teal">
                                      {formatCurrency(price)}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      {FREQUENCY_SHORT[billingFrequency]}
                                    </span>
                                  </div>
                                </div>
                                {plan.description && (
                                  <p className="mt-1 text-sm text-gray-500">{plan.description}</p>
                                )}
                                {plan.enrollmentFee > 0 && (
                                  <p className="mt-1 text-xs text-gray-400">
                                    + {formatCurrency(plan.enrollmentFee)} one-time enrollment fee
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* Billing frequency */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Billing Frequency</CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={billingFrequency}
                    onValueChange={(v) => setBillingFrequency(v as BillingFrequency)}
                    className="grid grid-cols-3 gap-3"
                  >
                    {(["monthly", "biannual", "annual"] as BillingFrequency[]).map((freq) => {
                      const isSelected = billingFrequency === freq;
                      return (
                        <label key={freq} htmlFor={`freq-${freq}`} className="cursor-pointer">
                          <div
                            className={`rounded-lg border-2 p-3 text-center transition-all ${
                              isSelected
                                ? "border-brand-teal bg-brand-teal/5"
                                : "border-gray-200 hover:border-gray-300 bg-white"
                            }`}
                          >
                            <RadioGroupItem value={freq} id={`freq-${freq}`} className="sr-only" />
                            <div className={`text-sm font-semibold ${isSelected ? "text-brand-teal" : "text-text-dark-slate"}`}>
                              {FREQUENCY_LABELS[freq]}
                            </div>
                            {selectedPlan && (
                              <div className={`mt-1 text-xs ${isSelected ? "text-brand-teal/70" : "text-gray-400"}`}>
                                {formatCurrency(getPriceForFrequency(selectedPlan, freq))}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* Pricing summary */}
              {selectedPlan && (
                <Card className="border-brand-teal/20 bg-brand-teal/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Pricing Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {selectedPlan.name} ({FREQUENCY_LABELS[billingFrequency]})
                      </span>
                      <span className="font-medium text-text-dark-slate">
                        {formatCurrency(getPriceForFrequency(selectedPlan, billingFrequency))}
                      </span>
                    </div>
                    {selectedPlan.enrollmentFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">One-time enrollment fee</span>
                        <span className="font-medium text-text-dark-slate">
                          {formatCurrency(selectedPlan.enrollmentFee)}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-brand-teal/10 pt-3 mt-3 flex justify-between">
                      <span className="font-semibold text-text-dark-slate">Total due today</span>
                      <span className="text-lg font-bold text-brand-teal">
                        {formatCurrency(
                          getPriceForFrequency(selectedPlan, billingFrequency) +
                            selectedPlan.enrollmentFee
                        )}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ============================================================= */}
          {/* Step 2: Personal Information                                  */}
          {/* ============================================================= */}
          {step === 1 && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First name"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="middleName">Middle Name</Label>
                      <Input
                        id="middleName"
                        value={middleName}
                        onChange={(e) => setMiddleName(e.target.value)}
                        placeholder="Middle name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Last name"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone *</Label>
                    <PhoneInput
                      id="phone"
                      value={phone}
                      onChange={setPhone}
                    />
                  </div>

                  <div>
                    <Label htmlFor="language">Preferred Language</Label>
                    <Select
                      value={preferredLanguage}
                      onValueChange={(v) => setPreferredLanguage(v as "en" | "fa")}
                    >
                      <SelectTrigger id="language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="fa">Farsi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ============================================================= */}
          {/* Step 3: Additional Details & Review                           */}
          {/* ============================================================= */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Address */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Address</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="street">Street Address</Label>
                    <Input
                      id="street"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="123 Main St"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="col-span-2 sm:col-span-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="CA"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <Label htmlFor="zip">ZIP Code</Label>
                      <Input
                        id="zip"
                        value={zip}
                        onChange={(e) => setZip(e.target.value)}
                        placeholder="90001"
                        maxLength={5}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Family Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Family Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Spouse */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700">Spouse</h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="spouseName">Full Name</Label>
                        <Input
                          id="spouseName"
                          value={spouseName}
                          onChange={(e) => setSpouseName(e.target.value)}
                          placeholder="Spouse full name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="spouseDob">Date of Birth</Label>
                        <Input
                          id="spouseDob"
                          type="date"
                          value={spouseDateOfBirth}
                          onChange={(e) => setSpouseDateOfBirth(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t" />

                  {/* Children */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-700">Children</h4>
                      <Button type="button" variant="outline" size="sm" onClick={addChild}>
                        + Add Child
                      </Button>
                    </div>
                    {children.length === 0 && (
                      <p className="text-sm text-gray-400 italic">No children added</p>
                    )}
                    {children.map((child, idx) => (
                      <div
                        key={child.id}
                        className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Child {idx + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeChild(child.id)}
                            className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            Remove
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <Label>Full Name</Label>
                            <Input
                              value={child.name}
                              onChange={(e) => updateChild(child.id, "name", e.target.value)}
                              placeholder="Child's full name"
                            />
                          </div>
                          <div>
                            <Label>Date of Birth</Label>
                            <Input
                              type="date"
                              value={child.dateOfBirth}
                              onChange={(e) => updateChild(child.id, "dateOfBirth", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Emergency Contact */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Emergency Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="emergencyName">Full Name</Label>
                      <Input
                        id="emergencyName"
                        value={emergencyName}
                        onChange={(e) => setEmergencyName(e.target.value)}
                        placeholder="Contact name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="emergencyRelationship">Relationship</Label>
                      <Input
                        id="emergencyRelationship"
                        value={emergencyRelationship}
                        onChange={(e) => setEmergencyRelationship(e.target.value)}
                        placeholder="e.g. Brother, Sister, Friend"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="emergencyPhone">Phone</Label>
                    <PhoneInput
                      id="emergencyPhone"
                      value={emergencyPhone}
                      onChange={setEmergencyPhone}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Review Summary */}
              {selectedPlan && (
                <Card className="border-brand-teal/20 bg-brand-teal/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Review Your Membership</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Member info */}
                      <div className="grid grid-cols-2 gap-y-2 text-sm">
                        <span className="text-gray-500">Name</span>
                        <span className="font-medium text-text-dark-slate text-right">
                          {firstName} {middleName ? `${middleName} ` : ""}{lastName}
                        </span>
                        <span className="text-gray-500">Email</span>
                        <span className="font-medium text-text-dark-slate text-right truncate">{email}</span>
                        <span className="text-gray-500">Phone</span>
                        <span className="font-medium text-text-dark-slate text-right">{phone}</span>
                      </div>

                      <div className="border-t border-brand-teal/10" />

                      {/* Plan info */}
                      <div className="grid grid-cols-2 gap-y-2 text-sm">
                        <span className="text-gray-500">Plan</span>
                        <span className="font-medium text-text-dark-slate text-right">{selectedPlan.name}</span>
                        <span className="text-gray-500">Billing</span>
                        <span className="font-medium text-text-dark-slate text-right">{FREQUENCY_LABELS[billingFrequency]}</span>
                        <span className="text-gray-500">Recurring Dues</span>
                        <span className="font-medium text-text-dark-slate text-right">
                          {formatCurrency(getPriceForFrequency(selectedPlan, billingFrequency))}
                        </span>
                        {selectedPlan.enrollmentFee > 0 && (
                          <>
                            <span className="text-gray-500">Enrollment Fee</span>
                            <span className="font-medium text-text-dark-slate text-right">
                              {formatCurrency(selectedPlan.enrollmentFee)}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="border-t border-brand-teal/10 pt-3 flex justify-between items-center">
                        <span className="font-semibold text-text-dark-slate">Total Due Today</span>
                        <span className="text-xl font-bold text-brand-teal">
                          {formatCurrency(
                            getPriceForFrequency(selectedPlan, billingFrequency) +
                              selectedPlan.enrollmentFee
                          )}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      <div className="mt-8 flex justify-between">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={handleBack} disabled={submitting}>
            Back
          </Button>
        ) : (
          <div />
        )}

        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            onClick={handleNext}
            className="bg-brand-teal hover:bg-brand-teal-hover text-white px-8"
          >
            Continue
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-brand-teal hover:bg-brand-teal-hover text-white px-8"
          >
            {submitting ? "Processing..." : "Join & Pay"}
          </Button>
        )}
      </div>
    </div>
  );
}
