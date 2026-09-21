-- 0001_init.sql
-- REQUIREMENTS.md §4 のテーブル定義と §4.3 のアクセス制御（RLS）。
-- 方針: すべてのユーザー所有テーブルに user_id を持ち、RLS で auth.uid() = user_id を強制する。
--       roasters のみ共有マスタ（読み取り全員可 / INSERT 認証ユーザー可 / UPDATE・DELETE は created_by 本人のみ）。

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 共通: updated_at を自動更新するトリガー関数
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- roasters（ロースターマスタ。ユーザー横断で共有）
-- ---------------------------------------------------------------------------
create table public.roasters (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  -- 大文字小文字・前後空白を正規化した名前。重複登録防止用（CLAUDE.md §4）
  name_normalized text generated always as (lower(btrim(name))) stored,
  website     text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint roasters_name_not_blank check (btrim(name) <> '')
);
create unique index roasters_name_normalized_key on public.roasters (name_normalized);
create trigger roasters_set_updated_at before update on public.roasters
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- shops（店。ユーザーごと）
-- ---------------------------------------------------------------------------
create table public.shops (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  name              text not null,
  kind              text check (kind in ('cafe', 'roaster', 'green_bean_shop', 'other')),
  address           text,
  lat               double precision,
  lng               double precision,
  external_place_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint shops_name_not_blank check (btrim(name) <> ''),
  -- 座標は両方 NULL か両方あり
  constraint shops_latlng_pair check ((lat is null) = (lng is null)),
  constraint shops_lat_range check (lat is null or (lat between -90 and 90)),
  constraint shops_lng_range check (lng is null or (lng between -180 and 180))
);
create index shops_user_id_idx on public.shops (user_id);
create trigger shops_set_updated_at before update on public.shops
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- beans（豆。ユーザーごと）
-- ---------------------------------------------------------------------------
create table public.beans (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  roaster_id       uuid references public.roasters (id) on delete set null,
  name             text not null,
  country          text,
  region           text,
  variety          text,
  process          text,
  altitude_m       integer check (altitude_m is null or altitude_m >= 0),
  flavor_notes     text[] not null default '{}',
  description      text,
  taste_flavor     smallint check (taste_flavor     is null or taste_flavor     between 1 and 5),
  taste_sweetness  smallint check (taste_sweetness  is null or taste_sweetness  between 1 and 5),
  taste_acidity    smallint check (taste_acidity    is null or taste_acidity    between 1 and 5),
  taste_aftertaste smallint check (taste_aftertaste is null or taste_aftertaste between 1 and 5),
  taste_body       smallint check (taste_body       is null or taste_body       between 1 and 5),
  price_jpy        integer check (price_jpy is null or price_jpy >= 0),
  price_grams      integer check (price_grams is null or price_grams > 0),
  roast_level      text check (roast_level is null or roast_level in ('light', 'medium', 'dark')),
  source           text not null check (source in ('purchased', 'home_roasted')),
  roasted_on       date,
  reference_url    text,
  ocr_raw          jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint beans_name_not_blank check (btrim(name) <> '')
);
create index beans_user_id_idx on public.beans (user_id);
create index beans_roaster_id_idx on public.beans (roaster_id);
create trigger beans_set_updated_at before update on public.beans
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- bean_images（カード画像 表・裏）
-- ---------------------------------------------------------------------------
create table public.bean_images (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  bean_id      uuid not null references public.beans (id) on delete cascade,
  side         text not null check (side in ('front', 'back')),
  storage_path text not null,
  created_at   timestamptz not null default now(),
  unique (bean_id, side)
);
create index bean_images_user_id_idx on public.bean_images (user_id);

-- ---------------------------------------------------------------------------
-- roasts（自家焙煎バッチ）
-- ---------------------------------------------------------------------------
create table public.roasts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  bean_id       uuid not null references public.beans (id) on delete cascade,
  roasted_on    date not null,
  method        text,
  green_grams   integer check (green_grams   is null or green_grams   > 0),
  roasted_grams integer check (roasted_grams is null or roasted_grams > 0),
  duration_sec  integer check (duration_sec  is null or duration_sec  > 0),
  roast_level   text check (roast_level is null or roast_level in ('light', 'medium_light', 'medium', 'medium_dark', 'dark')),
  green_shop_id uuid references public.shops (id) on delete set null,
  memo          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index roasts_user_id_idx on public.roasts (user_id);
