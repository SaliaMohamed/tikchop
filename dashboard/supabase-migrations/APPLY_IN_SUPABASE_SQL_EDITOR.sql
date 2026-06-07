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
ADD COLUMN IF NOT EXISTS auto_share_to_driver boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS accepted_payment_methods text[] DEFAULT ARRAY['CASH_ON_DELIVERY','WAVE','ORANGE_MONEY','MTN_MONEY']::text[],
ADD COLUMN IF NOT EXISTS default_payment_method text DEFAULT 'CASH_ON_DELIVERY';

UPDATE public.sellers
SET
  delivery_enabled = coalesce(delivery_enabled, true),
  pickup_enabled = coalesce(pickup_enabled, true),
  fixed_delivery_fee = coalesce(fixed_delivery_fee, 1000),
  delivery_payment_timing = coalesce(delivery_payment_timing, 'AT_RECEPTION'::public.delivery_payment_timing),
  auto_share_to_driver = coalesce(auto_share_to_driver, false),
  accepted_payment_methods = coalesce(accepted_payment_methods, ARRAY['CASH_ON_DELIVERY','WAVE','ORANGE_MONEY','MTN_MONEY']::text[]),
  default_payment_method = coalesce(default_payment_method, 'CASH_ON_DELIVERY')
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
ADD COLUMN IF NOT EXISTS product_keywords text,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE public.sellers
DROP CONSTRAINT IF EXISTS sellers_accepted_payment_methods_check;

ALTER TABLE public.sellers
ADD CONSTRAINT sellers_accepted_payment_methods_check
CHECK (
  cardinality(accepted_payment_methods) > 0
  AND accepted_payment_methods <@ ARRAY['CASH_ON_DELIVERY','WAVE','ORANGE_MONEY','MTN_MONEY','PAYSTACK']::text[]
);

ALTER TABLE public.sellers
DROP CONSTRAINT IF EXISTS sellers_default_payment_method_check;

ALTER TABLE public.sellers
ADD CONSTRAINT sellers_default_payment_method_check
CHECK (
  default_payment_method = ANY(accepted_payment_methods)
);

UPDATE public.products
SET is_active = true
WHERE is_active IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_variants_gin
ON public.products USING gin(product_variants);

CREATE INDEX IF NOT EXISTS idx_products_seller_active_created
ON public.products(seller_id, is_active, created_at DESC);

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

-- WhatsApp media previews in seller conversations.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_mime_type text,
  ADD COLUMN IF NOT EXISTS media_caption text,
  ADD COLUMN IF NOT EXISTS media_payload jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_messages_media_seller_created
  ON public.messages(seller_slug, created_at DESC)
  WHERE media_type IS NOT NULL;

NOTIFY pgrst, 'reload schema';

-- 12. Isolation stricte des vendeurs.
-- Version source: 2026-05-16-seller-auth-isolation-rls.sql
-- Les boutiques publiques passent par les routes serveur Tikchop (service role),
-- pas par un SELECT anon direct sur sellers/products/orders.

ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_email text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_one_shop_per_owner
  ON public.sellers(owner_user_id)
  WHERE owner_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_unique_phone_number
  ON public.sellers(phone_number)
  WHERE phone_number IS NOT NULL AND phone_number <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_unique_owner_email
  ON public.sellers(lower(owner_email))
  WHERE owner_email IS NOT NULL AND owner_email <> '';

CREATE INDEX IF NOT EXISTS idx_sellers_owner_user_id
  ON public.sellers(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_products_seller_id
  ON public.products(seller_id);

CREATE INDEX IF NOT EXISTS idx_orders_seller_id
  ON public.orders(seller_id);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items(order_id);

ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('sellers', 'products', 'orders', 'order_items', 'delivery_zones', 'delivery_drivers')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  END LOOP;
END $$;

REVOKE ALL ON public.sellers FROM anon;
REVOKE ALL ON public.products FROM anon;
REVOKE ALL ON public.orders FROM anon;
REVOKE ALL ON public.order_items FROM anon;
REVOKE ALL ON public.delivery_zones FROM anon;
REVOKE ALL ON public.delivery_drivers FROM anon;

GRANT SELECT, UPDATE ON public.sellers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_zones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_drivers TO authenticated;

CREATE POLICY seller_owner_select
  ON public.sellers
  FOR SELECT
  TO authenticated
  USING (owner_user_id = (SELECT auth.uid()));

CREATE POLICY seller_owner_update
  ON public.sellers
  FOR UPDATE
  TO authenticated
  USING (owner_user_id = (SELECT auth.uid()))
  WITH CHECK (owner_user_id = (SELECT auth.uid()));

CREATE POLICY products_owner_all
  ON public.products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sellers s
      WHERE s.id = products.seller_id
        AND s.owner_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sellers s
      WHERE s.id = products.seller_id
        AND s.owner_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY orders_owner_all
  ON public.orders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sellers s
      WHERE s.id = orders.seller_id
        AND s.owner_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sellers s
      WHERE s.id = orders.seller_id
        AND s.owner_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY order_items_owner_all
  ON public.order_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.sellers s ON s.id = o.seller_id
      WHERE o.id = order_items.order_id
        AND s.owner_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.sellers s ON s.id = o.seller_id
      WHERE o.id = order_items.order_id
        AND s.owner_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY delivery_zones_owner_all
  ON public.delivery_zones
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sellers s
      WHERE s.id = delivery_zones.seller_id
        AND s.owner_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sellers s
      WHERE s.id = delivery_zones.seller_id
        AND s.owner_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY delivery_drivers_owner_all
  ON public.delivery_drivers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sellers s
      WHERE s.id = delivery_drivers.seller_id
        AND s.owner_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sellers s
      WHERE s.id = delivery_drivers.seller_id
        AND s.owner_user_id = (SELECT auth.uid())
    )
  );

