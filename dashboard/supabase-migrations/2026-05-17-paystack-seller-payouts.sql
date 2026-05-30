-- Tikchop seller payout settings and Paystack split traceability.
-- Safe to rerun.

ALTER TABLE public.sellers
ADD COLUMN IF NOT EXISTS payout_network text,
ADD COLUMN IF NOT EXISTS payout_phone text,
ADD COLUMN IF NOT EXISTS payout_bank_code text,
ADD COLUMN IF NOT EXISTS payout_bank_name text,
ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'not_configured',
ADD COLUMN IF NOT EXISTS payout_last_error text,
ADD COLUMN IF NOT EXISTS payout_confirmed_at timestamptz,
ADD COLUMN IF NOT EXISTS paystack_subaccount_created_at timestamptz,
ADD COLUMN IF NOT EXISTS subscription_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS paystack_split_subaccount_code text,
ADD COLUMN IF NOT EXISTS paystack_split_bearer text,
ADD COLUMN IF NOT EXISTS paystack_settlement_status text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sellers_payout_network_check'
      AND conrelid = 'public.sellers'::regclass
  ) THEN
    ALTER TABLE public.sellers
    ADD CONSTRAINT sellers_payout_network_check
    CHECK (
      payout_network IS NULL
      OR payout_network IN ('ORANGE_MONEY', 'MTN_MOMO', 'WAVE', 'DJAMO')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sellers_payout_status_check'
      AND conrelid = 'public.sellers'::regclass
  ) THEN
    ALTER TABLE public.sellers
    ADD CONSTRAINT sellers_payout_status_check
    CHECK (
      payout_status IN (
        'not_configured',
        'pending_confirmation',
        'manual_review',
        'paystack_ready',
        'failed'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sellers_subscription_status_check'
      AND conrelid = 'public.sellers'::regclass
  ) THEN
    ALTER TABLE public.sellers
    ADD CONSTRAINT sellers_subscription_status_check
    CHECK (
      subscription_status IN ('trial', 'active', 'past_due', 'paused', 'cancelled')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_paystack_split_bearer_check'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
    ADD CONSTRAINT orders_paystack_split_bearer_check
    CHECK (
      paystack_split_bearer IS NULL
      OR paystack_split_bearer IN ('account', 'subaccount')
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sellers_payout_status
ON public.sellers(payout_status);

CREATE INDEX IF NOT EXISTS idx_orders_paystack_split_subaccount
ON public.orders(paystack_split_subaccount_code)
WHERE paystack_split_subaccount_code IS NOT NULL;

UPDATE public.sellers
SET
  payout_status = CASE
    WHEN paystack_subaccount_code IS NOT NULL THEN 'paystack_ready'
    WHEN payout_status IS NULL THEN 'not_configured'
    ELSE payout_status
  END,
  paystack_subaccount_created_at = CASE
    WHEN paystack_subaccount_code IS NOT NULL
      THEN COALESCE(paystack_subaccount_created_at, created_at, NOW())
    ELSE paystack_subaccount_created_at
  END,
  subscription_active = COALESCE(subscription_active, true),
  subscription_status = COALESCE(subscription_status, 'trial')
WHERE payout_status IS NULL
   OR subscription_active IS NULL
   OR subscription_status IS NULL
   OR (paystack_subaccount_code IS NOT NULL AND paystack_subaccount_created_at IS NULL);

NOTIFY pgrst, 'reload schema';
