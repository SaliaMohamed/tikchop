-- Tikchop live Supabase schema patch
-- Apply once in Supabase Dashboard > SQL Editor.
-- Safe to rerun: uses IF NOT EXISTS where possible.

-- Required for gen_random_uuid() on older projects.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Short public order references for WhatsApp/n8n order linking.
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_ref text;

UPDATE public.orders
SET order_ref = upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE order_ref IS NULL;

ALTER TABLE public.orders
ALTER COLUMN order_ref SET NOT NULL;

ALTER TABLE public.orders
ALTER COLUMN order_ref SET DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_ref_unique
ON public.orders(order_ref);

CREATE INDEX IF NOT EXISTS idx_orders_order_ref
ON public.orders(order_ref);

-- 2. Order status used by the seller order-management screen.
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'PREPARED';

-- 3. Delivery enums.
DO $$
BEGIN
  CREATE TYPE public.delivery_type AS ENUM ('DELIVERY', 'PICKUP');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.delivery_payment_timing AS ENUM ('INCLUDED', 'AT_RECEPTION', 'OFFERED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4. Seller delivery settings.
ALTER TABLE public.sellers
ADD COLUMN IF NOT EXISTS delivery_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS pickup_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS fixed_delivery_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_payment_timing public.delivery_payment_timing DEFAULT 'AT_RECEPTION',
ADD COLUMN IF NOT EXISTS auto_share_to_driver boolean DEFAULT false;

UPDATE public.sellers
SET
  delivery_enabled = coalesce(delivery_enabled, true),
  pickup_enabled = coalesce(pickup_enabled, true),
  fixed_delivery_fee = coalesce(fixed_delivery_fee, 1000),
  delivery_payment_timing = coalesce(delivery_payment_timing, 'AT_RECEPTION'::public.delivery_payment_timing),
  auto_share_to_driver = coalesce(auto_share_to_driver, false)
WHERE slug = 'salia';

-- 5. Delivery drivers linked to sellers.
CREATE TABLE IF NOT EXISTS public.delivery_drivers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone_number text NOT NULL,
  zone text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_drivers_seller_id
ON public.delivery_drivers(seller_id);

ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers can manage their own drivers." ON public.delivery_drivers;
CREATE POLICY "Sellers can manage their own drivers."
ON public.delivery_drivers
FOR ALL
USING (auth.uid() = seller_id)
WITH CHECK (auth.uid() = seller_id);

-- 6. Delivery details stored on each order.
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_type public.delivery_type DEFAULT 'DELIVERY',
ADD COLUMN IF NOT EXISTS delivery_zone text,
ADD COLUMN IF NOT EXISTS delivery_address text,
ADD COLUMN IF NOT EXISTS delivery_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_driver_id uuid REFERENCES public.delivery_drivers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'PENDING';

UPDATE public.orders
SET
  delivery_type = coalesce(delivery_type, 'DELIVERY'::public.delivery_type),
  delivery_fee = coalesce(delivery_fee, 0),
  delivery_status = coalesce(delivery_status, 'PENDING');

CREATE INDEX IF NOT EXISTS idx_orders_seller_status_created
ON public.orders(seller_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_delivery_driver_id
ON public.orders(delivery_driver_id);

-- 7. Paystack traceability for app and WhatsApp orders.
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS paystack_reference text,
ADD COLUMN IF NOT EXISTS paystack_authorization_url text,
ADD COLUMN IF NOT EXISTS paystack_payment_status text,
ADD COLUMN IF NOT EXISTS paystack_paid_at timestamptz,
ADD COLUMN IF NOT EXISTS whatsapp_receipt_sent_at timestamptz;

ALTER TABLE public.sellers
ADD COLUMN IF NOT EXISTS paystack_subaccount_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_paystack_reference_unique
ON public.orders(paystack_reference)
WHERE paystack_reference IS NOT NULL;

-- 8. WhatsApp chatbot connection state managed through Evolution API.
ALTER TABLE public.sellers
ADD COLUMN IF NOT EXISTS whatsapp_provider text,
ADD COLUMN IF NOT EXISTS evolution_instance text,
ADD COLUMN IF NOT EXISTS whatsapp_status text DEFAULT 'disconnected',
ADD COLUMN IF NOT EXISTS whatsapp_connected_at timestamptz,
ADD COLUMN IF NOT EXISTS whatsapp_last_pairing_at timestamptz,
ADD COLUMN IF NOT EXISTS whatsapp_last_error text;

CREATE INDEX IF NOT EXISTS idx_sellers_evolution_instance
ON public.sellers(evolution_instance);

UPDATE public.sellers
SET
  whatsapp_provider = coalesce(whatsapp_provider, 'evolution'),
  evolution_instance = coalesce(evolution_instance, slug),
  whatsapp_status = coalesce(whatsapp_status, 'disconnected')
WHERE slug IS NOT NULL;

-- 9. Chatbot guardrails: seller handoff pause and follow-up history.
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

-- 10. Per-boutique chatbot settings and product variants.
ALTER TABLE public.sellers
ADD COLUMN IF NOT EXISTS bot_tone text DEFAULT 'Francais ivoirien simple, poli, direct.',
ADD COLUMN IF NOT EXISTS bot_greeting text,
ADD COLUMN IF NOT EXISTS bot_payment_preferences text DEFAULT 'Wave, Orange Money, MTN MoMo, Djamo, paiement a la livraison selon la zone.',
ADD COLUMN IF NOT EXISTS bot_delivery_notes text,
ADD COLUMN IF NOT EXISTS bot_special_rules text;

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS product_variants jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS product_keywords text;

CREATE INDEX IF NOT EXISTS idx_products_variants_gin
ON public.products USING gin(product_variants);

-- 11. WhatsApp message deduplication and faster batch lookups.
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS external_message_id text,
ADD COLUMN IF NOT EXISTS seller_slug text,
ADD COLUMN IF NOT EXISTS customer_phone text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_external_message_id
ON public.messages(external_message_id)
WHERE external_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_client_status_created
ON public.messages(client, statut, created_at DESC);

-- Refresh PostgREST schema cache so Next.js and n8n see new columns quickly.
NOTIFY pgrst, 'reload schema';
