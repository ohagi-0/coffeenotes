import { createClient } from '@supabase/supabase-js';
import { e2eCredentials, loadEnvLocal } from './env';

// テスト用ユーザーを用意する（Issue #24）。
// SUPABASE_SERVICE_ROLE_KEY があれば admin API でメール確認済みのユーザーを作る（既にあれば何もしない）。
// 無ければ、ダッシュボードで作った E2E_TEST_EMAIL / E2E_TEST_PASSWORD のユーザーをそのまま使う。
export default async function globalSetup(): Promise<void> {
  loadEnvLocal();
  const creds = e2eCredentials();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!creds) {
    console.log('[e2e] E2E_TEST_EMAIL / E2E_TEST_PASSWORD が無いので、ログインが要るテストは skip します');
    return;
  }
  if (!url || !serviceRole) {
    console.log('[e2e] SUPABASE_SERVICE_ROLE_KEY が無いので、テスト用ユーザーは既にある前提で進めます');
    return;
  }
  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.createUser({
    email: creds.email,
    password: creds.password,
    email_confirm: true,
  });
  if (error && !/already/i.test(error.message)) throw error;
  console.log(`[e2e] テスト用ユーザー ${creds.email} を用意しました`);
}
