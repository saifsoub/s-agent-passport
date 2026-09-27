-- Additive control records for the existing public.agent_passports registry.
-- Historical passports remain ungoverned until an issuer writes a signed envelope.
create table public.passport_authority_envelopes (
  passport_id text primary key references public.agent_passports(passport_id),
  envelope jsonb not null check (jsonb_typeof(envelope) = 'object'),
  envelope_sha256 text not null check (envelope_sha256 ~ '^[0-9a-f]{64}$'),
  issuer_signature text not null check (length(issuer_signature) > 0),
  issuer_key_id text not null check (length(issuer_key_id) > 0),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at > issued_at),
  constraint passport_authority_minimum check (
    envelope ?& array['owner','purpose','capabilities','constraints','delegation','lifecycle']
  )
);

create table public.passport_decision_receipts (
  sequence_id bigint generated always as identity primary key,
  receipt_id text not null unique,
  passport_id text not null references public.agent_passports(passport_id),
  action_id text not null,
  lane text not null check (lane in ('green','yellow','red')),
  decision text not null check (decision in ('allow','deny','require_validation','require_owner_approval')),
  reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(reasons) = 'array'),
  evaluated_at timestamptz not null,
  previous_receipt_hash text check (previous_receipt_hash is null or previous_receipt_hash ~ '^[0-9a-f]{64}$'),
  receipt_hash text not null unique check (receipt_hash ~ '^[0-9a-f]{64}$')
);
create index passport_decision_receipts_chain_idx on public.passport_decision_receipts(passport_id, sequence_id desc);

create function public.passport_receipt_chain_guard() returns trigger
language plpgsql set search_path = '' as $$
declare last_hash text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.passport_id)::bigint);
  select r.receipt_hash into last_hash
    from public.passport_decision_receipts r
    where r.passport_id = new.passport_id
    order by r.sequence_id desc limit 1;
  if new.previous_receipt_hash is distinct from last_hash then
    raise exception 'passport receipt chain mismatch';
  end if;
  return new;
end;
$$;
create trigger passport_receipt_chain_guard before insert on public.passport_decision_receipts
for each row execute function public.passport_receipt_chain_guard();

create function public.passport_governance_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'passport governance records are append-only; issue a replacement passport';
end;
$$;
create trigger passport_authority_immutable before update or delete on public.passport_authority_envelopes
for each row execute function public.passport_governance_immutable();
create trigger passport_receipt_immutable before update or delete on public.passport_decision_receipts
for each row execute function public.passport_governance_immutable();

alter table public.passport_authority_envelopes enable row level security;
alter table public.passport_decision_receipts enable row level security;
revoke all on public.passport_authority_envelopes, public.passport_decision_receipts from anon, authenticated;
grant select, insert on public.passport_authority_envelopes, public.passport_decision_receipts to service_role;
grant usage, select on sequence public.passport_decision_receipts_sequence_id_seq to service_role;
