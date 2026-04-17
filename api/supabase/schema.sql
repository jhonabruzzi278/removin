create extension if not exists pgcrypto;

create table if not exists public.users (
  id text primary key,
  clerk_id text unique not null,
  email text unique not null,
  name text,
  picture_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.replicate_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id text unique not null references public.users(id) on delete cascade,
  token_cipher text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.temporary_uploads (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  logical_path text not null,
  file_name text not null,
  mime_type text not null,
  byte_size integer not null,
  payload_cipher text not null,
  payload_iv text not null,
  payload_auth_tag text not null,
  access_token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_temporary_uploads_user_created
  on public.temporary_uploads(user_id, created_at);

create index if not exists idx_temporary_uploads_expires_at
  on public.temporary_uploads(expires_at);
