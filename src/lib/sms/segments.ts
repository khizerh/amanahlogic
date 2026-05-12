/**
 * SMS segment calculator. Matches what Twilio bills.
 *
 * GSM-7 single message: up to 160 chars
 * GSM-7 multi-part:     153 chars per segment (7 bytes UDH overhead)
 * UCS-2 single message: up to 70 chars
 * UCS-2 multi-part:     67 chars per segment
 *
 * Any character outside the GSM-7 default + extension set forces UCS-2 encoding
 * for the whole message. Persian / Arabic / emoji = UCS-2.
 */

// GSM-7 default alphabet (plus extension chars). Anything outside this set
// forces UCS-2.
const GSM7_RE = new RegExp(
  "^[" +
    "@£$¥èéùìòÇ\\n\\rØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,\\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà" +
    "{}\\[\\]~^|€\\\\" +
    "]*$"
);

export type SmsEncoding = "GSM-7" | "UCS-2";

export interface SegmentInfo {
  encoding: SmsEncoding;
  length: number;
  segments: number;
  perSegment: number;
}

export function detectEncoding(body: string): SmsEncoding {
  return GSM7_RE.test(body) ? "GSM-7" : "UCS-2";
}

export function calculateSegments(body: string): SegmentInfo {
  const length = body.length;
  const encoding = detectEncoding(body);

  if (encoding === "GSM-7") {
    if (length === 0) return { encoding, length: 0, segments: 0, perSegment: 160 };
    if (length <= 160) return { encoding, length, segments: 1, perSegment: 160 };
    return { encoding, length, segments: Math.ceil(length / 153), perSegment: 153 };
  }

  // UCS-2
  if (length === 0) return { encoding, length: 0, segments: 0, perSegment: 70 };
  if (length <= 70) return { encoding, length, segments: 1, perSegment: 70 };
  return { encoding, length, segments: Math.ceil(length / 67), perSegment: 67 };
}
