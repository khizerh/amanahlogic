"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/utils/phone";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Link from "next/link";
import { Plus, Trash2, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Plan, PlanType, BillingFrequency, CommunicationLanguage } from "@/lib/types";

interface ChildFormData {
  id: string;
  name: string;
  dateOfBirth: string;
}

export default function NewMemberPage() {
  const router = useRouter();

  // Plans state - fetched from API
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  // Fetch plans on mount
  useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await fetch("/api/plans");
        const data = await response.json();
        if (response.ok && data.plans) {
          setPlans(data.plans);
          // Set initial plan type to first plan's type
          if (data.plans.length > 0) {
            setPlanType(data.plans[0].type);
          }
        } else {
          toast.error("Failed to load plans");
        }
      } catch (error) {
        toast.error("Failed to load plans");
      } finally {
        setPlansLoading(false);
      }
    }
    fetchPlans();
  }, []);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [spouseName, setSpouseName] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [planType, setPlanType] = useState<PlanType>("");
  const [billingFrequency, setBillingFrequency] = useState<BillingFrequency>("monthly");
  const [preferredLanguage, setPreferredLanguage] = useState<CommunicationLanguage>("en");
  const [children, setChildren] = useState<ChildFormData[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"manual" | "stripe">("stripe");
  const [waiveEnrollmentFee, setWaiveEnrollmentFee] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emergencyPhoneError, setEmergencyPhoneError] = useState<string | null>(null);

  // Get current plan and pricing based on selections
  const currentPlan = plans.find((p) => p.type === planType);
  const currentPricing = currentPlan?.pricing || { monthly: 0, biannual: 0, annual: 0 };
  const currentDuesAmount = currentPricing[billingFrequency];
  const enrollmentFeeAmount = currentPlan?.enrollmentFee || 0;

  const addChild = () => {
    setChildren([
      ...children,
      { id: `temp_${Date.now()}`, name: "", dateOfBirth: "" },
    ]);
  };

  const removeChild = (id: string) => {
    setChildren(children.filter((child) => child.id !== id));
  };

  const updateChild = (id: string, field: "name" | "dateOfBirth", value: string) => {
    setChildren(
      children.map((child) =>
        child.id === id ? { ...child, [field]: value } : child
      )
    );
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    setEmergencyPhoneError(null);

    // Basic validation
    if (!firstName || !lastName || !email || !phone) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate phone numbers
    if (!isValidPhoneNumber(phone)) {
      setPhoneError("Please enter a valid US phone number");
      toast.error("Invalid phone number format");
      return;
    }

    if (emergencyPhone && !isValidPhoneNumber(emergencyPhone)) {
      setEmergencyPhoneError("Please enter a valid US phone number");
      toast.error("Invalid emergency phone number format");
      return;
    }

    setIsSubmitting(true);

    try {
      // Normalize phone numbers to E.164 format
      const normalizedPhone = normalizePhoneNumber(phone);
      const normalizedEmergencyPhone = emergencyPhone ? normalizePhoneNumber(emergencyPhone) : "";

      const response = await fetch("/api/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone: normalizedPhone,
          street,
          city,
          state,
          zip,
          spouseName: spouseName || undefined,
          emergencyName,
          emergencyPhone: normalizedEmergencyPhone,
          planType,
          billingFrequency,
          preferredLanguage,
          children: children.map((c) => ({
            id: c.id,
            name: c.name,
            dateOfBirth: c.dateOfBirth,
          })),
          // Pass if enrollment fee is waived (applies to both payment methods)
          waiveEnrollmentFee,
          paymentMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create member");
      }

      // Show success with onboarding status
      const onboarding = data.onboarding;
      if (onboarding) {
        const emailsSent = [
          onboarding.welcomeEmailSent && "welcome",
          onboarding.agreementEmailSent && "agreement",
        ].filter(Boolean);

        if (emailsSent.length > 0) {
          toast.success("Member created successfully", {
            description: `Sent ${emailsSent.join(" & ")} email${emailsSent.length > 1 ? "s" : ""} to ${email}`,
          });
        } else if (onboarding.errors?.length > 0) {
          toast.success("Member created, but some emails failed to send", {
            description: "You can resend from the member detail page.",
          });
        } else {
          toast.success("Member created successfully");
        }
      } else {
        toast.success("Member created successfully");
      }

      router.push(`/members/${data.member.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create member");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <Breadcrumb className="mb-6">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/members">Members</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Add Member</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Add New Member</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter member information to create a new account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">
                      First Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Enter first name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">
                      Last Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Enter last name"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Email <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">
                      Phone <span className="text-red-500">*</span>
                    </Label>
                    <PhoneInput
                      id="phone"
                      value={phone}
                      onChange={(value) => {
                        setPhone(value);
                        setPhoneError(null);
                      }}
                      error={phoneError || undefined}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preferredLanguage">Preferred Communication Language</Label>
                  <Select
                    value={preferredLanguage}
                    onValueChange={(value) => setPreferredLanguage(value as CommunicationLanguage)}
                  >
                    <SelectTrigger id="preferredLanguage" className="w-full md:w-[240px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fa">فارسی (Farsi)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Emails and notifications will be sent in this language
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Address */}
            <Card>
              <CardHeader>
                <CardTitle>Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="street">Street Address</Label>
                  <Input
                    id="street"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="123 Main St"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="TX"
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input
                      id="zip"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      placeholder="12345"
                      maxLength={5}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Household */}
            <Card>
              <CardHeader>
                <CardTitle>Household Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="spouseName">Spouse Name</Label>
                  <Input
                    id="spouseName"
                    value={spouseName}
                    onChange={(e) => setSpouseName(e.target.value)}
                    placeholder="Enter spouse name if applicable"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Children</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addChild}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Child
                    </Button>
                  </div>

                  {children.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg border-dashed">
                      No children added. Click &quot;Add Child&quot; to add.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {children.map((child) => (
                        <div key={child.id} className="flex gap-3 items-end">
                          <div className="flex-1 space-y-2">
                            <Label htmlFor={`child-name-${child.id}`}>Name</Label>
                            <Input
                              id={`child-name-${child.id}`}
                              value={child.name}
                              onChange={(e) => updateChild(child.id, "name", e.target.value)}
                              placeholder="Child name"
                            />
                          </div>
                          <div className="flex-1 space-y-2">
                            <Label htmlFor={`child-dob-${child.id}`}>Date of Birth</Label>
                            <Input
                              id={`child-dob-${child.id}`}
                              type="date"
                              value={child.dateOfBirth}
                              onChange={(e) => updateChild(child.id, "dateOfBirth", e.target.value)}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeChild(child.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Emergency Contact */}
            <Card>
              <CardHeader>
                <CardTitle>Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyName">Contact Name</Label>
                    <Input
                      id="emergencyName"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      placeholder="Emergency contact name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyPhone">Contact Phone</Label>
                    <PhoneInput
                      id="emergencyPhone"
                      value={emergencyPhone}
                      onChange={(value) => {
                        setEmergencyPhone(value);
                        setEmergencyPhoneError(null);
                      }}
                      error={emergencyPhoneError || undefined}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Plan Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Plan Selection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {plansLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading plans...</span>
                  </div>
                ) : plans.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No plans found. Please create plans in Settings first.
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <Label>Plan</Label>
                      <RadioGroup value={planType} onValueChange={(value) => setPlanType(value as PlanType)}>
                        {plans.map((plan) => (
                          <div key={plan.id} className="flex items-center space-x-2">
                            <RadioGroupItem value={plan.type} id={`plan-${plan.id}`} />
                            <Label htmlFor={`plan-${plan.id}`} className="font-normal cursor-pointer">
                              <span className="font-medium">{plan.name}</span>
                              <span className="text-muted-foreground ml-1">({plan.type})</span>
                              {plan.description && <span className="text-muted-foreground"> - {plan.description}</span>}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="billingFrequency">Billing Frequency</Label>
                      <Select
                        value={billingFrequency}
                        onValueChange={(value) => setBillingFrequency(value as BillingFrequency)}
                      >
                        <SelectTrigger id="billingFrequency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">
                            Monthly - ${currentPricing.monthly}/mo
                          </SelectItem>
                          <SelectItem value="biannual">
                            Biannual - ${currentPricing.biannual}/6mo
                          </SelectItem>
                          <SelectItem value="annual">
                            Annual - ${currentPricing.annual}/yr
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Pricing Summary */}
                    <div className="bg-muted/50 rounded-lg p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Dues Amount:</span>
                        <span className="font-medium">
                          ${currentDuesAmount}
                          {billingFrequency === "monthly" && "/month"}
                          {billingFrequency === "biannual" && " every 6 months"}
                          {billingFrequency === "annual" && "/year"}
                        </span>
                      </div>
                      {!waiveEnrollmentFee && (
                        <div className="flex justify-between mt-1">
                          <span className="text-muted-foreground">Enrollment Fee:</span>
                          <span className="font-medium">${enrollmentFeeAmount} (one-time)</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                      <Label>Payment Method</Label>
                      <RadioGroup
                        value={paymentMethod}
                        onValueChange={(value) => setPaymentMethod(value as "manual" | "stripe")}
                      >
                        <div className="flex items-start space-x-2">
                          <RadioGroupItem value="stripe" id="stripe" className="mt-1" />
                          <div>
                            <Label htmlFor="stripe" className="font-normal cursor-pointer">
                              Stripe Auto-Pay
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Set up automatic card payments via email link
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2">
                          <RadioGroupItem value="manual" id="manual" className="mt-1" />
                          <div>
                            <Label htmlFor="manual" className="font-normal cursor-pointer">
                              Manual Payments
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Collect payments via cash, check, or Zelle
                            </p>
                          </div>
                        </div>
                      </RadioGroup>

                      {/* Enrollment Fee Option - same for both payment methods */}
                      <div className="space-y-3 mt-3 pt-3 border-t">
                        <Label className="text-sm">
                          Enrollment Fee {!waiveEnrollmentFee && `($${enrollmentFeeAmount})`}
                        </Label>

                        <div className="flex items-start space-x-3">
                          <Checkbox
                            id="waiveEnrollmentFee"
                            checked={waiveEnrollmentFee}
                            onCheckedChange={(checked) => setWaiveEnrollmentFee(checked as boolean)}
                          />
                          <div className="space-y-1">
                            <Label
                              htmlFor="waiveEnrollmentFee"
                              className="font-normal cursor-pointer"
                            >
                              Waive enrollment fee
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Check to skip collecting the enrollment fee
                            </p>
                          </div>
                        </div>

                        {/* Info Box - Onboarding emails */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                          <div className="flex items-start gap-2">
                            <Mail className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-blue-800">
                              <p className="font-medium">Two emails will be sent to the member:</p>
                              <ul className="mt-1 text-blue-700 list-disc list-inside space-y-0.5">
                                <li>
                                  <strong>Welcome email</strong> &mdash; portal invite
                                  {paymentMethod === "stripe"
                                    ? !waiveEnrollmentFee
                                      ? ` + payment setup ($${enrollmentFeeAmount} enrollment fee + $${currentDuesAmount} recurring dues)`
                                      : ` + payment setup ($${currentDuesAmount} recurring dues)`
                                    : " + payment reminder (cash, check, or Zelle)"}
                                </li>
                                <li><strong>Agreement email</strong> &mdash; membership agreement to sign</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <Link href="/members">
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting || plansLoading || plans.length === 0}>
                {isSubmitting ? "Creating..." : "Create Member"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
