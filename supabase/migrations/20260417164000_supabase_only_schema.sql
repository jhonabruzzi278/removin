-- Removin schema (Supabase-only, no Neon/Prisma)
-- Run this in Supabase SQL Editor once.

create table if not exists public.replicate_credentials (
  auth_user_id text primary key,
  token_cipher text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.temporary_uploads (
  id text primary key,
  auth_user_id text not null,
  logical_path text not null,
  file_name text not null,
  mime_type text not null,
  byte_size integer not null,
  payload_cipher text not null,
  access_token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_temporary_uploads_auth_user_id
  on public.temporary_uploads (auth_user_id, created_at desc);

create index if not exists idx_temporary_uploads_expires_at
  on public.temporary_uploads (expires_at);

alter table public.replicate_credentials enable row level security;
alter table public.temporary_uploads enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_replicate_credentials_updated_at on public.replicate_credentials;
create trigger trg_replicate_credentials_updated_at
before update on public.replicate_credentials
for each row
execute function public.set_updated_at();
