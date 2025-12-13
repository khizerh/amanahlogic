import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "fs/promises";
import { join } from "path";

import type { Agreement } from "@/lib/types";

// PDF template paths (relative to project root)
const TEMPLATES = {
  en: "public/Masjid Muhajireen Agreement.pdf",
  fa: "public/Masjid Muhajireen Bylaws 2 (Dari).pdf",
} as const;

interface StampAgreementOptions {
  agreement: Agreement;
  member: { id: string; name: string };
  signatureImageDataUrl: string;
  ipAddress?: string;
  userAgent?: string;
  consentChecked?: boolean;
  signedAt: string;
  language: "en" | "fa";
}

/**
 * Load the PDF template and stamp signature + audit info onto it.
 *
 * English: 4 pages, signature section on page 4
 * Dari: 2 pages, we add a signature page
 */
export async function stampAgreementPdf(options: StampAgreementOptions): Promise<Uint8Array> {
  const templatePath = join(process.cwd(), TEMPLATES[options.language]);
  const templateBytes = await readFile(templatePath);

  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Embed signature image
  const signatureImage = await pdfDoc.embedPng(options.signatureImageDataUrl);

  // Format the date nicely
  const signedDate = new Date(options.signedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (options.language === "en") {
    await stampEnglishPdf(pdfDoc, signatureImage, font, fontBold, {
      ...options,
      signedDate,
    });
  } else {
    await stampDariPdf(pdfDoc, signatureImage, font, fontBold, {
      ...options,
      signedDate,
    });
  }

  return pdfDoc.save();
}

/**
 * Stamp signature on page 4 of English PDF
 * Page 4 has signature section in the top 1/3
 */
async function stampEnglishPdf(
  pdfDoc: PDFDocument,
  signatureImage: Awaited<ReturnType<typeof pdfDoc.embedPng>>,
  font: Awaited<ReturnType<typeof pdfDoc.embedFont>>,
  fontBold: Awaited<ReturnType<typeof pdfDoc.embedFont>>,
  options: StampAgreementOptions & { signedDate: string }
) {
  const pages = pdfDoc.getPages();
  const signaturePage = pages[3]; // Page 4 (0-indexed)
  const { height } = signaturePage.getSize();

  // Signature line is approximately at y=580 from bottom (top 1/3 of page)
  // "Member Signature: ___" line
  const sigLineY = height - 220; // ~572 on letter size
  const dateLineY = sigLineY - 50; // Date line below signature

  // Draw signature image (scale to reasonable size)
  const sigDims = signatureImage.scale(0.4);
  const maxSigWidth = 200;
  const scale = sigDims.width > maxSigWidth ? maxSigWidth / sigDims.width : 1;

  signaturePage.drawImage(signatureImage, {
    x: 180, // After "Member Signature:" label
    y: sigLineY - 30, // Slightly below the line text
    width: sigDims.width * scale,
    height: sigDims.height * scale,
  });

  // Draw the date
  signaturePage.drawText(options.signedDate, {
    x: 100, // After "Date:" label
    y: dateLineY + 5,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  // Add audit trail at bottom of page 4
  const auditY = 80;
  signaturePage.drawText("Electronic Signature Verification", {
    x: 50,
    y: auditY + 40,
    size: 9,
    font: fontBold,
    color: rgb(0.3, 0.3, 0.3),
  });

  signaturePage.drawText(`Signed by: ${options.member.name}`, {
    x: 50,
    y: auditY + 25,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  signaturePage.drawText(`Date/Time: ${options.signedAt}`, {
    x: 50,
    y: auditY + 12,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  const auditLine2 = `IP: ${options.ipAddress || "N/A"} | Consent: ${options.consentChecked ? "Yes" : "No"}`;
  signaturePage.drawText(auditLine2, {
    x: 50,
    y: auditY,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Truncate user agent if too long
  const ua = options.userAgent || "N/A";
  const truncatedUa = ua.length > 80 ? ua.substring(0, 77) + "..." : ua;
  signaturePage.drawText(`Browser: ${truncatedUa}`, {
    x: 50,
    y: auditY - 12,
    size: 7,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
}

/**
 * Add signature page to Dari PDF (originally 2 pages)
 */
async function stampDariPdf(
  pdfDoc: PDFDocument,
  signatureImage: Awaited<ReturnType<typeof pdfDoc.embedPng>>,
  font: Awaited<ReturnType<typeof pdfDoc.embedFont>>,
  fontBold: Awaited<ReturnType<typeof pdfDoc.embedFont>>,
  options: StampAgreementOptions & { signedDate: string }
) {
  // Add a new signature page
  const signaturePage = pdfDoc.addPage([612, 792]); // US Letter
  const { width, height } = signaturePage.getSize();

  // Header - center aligned
  signaturePage.drawText("SIGNATURE / امضاء", {
    x: width / 2 - 80,
    y: height - 100,
    size: 18,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  // Agreement text (bilingual)
  signaturePage.drawText("I agree to the terms and conditions of this membership agreement.", {
    x: 50,
    y: height - 160,
    size: 11,
    font,
    color: rgb(0, 0, 0),
  });

  signaturePage.drawText("من با شرایط و مقررات این قرارداد عضویت موافقم.", {
    x: 50,
    y: height - 180,
    size: 11,
    font,
    color: rgb(0, 0, 0),
  });

  // Signature label
  signaturePage.drawText("Member Signature / امضای عضو:", {
    x: 50,
    y: height - 240,
    size: 12,
    font: fontBold,
  });

  // Draw signature image
  const sigDims = signatureImage.scale(0.4);
  const maxSigWidth = 250;
  const scale = sigDims.width > maxSigWidth ? maxSigWidth / sigDims.width : 1;

  signaturePage.drawImage(signatureImage, {
    x: 50,
    y: height - 320,
    width: sigDims.width * scale,
    height: sigDims.height * scale,
  });

  // Signed name
  signaturePage.drawText(`Name / نام: ${options.member.name}`, {
    x: 50,
    y: height - 360,
    size: 12,
    font,
  });

  // Date
  signaturePage.drawText(`Date / تاریخ: ${options.signedDate}`, {
    x: 50,
    y: height - 385,
    size: 12,
    font,
  });

  // Audit trail section
  const auditY = 120;
  signaturePage.drawLine({
    start: { x: 50, y: auditY + 60 },
    end: { x: width - 50, y: auditY + 60 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });

  signaturePage.drawText("Electronic Signature Verification", {
    x: 50,
    y: auditY + 40,
    size: 9,
    font: fontBold,
    color: rgb(0.3, 0.3, 0.3),
  });

  signaturePage.drawText(`Signed: ${options.signedAt}`, {
    x: 50,
    y: auditY + 25,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  signaturePage.drawText(`IP: ${options.ipAddress || "N/A"} | Consent checkbox: ${options.consentChecked ? "Yes" : "No"}`, {
    x: 50,
    y: auditY + 10,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  const ua = options.userAgent || "N/A";
  const truncatedUa = ua.length > 100 ? ua.substring(0, 97) + "..." : ua;
  signaturePage.drawText(`Browser: ${truncatedUa}`, {
    x: 50,
    y: auditY - 5,
    size: 7,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Footer
  signaturePage.drawText("This document is electronically signed and legally binding under ESIGN/UETA.", {
    x: 50,
    y: 50,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
}
