-- =============================================================
-- Tikchop - Migration 2026-05-16 : isolation stricte des vendeurs
-- A appliquer dans Supabase Dashboard > SQL Editor.
--
-- Objectif:
-- - chaque vendeur authentifie ne voit que sa boutique, ses produits,
--   ses commandes, ses lignes de commandes, ses zones et ses livreurs;
-- - aucune boutique creee par le parcours vendeur ne doit rester sans
--   owner_user_id;
-- - les anciennes policies larges sur les tables vendeur sont remplacees.
-- Safe to rerun.
-- =============================================================

-- 1. Colonnes de ownership vendeur.
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

-- 2. RLS obligatoire sur les tables back-office vendeur.
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;

-- 3. Retire toutes les anciennes policies sur le coeur vendeur.
-- Les boutiques publiques passent par les routes serveur Tikchop (service role),
-- pas par un SELECT anon direct sur ces tables.
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

-- 4. Privileges explicites: anon ne lit pas le back-office vendeur.
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

-- 5. Policies vendeurs.
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

-- 6. La RPC stock reste appelee uniquement par le serveur Tikchop.
DO $$
BEGIN
  IF to_regprocedure('public.decrement_stock_atomic(uuid,uuid,integer)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.decrement_stock_atomic(uuid, uuid, integer) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.decrement_stock_atomic(uuid, uuid, integer) FROM anon;
    REVOKE ALL ON FUNCTION public.decrement_stock_atomic(uuid, uuid, integer) FROM authenticated;
    GRANT EXECUTE ON FUNCTION public.decrement_stock_atomic(uuid, uuid, integer) TO service_role;
  END IF;
END $$;

-- 7. Diagnostic non bloquant: les anciennes boutiques sans owner restent
-- invisibles aux vendeurs authentifies jusqu'a rattachement manuel.
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

NOTIFY pgrst, 'reload schema';
