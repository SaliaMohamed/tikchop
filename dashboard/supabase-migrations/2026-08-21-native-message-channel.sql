-- Djassaman natif - messagerie native Tikchop (phase 0: fondations).
-- Ajoute le canal natif cote messages + plan vendeur.
-- Safe to rerun.

alter table public.messages
  add column if not exists channel text not null default 'whatsapp',
  add column if not exists client_name text;

create index if not exists idx_messages_seller_channel_created
  on public.messages(seller_slug, channel, created_at desc);

alter table public.sellers
  add column if not exists plan text not null default 'native';

alter table public.sellers
  drop constraint if exists sellers_plan_check;

alter table public.sellers
  add constraint sellers_plan_check
  check (plan in ('native', 'premium'));

notify pgrst, 'reload schema';