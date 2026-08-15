-- S/Agency model asset runtime mirror contract.
-- Prepared only. Do not apply to production until the owner approves the registry contract.
-- Canonical source: GitHub s-agency/model-assets + Agent_memory Google Sheet.

create table if not exists public.s_agency_model_assets (
  asset_id text primary key,
  model_repo text not null,
  source_url text not null,
  primary_capability text not null,
  model_class text not null,
  agent_fit text not null,
  allowed_use text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  owner_control text not null,
  approval_status text not null check (approval_status in ('approved', 'pending_owner_review', 'hold', 'rejected')),
  passport_requirement text not null check (passport_requirement in ('required', 'not_required')),
  activation_status text not null check (activation_status in ('registry_only', 'runtime_ready', 'active', 'retired')),
  supabase_mirror text not null check (supabase_mirror in ('prepared', 'synced', 'blocked')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.s_agency_model_assets enable row level security;

-- Policy intentionally omitted until the live Supabase project, auth model, and owner role source are confirmed.
-- Avoid using user-editable metadata for authorization decisions.
