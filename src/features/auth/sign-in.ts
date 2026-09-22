'use client';

import { authCallbackUrl } from '@/lib/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/** メールにマジックリンクを送る（F-AUTH-1）。未登録メールはそのまま新規登録になる。 */
export async function signInWithEmail(email: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: authCallbackUrl() },
  });
  if (error) throw error;
}

/** Google でログイン（F-AUTH-1）。同じメールなら Supabase 側で同一アカウントに紐づく。 */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: authCallbackUrl() },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseBrowserClient().auth.signOut();
  if (error) throw error;
  await clearOfflineCaches();
}

/** Service Worker がオフライン閲覧用に持つデータのキャッシュを消す（別のアカウントでログインしたときに残さない） */
export async function clearOfflineCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await Promise.all(['supabase-rest', 'supabase-images'].map((name) => caches.delete(name)));
  } catch {
    // キャッシュが無い・使えない環境では何もしない
  }
}
