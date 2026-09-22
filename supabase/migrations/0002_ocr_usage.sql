-- 0002_ocr_usage.sql
-- OCR（カード読み取り）の 1 ユーザー 1 日 50 回の上限（CLAUDE.md §5.2、REQUIREMENTS.md §8.1）。
-- 方針: 回数は SECURITY DEFINER の関数でしか増やせない（ユーザーは自分の行を読めるだけ。減らす・消す手段は無い）。
--       上限値は関数の中に固定し、クライアントから渡させない。日付の切り替えは日本時間の 0 時。

create table public.ocr_usage (
  user_id    uuid not null references auth.users (id) on delete cascade,
  used_on    date not null,
  count      integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, used_on)
);

alter table public.ocr_usage enable row level security;

-- 読み取りは本人のみ（設定画面の「今日の回数 3 / 50」用）。INSERT / UPDATE / DELETE のポリシーは意図的に作らない
create policy "ocr_usage: owner select" on public.ocr_usage
  for select to authenticated using ((select auth.uid()) = user_id);

/** 1 日の上限。表示にも使うので関数にしておく */
create or replace function public.ocr_daily_limit()
returns integer
language sql
immutable
as $$ select 50 $$;

/** 今日（日本時間）の日付 */
create or replace function public.ocr_today()
returns date
language sql
stable
as $$ select (now() at time zone 'Asia/Tokyo')::date $$;

/**
 * 読み取り 1 回分を消費する。上限内なら count を 1 増やして allowed = true、
 * 上限に達していれば増やさずに allowed = false を返す。行ロックで同時呼び出しでも二重に通らない。
 * /api/ocr がプロバイダを呼ぶ前に呼ぶ。
 */
create or replace function public.consume_ocr_quota()
returns table (used integer, daily_limit integer, allowed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_today date := public.ocr_today();
  v_limit integer := public.ocr_daily_limit();
  v_count integer;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  insert into public.ocr_usage (user_id, used_on, count)
  values (v_user, v_today, 0)
  on conflict (user_id, used_on) do nothing;

  select u.count into v_count
  from public.ocr_usage u
  where u.user_id = v_user and u.used_on = v_today
  for update;

  if v_count >= v_limit then
    return query select v_count, v_limit, false;
    return;
  end if;

  update public.ocr_usage u
  set count = u.count + 1, updated_at = now()
  where u.user_id = v_user and u.used_on = v_today
  returning u.count into v_count;

  return query select v_count, v_limit, true;
end;
$$;

revoke all on function public.consume_ocr_quota() from public;
grant execute on function public.consume_ocr_quota() to authenticated;
grant execute on function public.ocr_daily_limit() to authenticated, anon;
grant execute on function public.ocr_today() to authenticated, anon;
