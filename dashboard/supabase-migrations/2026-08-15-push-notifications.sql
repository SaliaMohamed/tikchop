-- Push notifications: stocke les abonnements Web Push des vendeurs.
-- Chaque vendeur est lie a auth.users via sellers.owner_user_id.
-- L'abonnement appartient a l'utilisateur, et le push est envoye via
-- web-push (VAPID) depuis le serveur, jamais par l'anon.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_owner
  ON public.push_subscriptions(owner_user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Chaque vendeur gère ses propres abonnements push (lecture/écriture/suppression).
CREATE POLICY "Seller owners can manage their own push subscriptions."
  ON public.push_subscriptions
  FOR ALL
  USING (owner_user_id = (SELECT auth.uid()))
  WITH CHECK (owner_user_id = (SELECT auth.uid()));

-- Le serveur (service_role) lit les abonnements pour envoyer les notifications.
CREATE POLICY "Service role can read push subscriptions."
  ON public.push_subscriptions
  FOR SELECT
  USING (true);

-- Supprime les abonnements expirés (browser 410 Gone) en masse.
CREATE OR REPLACE FUNCTION public.delete_push_subscription(p_endpoint text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.push_subscriptions
  WHERE endpoint = p_endpoint;
$$;

REVOKE ALL ON FUNCTION public.delete_push_subscription(p_endpoint text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_push_subscription(p_endpoint text) FROM anon;
REVOKE ALL ON FUNCTION public.delete_push_subscription(p_endpoint text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_push_subscription(p_endpoint text) TO service_role;

NOTIFY pgrst, 'reload schema';
