-- Rated catalog tables. Run once in the Supabase SQL editor.
-- User ratings stay in the app (localStorage). These tables are catalog-only.

create table if not exists public.artists (
    id bigint generated always as identity primary key,
    provider text not null,
    provider_id text not null,
    name text not null,
    image_url text,
    genres text[] not null default '{}',
    country text,
    popularity integer,
    release_count integer not null default 0,
    discovery_status text,
    first_seen date,
    provider_url text,
    updated_at timestamptz not null default now(),
    unique (provider, provider_id)
);

create table if not exists public.albums (
    id bigint generated always as identity primary key,
    provider text not null,
    provider_id text not null,
    artist_provider_id text,
    title text not null,
    artist_name text not null,
    artwork_url text,
    release_date date,
    project_type text,
    track_count integer,
    genres text[] not null default '{}',
    provider_url text,
    updated_at timestamptz not null default now(),
    unique (provider, provider_id)
);

create table if not exists public.tracks (
    id bigint generated always as identity primary key,
    provider text not null,
    provider_id text not null,
    album_provider_id text,
    title text not null,
    track_number integer,
    duration integer,
    explicit boolean,
    unique (provider, provider_id)
);

create table if not exists public.catalog_jobs (
    id text primary key,
    status text not null default 'idle',
    checkpoint jsonb not null default '{}'::jsonb,
    stats jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

alter table public.artists enable row level security;
alter table public.albums enable row level security;
alter table public.tracks enable row level security;
alter table public.catalog_jobs enable row level security;

create policy "public read artists" on public.artists for select using (true);
create policy "public read albums" on public.albums for select using (true);
create policy "public read tracks" on public.tracks for select using (true);
