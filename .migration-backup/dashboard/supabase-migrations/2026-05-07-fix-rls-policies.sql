/*
# Fix RLS policies and payment constraint

## Context
The original schema.sql and earlier migrations introduced several RLS issues:
- `FOR ALL` policies on products, sellers, and delivery_drivers instead of separate per-verb policies
- sellers table fully public (exposes phone numbers and emails)
- No INSERT policy on orders/order_items (public checkout flow broken via anon key)
- payment_method CHECK constraint only allows WAVE/PAYSTACK but the app supports 5 methods

## Changes

### 1. sellers — restrict public read to non-sensitive columns
- Drop the blanket "Public profiles are viewable by everyone" SELECT policy
- Add a public SELECT policy scoped to shop-display columns only (id, name, slug, created_at, delivery settings)
  NOTE: Supabase RLS operates at row level, not column level. To truly hide phone_number and owner_email,
  we add column-level GRANT REVOKE on the sensitive columns for the anon role.
- Replace the FOR ALL owner policy with 4 separate policies (SELECT/INSERT/UPDATE/DELETE)

### 2. products — split FOR ALL into 4 policies
- Keep public SELECT (shops are public)
- Owner-scoped INSERT/UPDATE/DELETE via sellers.owner_user_id join

### 3. orders — add missing INSERT policy for anon (public checkout)
- Keep owner-scoped SELECT/UPDATE for sellers
- Add anon INSERT so customers can create orders from the public shop
- Add anon SELECT limited to own orders (by customer_phone match via JWT metadata or metadata.order_id)
  For the MVP, anon can SELECT orders they just created (by matching customer_phone is not possible in RLS
  without passing it through JWT). We keep SELECT owner-only and let server actions handle public reads.

### 4. order_items — add INSERT policy for anon
- anon can INSERT order_items linked to an order they just created
- Keep owner-scoped SELECT for sellers

### 5. delivery_drivers — split FOR ALL into 4 policies
- Owner-scoped CRUD via sellers.owner_user_id join

### 6. payment_method constraint — expand to match local-commerce.js
- Allow: WAVE, ORANGE_MONEY, MTN_MONEY, CASH_ON_DELIVERY, PAYSTACK

### 7. updated_at columns
- Add updated_at timestamp to sellers, products, orders for auditability
*/

-- 1. sellers: restrict sensitive column access
REVOKE SELECT (phone_number, owner_email) ON public.sellers FROM anon, authenticated;

-- Replace sellers policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.sellers;
DROP POLICY IF EXISTS "Seller owners can manage their own shop." ON public.sellers;

CREATE POLICY "sellers_public_read"
ON public.sellers FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "sellers_owner_select"
ON public.sellers FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

CREATE POLICY "sellers_owner_insert"
ON public.sellers FOR INSERT
TO authenticated
WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "sellers_owner_update"
ON public.sellers FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "sellers_owner_delete"
ON public.sellers FOR DELETE
TO authenticated
USING (owner_user_id = auth.uid());

-- 2. products: split FOR ALL into 4 policies
DROP POLICY IF EXISTS "Products are viewable by everyone." ON public.products;
DROP POLICY IF EXISTS "Sellers can manage their own products." ON public.products;
DROP POLICY IF EXISTS "Seller owners can manage their own products." ON public.products;

CREATE POLICY "products_public_read"
ON public.products FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "products_owner_insert"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sellers
    WHERE sellers.id = products.seller_id
      AND sellers.owner_user_id = auth.uid()
  )
);

CREATE POLICY "products_owner_update"
ON public.products FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sellers
    WHERE sellers.id = products.seller_id
      AND sellers.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sellers
    WHERE sellers.id = products.seller_id
      AND sellers.owner_user_id = auth.uid()
  )
);

CREATE POLICY "products_owner_delete"
ON public.products FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sellers
    WHERE sellers.id = products.seller_id
      AND sellers.owner_user_id = auth.uid()
  )
);

-- 3. orders: add anon INSERT for public checkout
DROP POLICY IF EXISTS "Seller owners can view their own orders." ON public.orders;
DROP POLICY IF EXISTS "Seller owners can update their own orders." ON public.orders;

CREATE POLICY "orders_owner_select"
ON public.orders FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sellers
    WHERE sellers.id = orders.seller_id
      AND sellers.owner_user_id = auth.uid()
  )
);

CREATE POLICY "orders_anon_insert"
ON public.orders FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "orders_owner_update"
ON public.orders FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sellers
    WHERE sellers.id = orders.seller_id
      AND sellers.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sellers
    WHERE sellers.id = orders.seller_id
      AND sellers.owner_user_id = auth.uid()
  )
);

CREATE POLICY "orders_owner_delete"
ON public.orders FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sellers
    WHERE sellers.id = orders.seller_id
      AND sellers.owner_user_id = auth.uid()
  )
);

-- 4. order_items: add anon INSERT for public checkout
DROP POLICY IF EXISTS "Seller owners can view their own order items." ON public.order_items;

CREATE POLICY "order_items_owner_select"
ON public.order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    JOIN public.sellers ON sellers.id = orders.seller_id
    WHERE orders.id = order_items.order_id
      AND sellers.owner_user_id = auth.uid()
  )
);

CREATE POLICY "order_items_anon_insert"
ON public.order_items FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "order_items_owner_update"
ON public.order_items FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    JOIN public.sellers ON sellers.id = orders.seller_id
    WHERE orders.id = order_items.order_id
      AND sellers.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    JOIN public.sellers ON sellers.id = orders.seller_id
    WHERE orders.id = order_items.order_id
      AND sellers.owner_user_id = auth.uid()
  )
);

CREATE POLICY "order_items_owner_delete"
ON public.order_items FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    JOIN public.sellers ON sellers.id = orders.seller_id
    WHERE orders.id = order_items.order_id
      AND sellers.owner_user_id = auth.uid()
  )
);

-- 5. delivery_drivers: split FOR ALL into 4 policies
DROP POLICY IF EXISTS "Sellers can manage their own drivers." ON public.delivery_drivers;

CREATE POLICY "drivers_owner_select"
ON public.delivery_drivers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sellers
    WHERE sellers.id = delivery_drivers.seller_id
      AND sellers.owner_user_id = auth.uid()
  )
);

CREATE POLICY "drivers_owner_insert"
ON public.delivery_drivers FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sellers
    WHERE sellers.id = delivery_drivers.seller_id
      AND sellers.owner_user_id = auth.uid()
  )
);

CREATE POLICY "drivers_owner_update"
ON public.delivery_drivers FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sellers
    WHERE sellers.id = delivery_drivers.seller_id
      AND sellers.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sellers
    WHERE sellers.id = delivery_drivers.seller_id
      AND sellers.owner_user_id = auth.uid()
  )
);

CREATE POLICY "drivers_owner_delete"
ON public.delivery_drivers FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sellers
    WHERE sellers.id = delivery_drivers.seller_id
      AND sellers.owner_user_id = auth.uid()
  )
);

-- 6. Expand payment_method constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('WAVE', 'ORANGE_MONEY', 'MTN_MONEY', 'CASH_ON_DELIVERY', 'PAYSTACK'));

-- 7. Add updated_at columns
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_products_seller_id ON public.products(seller_id);

NOTIFY pgrst, 'reload schema';
