create extension if not exists pgcrypto;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  url text,
  price text,
  size text,
  notes text,
  claimed_at timestamptz,
  created_at timestamptz default now()
);
alter table public.items enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'items' and policyname = 'public read items') then
    create policy "public read items" on public.items for select to anon using (true);
  end if;
end $$;

create table if not exists public.config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);
alter table public.config enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'config' and policyname = 'public read config') then
    create policy "public read config" on public.config for select to anon using (true);
  end if;
end $$;

insert into public.config (key, value)
values ('recipients', jsonb_build_object('emails', ''))
on conflict (key) do nothing;
