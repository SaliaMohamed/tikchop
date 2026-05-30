-- Schéma Supabase pour Plateforme de Mini-boutiques (TikTok Sellers)

-- 1. Table: Vendeurs (sellers)
CREATE TABLE public.sellers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone_number text NOT NULL UNIQUE,
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    waha_session text UNIQUE,
    paystack_subaccount_code text,
    bot_tone text DEFAULT 'Francais ivoirien simple, poli, direct.',
    bot_greeting text,
    bot_payment_preferences text DEFAULT 'Wave, Orange Money, MTN MoMo, Djamo, paiement a la livraison selon la zone.',
    bot_delivery_notes text,
    bot_special_rules text,
    accepted_payment_methods text[] NOT NULL DEFAULT ARRAY['CASH_ON_DELIVERY','WAVE','ORANGE_MONEY','MTN_MONEY']::text[],
    default_payment_method text NOT NULL DEFAULT 'CASH_ON_DELIVERY',
    logo_url text,
    brand_color text DEFAULT '#008f5a',
    physical_address text,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- Index pour la recherche par slug (très fréquent)
CREATE INDEX idx_sellers_slug ON public.sellers(slug);
CREATE INDEX idx_sellers_phone ON public.sellers(phone_number);
CREATE INDEX idx_sellers_waha_session ON public.sellers(waha_session);

-- 2. Table: Produits (products)
CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    name text NOT NULL,
    price numeric NOT NULL,
    stock_quantity integer DEFAULT 0,
    image_url text,
    description text,
    product_variants jsonb DEFAULT '[]'::jsonb,
    product_keywords text,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- Index pour rechercher les produits par vendeur
CREATE INDEX idx_products_seller_id ON public.products(seller_id);

-- 3. Table: Commandes (orders)
CREATE TYPE order_status AS ENUM ('PENDING', 'PAID', 'DELIVERED', 'CANCELLED');

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    order_ref text NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)) UNIQUE,
    customer_phone text NOT NULL,
    status order_status DEFAULT 'PENDING',
    total_amount numeric NOT NULL,
    payment_method text CHECK (payment_method IN ('WAVE', 'ORANGE_MONEY', 'MTN_MONEY', 'CASH_ON_DELIVERY', 'PAYSTACK')),
    paystack_reference text UNIQUE,
    paystack_authorization_url text,
    paystack_payment_status text,
    paystack_paid_at timestamp with time zone,
    whatsapp_receipt_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- Index pour rechercher les commandes par vendeur
CREATE INDEX idx_orders_seller_id ON public.orders(seller_id);
CREATE INDEX idx_orders_order_ref ON public.orders(order_ref);
CREATE INDEX idx_orders_paystack_reference ON public.orders(paystack_reference);

-- Chatbot guardrails: pause bot when seller replies manually, avoid repeated follow-ups.
CREATE TABLE public.tikchop_customer_handoffs (
    seller_slug text NOT NULL,
    customer_phone text NOT NULL,
    instance_name text,
    paused_until timestamp with time zone NOT NULL,
    last_from_me_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (seller_slug, customer_phone)
);

CREATE INDEX idx_tikchop_customer_handoffs_active
ON public.tikchop_customer_handoffs(seller_slug, customer_phone, paused_until);

CREATE TABLE public.tikchop_customer_followups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid REFERENCES public.sellers(id) ON DELETE CASCADE,
    seller_slug text,
    customer_phone text NOT NULL,
    product_name text,
    sent_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE INDEX idx_tikchop_customer_followups_recent
ON public.tikchop_customer_followups(seller_id, customer_phone, sent_at DESC);

CREATE INDEX idx_tikchop_customer_followups_slug_recent
ON public.tikchop_customer_followups(seller_slug, customer_phone, sent_at DESC);

-- Chatbot message buffer and deduplication metadata.
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS external_message_id text,
ADD COLUMN IF NOT EXISTS seller_slug text,
ADD COLUMN IF NOT EXISTS customer_phone text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_external_message_id
ON public.messages(external_message_id)
WHERE external_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_client_status_created
ON public.messages(client, statut, created_at DESC);

-- 4. Table: Lignes de commande (order_items)
CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity integer NOT NULL,
    price_at_time numeric NOT NULL, -- Sauvegarde le prix au moment de l'achat
    PRIMARY KEY (id)
);

-- RLS (Row Level Security) - Configuration basique
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Les produits et les vendeurs sont lisibles par tout le monde (pour les boutiques publiques)
CREATE POLICY "Public profiles are viewable by everyone."
ON public.sellers FOR SELECT
USING ( true );

CREATE POLICY "Products are viewable by everyone."
ON public.products FOR SELECT
USING ( true );

-- Les vendeurs peuvent tout faire sur leurs propres produits (l'authentification sera gérée par l'API/Supabase)
-- (Pour l'instant, on laisse ces politiques simples. À adapter selon l'authentification n8n/Next.js)
CREATE POLICY "Sellers can manage their own products."
ON public.products FOR ALL
USING ( auth.uid() = seller_id );
