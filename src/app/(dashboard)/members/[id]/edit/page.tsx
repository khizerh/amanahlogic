"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getMember } from "@/lib/mock-data";
import { PlanType, BillingFrequency, CommunicationLanguage } from "@/lib/types";

interface ChildFormData {
  id: string;
  name: string;
  dateOfBirth: string;
}

export default function EditMemberPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id as string;

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
  const [planType, setPlanType] = useState<PlanType>("single");
  const [billingFrequency, setBillingFrequency] = useState<BillingFrequency>("monthly");
  const [preferredLanguage, setPreferredLanguage] = useState<CommunicationLanguage>("en");
  const [children, setChildren] = useState<ChildFormData[]>([]);
  const [loading, setLoading] = useState(true);

  // Load member data
  useEffect(() => {
    const memberData = getMember(memberId);
    if (memberData) {
      setFirstName(memberData.firstName);
      setLastName(memberData.lastName);
      setEmail(memberData.email);
      setPhone(memberData.phone);
      setStreet(memberData.address.street);
      setCity(memberData.address.city);
      setState(memberData.address.state);
      setZip(memberData.address.zip);
      setSpouseName(memberData.spouseName || "");
      setEmergencyName(memberData.emergencyContact.name);
      setEmergencyPhone(memberData.emergencyContact.phone);

      if (memberData.plan) {
        setPlanType(memberData.plan.type);
      }

      if (memberData.membership) {
        setBillingFrequency(memberData.membership.billingFrequency);
      }

      setPreferredLanguage(memberData.preferredLanguage);

      setChildren(
        memberData.children.map((child) => ({
          id: child.id,
          name: child.name,
          dateOfBirth: child.dateOfBirth.split("T")[0], // Convert ISO to YYYY-MM-DD
        }))
      );

      setLoading(false);
    } else {
      toast.error("Member not found");
      router.push("/members");
    }
  }, [memberId, router]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!firstName || !lastName || !email || !phone) {
      toast.error("Please fill in all required fields");
      return;
    }

    // In a real app, this would update the database
    toast.success("Member updated successfully");
    router.push(`/members/${memberId}`);
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
            <p className="text-center text-muted-foreground">Loading...</p>
          </div>
        </div>
      </>
    );
  }

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
                <BreadcrumbLink asChild>
                  <Link href={`/members/${memberId}`}>
                    {firstName} {lastName}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Edit</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Edit Member</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Update member information
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
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(123) 456-7890"
                      required
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
                  <Label htmlFor="spouseName">Spouse Name (Optional)</Label>
                  <Input
                    id="spouseName"
                    value={spouseName}
                    onChange={(e) => setSpouseName(e.target.value)}
                    placeholder="Enter spouse name if applicable"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Children (Optional)</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addChild}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Child
                    </Button>
                  </div>

                  {children.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg border-dashed">
                      No children added. Click "Add Child" to add.
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
                    <Input
                      id="emergencyPhone"
                      type="tel"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="(123) 456-7890"
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
                <div className="space-y-3">
                  <Label>Plan Type</Label>
                  <RadioGroup value={planType} onValueChange={(value) => setPlanType(value as PlanType)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="single" id="single" />
                      <Label htmlFor="single" className="font-normal cursor-pointer">
                        Single - Individual coverage only ($20/month)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="married" id="married" />
                      <Label htmlFor="married" className="font-normal cursor-pointer">
                        Married - Member + spouse + children ($40/month)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="widow" id="widow" />
                      <Label htmlFor="widow" className="font-normal cursor-pointer">
                        Widow/Widower - Member + children ($40/month)
                      </Label>
                    </div>
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
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="biannual">Biannual (6 months)</SelectItem>
                      <SelectItem value="annual">Annual (12 months)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <Link href={`/members/${memberId}`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit">Update Member</Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
