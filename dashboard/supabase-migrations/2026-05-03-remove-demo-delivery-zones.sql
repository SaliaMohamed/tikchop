-- Removes only the demo zones inserted during development for the salia shop.
-- This keeps any zone where the seller already changed the fee.

DELETE FROM public.delivery_zones
WHERE seller_id = (SELECT id FROM public.sellers WHERE slug = 'salia')
  AND (name, fee) IN (
    ('Cocody', 1500::numeric),
    ('Marcory', 1500::numeric),
    ('Plateau', 1000::numeric),
    ('Yopougon', 2000::numeric)
  );

NOTIFY pgrst, 'reload schema';
