-- 0007: Supabase Free の一時停止よけ（2026-11-10）。
-- 1 週間「データベースの活動」が少ないと Free のプロジェクトは自動で止まる（2026-11-07 に実際に止まった。
-- 週 2 回の REST の読み取りでは足りなかった）。Supabase の回答では「日時を 1 行更新する小さな書き込み」で足りるので、
-- GitHub Actions から毎日この関数を呼んで 1 行 upsert する。
-- 出典: https://supabase.com/docs/guides/platform/pausing / https://github.com/orgs/supabase/discussions/13121（2026-11-10 確認）
create table public.keepalive (
  id smallint primary key check (id = 1),
  pinged_at timestamptz not null default now(),
  count integer not null default 0
);
alter table public.keepalive enable row level security;
-- ポリシーも GRANT も付けない。読み書きは下の関数経由だけ（CLAUDE.md §4「新しいテーブルには GRANT」の、意図的に閉じる例外）
revoke all on public.keepalive from anon, authenticated;

create or replace function public.keepalive_ping()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  insert into public.keepalive (id, pinged_at, count) values (1, now(), 1)
  on conflict (id) do update set pinged_at = now(), count = public.keepalive.count + 1
  returning pinged_at;
$$;
revoke all on function public.keepalive_ping() from public;
grant execute on function public.keepalive_ping() to anon, service_role;
