import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processOrganizationReminders } from "@/lib/billing/reminders";
import { logger } from "@/lib/logger";

/**
 * Payment Reminders Cron Endpoint
 * Triggered daily by Vercel Cron
 * Processes payment reminders for all active organizations
 */
async function processRemindersCron(request: NextRequest) {
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
      logger.warn("Unauthorized reminders cron access attempt", {});
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.info("Starting reminders run", {});

    // Use service role key to bypass RLS
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

    // 2. Get all active organizations
    const { data: organizations, error: queryError } = await supabase
      .from("organizations")
      .select("id, name")
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
        summary: {
          organizationsProcessed: 0,
          totalRemindersQueued: 0,
          totalMarkedForReview: 0,
          totalErrors: 0,
        },
      });
    }

    logger.info("Found active organizations for reminders", { count: organizations.length });

    // 3. Process each organization
    const results: Record<string, unknown> = {};
    let totalRemindersQueued = 0;
    let totalMarkedForReview = 0;
    let totalErrors = 0;

    for (const org of organizations) {
      try {
        logger.info("Processing organization reminders", { orgName: org.name });

        const result = await processOrganizationReminders(org.id, supabase);

        results[org.id] = {
          organization_name: org.name,
          ...result,
        };

        totalRemindersQueued += result.remindersQueued;
        totalMarkedForReview += result.paymentsMarkedForReview;
        totalErrors += result.errors.length;

        if (result.remindersQueued > 0) {
          logger.info("Reminders queued for organization", {
            orgName: org.name,
            remindersQueued: result.remindersQueued,
            markedForReview: result.paymentsMarkedForReview,
          });
        }
      } catch (orgError) {
        const errorMessage = orgError instanceof Error ? orgError.message : String(orgError);
        logger.error("Organization reminder processing failed", {
          orgName: org.name,
          error: errorMessage,
        });
        results[org.id] = {
          organization_name: org.name,
          success: false,
          error: errorMessage,
        };
        totalErrors++;
      }
    }

    const duration = Date.now() - startTime;

    // 4. Log summary to console (TODO: Add database logging later)
    logger.info("Reminders run complete", {
      organizationsProcessed: organizations.length,
      totalRemindersQueued,
      totalMarkedForReview,
      totalErrors,
      durationMs: duration,
    });

    // 5. Return summary
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        organizationsProcessed: organizations.length,
        totalRemindersQueued,
        totalMarkedForReview,
        totalErrors,
        durationMs: duration,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error("Fatal error in reminders cron", { error });

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
  return processRemindersCron(request);
}

// Keep POST for manual triggering
export async function POST(request: NextRequest) {
  return processRemindersCron(request);
}
