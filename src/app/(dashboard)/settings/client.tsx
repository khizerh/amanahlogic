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
  UploadCloud,
  Loader2,
  Languages,
  Trash2,
  Mail,
} from "lucide-react";
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


  // Email template preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [previewLanguage, setPreviewLanguage] = useState<"en" | "fa">("en");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const handlePreviewTemplate = async (template: EmailTemplate, lang: "en" | "fa" = "en") => {
    setPreviewTemplate(template);
    setPreviewLanguage(lang);
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/email-templates/preview?type=${template.type}&language=${lang}`);
      if (!res.ok) throw new Error("Failed to load preview");
      const html = await res.text();
      setPreviewHtml(html);
    } catch {
      setPreviewHtml("<p style='padding:20px;color:#666'>Failed to load preview</p>");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePreviewLanguageChange = async (lang: "en" | "fa") => {
    if (!previewTemplate || lang === previewLanguage) return;
    setPreviewLanguage(lang);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/email-templates/preview?type=${previewTemplate.type}&language=${lang}`);
      if (!res.ok) throw new Error("Failed to load preview");
      const html = await res.text();
      setPreviewHtml(html);
    } catch {
      setPreviewHtml("<p style='padding:20px;color:#666'>Failed to load preview</p>");
    } finally {
      setPreviewLoading(false);
    }
  };

  // View/delete template loading state
  const [viewingTemplateId, setViewingTemplateId] = useState<string | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  // Handle deleting an agreement template
  const handleDeleteTemplate = async (template: AgreementTemplate) => {
    const warningMessage = template.isActive
      ? `WARNING: "${template.version}" is the active ${template.language === "en" ? "English" : "Dari/Farsi"} template. Deleting it means new agreements cannot be sent in this language until you upload a new template.\n\nDelete anyway?`
      : `Delete template "${template.version}"? This cannot be undone.`;

    if (!confirm(warningMessage)) {
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
          ? "Stripe processing fees will now be added to member payments"
          : "Organization will now absorb Stripe processing fees"
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
                                  )}
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
                          <p className="font-medium">Pass Stripe processing fees to members</p>
                          <p className="text-sm text-muted-foreground">
                            {organization.passFeesToMember
                              ? "Members pay Stripe processing fees on top of their dues"
                              : "Your organization absorbs Stripe processing fees. The platform fee is always included in member payments."}
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
                              Amanah Logic service fee — always included in member payments
                            </p>
                          </div>
                          <p className="font-mono text-sm">${organization.platformFee.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Example Calculation - Dynamic based on setting */}
                      {(() => {
                        const baseDues = 50;
                        const baseCents = baseDues * 100;
                        const platformFeeCents = Math.round(organization.platformFee * 100);
                        const stripePercent = 0.029;
                        const stripeFixed = 30; // cents

                        if (organization.passFeesToMember) {
                          // Gross-up: charge = (base + platformFee + stripeFixed) / (1 - stripePercent)
                          const chargeCents = Math.ceil(
                            (baseCents + platformFeeCents + stripeFixed) / (1 - stripePercent)
                          );
                          const stripeFeeCents = Math.round(chargeCents * stripePercent) + stripeFixed;
                          const chargeAmount = chargeCents / 100;
                          const stripeFee = stripeFeeCents / 100;
                          const totalFees = stripeFee + organization.platformFee;

                          return (
                            <div className="p-4 bg-muted/50 rounded-lg">
                              <p className="text-sm font-medium mb-3">
                                Example: ${baseDues} dues (fees passed to member)
                              </p>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Dues amount</span>
                                  <span>${baseDues.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">+ Processing fees</span>
                                  <span>+${totalFees.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t">
                                  <span className="font-medium">Member pays</span>
                                  <span className="font-medium">${chargeAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Stripe keeps</span>
                                  <span>-${stripeFee.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Platform keeps</span>
                                  <span>-${organization.platformFee.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t font-medium">
                                  <span>You receive</span>
                                  <span className="text-green-600">${baseDues.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        } else {
                          // Standard: org absorbs Stripe fees, platform fee always passed to member
                          const chargeCents = baseCents + platformFeeCents;
                          const chargeAmount = chargeCents / 100;
                          const stripeFeeCents = Math.round(chargeCents * stripePercent) + stripeFixed;
                          const stripeFee = stripeFeeCents / 100;
                          const netAmount = baseDues - stripeFee;

                          return (
                            <div className="p-4 bg-muted/50 rounded-lg">
                              <p className="text-sm font-medium mb-3">
                                Example: ${baseDues} dues (org absorbs Stripe fees)
                              </p>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Dues amount</span>
                                  <span>${baseDues.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">+ Platform fee</span>
                                  <span>+${organization.platformFee.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t">
                                  <span className="font-medium">Member pays</span>
                                  <span className="font-medium">${chargeAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Stripe fee (2.9% + $0.30)</span>
                                  <span className="text-red-600">-${stripeFee.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Platform fee (to Amanah Logic)</span>
                                  <span className="text-red-600">-${organization.platformFee.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t font-medium">
                                  <span>You receive</span>
                                  <span className="text-green-600">${netAmount.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                      })()}

                      <p className="text-xs text-muted-foreground">
                        The ${organization.platformFee.toFixed(2)} platform fee is always included in member payments.{" "}
                        {organization.passFeesToMember
                          ? "Stripe processing fees are also passed to members. You receive the full dues amount."
                          : "Stripe processing fees are deducted from each transaction. You receive the net amount after Stripe fees."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Email Templates Tab */}
            <TabsContent value="emails">
              <div className="space-y-6">
                {/* Email Sender Configuration */}
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50/50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-blue-600" />
                      Email Sender Configuration
                    </CardTitle>
                    <CardDescription>
                      How your organization&apos;s emails appear to members
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-muted-foreground text-xs uppercase tracking-wide">From</Label>
                          <div className="p-3 bg-muted rounded-lg font-mono text-sm">
                            &quot;{organization.name}&quot; &lt;{organization.slug}@amanahlogic.com&gt;
                          </div>
                          <p className="text-xs text-muted-foreground">
                            This is what members see as the sender
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground text-xs uppercase tracking-wide">Reply-To</Label>
                          <div className="p-3 bg-muted rounded-lg font-mono text-sm">
                            {organization.email || <span className="text-muted-foreground italic">Not set - update in Organization tab</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            When members reply, it goes to your contact email
                          </p>
                        </div>
                      </div>
                      {!organization.email && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                          Set your contact email in the Organization tab so members can reply to your emails.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div>
                  <h3 className="text-lg font-semibold">Email Templates</h3>
                  <p className="text-sm text-muted-foreground">
                    Automated emails sent to members at key moments
                  </p>
                </div>

                <div className="grid gap-4">
                  {emailTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className="cursor-pointer transition-colors hover:border-brand-teal/40"
                      onClick={() => handlePreviewTemplate(template)}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                              <h4 className="font-semibold">{template.name}</h4>
                              <Badge variant="outline">
                                {getEmailTemplateTypeLabel(template.type)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{template.description}</p>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Eye className="h-4 w-4" />
                            Preview
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

      {/* Email Template Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>{previewTemplate?.name}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">{previewTemplate?.description}</p>
              </div>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <button
                  type="button"
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    previewLanguage === "en"
                      ? "bg-background shadow-sm font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => handlePreviewLanguageChange("en")}
                >
                  English
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    previewLanguage === "fa"
                      ? "bg-background shadow-sm font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => handlePreviewLanguageChange("fa")}
                >
                  فارسی
                </button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-gray-100 p-4">
            {previewLoading ? (
              <div className="flex items-center justify-center h-96">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[600px] bg-white rounded-lg shadow-sm border-0"
                title="Email preview"
                sandbox=""
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
