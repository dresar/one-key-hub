create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider_name text not null,
  provider_type text not null default 'ai',
  label text,
  credentials jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  total_requests integer not null default 0,
  failed_requests integer not null default 0,
  cooldown_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_provider_credentials_user on public.provider_credentials(user_id);
create index if not exists idx_provider_credentials_provider on public.provider_credentials(provider_name);

create table if not exists public.api_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  api_key text,
  is_active boolean not null default true,
  rate_limit integer not null default 100,
  allowed_providers text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_api_clients_user on public.api_clients(user_id);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.users(id) on delete cascade,
  key_hash text not null unique,
  key_ciphertext text,
  status text not null default 'active',
  grace_until timestamptz,
  rotated_from uuid references public.api_keys(id) on delete set null,
  quota_per_minute integer not null default 1000,
  allowed_providers text[] not null default '{}'::text[],
  name text,
  client_username text,
  client_password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.api_keys add column if not exists key_ciphertext text;
create index if not exists idx_api_keys_tenant on public.api_keys(tenant_id);
create index if not exists idx_api_keys_status on public.api_keys(status);

create table if not exists public.gateway_request_logs (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid references public.api_keys(id) on delete set null,
  tenant_id uuid not null references public.users(id) on delete cascade,
  provider text,
  method text,
  status_code integer,
  response_time_ms integer,
  origin_domain text,
  request_path text,
  error_type text,
  error_message text,
  credential_id uuid references public.provider_credentials(id) on delete set null,
  client_auth_used boolean not null default false,
  rate_limited boolean not null default false,
  breaker_open boolean not null default false,
  upstream_status integer,
  detected_anomaly_types text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_gateway_logs_tenant_created on public.gateway_request_logs(tenant_id, created_at desc);
create index if not exists idx_gateway_logs_api_key_created on public.gateway_request_logs(api_key_id, created_at desc);

create table if not exists public.gateway_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.users(id) on delete cascade,
  api_key_id uuid references public.api_keys(id) on delete set null,
  title text not null default 'Alert',
  message text not null default '',
  severity text not null default 'info',
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  acknowledged_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_gateway_alerts_tenant_created on public.gateway_alerts(tenant_id, created_at desc);

create table if not exists public.system_settings (
  user_id uuid not null references public.users(id) on delete cascade,
  setting_key text not null,
  setting_value jsonb not null default 'null'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, setting_key)
);

create table if not exists public.ai_models (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model_id text not null,
  display_name text,
  is_default boolean not null default false,
  supports_vision boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, model_id)
);

create table if not exists public.upload_expiry (
  id bigserial primary key,
  tenant_id uuid not null references public.users(id) on delete cascade,
  credential_id uuid references public.provider_credentials(id) on delete set null,
  provider text not null,
  external_id text not null,
  delete_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_upload_expiry_delete_at on public.upload_expiry(delete_at);

create table if not exists public.revoked_tokens (
  jti text primary key,
  exp timestamptz not null
);
create index if not exists idx_revoked_tokens_exp on public.revoked_tokens(exp);
