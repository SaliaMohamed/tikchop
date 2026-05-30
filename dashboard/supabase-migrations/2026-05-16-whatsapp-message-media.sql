-- Store WhatsApp media metadata so seller conversations can display photos, audio, video and documents.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_mime_type text,
  ADD COLUMN IF NOT EXISTS media_caption text,
  ADD COLUMN IF NOT EXISTS media_payload jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_messages_media_seller_created
  ON public.messages(seller_slug, created_at DESC)
  WHERE media_type IS NOT NULL;
