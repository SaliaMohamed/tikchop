-- =============================================================
-- Tikchop — Migration 2026-05-13 : Sécurité et robustesse
-- Appliquer dans Supabase Dashboard > SQL Editor
-- Safe to rerun : utilise IF NOT EXISTS / OR REPLACE partout.
-- =============================================================

-- ============================================================
-- 1. Comptes vendeurs (owner_user_id + email)
--    Permet de lier un compte Auth Supabase à une boutique.
-- ============================================================
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_email text;

-- Un compte = une boutique maximum (évite les doublons à l'onboarding)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_one_shop_per_owner
  ON public.sellers(owner_user_id)
  WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sellers_owner_user_id
  ON public.sellers(owner_user_id);

-- ============================================================
-- 2. RLS : Vendeurs peuvent modifier leur propre boutique
-- ============================================================
DROP POLICY IF EXISTS "Sellers can update their own shop." ON public.sellers;
CREATE POLICY "Sellers can update their own shop."
  ON public.sellers FOR UPDATE
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- ============================================================
-- 3. RLS : Produits — le vendeur propriétaire peut tout faire
-- ============================================================
-- Remplace la policy buggée qui compare auth.uid() à seller_id (uuid product ≠ user id)
DROP POLICY IF EXISTS "Sellers can manage their own products." ON public.products;
CREATE POLICY "Sellers can manage their own products."
  ON public.products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sellers s
      WHERE s.id = products.seller_id
        AND s.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sellers s
      WHERE s.id = products.seller_id
        AND s.owner_user_id = auth.uid()
    )
  );

-- ============================================================
-- 4. RLS : Commandes — visible uniquement par le vendeur propriétaire
-- ============================================================
DROP POLICY IF EXISTS "Sellers can view their own orders." ON public.orders;
CREATE POLICY "Sellers can view their own orders."
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sellers s
      WHERE s.id = orders.seller_id
        AND s.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers can update their own orders." ON public.orders;
CREATE POLICY "Sellers can update their own orders."
  ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sellers s
      WHERE s.id = orders.seller_id
        AND s.owner_user_id = auth.uid()
    )
  );

-- ============================================================
-- 5. RLS : Livreurs — le vendeur propriétaire peut tout faire
-- ============================================================
DROP POLICY IF EXISTS "Sellers can manage their own drivers." ON public.delivery_drivers;
CREATE POLICY "Sellers can manage their own drivers."
  ON public.delivery_drivers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sellers s
      WHERE s.id = delivery_drivers.seller_id
        AND s.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sellers s
      WHERE s.id = delivery_drivers.seller_id
        AND s.owner_user_id = auth.uid()
    )
  );

-- ============================================================
-- 6. Fonction RPC : décrémentation atomique du stock
--    Remplace l'optimistic lock manuel dans createOrder().
--    Appelée via supabaseAdmin.rpc('decrement_stock_atomic', {...})
-- ============================================================
CREATE OR REPLACE FUNCTION public.decrement_stock_atomic(
  p_product_id  uuid,
  p_seller_id   uuid,
  p_quantity    integer
)
RETURNS TABLE(
  success       boolean,
  new_stock     integer,
  product_name  text,
  error_code    text
)
LANGUAGE plpgsql
SECURITY DEFINER   -- s'exécute avec les droits du propriétaire (service role)
SET search_path = public
AS $$
DECLARE
  v_current_stock  integer;
  v_new_stock      integer;
  v_product_name   text;
BEGIN
  -- Verrouille la ligne pour éviter les race conditions
  SELECT stock_quantity, name
    INTO v_current_stock, v_product_name
    FROM public.products
   WHERE id = p_product_id
     AND seller_id = p_seller_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, ''::text, 'PRODUCT_NOT_FOUND';
    RETURN;
  END IF;

  IF v_current_stock < p_quantity THEN
    RETURN QUERY SELECT false, v_current_stock, v_product_name, 'INSUFFICIENT_STOCK';
    RETURN;
  END IF;

  v_new_stock := v_current_stock - p_quantity;

  UPDATE public.products
     SET stock_quantity = v_new_stock
   WHERE id = p_product_id
     AND seller_id = p_seller_id;

  RETURN QUERY SELECT true, v_new_stock, v_product_name, ''::text;
END;
$$;

-- Autorise le service role à appeler la fonction
GRANT EXECUTE ON FUNCTION public.decrement_stock_atomic(uuid, uuid, integer) TO service_role;

-- ============================================================
-- 7. Zones de livraison (table peut être absente sur anciens projets)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id         uuid DEFAULT gen_random_uuid() NOT NULL,
  seller_id  uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  name       text NOT NULL,
  fee        numeric NOT NULL DEFAULT 0,
  is_active  boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_seller_id
  ON public.delivery_zones(seller_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_zones_seller_name
  ON public.delivery_zones(seller_id, name)
  WHERE is_active = true;

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

-- Zones publiques (affichées dans la boutique cliente)
DROP POLICY IF EXISTS "Delivery zones are viewable by everyone." ON public.delivery_zones;
CREATE POLICY "Delivery zones are viewable by everyone."
  ON public.delivery_zones FOR SELECT
  USING (true);

-- Le vendeur gère ses propres zones
DROP POLICY IF EXISTS "Sellers can manage their own delivery zones." ON public.delivery_zones;
CREATE POLICY "Sellers can manage their own delivery zones."
  ON public.delivery_zones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sellers s
      WHERE s.id = delivery_zones.seller_id
        AND s.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sellers s
      WHERE s.id = delivery_zones.seller_id
        AND s.owner_user_id = auth.uid()
    )
  );

-- ============================================================
-- Rafraîchit le cache PostgREST (Next.js et n8n voient les nouveaux schémas)
-- ============================================================
NOTIFY pgrst, 'reload schema';
