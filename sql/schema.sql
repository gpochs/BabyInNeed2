create extension if not exists pgcrypto;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text,
  price text,
  size text,
  notes text,
  priority text check (priority in ('low', 'medium', 'high')) default 'medium',
  category text,
  status text check (status in ('offen', 'reserviert')) default 'offen',
  claimed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create index for better performance
create index if not exists idx_items_status on public.items(status);
create index if not exists idx_items_category on public.items(category);
create index if not exists idx_items_priority on public.items(priority);
create index if not exists idx_items_created_at on public.items(created_at);

-- Enable row level security
alter table public.items enable row level security;

-- Policies for items table
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'items' and policyname = 'public read items') then
    create policy "public read items" on public.items for select to anon using (true);
  end if;
  
  if not exists (select 1 from pg_policies where tablename = 'items' and policyname = 'public insert items') then
    create policy "public insert items" on public.items for insert to anon with check (true);
  end if;
  
  if not exists (select 1 from pg_policies where tablename = 'items' and policyname = 'public update items') then
    create policy "public update items" on public.items for update to anon using (true) with check (true);
  end if;
  
  if not exists (select 1 from pg_policies where tablename = 'items' and policyname = 'public delete items') then
    create policy "public delete items" on public.items for delete to anon using (true);
  end if;
end $$;

create table if not exists public.config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Enable row level security
alter table public.config enable row level security;

-- Policies for config table
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'config' and policyname = 'public read config') then
    create policy "public read config" on public.config for select to anon using (true);
  end if;
  
  if not exists (select 1 from pg_policies where tablename = 'config' and policyname = 'public insert config') then
    create policy "public insert config" on public.config for insert to anon with check (true);
  end if;
  
  if not exists (select 1 from pg_policies where tablename = 'config' and policyname = 'public update config') then
    create policy "public update config" on public.config for update to anon using (true) with check (true);
  end if;
end $$;

-- Insert default config
insert into public.config (key, value)
values 
  ('email_recipients', jsonb_build_object('emails', '')),
  ('app_settings', jsonb_build_object(
    'notify_on_claim', true,
    'custom_message', '',
    'theme', 'light'
  ))
on conflict (key) do nothing;

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to automatically update updated_at
create trigger update_items_updated_at
  before update on public.items
  for each row
  execute function update_updated_at_column();
