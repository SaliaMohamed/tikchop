-- Tikchop seller accounts.
-- Run this once in Supabase SQL Editor before using account-owned shops.

ALTER TABLE public.sellers
ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS owner_email text;

CREATE INDEX IF NOT EXISTS idx_sellers_owner_user_id
ON public.sellers(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_sellers_owner_email
ON public.sellers(lower(owner_email));

-- One Supabase account should own one seller shop in the MVP.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_one_shop_per_owner
ON public.sellers(owner_user_id)
WHERE owner_user_id IS NOT NULL;

DROP POLICY IF EXISTS "Seller owners can manage their own shop." ON public.sellers;
CREATE POLICY "Seller owners can manage their own shop."
ON public.sellers
FOR ALL
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Sellers can manage their own products." ON public.products;
DROP POLICY IF EXISTS "Seller owners can manage their own products." ON public.products;
CREATE POLICY "Seller owners can manage their own products."
ON public.products
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.sellers
    WHERE sellers.id = products.seller_id
      AND sellers.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sellers
    WHERE sellers.id = products.seller_id
      AND sellers.owner_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Seller owners can view their own orders." ON public.orders;
CREATE POLICY "Seller owners can view their own orders."
ON public.orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.sellers
    WHERE sellers.id = orders.seller_id
      AND sellers.owner_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Seller owners can update their own orders." ON public.orders;
CREATE POLICY "Seller owners can update their own orders."
ON public.orders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.sellers
    WHERE sellers.id = orders.seller_id
      AND sellers.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sellers
    WHERE sellers.id = orders.seller_id
      AND sellers.owner_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Seller owners can view their own order items." ON public.order_items;
CREATE POLICY "Seller owners can view their own order items."
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.orders
    JOIN public.sellers ON sellers.id = orders.seller_id
    WHERE orders.id = order_items.order_id
      AND sellers.owner_user_id = auth.uid()
  )
);

NOTIFY pgrst, 'reload schema';
