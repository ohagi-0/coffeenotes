import type { SupabaseClient } from '@supabase/supabase-js';
import { BEAN_IMAGES_BUCKET } from '@/lib/storage/bean-images';
import type { Database } from '@/types/database';

// アカウント削除（F-AUTH-3）。service role を使わず、本人の権限だけで完結させる。
// 1. Storage の自分のプレフィックス（{user_id}/…）を Storage API で削除（SQL で行だけ消すと実体が残るため）
// 2. DB 関数 delete_my_account()（SECURITY DEFINER）で auth.users の自分の行を削除 → 所有テーブルは CASCADE
// 3. ローカルのセッションを破棄（サーバー側はもう無い）

type Client = SupabaseClient<Database>;

/** 自分のカード画像を全部消す。戻り値は消したファイル数。 */
export async function removeAllBeanImages(client: Client, userId: string): Promise<number> {
  const bucket = client.storage.from(BEAN_IMAGES_BUCKET);
  const { data: entries, error } = await bucket.list(userId, { limit: 1000 });
  if (error) throw error;
  const paths: string[] = [];
  for (const entry of entries ?? []) {
    // Storage の list は「フォルダ」を id: null で返す。{user_id}/{bean_id}/ の下にファイルがある
    if (entry.id) {
      paths.push(`${userId}/${entry.name}`);
      continue;
    }
    const { data: files, error: listError } = await bucket.list(`${userId}/${entry.name}`, { limit: 1000 });
    if (listError) throw listError;
    for (const file of files ?? []) paths.push(`${userId}/${entry.name}/${file.name}`);
  }
  if (paths.length > 0) {
    const { error: removeError } = await bucket.remove(paths);
    if (removeError) throw removeError;
  }
  return paths.length;
}

/** アカウントと全データを削除し、ローカルのセッションを破棄する。 */
export async function deleteMyAccount(client: Client, userId: string): Promise<void> {
  await removeAllBeanImages(client, userId);
  const { error } = await client.rpc('delete_my_account');
  if (error) throw error;
  await client.auth.signOut({ scope: 'local' });
}
