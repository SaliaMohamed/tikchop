-- Seller-controlled client payment options.
ALTER TABLE public.sellers
ADD COLUMN IF NOT EXISTS accepted_payment_methods text[] DEFAULT ARRAY['CASH_ON_DELIVERY','WAVE','ORANGE_MONEY','MTN_MONEY']::text[],
ADD COLUMN IF NOT EXISTS default_payment_method text DEFAULT 'CASH_ON_DELIVERY';

UPDATE public.sellers
SET accepted_payment_methods = ARRAY['CASH_ON_DELIVERY','WAVE','ORANGE_MONEY','MTN_MONEY']::text[]
WHERE accepted_payment_methods IS NULL OR cardinality(accepted_payment_methods) = 0;

UPDATE public.sellers
SET default_payment_method = 'CASH_ON_DELIVERY'
WHERE default_payment_method IS NULL OR default_payment_method = '';

UPDATE public.sellers
SET default_payment_method = accepted_payment_methods[1]
WHERE NOT (default_payment_method = ANY(accepted_payment_methods));

ALTER TABLE public.sellers
ALTER COLUMN accepted_payment_methods SET NOT NULL,
ALTER COLUMN default_payment_method SET NOT NULL;

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

NOTIFY pgrst, 'reload schema';