create index roasts_bean_id_idx on public.roasts (bean_id);
create trigger roasts_set_updated_at before update on public.roasts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- logs（飲んだ／買った記録）
-- ---------------------------------------------------------------------------
create table public.logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  bean_id         uuid not null references public.beans (id) on delete cascade,
  roast_id        uuid references public.roasts (id) on delete set null,
  shop_id         uuid references public.shops (id) on delete set null,
  kind            text not null default 'drank' check (kind in ('drank', 'bought')),
  place           text not null check (place in ('shop', 'home')),
  logged_on       date not null default current_date,
  -- 星: 1.0〜5.0 の 0.5 刻み（決定 Q4）
  rating          numeric(2,1) check (rating is null or (rating between 1.0 and 5.0 and (rating * 2) = floor(rating * 2))),
  brew_method     text,
  grinder         text,
  grind_setting   text,
  dose_g          numeric check (dose_g  is null or dose_g  > 0),
  water_g         numeric check (water_g is null or water_g > 0),
  water_temp_c    smallint check (water_temp_c is null or water_temp_c between 0 and 100),
  brew_time_sec   integer check (brew_time_sec is null or brew_time_sec > 0),
  recipe_memo     text,
  memo            text,
  purchased_grams integer check (purchased_grams is null or purchased_grams > 0),
  photo_path      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- place=home のときは shop_id を持たない
  constraint logs_home_has_no_shop check (place <> 'home' or shop_id is null)
);
create index logs_user_id_logged_on_idx on public.logs (user_id, logged_on desc);
create index logs_bean_id_idx on public.logs (bean_id);
create index logs_shop_id_idx on public.logs (shop_id);
create index logs_roast_id_idx on public.logs (roast_id);
create trigger logs_set_updated_at before update on public.logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tags / log_tags
-- ---------------------------------------------------------------------------
create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  constraint tags_name_not_blank check (btrim(name) <> ''),
  unique (user_id, name)
);

create table public.log_tags (
  log_id  uuid not null references public.logs (id) on delete cascade,
  tag_id  uuid not null references public.tags (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (log_id, tag_id)
);
create index log_tags_tag_id_idx on public.log_tags (tag_id);

-- ---------------------------------------------------------------------------
-- RLS: ユーザー所有テーブル（auth.uid() = user_id）
-- ---------------------------------------------------------------------------
alter table public.shops       enable row level security;
alter table public.beans       enable row level security;
alter table public.bean_images enable row level security;
alter table public.roasts      enable row level security;
alter table public.logs        enable row level security;
alter table public.tags        enable row level security;
alter table public.log_tags    enable row level security;

create policy "shops: owner all" on public.shops
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "beans: owner all" on public.beans
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "bean_images: owner all" on public.bean_images
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "roasts: owner all" on public.roasts
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "logs: owner all" on public.logs
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "tags: owner all" on public.tags
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "log_tags: owner all" on public.log_tags
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- RLS: roasters（共有マスタ。決定 Q5）
-- ---------------------------------------------------------------------------
alter table public.roasters enable row level security;

create policy "roasters: read all" on public.roasters
  for select to authenticated using (true);

create policy "roasters: insert authenticated" on public.roasters
  for insert to authenticated with check ((select auth.uid()) = created_by);

create policy "roasters: update by creator" on public.roasters
  for update to authenticated
  using ((select auth.uid()) = created_by) with check ((select auth.uid()) = created_by);

create policy "roasters: delete by creator" on public.roasters
  for delete to authenticated using ((select auth.uid()) = created_by);

-- ---------------------------------------------------------------------------
-- Storage: bean-images バケット（パス {user_id}/{bean_id}/{front|back}.jpg）
-- 先頭フォルダ名 = 自分の uid のオブジェクトだけ操作可
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bean-images', 'bean-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "bean-images: owner select" on storage.objects
  for select to authenticated
  using (bucket_id = 'bean-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "bean-images: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'bean-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "bean-images: owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'bean-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'bean-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "bean-images: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'bean-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
