-- Tikchop performance hardening.
-- Apply in Supabase SQL Editor, then refresh the app.

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
