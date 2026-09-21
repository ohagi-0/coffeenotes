'use client';

// ブラウザ用 Supabase クライアント（シングルトン）。
// 画面はすべてクライアント側でデータ取得する（ネイティブ化制約 N-1）ため、これが唯一のデータ経路。
// 型引数 <Database> は `pnpm db:types` で src/types/database.ts を生成後に付ける。
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPublicEnv } from '@/lib/env';

let client: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!client) {
    const env = getPublicEnv();
    client = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  }
  return client;
}
