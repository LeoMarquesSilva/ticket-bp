create table public.app_c009c0e4f1_ticket_teams_oauth (
  singleton boolean primary key default true check (singleton),
  account_id uuid not null,
  account_email text not null,
  account_display_name text,
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_c009c0e4f1_ticket_teams_oauth
  enable row level security;

revoke all
  on table public.app_c009c0e4f1_ticket_teams_oauth
  from anon, authenticated;

grant select, insert, update, delete
  on table public.app_c009c0e4f1_ticket_teams_oauth
  to service_role;

create function public.helpdesk_touch_ticket_teams_oauth()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger helpdesk_touch_ticket_teams_oauth
before update on public.app_c009c0e4f1_ticket_teams_oauth
for each row execute function public.helpdesk_touch_ticket_teams_oauth();

revoke all
  on function public.helpdesk_touch_ticket_teams_oauth()
  from public, anon, authenticated;
