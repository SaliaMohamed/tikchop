alter table public.sellers
  add column if not exists whatsapp_provider text,
  add column if not exists evolution_instance text,
  add column if not exists whatsapp_status text default 'disconnected',
  add column if not exists whatsapp_connected_at timestamptz,
  add column if not exists whatsapp_last_pairing_at timestamptz,
  add column if not exists whatsapp_last_error text;

create index if not exists idx_sellers_evolution_instance
  on public.sellers (evolution_instance);

update public.sellers
set
  whatsapp_provider = coalesce(whatsapp_provider, 'evolution'),
  evolution_instance = coalesce(evolution_instance, slug),
  whatsapp_status = coalesce(whatsapp_status, 'disconnected')
where slug is not null;
