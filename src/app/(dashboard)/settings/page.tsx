"use client";

import { useState } from "react";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, CreditCard, Users, Settings as SettingsIcon, FileText, Eye, Plus, Edit2, ToggleLeft, ToggleRight, Mail, Languages } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { getOrganization, getPlans, formatCurrency, getEmailTemplates, getEmailTemplateTypeLabel } from "@/lib/mock-data";
import { Plan, EmailTemplate } from "@/lib/types";
import { toast } from "sonner";

const defaultAgreementText = `MEMBERSHIP AGREEMENT

This Membership Agreement ("Agreement") is entered into between the undersigned Member and [Organization Name] ("Organization").

1. MEMBERSHIP BENEFITS
Upon completion of the required waiting period (60 consecutive months of paid membership), the Member shall be eligible to receive burial benefits as outlined in the Organization's bylaws.

2. PAYMENT OBLIGATIONS
- The Member agrees to pay the enrollment fee of $500.00 upon signing this Agreement.
- The Member agrees to pay monthly dues according to their selected plan:
  • Single Plan: $20.00/month
  • Married Plan: $40.00/month
  • Widow Plan: $40.00/month

3. WAITING PERIOD
- Benefits become available after 60 consecutive months of paid membership.
- Missed payments may extend the waiting period.
- If payments are missed for 24 consecutive months, membership will be automatically cancelled.

4. CANCELLATION
- Members may cancel their membership at any time by providing written notice.
- No refunds will be provided for payments already made.
- Cancelled memberships forfeit all accumulated paid months toward eligibility.

5. AGREEMENT
By signing below, the Member acknowledges that they have read, understood, and agree to the terms of this Agreement.

Member Signature: ____________________
Date: ____________________
`;

