-- Upgrade Tikchop for multi-boutique WAHA routing and optional Paystack subaccounts.
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS waha_session text,
  ADD COLUMN IF NOT EXISTS paystack_subaccount_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_waha_session
  ON public.sellers(waha_session)
  WHERE waha_session IS NOT NULL;
