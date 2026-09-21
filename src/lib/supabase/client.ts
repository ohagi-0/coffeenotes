'use client';

// ブラウザ用 Supabase クライアント（シングルトン）。
// 画面はすべてクライアント側でデータ取得する（ネイティブ化制約 N-1）ため、これが唯一のデータ経路。
// 型引数 <Database> は `pnpm db:types` で生成した src/types/database.ts に対応する。
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPublicEnv } from '@/lib/env';
import type { Database } from '@/types/database';

let client: SupabaseClient<Database> | undefined;

export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (!client) {
    const env = getPublicEnv();
    client = createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  }
  return client;
}
