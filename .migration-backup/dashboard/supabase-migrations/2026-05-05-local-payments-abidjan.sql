-- Local payment options used in Abidjan checkout.
ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_payment_method_check
CHECK (
  payment_method IN (
    'WAVE',
    'ORANGE_MONEY',
    'MTN_MONEY',
    'CASH_ON_DELIVERY',
    'PAYSTACK'
  )
);

NOTIFY pgrst, 'reload schema';
