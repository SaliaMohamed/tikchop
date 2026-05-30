-- Migration : Ajout du branding boutique et adresse physique
ALTER TABLE public.sellers 
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS brand_color text DEFAULT '#008f5a',
ADD COLUMN IF NOT EXISTS physical_address text;
