// Supabase / PostgREST のエラーを判定する小さな部品。features 層で共通に使う。

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

function hasCode(err: unknown): err is PostgrestLikeError {
  return typeof err === 'object' && err !== null && 'code' in err;
}

/** 一意制約違反（Postgres 23505）。ロースター名・タグ名の重複登録で起きる。 */
export function isUniqueViolation(err: unknown): boolean {
  return hasCode(err) && err.code === '23505';
}

/** PostgREST の `.single()` で 0 行だったとき（PGRST116）。 */
export function isNoRows(err: unknown): boolean {
  return hasCode(err) && err.code === 'PGRST116';
}

/** `ilike` / `like` に渡す文字列の特殊文字をエスケープする。 */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
