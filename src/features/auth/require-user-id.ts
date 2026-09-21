import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * 現在のユーザー ID を返す。未ログインなら例外。
 * ユーザー所有テーブルへの INSERT は RLS の WITH CHECK で `user_id = auth.uid()` を要求するため、
 * mutations はこれで取った ID を明示的に入れる（DB 側に既定値は無い）。
 */
export async function requireUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await getSupabaseBrowserClient().auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('ログインが必要です');
  return user.id;
}
