-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 029: API / White-Label Platform
-- ══════════════════════════════════════════════════════════════════════════════
-- Exposes TandaXn's Elder system as a service to partner platforms:
--   • api_clients          — partner organizations with API keys
--   • api_request_logs     — audit trail of all API calls
--   • webhook_deliveries   — webhook delivery tracking & retry
--   • generate_api_key()   — secure key generation
--   • validate_api_key()   — key validation for edge functions
-- ══════════════════════════════════════════════════════════════════════════════

-- Ensure pgcrypto is available for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- STEP 1: Create API_CLIENTS table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.api_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    contact_email TEXT NOT NULL,
    api_key_hash TEXT NOT NULL,              -- SHA-256 hash (never store plaintext)
    api_key_prefix TEXT NOT NULL,            -- First chars for identification (e.g. "txn_live_abcd1234")
    webhook_url TEXT,
    webhook_secret TEXT,                     -- HMAC secret for signing webhook payloads
    permissions TEXT[] NOT NULL DEFAULT '{}', -- e.g. {'cases.create','honor.read','vouch.check','elders.list'}
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
    rate_limit_per_day INTEGER NOT NULL DEFAULT 10000,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_sandbox BOOLEAN NOT NULL DEFAULT FALSE,
    ip_allowlist TEXT[],                     -- optional IP whitelist
    metadata JSONB DEFAULT '{}',
    last_request_at TIMESTAMPTZ,
    total_requests BIGINT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.api_clients IS 'Partner platforms that consume the TandaXn API. API key hash stored, plaintext shown once on creation.';
COMMENT ON COLUMN public.api_clients.permissions IS 'Array of permission strings: cases.create, cases.read, honor.read, vouch.check, elders.list, webhooks.receive';

-- ============================================================================
-- STEP 2: Create API_REQUEST_LOGS table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.api_request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_client_id UUID NOT NULL REFERENCES api_clients(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    request_body JSONB,
    response_summary TEXT,                   -- brief description, not full body
    ip_address INET,
    user_agent TEXT,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.api_request_logs IS 'Audit trail for partner API usage. Retained for billing and debugging.';

-- ============================================================================
-- STEP 3: Create WEBHOOK_DELIVERIES table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_client_id UUID NOT NULL REFERENCES api_clients(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,                -- e.g. 'case.status_changed', 'vouch.completed'
    payload JSONB NOT NULL,
    delivery_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
    http_status_code INTEGER,
    response_body TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    next_retry_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.webhook_deliveries IS 'Tracks webhook delivery attempts to partner platforms. Failed deliveries are retried with exponential backoff.';

-- ============================================================================
-- STEP 4: Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_api_clients_key_prefix
    ON public.api_clients(api_key_prefix);

CREATE INDEX IF NOT EXISTS idx_api_clients_active
    ON public.api_clients(is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_api_request_logs_client
    ON public.api_request_logs(api_client_id);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_created
    ON public.api_request_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_client
    ON public.webhook_deliveries(api_client_id);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status
    ON public.webhook_deliveries(status);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry
    ON public.webhook_deliveries(next_retry_at)
    WHERE status = 'retrying';

-- ============================================================================
-- STEP 5: Row Level Security
-- ============================================================================
-- All partner data is admin-only. Service role bypasses RLS.
ALTER TABLE public.api_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_clients_service_only"
    ON public.api_clients FOR ALL USING (false);

CREATE POLICY "api_request_logs_service_only"
    ON public.api_request_logs FOR ALL USING (false);

CREATE POLICY "webhook_deliveries_service_only"
    ON public.webhook_deliveries FOR ALL USING (false);

-- ============================================================================
-- STEP 6: generate_api_key() — Secure key generation
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_api_key(p_prefix TEXT DEFAULT 'txn_live_')
RETURNS TABLE(api_key TEXT, api_key_hash TEXT, api_key_prefix TEXT) AS $$
DECLARE
    v_random_part TEXT;
    v_full_key TEXT;
BEGIN
    -- Generate 32 random bytes (256-bit entropy) encoded as hex
    v_random_part := encode(gen_random_bytes(32), 'hex');
    v_full_key := p_prefix || v_random_part;

    api_key := v_full_key;
    api_key_hash := encode(digest(v_full_key, 'sha256'), 'hex');
    api_key_prefix := p_prefix || substring(v_random_part FROM 1 FOR 8);

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_api_key IS 'Generates a secure API key. Returns plaintext (show once), SHA-256 hash (store), and prefix (for identification).';

-- ============================================================================
-- STEP 7: validate_api_key() — Key lookup for edge functions
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_api_key(p_api_key TEXT)
RETURNS TABLE(
    client_id UUID,
    client_name TEXT,
    permissions TEXT[],
    is_sandbox BOOLEAN,
    rate_limit_per_minute INTEGER
) AS $$
DECLARE
    v_hash TEXT;
BEGIN
    v_hash := encode(digest(p_api_key, 'sha256'), 'hex');

    RETURN QUERY
    SELECT
        ac.id,
        ac.name,
        ac.permissions,
        ac.is_sandbox,
        ac.rate_limit_per_minute
    FROM public.api_clients ac
    WHERE ac.api_key_hash = v_hash
      AND ac.is_active = TRUE;

    -- Increment request counter and update timestamp
    UPDATE public.api_clients
    SET last_request_at = NOW(),
        total_requests = total_requests + 1,
        updated_at = NOW()
    WHERE api_key_hash = v_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION validate_api_key IS 'Validates an API key by hashing and looking up. Returns client info + permissions. Updates request counter.';

-- ============================================================================
-- STEP 8: Helper — log_api_request()
-- ============================================================================
CREATE OR REPLACE FUNCTION log_api_request(
    p_client_id UUID,
    p_method TEXT,
    p_path TEXT,
    p_status_code INTEGER,
    p_request_body JSONB DEFAULT NULL,
    p_response_summary TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_latency_ms INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.api_request_logs (
        api_client_id, method, path, status_code,
        request_body, response_summary,
        ip_address, user_agent, latency_ms
    ) VALUES (
        p_client_id, p_method, p_path, p_status_code,
        p_request_body, p_response_summary,
        p_ip_address, p_user_agent, p_latency_ms
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 9: Helper — queue_webhook()
-- ============================================================================
CREATE OR REPLACE FUNCTION queue_webhook(
    p_client_id UUID,
    p_event_type TEXT,
    p_payload JSONB
) RETURNS UUID AS $$
DECLARE
    v_delivery_id UUID;
    v_webhook_url TEXT;
BEGIN
    -- Get client's webhook URL
    SELECT webhook_url INTO v_webhook_url
    FROM public.api_clients
    WHERE id = p_client_id AND is_active = TRUE;

    IF v_webhook_url IS NULL THEN
        RETURN NULL;  -- No webhook configured
    END IF;

    INSERT INTO public.webhook_deliveries (
        api_client_id, event_type, payload, delivery_url
    ) VALUES (
        p_client_id, p_event_type, p_payload, v_webhook_url
    ) RETURNING id INTO v_delivery_id;

    RETURN v_delivery_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 029
-- ══════════════════════════════════════════════════════════════════════════════
