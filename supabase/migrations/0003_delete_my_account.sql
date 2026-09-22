-- 0003_delete_my_account.sql
-- アカウント削除（F-AUTH-3）。本人が自分の auth.users 行を消す関数。
-- 方針: service role をブラウザやサーバーに置かず、SECURITY DEFINER の関数で auth.uid() の行だけを消す。
--       public 側のユーザー所有テーブルは user_id の ON DELETE CASCADE で消え、roasters.created_by は SET NULL になる。
--       Storage のファイルは SQL で消しても実体が残るため、呼び出し前にクライアントが Storage API で自分のプレフィックスを削除する。

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  -- 念のため public 側を先に消す（CASCADE でも消えるが、Storage の行も含めて明示する）
  delete from storage.objects
   where bucket_id = 'bean-images'
     and (storage.foldername(name))[1] = v_user::text;
  delete from public.logs   where user_id = v_user;
  delete from public.roasts where user_id = v_user;
  delete from public.beans  where user_id = v_user;
  delete from public.shops  where user_id = v_user;
  delete from public.tags   where user_id = v_user;
  delete from public.ocr_usage where user_id = v_user;
  delete from auth.users where id = v_user;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
