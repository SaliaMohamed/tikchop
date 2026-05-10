-- Tikchop WhatsApp message deduplication and faster batch lookups.

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS external_message_id text,
ADD COLUMN IF NOT EXISTS seller_slug text,
ADD COLUMN IF NOT EXISTS customer_phone text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_external_message_id
ON public.messages(external_message_id)
WHERE external_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_client_status_created
ON public.messages(client, statut, created_at DESC);

NOTIFY pgrst, 'reload schema';
