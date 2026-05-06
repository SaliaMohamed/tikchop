-- Tikchop chatbot guardrails.
-- Stores seller handoff pauses and follow-up history.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.tikchop_customer_handoffs (
  seller_slug text NOT NULL,
  customer_phone text NOT NULL,
  instance_name text,
  paused_until timestamptz NOT NULL,
  last_from_me_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (seller_slug, customer_phone)
);

CREATE INDEX IF NOT EXISTS idx_tikchop_customer_handoffs_active
ON public.tikchop_customer_handoffs(seller_slug, customer_phone, paused_until);

ALTER TABLE public.tikchop_customer_handoffs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.tikchop_customer_followups (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  seller_id uuid REFERENCES public.sellers(id) ON DELETE CASCADE,
  seller_slug text,
  customer_phone text NOT NULL,
  product_name text,
  sent_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_tikchop_customer_followups_recent
ON public.tikchop_customer_followups(seller_id, customer_phone, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_tikchop_customer_followups_slug_recent
ON public.tikchop_customer_followups(seller_slug, customer_phone, sent_at DESC);

ALTER TABLE public.tikchop_customer_followups ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
