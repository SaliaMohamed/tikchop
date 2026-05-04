-- Tikchop delivery zones
-- Allows each seller to define delivery fees per zone/neighborhood.

CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  name text NOT NULL,
  fee numeric NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (seller_id, name)
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_seller_id
ON public.delivery_zones(seller_id);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Delivery zones are public." ON public.delivery_zones;
CREATE POLICY "Delivery zones are public."
ON public.delivery_zones
FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Sellers can manage their own delivery zones." ON public.delivery_zones;
CREATE POLICY "Sellers can manage their own delivery zones."
ON public.delivery_zones
FOR ALL
USING (auth.uid() = seller_id)
WITH CHECK (auth.uid() = seller_id);

NOTIFY pgrst, 'reload schema';
