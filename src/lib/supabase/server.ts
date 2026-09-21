import 'server-only';

// Route Handler（src/app/api/*）用の Supabase クライアント。
// ネイティブ版は Cookie を送れないため、Authorization: Bearer <access_token> を優先し、無ければ Cookie を使う。
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { getPublicEnv, getServerEnv } from '@/lib/env';
import type { Database } from '@/types/database';

function parseCookieHeader(header: string | null): { name: string; value: string }[] {
  if (!header) return [];
  return header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf('=');
      return idx === -1
        ? { name: part, value: '' }
        : { name: part.slice(0, idx), value: decodeURIComponent(part.slice(idx + 1)) };
    });
}

/** リクエストの認証情報を引き継いだクライアント（RLS が効く） */
export function createRouteClient(request: Request): SupabaseClient<Database> {
  const env = getPublicEnv();
  const bearer = request.headers.get('authorization');
  if (bearer?.toLowerCase().startsWith('bearer ')) {
    return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: bearer } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  const cookies = parseCookieHeader(request.headers.get('cookie'));
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookies,
      // Route Handler ではセッション更新をしない（ブラウザ側クライアントが担う）
      setAll: () => {},
    },
  });
}

/** リクエストのユーザーを返す。未認証なら null。 */
export async function getRequestUser(request: Request): Promise<User | null> {
  const {
    data: { user },
  } = await createRouteClient(request).auth.getUser();
  return user;
}

/** service role クライアント。RLS を無視するため、アカウント削除など限定用途にのみ使う。 */
export function createServiceClient(): SupabaseClient<Database> {
  const key = getServerEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY が未設定です');
  return createClient<Database>(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
