-- Update script for existing databases
-- Run this in Supabase SQL Editor to add missing columns

-- Add missing columns if they don't exist
do $$ begin
  -- Add color column
  if not exists (select 1 from information_schema.columns where table_name = 'items' and column_name = 'color') then
    alter table public.items add column color text;
    raise notice 'Added color column';
  else
    raise notice 'Color column already exists';
  end if;
  
  -- Add link column
  if not exists (select 1 from information_schema.columns where table_name = 'items' and column_name = 'link') then
    alter table public.items add column link text;
    raise notice 'Added link column';
  else
    raise notice 'Link column already exists';
  end if;
  
  -- Add status column
  if not exists (select 1 from information_schema.columns where table_name = 'items' and column_name = 'status') then
    alter table public.items add column status text check (status in ('offen', 'reserviert')) default 'offen';
    raise notice 'Added status column';
  else
    raise notice 'Status column already exists';
  end if;
  
  -- Add priority column
  if not exists (select 1 from information_schema.columns where table_name = 'items' and column_name = 'priority') then
    alter table public.items add column priority text check (priority in ('low', 'medium', 'high')) default 'medium';
    raise notice 'Added priority column';
  else
    raise notice 'Priority column already exists';
  end if;
  
  -- Add category column
  if not exists (select 1 from information_schema.columns where table_name = 'items' and column_name = 'category') then
    alter table public.items add column category text;
    raise notice 'Added category column';
  else
    raise notice 'Category column already exists';
  end if;
  
  -- Update existing items to have default status and priority
  update public.items set status = 'offen' where status is null;
  update public.items set priority = 'medium' where priority is null;
  
  raise notice 'Database schema updated successfully!';
end $$;