export default function SettingsPage() {
  const organization = getOrganization();
  const plans = getPlans();
  const emailTemplates = getEmailTemplates();

  const [formData, setFormData] = useState({
    name: organization.name,
    email: organization.email,
    phone: organization.phone,
    street: organization.address.street,
    city: organization.address.city,
    state: organization.address.state,
    zip: organization.address.zip,
  });

  const [agreementText, setAgreementText] = useState(defaultAgreementText);
  const [agreementVersion, setAgreementVersion] = useState("1.0");
  const [showPreview, setShowPreview] = useState(false);

  // Plan management state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [planFormData, setPlanFormData] = useState({
    name: "",
    type: "single",
    description: "",
    monthly: "",
    biannual: "",
    annual: "",
    enrollmentFee: "",
  });

  // Email template state
  const [editTemplateDialogOpen, setEditTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [templateFormData, setTemplateFormData] = useState({
    subjectEn: "",
    subjectFa: "",
    bodyEn: "",
    bodyFa: "",
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Organization settings saved successfully");
  };

  const handleSaveAgreement = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Membership agreement saved successfully");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Plan management handlers
  const handleEditPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setPlanFormData({
      name: plan.name,
      type: plan.type,
      description: plan.description,
      monthly: plan.pricing.monthly.toString(),
      biannual: plan.pricing.biannual.toString(),
      annual: plan.pricing.annual.toString(),
      enrollmentFee: plan.enrollmentFee.toString(),
    });
    setEditDialogOpen(true);
  };

  const handleAddPlan = () => {
    setPlanFormData({
      name: "",
      type: "single",
      description: "",
      monthly: "",
      biannual: "",
      annual: "",
      enrollmentFee: "500",
    });
    setAddDialogOpen(true);
  };

  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success(editDialogOpen ? "Plan updated successfully" : "Plan created successfully");
    setEditDialogOpen(false);
    setAddDialogOpen(false);
  };

  const handleToggleActive = (plan: Plan) => {
    toast.success(`Plan ${plan.isActive ? "deactivated" : "activated"} successfully`);
  };

  // Email template handlers
  const handleEditTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setTemplateFormData({
      subjectEn: template.subject.en,
      subjectFa: template.subject.fa,
      bodyEn: template.body.en,
      bodyFa: template.body.fa,
    });
    setEditTemplateDialogOpen(true);
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Email template updated successfully");
    setEditTemplateDialogOpen(false);
  };

  const handleToggleTemplateActive = (template: EmailTemplate) => {
    toast.success(`Template ${template.isActive ? "deactivated" : "activated"} successfully`);
  };

  const getPlanTypeBadge = (type: string) => {
    const badges = {
      single: "bg-blue-100 text-blue-800",
      married: "bg-purple-100 text-purple-800",
      widow: "bg-green-100 text-green-800",
    };
    return badges[type as keyof typeof badges] || "bg-gray-100 text-gray-800";
  };

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage your organization settings and preferences
            </p>
          </div>

          <Tabs defaultValue="organization" className="space-y-6">
            <TabsList>
              <TabsTrigger value="organization">Organization</TabsTrigger>
              <TabsTrigger value="plans">Plans</TabsTrigger>
              <TabsTrigger value="agreement">Agreement</TabsTrigger>
              <TabsTrigger value="stripe">Stripe</TabsTrigger>
              <TabsTrigger value="admins">Admins</TabsTrigger>
              <TabsTrigger value="emails">Email Templates</TabsTrigger>
            </TabsList>

            {/* Organization Tab */}
            <TabsContent value="organization">
              <Card>
                <CardHeader>
                  <CardTitle>Organization Information</CardTitle>
                  <CardDescription>
                    Update your organization details and contact information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSave} className="space-y-6">
                    {/* Organization Name */}
                    <div className="space-y-2">
                      <Label htmlFor="name">Organization Name</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Enter organization name"
                      />
                    </div>

                    {/* Contact Email */}
                    <div className="space-y-2">
                      <Label htmlFor="email">Contact Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="admin@organization.org"
                      />
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="(555) 123-4567"
                      />
                    </div>

                    {/* Address */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Address</h3>

                      <div className="space-y-2">
                        <Label htmlFor="street">Street Address</Label>
                        <Input
                          id="street"
                          name="street"
                          value={formData.street}
                          onChange={handleChange}
                          placeholder="123 Main Street"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            name="city"
                            value={formData.city}
                            onChange={handleChange}
                            placeholder="Houston"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="state">State</Label>
                          <Input
                            id="state"
                            name="state"
                            value={formData.state}
                            onChange={handleChange}
                            placeholder="TX"
                            maxLength={2}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="zip">ZIP Code</Label>
                          <Input
                            id="zip"
                            name="zip"
                            value={formData.zip}
                            onChange={handleChange}
                            placeholder="77001"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit">Save Changes</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Plans Tab */}
            <TabsContent value="plans">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">Membership Plans</h3>
                    <p className="text-sm text-muted-foreground">Configure plans and pricing options</p>
                  </div>
                  <Button onClick={handleAddPlan} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Plan
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {plans.map((plan) => (
                    <Card key={plan.id} className={plan.isActive ? "" : "opacity-60"}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-xl">{plan.name}</CardTitle>
                            <CardDescription className="mt-1">{plan.description}</CardDescription>
                          </div>
                          <Badge className={getPlanTypeBadge(plan.type)}>
                            {plan.type.charAt(0).toUpperCase() + plan.type.slice(1)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm">Pricing</h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="h-8">Frequency</TableHead>
                                <TableHead className="h-8 text-right">Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell className="py-2">Monthly</TableCell>
                                <TableCell className="py-2 text-right font-semibold">
                                  {formatCurrency(plan.pricing.monthly)}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="py-2">Bi-Annual (6mo)</TableCell>
                                <TableCell className="py-2 text-right font-semibold">
                                  {formatCurrency(plan.pricing.biannual)}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="py-2">Annual (12mo)</TableCell>
                                <TableCell className="py-2 text-right font-semibold">
                                  {formatCurrency(plan.pricing.annual)}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>

                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm font-medium">Enrollment Fee</p>
                          <p className="text-lg font-bold">{formatCurrency(plan.enrollmentFee)}</p>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditPlan(plan)}
                            className="flex-1 gap-2"
                          >
                            <Edit2 className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant={plan.isActive ? "outline" : "default"}
                            size="sm"
                            onClick={() => handleToggleActive(plan)}
                            className="flex-1 gap-2"
                          >
                            {plan.isActive ? (
                              <>
                                <ToggleLeft className="h-4 w-4" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <ToggleRight className="h-4 w-4" />
                                Activate
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Agreement Tab */}
            <TabsContent value="agreement">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Editor Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Membership Agreement</CardTitle>
                    <CardDescription>
                      Edit the legal agreement that members sign during enrollment
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSaveAgreement} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="agreementVersion">Version</Label>
                        <Input
                          id="agreementVersion"
                          value={agreementVersion}
                          onChange={(e) => setAgreementVersion(e.target.value)}
                          placeholder="1.0"
                          className="w-32"
                        />
                        <p className="text-xs text-muted-foreground">
                          Update the version when making significant changes
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="agreementText">Agreement Text</Label>
                        <Textarea
                          id="agreementText"
                          value={agreementText}
                          onChange={(e) => setAgreementText(e.target.value)}
                          placeholder="Enter your membership agreement text..."
                          className="min-h-[400px] font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Use [Organization Name] as a placeholder - it will be replaced with your organization name
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <Button type="submit">Save Agreement</Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowPreview(!showPreview)}
                          className="lg:hidden"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          {showPreview ? "Hide Preview" : "Show Preview"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                {/* Preview Card */}
                <Card className={showPreview ? "block" : "hidden lg:block"}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      Preview
                    </CardTitle>
                    <CardDescription>
                      How the agreement will appear to members
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg p-6 bg-white max-h-[500px] overflow-y-auto">
                      <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed">
                        {agreementText.replace(/\[Organization Name\]/g, organization.name)}
                      </pre>
                    </div>
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        <strong>Version:</strong> {agreementVersion} | <strong>Last updated:</strong> {new Date().toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Stripe Tab */}
            <TabsContent value="stripe">
              <Card>
                <CardHeader>
                  <CardTitle>Stripe Integration</CardTitle>
                  <CardDescription>
                    Configure payment processing with Stripe Connect
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Stripe Connect Status</p>
                        <p className="text-sm text-muted-foreground">
                          {organization.stripeOnboarded
                            ? "Connected and ready to accept payments"
                            : "Not connected"}
                        </p>
                      </div>
                      <div>
                        {organization.stripeOnboarded ? (
                          <Button variant="outline">Manage Account</Button>
                        ) : (
                          <Button>Connect Stripe</Button>
                        )}
                      </div>
                    </div>

                    {organization.stripeConnectId && (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-1">Account ID</p>
                        <p className="text-sm text-muted-foreground font-mono">
                          {organization.stripeConnectId}
                        </p>
                      </div>
                    )}

                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-1">Platform Fee</p>
                      <p className="text-sm text-muted-foreground">
                        ${organization.platformFee.toFixed(2)} per transaction
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Admins Tab */}
            <TabsContent value="admins">
              <Card>
                <CardHeader>
                  <CardTitle>Admin Users</CardTitle>
                  <CardDescription>
                    Manage administrator access and permissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      Admin user management coming soon
                    </p>
                    <Button disabled>Add Admin User</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Email Templates Tab */}
            <TabsContent value="emails">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold">Email Templates</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure automated email templates in English and Farsi
                  </p>
                </div>

                <div className="grid gap-4">
                  {emailTemplates.map((template) => (
                    <Card key={template.id} className={template.isActive ? "" : "opacity-60"}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                              <h4 className="font-semibold">{template.name}</h4>
                              <Badge variant="outline">
                                {getEmailTemplateTypeLabel(template.type)}
                              </Badge>
                              {!template.isActive && (
                                <Badge variant="inactive">Inactive</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{template.description}</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                  <Languages className="h-3 w-3" />
                                  English
                                </div>
                                <p className="text-sm font-medium">{template.subject.en}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2">{template.body.en.substring(0, 100)}...</p>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                  <Languages className="h-3 w-3" />
                                  فارسی (Farsi)
                                </div>
                                <p className="text-sm font-medium" dir="rtl">{template.subject.fa}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2" dir="rtl">{template.body.fa.substring(0, 100)}...</p>
                              </div>
                            </div>

                            {template.variables.length > 0 && (
                              <div className="pt-2">
                                <p className="text-xs text-muted-foreground mb-1">Variables:</p>
                                <div className="flex flex-wrap gap-1">
                                  {template.variables.map((v) => (
                                    <Badge key={v} variant="secondary" className="text-xs font-mono">
                                      {`{{${v}}}`}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditTemplate(template)}
                              className="gap-2"
                            >
                              <Edit2 className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              variant={template.isActive ? "outline" : "default"}
                              size="sm"
                              onClick={() => handleToggleTemplateActive(template)}
                              className="gap-2"
                            >
                              {template.isActive ? (
                                <>
                                  <ToggleLeft className="h-4 w-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <ToggleRight className="h-4 w-4" />
                                  Activate
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Plan Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Plan</DialogTitle>
            <DialogDescription>Update plan details and pricing</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSavePlan}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Plan Name</Label>
                  <Input
                    id="edit-name"
                    value={planFormData.name}
                    onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Plan Type</Label>
                  <Select
                    value={planFormData.type}
                    onValueChange={(value) => setPlanFormData({ ...planFormData, type: value })}
                  >
                    <SelectTrigger id="edit-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="widow">Widow/Widower</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={planFormData.description}
                  onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-monthly">Monthly</Label>
                  <Input
                    id="edit-monthly"
                    type="number"
                    value={planFormData.monthly}
                    onChange={(e) => setPlanFormData({ ...planFormData, monthly: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-biannual">Bi-Annual (6mo)</Label>
                  <Input
                    id="edit-biannual"
                    type="number"
                    value={planFormData.biannual}
                    onChange={(e) => setPlanFormData({ ...planFormData, biannual: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-annual">Annual (12mo)</Label>
                  <Input
                    id="edit-annual"
                    type="number"
                    value={planFormData.annual}
                    onChange={(e) => setPlanFormData({ ...planFormData, annual: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-enrollment">Enrollment Fee</Label>
                <Input
                  id="edit-enrollment"
                  type="number"
                  value={planFormData.enrollmentFee}
                  onChange={(e) => setPlanFormData({ ...planFormData, enrollmentFee: e.target.value })}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Plan Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Plan</DialogTitle>
            <DialogDescription>Create a new membership plan</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSavePlan}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-name">Plan Name</Label>
                  <Input
                    id="add-name"
                    value={planFormData.name}
                    onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                    placeholder="e.g., Single"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-type">Plan Type</Label>
                  <Select
                    value={planFormData.type}
                    onValueChange={(value) => setPlanFormData({ ...planFormData, type: value })}
                  >
                    <SelectTrigger id="add-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="widow">Widow/Widower</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-description">Description</Label>
                <Input
                  id="add-description"
                  value={planFormData.description}
                  onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                  placeholder="e.g., Individual coverage only"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-monthly">Monthly</Label>
                  <Input
                    id="add-monthly"
                    type="number"
                    value={planFormData.monthly}
                    onChange={(e) => setPlanFormData({ ...planFormData, monthly: e.target.value })}
                    placeholder="20"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-biannual">Bi-Annual (6mo)</Label>
                  <Input
                    id="add-biannual"
                    type="number"
                    value={planFormData.biannual}
                    onChange={(e) => setPlanFormData({ ...planFormData, biannual: e.target.value })}
                    placeholder="120"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-annual">Annual (12mo)</Label>
                  <Input
                    id="add-annual"
                    type="number"
                    value={planFormData.annual}
                    onChange={(e) => setPlanFormData({ ...planFormData, annual: e.target.value })}
                    placeholder="240"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-enrollment">Enrollment Fee</Label>
                <Input
                  id="add-enrollment"
                  type="number"
                  value={planFormData.enrollmentFee}
                  onChange={(e) => setPlanFormData({ ...planFormData, enrollmentFee: e.target.value })}
                  placeholder="500"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Plan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Email Template Dialog */}
      <Dialog open={editTemplateDialogOpen} onOpenChange={setEditTemplateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Email Template</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.name} - {selectedTemplate?.description}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveTemplate}>
            <div className="space-y-6 py-4">
              {/* English Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  <h4 className="font-semibold">English</h4>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject-en">Subject</Label>
                  <Input
                    id="subject-en"
                    value={templateFormData.subjectEn}
                    onChange={(e) => setTemplateFormData({ ...templateFormData, subjectEn: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body-en">Body</Label>
                  <Textarea
                    id="body-en"
                    value={templateFormData.bodyEn}
                    onChange={(e) => setTemplateFormData({ ...templateFormData, bodyEn: e.target.value })}
                    className="min-h-[150px]"
                    required
                  />
                </div>
              </div>

              {/* Farsi Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  <h4 className="font-semibold">فارسی (Farsi)</h4>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject-fa">Subject</Label>
                  <Input
                    id="subject-fa"
                    value={templateFormData.subjectFa}
                    onChange={(e) => setTemplateFormData({ ...templateFormData, subjectFa: e.target.value })}
                    dir="rtl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body-fa">Body</Label>
                  <Textarea
                    id="body-fa"
                    value={templateFormData.bodyFa}
                    onChange={(e) => setTemplateFormData({ ...templateFormData, bodyFa: e.target.value })}
                    className="min-h-[150px]"
                    dir="rtl"
                    required
                  />
                </div>
              </div>

              {/* Variables */}
              {selectedTemplate?.variables && selectedTemplate.variables.length > 0 && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Available Variables:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.variables.map((v) => (
                      <Badge key={v} variant="secondary" className="font-mono">
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Use these placeholders in your template - they will be replaced with actual values when sending
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTemplateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Template</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
