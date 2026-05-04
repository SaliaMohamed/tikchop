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
