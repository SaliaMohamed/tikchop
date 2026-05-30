-- Tikchop - hardening bot tables and missing FK index.
-- Applied live on Supabase project suhqntkvldwzrzaidnsw.

CREATE INDEX IF NOT EXISTS idx_order_items_product_id
  ON public.order_items(product_id);

CREATE OR REPLACE FUNCTION public.mark_processed(ids bigint[])
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  UPDATE public.messages
  SET statut = 'processed'
  WHERE id = ANY(ids);
END;
$function$;

REVOKE ALL ON public.messages FROM anon;
REVOKE ALL ON public.tikchop_customer_followups FROM anon;
REVOKE ALL ON public.tikchop_customer_handoffs FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tikchop_customer_followups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tikchop_customer_handoffs TO authenticated;

DROP POLICY IF EXISTS messages_owner_all ON public.messages;
CREATE POLICY messages_owner_all
  ON public.messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sellers s
      WHERE s.slug = messages.seller_slug
        AND s.owner_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sellers s
      WHERE s.slug = messages.seller_slug
        AND s.owner_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS tikchop_customer_followups_owner_all ON public.tikchop_customer_followups;
CREATE POLICY tikchop_customer_followups_owner_all
  ON public.tikchop_customer_followups
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sellers s
      WHERE s.id = tikchop_customer_followups.seller_id
        AND s.owner_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sellers s
      WHERE s.id = tikchop_customer_followups.seller_id
        AND s.owner_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS tikchop_customer_handoffs_owner_all ON public.tikchop_customer_handoffs;
CREATE POLICY tikchop_customer_handoffs_owner_all
  ON public.tikchop_customer_handoffs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sellers s
      WHERE s.slug = tikchop_customer_handoffs.seller_slug
        AND s.owner_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sellers s
      WHERE s.slug = tikchop_customer_handoffs.seller_slug
        AND s.owner_user_id = (SELECT auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';
