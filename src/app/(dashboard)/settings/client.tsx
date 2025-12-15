"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { isValidPhoneNumber, normalizePhoneNumber, formatPhoneNumber } from "@/lib/utils/phone";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Eye,
  Edit2,
  ToggleLeft,
  ToggleRight,
  UploadCloud,
  Loader2,
  Languages,
  Trash2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { getEmailTemplateTypeLabel } from "@/lib/mock-data";
import { Organization, EmailTemplate, AgreementTemplate } from "@/lib/types";
import { toast } from "sonner";

interface SettingsPageClientProps {
  initialOrganization: Organization;
  agreementTemplates: AgreementTemplate[];
  emailTemplates?: EmailTemplate[];
}

export function SettingsPageClient({
  initialOrganization,
  agreementTemplates,
  emailTemplates = [],
}: SettingsPageClientProps) {
  const [mounted, setMounted] = useState(false);
  const [organization, setOrganization] = useState<Organization>(initialOrganization);
  const [savingFeeSettings, setSavingFeeSettings] = useState(false);

  const [savingOrg, setSavingOrg] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Prevent hydration mismatch with Radix UI components
  useEffect(() => {
    setMounted(true);
  }, []);
  const [formData, setFormData] = useState({
    name: organization.name,
    email: organization.email || "",
    phone: formatPhoneNumber(organization.phone || ""),
    street: organization.address.street,
    city: organization.address.city,
    state: organization.address.state,
    zip: organization.address.zip,
  });

  // Agreement templates state
  const [allTemplates, setAllTemplates] = useState<AgreementTemplate[]>(agreementTemplates);
  const [allEmailTemplates, setAllEmailTemplates] = useState<EmailTemplate[]>(emailTemplates);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [templateUpload, setTemplateUpload] = useState<{
    file: File | null;
    language: "en" | "fa";
    version: string;
    notes: string;
  }>({
    file: null,
    language: "en",
    version: "v1-en",
    notes: "",
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

  // View/delete template loading state
  const [viewingTemplateId, setViewingTemplateId] = useState<string | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  // Handle deleting an agreement template
  const handleDeleteTemplate = async (template: AgreementTemplate) => {
    if (template.isActive) {
      toast.error("Cannot delete active template. Set another template as active first.");
      return;
    }

    if (!confirm(`Delete template "${template.version}"? This cannot be undone.`)) {
      return;
    }

    setDeletingTemplateId(template.id);
    try {
      const res = await fetch("/api/agreements/templates/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete template");
      }

      setAllTemplates((prev) => prev.filter((t) => t.id !== template.id));
      toast.success(`Deleted ${template.version}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setDeletingTemplateId(null);
    }
  };

  // Handle viewing an agreement template (fetches signed URL)
  const handleViewTemplate = async (templateId: string) => {
    setViewingTemplateId(templateId);
    try {
      const res = await fetch(`/api/agreement-templates/${templateId}/url`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to get template URL");
      }
      const { url } = await res.json();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open template");
    } finally {
      setViewingTemplateId(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);

    // Validate phone number if provided
    if (formData.phone && !isValidPhoneNumber(formData.phone)) {
      setPhoneError("Please enter a valid US phone number");
      toast.error("Invalid phone number format");
      return;
    }

    setSavingOrg(true);
    try {
      // Normalize phone to E.164 format for storage
      const normalizedPhone = formData.phone ? normalizePhoneNumber(formData.phone) : "";

      const res = await fetch("/api/organizations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: normalizedPhone,
          address: {
            street: formData.street,
            city: formData.city,
            state: formData.state,
            zip: formData.zip,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save organization");
      }
      setOrganization(json.organization);
      toast.success("Organization settings saved successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingOrg(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
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

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    try {
      const res = await fetch("/api/email-templates/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTemplate.id,
          subject: { en: templateFormData.subjectEn, fa: templateFormData.subjectFa },
          body: { en: templateFormData.bodyEn, fa: templateFormData.bodyFa },
          isActive: selectedTemplate.isActive,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update template");
      }
      const updated = json.template as EmailTemplate;
      setAllEmailTemplates((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t))
      );
      toast.success("Email template updated");
      setEditTemplateDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update template");
    }
  };

  const handleToggleTemplateActive = async (template: EmailTemplate) => {
    try {
      const res = await fetch("/api/email-templates/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: template.id,
          isActive: !template.isActive,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update template");
      }
      const updated = json.template as EmailTemplate;
      setAllEmailTemplates((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t))
      );
      toast.success(`Template ${updated.isActive ? "activated" : "deactivated"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update template");
    }
  };

  // Fee settings toggle handler
  const handleTogglePassFees = async () => {
    setSavingFeeSettings(true);
    try {
      const res = await fetch("/api/organizations/update-fee-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passFeesToMember: !organization.passFeesToMember }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update fee settings");
      }
      setOrganization(json.organization);
      toast.success(
        json.organization.passFeesToMember
          ? "Processing fees will now be added to member payments"
          : "Organization will now absorb processing fees"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update fee settings");
    } finally {
      setSavingFeeSettings(false);
    }
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

          {mounted && (
          <Tabs defaultValue="organization" className="space-y-6">
            <TabsList>
              <TabsTrigger value="organization">Organization</TabsTrigger>
              <TabsTrigger value="agreement">Agreement</TabsTrigger>
              <TabsTrigger value="stripe">Stripe</TabsTrigger>
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

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <PhoneInput
                        id="phone"
                        value={formData.phone}
                        onChange={(value) => {
                          setFormData({ ...formData, phone: value });
                          setPhoneError(null);
                        }}
                        error={phoneError || undefined}
                      />
                    </div>

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
                      <Button type="submit" disabled={savingOrg}>
                        {savingOrg ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Admin Users Section */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Admin Users</CardTitle>
                  <CardDescription>
                    Manage administrator access to this organization
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

            {/* Agreement Templates Tab */}
            <TabsContent value="agreement">
              <Card>
                <CardHeader>
                  <CardTitle>Agreement Templates</CardTitle>
                  <CardDescription>
                    Manage PDF templates for membership agreements. Upload separate templates for English and Dari/Farsi.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Templates Table */}
                  {allTemplates.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Language</TableHead>
                            <TableHead>Version</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allTemplates.map((t) => (
                            <TableRow key={t.id}>
                              <TableCell className="font-medium">
                                {t.language === "en" ? "English" : "Dari/Farsi"}
                              </TableCell>
                              <TableCell>{t.version}</TableCell>
                              <TableCell>
                                {t.isActive ? (
                                  <Badge variant="success">Active</Badge>
                                ) : (
                                  <Badge variant="outline">Inactive</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {t.notes || "-"}
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewTemplate(t.id)}
                                    disabled={viewingTemplateId === t.id}
                                  >
                                    {viewingTemplateId === t.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </Button>
                                  {!t.isActive && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                          try {
                                            const res = await fetch("/api/agreements/templates/set-active", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({
                                                templateId: t.id,
                                                language: t.language,
                                              }),
                                            });
                                            const json = await res.json();
                                            if (!res.ok || !json.success) {
                                              throw new Error(json.error || "Failed to activate");
                                            }
                                            setAllTemplates((prev) =>
                                              prev.map((tpl) =>
                                                tpl.language === t.language
                                                  ? { ...tpl, isActive: tpl.id === t.id }
                                                  : tpl
                                              )
                                            );
                                            toast.success(`Activated ${t.version}`);
                                          } catch (err) {
                                            toast.error(err instanceof Error ? err.message : "Failed to activate");
                                          }
                                        }}
                                      >
                                        Set Active
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteTemplate(t)}
                                        disabled={deletingTemplateId === t.id}
                                      >
                                        {deletingTemplateId === t.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-4 w-4 text-red-500" />
                                        )}
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {allTemplates.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                      <UploadCloud className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No templates uploaded yet</p>
                      <p className="text-sm">Upload your first agreement template below</p>
                    </div>
                  )}

                  {/* Upload Form */}
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center gap-2 mb-4">
                      <UploadCloud className="h-4 w-4" />
                      <span className="font-medium">Upload New Template</span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1">
                        <Label>Language</Label>
                        <Select
                          value={templateUpload.language}
                          onValueChange={(v) =>
                            setTemplateUpload((prev) => ({ ...prev, language: v as "en" | "fa" }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Language" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="fa">Dari/Farsi</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Version</Label>
                        <Input
                          value={templateUpload.version}
                          onChange={(e) =>
                            setTemplateUpload((prev) => ({ ...prev, version: e.target.value }))
                          }
                          placeholder="e.g. v1.0"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Notes (optional)</Label>
                        <Input
                          value={templateUpload.notes}
                          onChange={(e) =>
                            setTemplateUpload((prev) => ({ ...prev, notes: e.target.value }))
                          }
                          placeholder="e.g. Updated terms"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>PDF File</Label>
                        <Input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) =>
                            setTemplateUpload((prev) => ({
                              ...prev,
                              file: e.target.files?.[0] || null,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Button
                        onClick={async () => {
                          if (!templateUpload.file) {
                            toast.error("Select a PDF to upload");
                            return;
                          }
                          setUploadingTemplate(true);
                          try {
                            const formData = new FormData();
                            formData.append("file", templateUpload.file);
                            formData.append("language", templateUpload.language);
                            formData.append("version", templateUpload.version);
                            formData.append("notes", templateUpload.notes);

                            const res = await fetch("/api/agreements/templates/upload", {
                              method: "POST",
                              body: formData,
                            });
                            const json = await res.json();
                            if (!res.ok || !json.success) {
                              throw new Error(json.error || "Upload failed");
                            }

                            const newTemplate: AgreementTemplate = json.template;
                            setAllTemplates((prev) => [newTemplate, ...prev]);
                            setTemplateUpload((prev) => ({
                              ...prev,
                              file: null,
                              version: "",
                              notes: "",
                            }));
                            toast.success("Template uploaded and activated");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Upload failed");
                          } finally {
                            setUploadingTemplate(false);
                          }
                        }}
                        disabled={uploadingTemplate || !templateUpload.file}
                      >
                        {uploadingTemplate ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <UploadCloud className="h-4 w-4 mr-2" />
                            Upload & Activate
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Stripe Tab */}
            <TabsContent value="stripe">
              <div className="space-y-6">
                {/* Connection Status Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Stripe Connect</CardTitle>
                    <CardDescription>
                      Your organization's payment processing connection
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${organization.stripeOnboarded ? "bg-green-500" : "bg-yellow-500"}`} />
                        <div>
                          <p className="font-medium">
                            {organization.stripeOnboarded ? "Connected" : "Not Connected"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {organization.stripeOnboarded
                              ? "Ready to accept payments"
                              : "Contact support to connect your Stripe account"}
                          </p>
                        </div>
                      </div>
                      {organization.stripeConnectId && (
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {organization.stripeConnectId}
                        </code>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Fee Settings Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Fee Settings</CardTitle>
                    <CardDescription>
                      Configure how processing fees are handled
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Pass Fees Toggle */}
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">Pass fees to members</p>
                          <p className="text-sm text-muted-foreground">
                            {organization.passFeesToMember
                              ? "Members pay processing fees on top of their dues"
                              : "Your organization absorbs all processing fees"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {savingFeeSettings && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          <Switch
                            checked={organization.passFeesToMember}
                            onCheckedChange={handleTogglePassFees}
                            disabled={savingFeeSettings}
                          />
                        </div>
                      </div>

                      {/* Fee Breakdown */}
                      <div className="border rounded-lg divide-y">
                        <div className="flex justify-between items-center p-4">
                          <div>
                            <p className="font-medium">Stripe Processing</p>
                            <p className="text-sm text-muted-foreground">
                              Standard card processing fee
                            </p>
                          </div>
                          <p className="font-mono text-sm">2.9% + $0.30</p>
                        </div>
                        <div className="flex justify-between items-center p-4">
                          <div>
                            <p className="font-medium">Platform Fee</p>
                            <p className="text-sm text-muted-foreground">
                              Amanah Logic service fee
                            </p>
                          </div>
                          <p className="font-mono text-sm">${organization.platformFee.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Example Calculation - Dynamic based on setting */}
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm font-medium mb-3">
                          Example: $50 dues {organization.passFeesToMember && "(fees passed to member)"}
                        </p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Dues amount</span>
                            <span>$50.00</span>
                          </div>
                          {organization.passFeesToMember ? (
                            <>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">+ Processing fees</span>
                                <span>+${(1.75 + organization.platformFee).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between pt-2 border-t">
                                <span className="font-medium">Member pays</span>
                                <span className="font-medium">${(50 + 1.75 + organization.platformFee + 0.08).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-muted-foreground">
                                <span>Stripe keeps</span>
                                <span>-$1.83</span>
                              </div>
                              <div className="flex justify-between text-muted-foreground">
                                <span>Platform keeps</span>
                                <span>-${organization.platformFee.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between pt-2 border-t font-medium">
                                <span>You receive</span>
                                <span className="text-green-600">$50.00</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between pt-2 border-t">
                                <span className="font-medium">Member pays</span>
                                <span className="font-medium">$50.00</span>
                              </div>
                              <div className="flex justify-between text-muted-foreground">
                                <span>Stripe fee (2.9% + $0.30)</span>
                                <span className="text-red-600">-$1.75</span>
                              </div>
                              <div className="flex justify-between text-muted-foreground">
                                <span>Platform fee</span>
                                <span className="text-red-600">-${organization.platformFee.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between pt-2 border-t font-medium">
                                <span>You receive</span>
                                <span className="text-green-600">
                                  ${(50 - 1.75 - organization.platformFee).toFixed(2)}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {organization.passFeesToMember
                          ? "Members will see the fee breakdown when making payments. You receive the full dues amount."
                          : "Fees are automatically deducted from each transaction. You receive the net amount."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
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
                  {allEmailTemplates.map((template) => (
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
          )}
        </div>
      </div>

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
