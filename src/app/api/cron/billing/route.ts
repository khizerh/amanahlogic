import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { processRecurringBilling } from "@/lib/billing/engine";

/**
 * Billing Cron Endpoint
 * Triggered hourly by Vercel Cron
 * Processes recurring billing for organizations at midnight in their timezone
 */
async function processBillingCron(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Validate cron authentication
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      logger.error("CRON_SECRET not configured", {});
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn("Unauthorized cron access attempt", {});
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.info("Starting billing run", {});

    // Use service role key to bypass RLS for cron job
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      logger.error("SUPABASE_SERVICE_ROLE_KEY not configured", {});
      return NextResponse.json(
        { error: "Server configuration error - missing service role key" },
        { status: 500 }
      );
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 2. Get all active organizations with timezone info
    const { data: organizations, error: queryError } = await supabase
      .from("organizations")
      .select("id, name, timezone")
      .eq("active", true);

    if (queryError) {
      throw new Error(`Failed to query organizations: ${queryError.message}`);
    }

    if (!organizations || organizations.length === 0) {
      logger.info("No active organizations found", {});
      return NextResponse.json({
        success: true,
        message: "No active organizations to process",
        timestamp: new Date().toISOString(),
        results: {},
        summary: {
          organizationsProcessed: 0,
          successful: 0,
          failed: 0,
          totalInvoices: 0,
        },
      });
    }

    logger.info("Found active organizations", { count: organizations.length });

    // 3. Process each organization if it's midnight in their timezone
    const results: Record<string, unknown> = {};
    let organizationsProcessed = 0;
    let successful = 0;
    let failed = 0;
    let totalInvoices = 0;

    for (const org of organizations) {
      try {
        // Check if it's midnight (hour 0) in this organization's timezone
        const timeZone = org.timezone || "America/Los_Angeles";
        const now = new Date();
        const hourStr = now.toLocaleString("en-US", {
          timeZone,
          hour: "numeric",
          hour12: false,
        });
        const currentHour = Number.parseInt(hourStr, 10);
        const localDateStr = now.toLocaleDateString("en-CA", {
          timeZone,
        }); // YYYY-MM-DD

        const isMidnight = Number.isInteger(currentHour) && currentHour === 0;

        logger.info("Checking organization billing schedule", {
          orgName: org.name,
          timeZone,
          hour: Number.isNaN(currentHour) ? "NaN" : currentHour,
          localDate: localDateStr,
        });

        let shouldRun = isMidnight;

        if (!shouldRun) {
          // Fallback: if we missed the midnight window, run whenever memberships are overdue
          const { data: dueMemberships, error: dueError } = await supabase
            .from("memberships")
            .select("id")
            .eq("organization_id", org.id)
            .eq("status", "active")
            .not("next_billing_date", "is", null)
            .lte("next_billing_date", localDateStr)
            .limit(1);

          if (dueError) {
            throw new Error(`Failed to check overdue memberships: ${dueError.message}`);
          }

          if (dueMemberships && dueMemberships.length > 0) {
            shouldRun = true;
            logger.info("Catch-up billing triggered (overdue memberships detected)", {
              orgName: org.name,
            });
          }
        }

        if (!shouldRun) {
          logger.info("Skipping organization - not midnight and no overdue memberships", {
            orgName: org.name,
          });
          continue;
        }

        logger.info("Processing organization", { orgName: org.name });
        organizationsProcessed++;

        // Call billing engine with service-role client and local date
        const billingResult = await processRecurringBilling(org.id, {
          supabase,
          billingDate: localDateStr,
        });

        results[org.id] = {
          organization_name: org.name,
          ...billingResult,
        };

        if (billingResult.success) {
          successful++;
          totalInvoices += billingResult.paymentsCreated;
          logger.info("Billing successful", {
            orgName: org.name,
            paymentsCreated: billingResult.paymentsCreated,
          });
        } else {
          failed++;
          logger.error("Billing failed", {
            orgName: org.name,
            errorCount: billingResult.errors.length,
          });
        }
      } catch (orgError) {
        failed++;
        const errorMessage = orgError instanceof Error ? orgError.message : String(orgError);
        logger.error("Organization processing failed", {
          orgName: org.name,
          error: errorMessage,
        });
        results[org.id] = {
          organization_name: org.name,
          success: false,
          error: errorMessage,
          paymentsCreated: 0,
          errors: [],
        };
      }
    }

    const duration = Date.now() - startTime;

    // 4. Log results to console (TODO: Add database logging later)
    logger.info("Billing run complete", {
      organizationsProcessed,
      successful,
      failed,
      totalInvoices,
      durationMs: duration,
    });

    // 5. Return summary
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        organizationsProcessed,
        successful,
        failed,
        totalInvoices,
        durationMs: duration,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error("Fatal billing cron error", { error });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Vercel Cron uses GET requests
export async function GET(request: NextRequest) {
  return processBillingCron(request);
}

// Keep POST for backwards compatibility
export async function POST(request: NextRequest) {
  return processBillingCron(request);
}
