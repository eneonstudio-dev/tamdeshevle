-- Там Дешевле account backend. Run in Supabase SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Покупатель' check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.baskets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Моя корзина' check (char_length(name) between 1 and 80),
  city text not null check (city in ('msk','spb')),
  store_id text,
  items jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists baskets_user_id_idx on public.baskets(user_id);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Адрес' check (char_length(label) between 1 and 40),
  address text not null check (char_length(address) between 1 and 240),
  city text check (city in ('msk','spb')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists addresses_user_id_idx on public.addresses(user_id);

create table if not exists public.basket_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  city text not null check (city in ('msk','spb')),
  store_id text,
  total integer not null check (total >= 0),
  item_count integer not null default 0 check (item_count >= 0),
  items jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  unique(user_id, day, city)
);
create index if not exists basket_history_user_day_idx on public.basket_history(user_id, day desc);

create table if not exists public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  favorite_stores jsonb not null default '[]'::jsonb,
  price_alerts boolean not null default true,
  marketing boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.baskets enable row level security;
alter table public.addresses enable row level security;
alter table public.basket_history enable row level security;
alter table public.preferences enable row level security;

create policy "profiles own rows" on public.profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "baskets own rows" on public.baskets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "addresses own rows" on public.addresses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "basket_history own rows" on public.basket_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "preferences own rows" on public.preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(user_id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), 'Покупатель'))
  on conflict (user_id) do nothing;
  insert into public.preferences(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
