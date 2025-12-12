# Cron Jobs

This directory contains automated cron jobs for Amanah Logic.

## Overview

The cron jobs are configured in `vercel.json` and run automatically on Vercel's infrastructure.

### Billing Cron (`/api/cron/billing`)

- **Schedule**: Hourly (`0 * * * *`)
- **Purpose**: Process recurring billing for all active organizations
- **How it works**:
  1. Checks each organization's timezone
  2. Only processes billing at midnight in the organization's timezone
  3. Falls back to catch-up billing if memberships are overdue
  4. Calls the billing engine to create payment records
  5. Logs results to console (TODO: add database logging)

### Reminders Cron (`/api/cron/reminders`)

- **Schedule**: Daily at 9 AM UTC (`0 9 * * *`)
- **Purpose**: Send payment reminders for overdue invoices
- **How it works**:
  1. Finds payments that are overdue based on organization settings
  2. Default reminder schedule: 3, 7, and 14 days after due date
  3. Queues reminder emails (TODO: wire up email service)
  4. Updates `reminder_count` and `reminder_sent_at` on payments
  5. Marks payments for review after 3 reminders

## Security

All cron endpoints are protected with a `CRON_SECRET` bearer token:

```bash
Authorization: Bearer <CRON_SECRET>
```

Set `CRON_SECRET` in your environment variables (see `.env.example`).

## Manual Triggering

You can manually trigger cron jobs via POST requests:

```bash
# Billing cron
curl -X POST https://your-domain.com/api/cron/billing \
  -H "Authorization: Bearer <CRON_SECRET>"

# Reminders cron
curl -X POST https://your-domain.com/api/cron/reminders \
  -H "Authorization: Bearer <CRON_SECRET>"
```

## TODO

- [ ] Add database logging for cron runs (create `billing_runs` table)
- [ ] Wire up email service for payment reminders
- [ ] Add Sentry error tracking
- [ ] Add retry logic for failed payments
- [ ] Add dashboard for monitoring cron job status
