-- Tikchop launch readiness patch.
-- Apply in the Tikchop Supabase SQL Editor.
-- Safe to rerun.

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS paystack_reference text,
ADD COLUMN IF NOT EXISTS paystack_authorization_url text,
ADD COLUMN IF NOT EXISTS paystack_payment_status text,
ADD COLUMN IF NOT EXISTS paystack_paid_at timestamptz,
ADD COLUMN IF NOT EXISTS whatsapp_receipt_sent_at timestamptz;

ALTER TABLE public.sellers
ADD COLUMN IF NOT EXISTS paystack_subaccount_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_paystack_reference_unique
ON public.orders(paystack_reference)
WHERE paystack_reference IS NOT NULL;

NOTIFY pgrst, 'reload schema';
