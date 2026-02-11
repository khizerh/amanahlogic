"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface ParsedChild {
  name: string;
  dateOfBirth: string;
}

interface ParsedMember {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  spouseName?: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  preferredLanguage: "en" | "fa";
  planType: "single" | "married" | "widow";
  billingFrequency: "monthly" | "biannual" | "annual";
  waiveEnrollmentFee: boolean;
  children: ParsedChild[];
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportMembersDialogProps {
  trigger: React.ReactNode;
}

const REQUIRED_COLUMNS = [
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "street", label: "Street" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP" },
  { key: "emergency_contact_name", label: "Emergency Contact Name" },
  { key: "emergency_contact_phone", label: "Emergency Contact Phone" },
  { key: "plan_type", label: "Plan Type" },
  { key: "billing_frequency", label: "Billing Frequency" },
];

const OPTIONAL_COLUMNS = [
  { key: "spouse_name", label: "Spouse Name" },
  { key: "preferred_language", label: "Preferred Language" },
  { key: "waive_enrollment_fee", label: "Waive Enrollment Fee" },
  { key: "child1_name", label: "Child 1 Name" },
  { key: "child1_dob", label: "Child 1 DOB" },
  { key: "child2_name", label: "Child 2 Name" },
  { key: "child2_dob", label: "Child 2 DOB" },
  { key: "child3_name", label: "Child 3 Name" },
  { key: "child3_dob", label: "Child 3 DOB" },
  { key: "child4_name", label: "Child 4 Name" },
  { key: "child4_dob", label: "Child 4 DOB" },
];

export function ImportMembersDialog({ trigger }: ImportMembersDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedMember[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);

  const resetState = () => {
    setFile(null);
    setParsedData([]);
    setErrors([]);
    setImportResult(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetState();
    }
  };

  const downloadTemplate = () => {
    const headers = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].map(c => c.key).join(",");
    const exampleRow = [
      "John",
      "Doe",
      "john.doe@email.com",
      "(555) 123-4567",
      "123 Main St",
      "Hayward",
      "CA",
      "94544",
      "Jane Doe",
      "(555) 987-6543",
      "married",
      "monthly",
      "Sarah Doe",
      "en",
      "no",
      "Ahmed Doe",
      "2015-03-15",
      "Fatima Doe",
      "2018-07-22",
      "",
      "",
      "",
      "",
    ].join(",");

    const csv = `${headers}\n${exampleRow}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "member-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): { data: ParsedMember[]; errors: ValidationError[] } => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) {
      return { data: [], errors: [{ row: 0, field: "file", message: "CSV must have a header row and at least one data row" }] };
    }

    const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
    const data: ParsedMember[] = [];
    const errors: ValidationError[] = [];

    // Validate required columns exist
    for (const required of REQUIRED_COLUMNS) {
      if (!headers.includes(required.key)) {
        errors.push({ row: 0, field: required.key, message: `Missing required column: ${required.label}` });
      }
    }

    if (errors.length > 0) {
      return { data, errors };
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};

      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || "";
      });

      // Validate required fields
      const rowErrors: ValidationError[] = [];

      if (!row.first_name) rowErrors.push({ row: i, field: "first_name", message: "First name is required" });
      if (!row.last_name) rowErrors.push({ row: i, field: "last_name", message: "Last name is required" });
      if (!row.email) rowErrors.push({ row: i, field: "email", message: "Email is required" });
      if (!row.email?.includes("@")) rowErrors.push({ row: i, field: "email", message: "Invalid email format" });
      if (!row.phone) rowErrors.push({ row: i, field: "phone", message: "Phone is required" });
      if (!row.street) rowErrors.push({ row: i, field: "street", message: "Street is required" });
      if (!row.city) rowErrors.push({ row: i, field: "city", message: "City is required" });
      if (!row.state) rowErrors.push({ row: i, field: "state", message: "State is required" });
      if (!row.zip) rowErrors.push({ row: i, field: "zip", message: "ZIP is required" });
      if (!row.emergency_contact_name) rowErrors.push({ row: i, field: "emergency_contact_name", message: "Emergency contact name is required" });
      if (!row.emergency_contact_phone) rowErrors.push({ row: i, field: "emergency_contact_phone", message: "Emergency contact phone is required" });

      const planType = row.plan_type?.toLowerCase();
      if (!["single", "married", "widow"].includes(planType)) {
        rowErrors.push({ row: i, field: "plan_type", message: "Plan type must be: single, married, or widow" });
      }

      const billingFreq = row.billing_frequency?.toLowerCase();
      if (!billingFreq) {
        rowErrors.push({ row: i, field: "billing_frequency", message: "Billing frequency is required" });
      } else if (!["monthly", "biannual", "annual"].includes(billingFreq)) {
        rowErrors.push({ row: i, field: "billing_frequency", message: "Billing frequency must be: monthly, biannual, or annual" });
      }

      const language = row.preferred_language?.toLowerCase() || "en";
      if (!["en", "fa"].includes(language)) {
        rowErrors.push({ row: i, field: "preferred_language", message: "Language must be: en or fa" });
      }

      // Parse waive enrollment fee (yes/true/1 = waive, anything else = charge)
      const waiveEnrollmentRaw = row.waive_enrollment_fee?.toLowerCase().trim();
      const waiveEnrollmentFee = ["yes", "true", "1", "y"].includes(waiveEnrollmentRaw);

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      } else {
        // Parse children
        const children: ParsedChild[] = [];
        for (let c = 1; c <= 4; c++) {
          const childName = row[`child${c}_name`];
          const childDob = row[`child${c}_dob`];
          if (childName && childName.trim()) {
            children.push({
              name: childName.trim(),
              dateOfBirth: childDob?.trim() || "",
            });
          }
        }

        data.push({
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
          phone: row.phone,
          street: row.street,
          city: row.city,
          state: row.state,
          zip: row.zip,
          spouseName: row.spouse_name || undefined,
          emergencyContactName: row.emergency_contact_name,
          emergencyContactPhone: row.emergency_contact_phone,
          preferredLanguage: language as "en" | "fa",
          planType: planType as "single" | "married" | "widow",
          billingFrequency: billingFreq as "monthly" | "biannual" | "annual",
          waiveEnrollmentFee,
          children,
        });
      }
    }

    return { data, errors };
  };

  // Handle CSV values that might contain commas (quoted)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);

    return result;
  };

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    setFile(file);
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { data, errors } = parseCSV(text);
      setParsedData(data);
      setErrors(errors);
    };

    reader.readAsText(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }, [handleFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;

    setIsImporting(true);

    try {
      const response = await fetch("/api/members/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: parsedData }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Import failed");
      }

      setImportResult({
        success: result.imported,
        failed: result.failed,
      });

      if (result.imported > 0) {
        toast.success(`Successfully imported ${result.imported} member(s)`);
        router.refresh();
      }

      if (result.errors?.length > 0) {
        setErrors(result.errors.map((e: string, i: number) => ({
          row: i,
          field: "import",
          message: e,
        })));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Members
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import members into the system.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Required Columns Card */}
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-3 text-blue-900">Required Columns</h4>
            <p className="text-sm text-blue-700">
              {REQUIRED_COLUMNS.map(c => c.label).join(", ")}
            </p>
          </div>

          {/* Optional Columns Card */}
          <div className="border rounded-lg p-4">
            <h4 className="font-medium text-sm mb-3">Optional Columns</h4>
            <p className="text-sm text-muted-foreground">
              {OPTIONAL_COLUMNS.map(c => c.label).join(", ")}
            </p>
          </div>

          {/* Field Values */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-3">Field Values</h4>
            <ul className="list-disc ml-4 space-y-1.5 text-sm text-muted-foreground">
              <li><code className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-xs">Plan Type</code>: single, married, or widow</li>
              <li><code className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-xs">Billing Frequency</code>: monthly, biannual, or annual</li>
              <li><code className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-xs">Preferred Language</code>: en or fa (default: en)</li>
              <li><code className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-xs">Waive Enrollment Fee</code>: yes or no (default: no - they pay it)</li>
              <li><code className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-xs">Child DOB</code>: YYYY-MM-DD format (e.g., 2015-03-15)</li>
            </ul>
          </div>

          {/* Download Template */}
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>

          {/* Drop Zone */}
          {!file && !importResult && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors duration-200
                ${isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }
              `}
            >
              <Upload className={`h-10 w-10 mx-auto mb-4 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
              <p className="text-sm font-medium">
                {isDragging ? "Drop your CSV file here" : "Drag & drop your CSV file here"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          )}

          {/* File Selected */}
          {file && !importResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {parsedData.length} valid row(s) found
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={resetState}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Validation Errors */}
              {errors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-destructive mb-2">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium text-sm">Validation Errors ({errors.length})</span>
                  </div>
                  <ul className="text-sm text-destructive/80 space-y-1 max-h-32 overflow-y-auto">
                    {errors.slice(0, 10).map((error, i) => (
                      <li key={i}>
                        Row {error.row}: {error.message}
                      </li>
                    ))}
                    {errors.length > 10 && (
                      <li className="text-muted-foreground">...and {errors.length - 10} more errors</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              {parsedData.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 border-b">
                    <span className="text-sm font-medium">Preview ({parsedData.length} members)</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Kids</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.slice(0, 10).map((member, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">
                              {member.firstName} {member.lastName}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {member.email}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {member.planType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {member.children.length > 0 ? (
                                <Badge variant="secondary">
                                  {member.children.length} {member.children.length === 1 ? "child" : "children"}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {parsedData.length > 10 && (
                    <div className="bg-muted px-4 py-2 border-t text-xs text-muted-foreground text-center">
                      Showing 10 of {parsedData.length} members
                    </div>
                  )}
                </div>
              )}

              {/* Import Button */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={resetState}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={parsedData.length === 0 || isImporting}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import {parsedData.length} Member{parsedData.length !== 1 ? "s" : ""}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className="text-center py-6">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-600" />
              <h3 className="text-lg font-medium mb-2">Import Complete</h3>
              <p className="text-muted-foreground">
                Successfully imported {importResult.success} member{importResult.success !== 1 ? "s" : ""}.
                {importResult.failed > 0 && ` ${importResult.failed} failed.`}
              </p>
              <Button className="mt-4" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
