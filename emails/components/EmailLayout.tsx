import * as React from "react";
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Hr,
  Section,
  Button,
  Link,
} from "@react-email/components";

export interface EmailLayoutProps {
  title: string;
  previewText?: string;
  greeting?: string | null;
  children: React.ReactNode;
  cta?: {
    label: string;
    url: string;
  } | null;
  afterCta?: React.ReactNode;
  footer?: {
    organization_name?: string | null;
    organization_email?: string | null;
    organization_phone?: string | null;
  } | null;
}

export function EmailLayout(props: EmailLayoutProps) {
  const { title, previewText, greeting, children, cta, afterCta, footer } = props;
  return (
    <Html>
      <Head>
        <title>{title}</title>
        {/* Force light mode in email clients */}
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light only" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <style>{`
          /* Force light mode - prevent email clients from inverting colors */
          :root {
            color-scheme: light only;
            supported-color-schemes: light only;
          }

          @media (prefers-color-scheme: dark) {
            .email-container,
            .email-outer-wrapper,
            body {
              background-color: #f8fafc !important;
              color: #0f172a !important;
            }
          }

          @media only screen and (max-width: 600px) {
            .email-container {
              width: 100% !important;
              padding: 20px !important;
              border-radius: 0 !important;
            }
            .email-heading {
              font-size: 20px !important;
            }
            .email-cta-button {
              display: block !important;
              width: 100% !important;
              max-width: 100% !important;
              text-align: center !important;
              padding: 14px 20px !important;
              margin-left: 0 !important;
              margin-right: 0 !important;
              box-sizing: border-box !important;
            }
            .email-outer-wrapper {
              padding-top: 0 !important;
              padding-bottom: 0 !important;
            }
            .invoice-details {
              padding: 16px !important;
            }
            .invoice-table td {
              font-size: 14px !important;
            }
          }
        `}</style>
      </Head>
      <Preview>{previewText ?? title}</Preview>
      <Body style={styles.body}>
        <Section style={styles.outerWrapper} className="email-outer-wrapper">
          <Container style={styles.container} className="email-container">
            <Heading style={styles.heading} className="email-heading">
              {title}
            </Heading>
            {greeting ? <Text style={styles.greeting}>{greeting}</Text> : null}
            {children}
            {cta ? (
              <Button href={cta.url} style={styles.ctaButton} className="email-cta-button">
                {cta.label}
              </Button>
            ) : null}
            {afterCta}
            <Hr style={styles.divider} />
            {footer?.organization_email ? (
              <Text style={styles.footer}>{footer.organization_email}</Text>
            ) : null}
            {footer?.organization_phone ? (
              <Text style={styles.footer}>Phone: {footer.organization_phone}</Text>
            ) : null}
          </Container>
        </Section>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    margin: 0,
    padding: 0,
    backgroundColor: "#f8fafc",
    fontFamily: "'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#0f172a",
  },
  outerWrapper: {
    paddingTop: "40px",
    paddingBottom: "40px",
  },
  container: {
    maxWidth: "600px",
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    padding: "32px",
    margin: "0 auto",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 25px rgba(15,23,42,0.08)",
  },
  heading: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 700,
    color: "#0f172a",
  },
  greeting: {
    marginTop: "20px",
    marginBottom: "8px",
    fontSize: "16px",
    fontWeight: 400,
    lineHeight: 1.6,
    color: "#1f2937",
  },
  content: {
    marginTop: "16px",
    fontSize: "16px",
    lineHeight: 1.6,
    color: "#1f2937",
  },
  ctaButton: {
    display: "inline-block",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    padding: "12px 20px",
    borderRadius: "8px",
    marginTop: "24px",
    textDecoration: "none",
    fontWeight: 500,
  },
  divider: {
    marginTop: "32px",
    marginBottom: "32px",
    border: "none",
    borderTop: "1px solid #e2e8f0",
  },
  footer: {
    margin: 0,
    marginTop: "4px",
    fontSize: "14px",
    color: "#475569",
  },
} as const;

export function EmailTextLayout(props: {
  greeting?: string | null;
  lines: (string | null | false | undefined)[];
  cta?: { label: string; url: string } | null;
  footer?: {
    organization_name?: string | null;
    organization_email?: string | null;
    organization_phone?: string | null;
  } | null;
}) {
  const output: string[] = [];
  if (props.greeting) {
    output.push(props.greeting, "");
  }
  for (const line of props.lines) {
    if (!line) continue;
    output.push(line);
  }
  if (props.cta) {
    output.push("", `${props.cta.label}: ${props.cta.url}`);
  }
  const footer = props.footer ?? {};
  const footerLines = [
    footer.organization_name,
    footer.organization_email ? `Email: ${footer.organization_email}` : null,
    footer.organization_phone ? `Phone: ${footer.organization_phone}` : null,
  ].filter(Boolean) as string[];
  if (footerLines.length > 0) {
    output.push("", ...footerLines);
  }
  return output.join("\n");
}
