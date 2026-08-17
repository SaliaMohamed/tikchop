-- WhatsApp OTP login (connexion sans mot de passe).
-- Applied live on 2026-08-16. Safe to rerun.

create table if not exists public.login_otps (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_login_otps_phone_created
  on public.login_otps (phone, created_at desc);

alter table public.login_otps enable row level security;

-- No anon/authenticated policies: only service_role can access (bypasses RLS).
notify pgrst, 'reload schema';