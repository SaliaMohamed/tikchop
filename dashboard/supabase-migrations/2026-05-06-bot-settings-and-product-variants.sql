-- Tikchop per-boutique bot settings and product variants.

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

NOTIFY pgrst, 'reload schema';
