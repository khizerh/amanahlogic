-- Stripe Webhook Events Table
-- Used for idempotency to prevent double-processing of webhook events

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,  -- Stripe event ID (evt_xxx)
    event_type TEXT NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    membership_id UUID REFERENCES memberships(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'failed', 'held')),
    payload JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id ON stripe_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_organization ON stripe_webhook_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created ON stripe_webhook_events(created_at DESC);

-- RLS
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access (webhooks run with service role)
CREATE POLICY "Service role full access to stripe_webhook_events"
    ON stripe_webhook_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Org admins can view their events (read-only)
CREATE POLICY "Org admins can view their stripe_webhook_events"
    ON stripe_webhook_events
    FOR SELECT
    TO authenticated
    USING (organization_id = get_user_organization_id());

COMMENT ON TABLE stripe_webhook_events IS 'Tracks processed Stripe webhook events for idempotency';
COMMENT ON COLUMN stripe_webhook_events.event_id IS 'Stripe event ID (evt_xxx) - unique constraint prevents double processing';
