-- 0005: 店の出どころ（place_provider）と Google の写しの更新時刻（place_synced_at）。ADR 0011 / Issue #35
-- Google の店は place_id（external_place_id）だけ永続し、名前・住所・座標は 30 日以内に更新する写しとして扱う。
-- NULL の place_provider = 手入力の店。RLS は既存の「owner all」のまま（列の追加のみ）。
begin;

alter table public.shops
  add column place_provider text,
  add column place_synced_at timestamptz;

alter table public.shops
  add constraint shops_place_provider_check check (place_provider in ('google', 'osm')),
  -- Google の店は place_id が無いと更新できない
  add constraint shops_google_needs_place_id check (place_provider is distinct from 'google' or external_place_id is not null);

-- 既存の OSM 由来の店（Overpass / Photon / Nominatim の "node/123" 形式）
update public.shops
set place_provider = 'osm'
where external_place_id ~ '^(node|way|relation)/[0-9]+$';

-- 同じ利用者が同じ店を二重に登録しない（手入力の店は external_place_id が NULL なので対象外）
create unique index shops_user_place_uidx
  on public.shops (user_id, place_provider, external_place_id)
  where external_place_id is not null;

commit;
