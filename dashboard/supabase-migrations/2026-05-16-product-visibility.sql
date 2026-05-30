-- Product visibility for seller catalogue management.
-- Lets vendors hide a product from the public shop without deleting it.

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

UPDATE public.products
SET is_active = true
WHERE is_active IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_seller_active_created
ON public.products(seller_id, is_active, created_at DESC);

NOTIFY pgrst, 'reload schema';
