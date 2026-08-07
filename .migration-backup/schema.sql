-- Schéma Supabase pour Plateforme de Mini-boutiques (TikTok Sellers)

-- 1. Table: Vendeurs (sellers)
CREATE TABLE public.sellers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone_number text NOT NULL UNIQUE,
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- Index pour la recherche par slug (très fréquent)
CREATE INDEX idx_sellers_slug ON public.sellers(slug);
CREATE INDEX idx_sellers_phone ON public.sellers(phone_number);

-- 2. Table: Produits (products)
CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    name text NOT NULL,
    price numeric NOT NULL,
    stock_quantity integer DEFAULT 0,
    image_url text,
    description text,
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
    payment_method text CHECK (payment_method IN ('WAVE', 'PAYSTACK')),
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- Index pour rechercher les commandes par vendeur
CREATE INDEX idx_orders_seller_id ON public.orders(seller_id);
CREATE INDEX idx_orders_order_ref ON public.orders(order_ref);

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
