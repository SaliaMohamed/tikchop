-- Tikchop checkout completeness patch.
-- Stores optional client details from the public checkout on the order itself.
-- Safe to rerun.

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS customer_note text;

NOTIFY pgrst, 'reload schema';
