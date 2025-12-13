export interface SignAgreementPayload {
  token: string;
  signedName: string;
  signatureDataUrl: string;
  ipAddress?: string;
  userAgent?: string;
  consentChecked?: boolean;
  language?: "en" | "fa";
}

export function validateSignaturePayload(payload: SignAgreementPayload): string | null {
  if (!payload.token) return "Missing token";
  if (!payload.signedName || payload.signedName.trim().length < 2) return "Signed name is required";
  if (!payload.signatureDataUrl || !payload.signatureDataUrl.startsWith("data:image/")) {
    return "Signature image is required";
  }
  return null;
}
