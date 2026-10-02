-- Passport governed-delegation control plane
-- Applied to Supabase project nrjfbqgvigankejaajrt on 2026-09-27.

create table if not exists public.passport_authority_controls (
  passport_id text primary key references public.agent_passports(passport_id) on delete restrict,
  authority_envelope jsonb not null,
  enforcement_state text not null default 'active'
    check (enforcement_state in ('active', 'quarantined', 'suspended')),
  state_reason text,
  state_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(authority_envelope) = 'object')
);

create table if not exists public.passport_authority_events (
  sequence_id bigint generated always as identity primary key,
  event_id uuid not null default gen_random_uuid() unique,
  passport_id text not null references public.agent_passports(passport_id) on delete restrict,
  event_type text not null check (event_type in ('issued', 'renewed', 'quarantined', 'released', 'suspended', 'revoked', 'constraint_changed')),
  actor text not null,
  reason text,
  event_payload jsonb not null default '{}'::jsonb,
  previous_event_hash text check (previous_event_hash is null or previous_event_hash ~ '^[0-9a-f]{64}$'),
  event_hash text not null unique check (event_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  check (jsonb_typeof(event_payload) = 'object')
);

create index if not exists passport_authority_controls_state_idx
  on public.passport_authority_controls (enforcement_state, state_updated_at desc);
create index if not exists passport_authority_events_passport_idx
  on public.passport_authority_events (passport_id, sequence_id desc);

alter table public.passport_authority_controls enable row level security;
alter table public.passport_authority_events enable row level security;

create or replace function public.prevent_passport_history_mutation()
returns trigger language plpgsql security invoker set search_path = public
as $$
begin
  raise exception 'Passport history is append-only';
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'passport_authority_events_append_only' and tgrelid = 'public.passport_authority_events'::regclass) then
    create trigger passport_authority_events_append_only before update or delete on public.passport_authority_events
      for each row execute function public.prevent_passport_history_mutation();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'passport_decision_receipts_append_only' and tgrelid = 'public.passport_decision_receipts'::regclass) then
    create trigger passport_decision_receipts_append_only before update or delete on public.passport_decision_receipts
      for each row execute function public.prevent_passport_history_mutation();
  end if;
end;
$$;