DO $$
BEGIN
  IF to_regprocedure('public.decrement_stock_atomic(uuid,uuid,integer)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.decrement_stock_atomic(uuid, uuid, integer) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.decrement_stock_atomic(uuid, uuid, integer) FROM anon;
    REVOKE ALL ON FUNCTION public.decrement_stock_atomic(uuid, uuid, integer) FROM authenticated;
    GRANT EXECUTE ON FUNCTION public.decrement_stock_atomic(uuid, uuid, integer) TO service_role;
  END IF;
END $$;

DO $$
DECLARE
  unowned_count integer;
BEGIN
  SELECT COUNT(*) INTO unowned_count
  FROM public.sellers
  WHERE owner_user_id IS NULL;

  IF unowned_count > 0 THEN
    RAISE NOTICE 'Tikchop: % boutique(s) sans owner_user_id a rattacher manuellement.', unowned_count;
  END IF;
END $$;

-- 13. Seller branding columns and physical address
ALTER TABLE public.sellers 
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS brand_color text DEFAULT '#008f5a',
ADD COLUMN IF NOT EXISTS physical_address text;

-- 14. Performance dashboard, bot order lookup, and CRM support
CREATE INDEX IF NOT EXISTS idx_orders_seller_customer_created
ON public.orders(seller_id, customer_phone, created_at DESC)
WHERE customer_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_seller_status_created
ON public.orders(seller_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_seller_created
ON public.orders(seller_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_seller_dashboard_stats(
  p_seller_id uuid,
  p_seller_slug text,
  p_week_ago timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH order_stats AS (
  SELECT
    COUNT(*)::integer AS order_count,
    COUNT(*) FILTER (WHERE created_at >= p_week_ago)::integer AS weekly_order_count,
    COUNT(*) FILTER (WHERE status IN ('PAID', 'PREPARED', 'DELIVERED'))::integer AS confirmed_order_count,
    COUNT(*) FILTER (WHERE status = 'PENDING')::integer AS pending_order_count,
    COUNT(*) FILTER (WHERE status = 'PAID')::integer AS paid_order_count,
    COUNT(*) FILTER (WHERE status = 'PREPARED')::integer AS prepared_order_count,
    COUNT(*) FILTER (WHERE status = 'DELIVERED')::integer AS delivered_order_count,
    COALESCE(
      SUM(COALESCE(total_amount, 0) + COALESCE(delivery_fee, 0))
        FILTER (WHERE status IN ('PAID', 'PREPARED', 'DELIVERED')),
      0
    )::numeric AS sales
  FROM public.orders
  WHERE seller_id = p_seller_id
),
product_stats AS (
  SELECT COUNT(*)::integer AS product_count
  FROM public.products
  WHERE seller_id = p_seller_id
),
followup_stats AS (
  SELECT COUNT(*)::integer AS followup_count
  FROM public.messages
  WHERE seller_slug = p_seller_slug
    AND statut = 'followup'
    AND created_at >= p_week_ago
),
recent_orders AS (
  SELECT COALESCE(jsonb_agg(to_jsonb(row_data) ORDER BY row_data.created_at DESC), '[]'::jsonb) AS items
  FROM (
    SELECT id, order_ref, customer_phone, total_amount, delivery_fee, status, created_at
    FROM public.orders
    WHERE seller_id = p_seller_id
    ORDER BY created_at DESC
    LIMIT 4
  ) AS row_data
)
SELECT jsonb_build_object(
  'sales', order_stats.sales,
  'order_count', order_stats.order_count,
  'product_count', product_stats.product_count,
  'weekly_order_count', order_stats.weekly_order_count,
  'confirmed_order_count', order_stats.confirmed_order_count,
  'pending_order_count', order_stats.pending_order_count,
  'paid_order_count', order_stats.paid_order_count,
  'prepared_order_count', order_stats.prepared_order_count,
  'delivered_order_count', order_stats.delivered_order_count,
  'followup_count', followup_stats.followup_count,
  'recent_orders', recent_orders.items
)
FROM order_stats, product_stats, followup_stats, recent_orders;
$$;

REVOKE ALL ON FUNCTION public.get_seller_dashboard_stats(uuid, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_seller_dashboard_stats(uuid, text, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.get_seller_dashboard_stats(uuid, text, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_dashboard_stats(uuid, text, timestamptz) TO service_role;

NOTIFY pgrst, 'reload schema';
