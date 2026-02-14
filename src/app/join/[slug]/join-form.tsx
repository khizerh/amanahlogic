"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
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
  const [children, setChildren] = useState<Child[]>([]);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

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
      if (err) {
        toast.error(err);
        return;
      }
    }
    if (step === 1) {
      const err = validateStep2();
      if (err) {
        toast.error(err);
        return;
      }
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
    // Re-validate all steps
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
  // Render helpers
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
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    i <= step
                      ? "bg-primary text-primary-foreground"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {i < step ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className="mt-1 text-xs text-gray-500 hidden sm:block">{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 transition-colors ${i < step ? "bg-primary" : "bg-gray-200"}`} />
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
          {/* Step 1: Plan Selection */}
          {/* ============================================================= */}
          {step === 0 && (
            <div className="space-y-6">
              <RadioGroup
                value={selectedPlanId}
                onValueChange={setSelectedPlanId}
                className="grid gap-4"
              >
                {plans.map((plan) => {
                  const price = getPriceForFrequency(plan, billingFrequency);
                  return (
                    <label key={plan.id} htmlFor={`plan-${plan.id}`} className="cursor-pointer">
                      <Card
                        className={`transition-all ${
                          selectedPlanId === plan.id
                            ? "ring-2 ring-primary border-primary"
                            : "hover:border-gray-300"
                        }`}
                      >
                        <CardContent className="flex items-start gap-4 p-4">
                          <RadioGroupItem value={plan.id} id={`plan-${plan.id}`} className="mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                              <span className="text-lg font-bold text-primary">
                                {formatCurrency(price)}
                                <span className="text-sm font-normal text-gray-500">
                                  /{billingFrequency === "monthly" ? "mo" : billingFrequency === "biannual" ? "6mo" : "yr"}
                                </span>
                              </span>
                            </div>
                            {plan.description && (
                              <p className="mt-1 text-sm text-gray-600">{plan.description}</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </label>
                  );
                })}
              </RadioGroup>

              {/* Billing frequency selector */}
              <div>
                <Label className="mb-2 block">Billing Frequency</Label>
                <Select
                  value={billingFrequency}
                  onValueChange={(v) => setBillingFrequency(v as BillingFrequency)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{FREQUENCY_LABELS.monthly}</SelectItem>
                    <SelectItem value="biannual">{FREQUENCY_LABELS.biannual}</SelectItem>
                    <SelectItem value="annual">{FREQUENCY_LABELS.annual}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Pricing summary */}
              {selectedPlan && (
                <Card className="bg-gray-50">
                  <CardContent className="p-4 space-y-2">
                    <h4 className="font-medium text-gray-900">Pricing Summary</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {selectedPlan.name} ({FREQUENCY_LABELS[billingFrequency]})
                      </span>
                      <span className="font-medium">
                        {formatCurrency(getPriceForFrequency(selectedPlan, billingFrequency))}
                      </span>
                    </div>
                    {selectedPlan.enrollmentFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">One-time enrollment fee</span>
                        <span className="font-medium">{formatCurrency(selectedPlan.enrollmentFee)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex justify-between font-medium">
                      <span>Total due today</span>
                      <span>
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
          {/* Step 2: Personal Information */}
          {/* ============================================================= */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  placeholder="(555) 123-4567"
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
            </div>
          )}

          {/* ============================================================= */}
          {/* Step 3: Additional Details & Review */}
          {/* ============================================================= */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Address */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Address</h3>
                <div>
                  <Label htmlFor="street">Street</Label>
                  <Input
                    id="street"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="123 Main St"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
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
                    />
                  </div>
                  <div>
                    <Label htmlFor="zip">ZIP</Label>
                    <Input
                      id="zip"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      placeholder="90001"
                    />
                  </div>
                </div>
              </div>

              {/* Spouse */}
              <div>
                <Label htmlFor="spouseName">Spouse Name</Label>
                <Input
                  id="spouseName"
                  value={spouseName}
                  onChange={(e) => setSpouseName(e.target.value)}
                  placeholder="Spouse full name"
                />
              </div>

              {/* Children */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">Children</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addChild}>
                    + Add Child
                  </Button>
                </div>
                {children.map((child) => (
                  <div key={child.id} className="flex items-end gap-3">
                    <div className="flex-1">
                      <Label>Name</Label>
                      <Input
                        value={child.name}
                        onChange={(e) => updateChild(child.id, "name", e.target.value)}
                        placeholder="Child's name"
                      />
                    </div>
                    <div className="flex-1">
                      <Label>Date of Birth</Label>
                      <Input
                        type="date"
                        value={child.dateOfBirth}
                        onChange={(e) => updateChild(child.id, "dateOfBirth", e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeChild(child.id)}
                      className="text-red-500 hover:text-red-700 shrink-0"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              {/* Emergency Contact */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Emergency Contact</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="emergencyName">Name</Label>
                    <Input
                      id="emergencyName"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      placeholder="Emergency contact name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyPhone">Phone</Label>
                    <PhoneInput
                      id="emergencyPhone"
                      value={emergencyPhone}
                      onChange={setEmergencyPhone}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              {/* Summary */}
              {selectedPlan && (
                <Card className="bg-gray-50">
                  <CardContent className="p-4 space-y-3">
                    <h4 className="font-medium text-gray-900">Review Your Membership</h4>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Plan</span>
                        <span>{selectedPlan.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Billing</span>
                        <span>{FREQUENCY_LABELS[billingFrequency]}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Dues</span>
                        <span>{formatCurrency(getPriceForFrequency(selectedPlan, billingFrequency))}</span>
                      </div>
                      {selectedPlan.enrollmentFee > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Enrollment fee</span>
                          <span>{formatCurrency(selectedPlan.enrollmentFee)}</span>
                        </div>
                      )}
                      <div className="border-t pt-2 flex justify-between font-medium">
                        <span>Name</span>
                        <span>{firstName} {middleName ? `${middleName} ` : ""}{lastName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Email</span>
                        <span>{email}</span>
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
          <Button type="button" onClick={handleNext}>
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Processing..." : "Join & Pay"}
          </Button>
        )}
      </div>
    </div>
  );
}
