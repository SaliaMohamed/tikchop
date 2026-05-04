-- Migration: Delivery and Order Management
-- Date: 2026-05-03

-- 1. Extend order_status enum
-- Note: In Supabase/Postgres, adding values to an enum is done with ALTER TYPE
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'PREPARED';

-- 2. Add delivery-related types
DO $$ BEGIN
    CREATE TYPE delivery_type AS ENUM ('DELIVERY', 'PICKUP');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE delivery_payment_timing AS ENUM ('INCLUDED', 'AT_RECEPTION', 'OFFERED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Update sellers table for shop parameters
ALTER TABLE public.sellers 
ADD COLUMN IF NOT EXISTS delivery_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS pickup_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS fixed_delivery_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_payment_timing delivery_payment_timing DEFAULT 'AT_RECEPTION',
ADD COLUMN IF NOT EXISTS auto_share_to_driver boolean DEFAULT false;

-- 4. Create delivery_drivers table
CREATE TABLE IF NOT EXISTS public.delivery_drivers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    name text NOT NULL,
    phone_number text NOT NULL,
    zone text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- Index for drivers by seller
CREATE INDEX IF NOT EXISTS idx_drivers_seller_id ON public.delivery_drivers(seller_id);

-- 5. Update orders table for delivery details
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_type delivery_type DEFAULT 'DELIVERY',
ADD COLUMN IF NOT EXISTS delivery_zone text,
ADD COLUMN IF NOT EXISTS delivery_address text,
ADD COLUMN IF NOT EXISTS delivery_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_driver_id uuid REFERENCES public.delivery_drivers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'PENDING'; -- PENDING, SHIPPED, DELIVERED

-- 6. Add RLS for delivery_drivers
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can manage their own drivers."
ON public.delivery_drivers FOR ALL
USING ( auth.uid() = seller_id );
