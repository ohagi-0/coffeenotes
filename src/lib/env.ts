// 環境変数は必ずここで Zod 検証してから使う（CLAUDE.md §5.1）。
// ビルド時のプリレンダーで落ちないよう、読み出しは遅延（関数呼び出し時）にする。
import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: 'NEXT_PUBLIC_SUPABASE_URL が不正です' }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定です'),
  // /api/* とログインのリダイレクト先はこの絶対 URL を基点にする（ネイティブ化制約 N-2）
  NEXT_PUBLIC_API_BASE_URL: z.url({ message: 'NEXT_PUBLIC_API_BASE_URL が不正です' }),
});

const serverEnvSchema = z
  .object({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    OCR_PROVIDER: z.enum(['claude', 'none']).default('none'),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    GEO_PROVIDER: z.enum(['nominatim', 'google']).default('nominatim'),
    GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
    // /api/ocr/warm を叩く定期ジョブ（GitHub Actions）の合言葉。未設定ならそのルートは 503
    CRON_SECRET: z.string().min(16).optional(),
  })
  .refine((v) => v.OCR_PROVIDER !== 'claude' || !!v.ANTHROPIC_API_KEY, {
    message: 'OCR_PROVIDER=claude のときは ANTHROPIC_API_KEY が必要です',
    path: ['ANTHROPIC_API_KEY'],
  })
  .refine((v) => v.GEO_PROVIDER !== 'google' || !!v.GOOGLE_MAPS_API_KEY, {
    message: 'GEO_PROVIDER=google のときは GOOGLE_MAPS_API_KEY が必要です',
    path: ['GOOGLE_MAPS_API_KEY'],
  });

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

let publicEnvCache: PublicEnv | undefined;
let serverEnvCache: ServerEnv | undefined;

/** ブラウザ・サーバー両方から参照できる公開変数。NEXT_PUBLIC_ はビルド時にインライン化されるため明示的に列挙する。 */
export function getPublicEnv(): PublicEnv {
  publicEnvCache ??= publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  });
  return publicEnvCache;
}

/** サーバー専用変数。src/app/api/ と Server Actions の中からのみ呼ぶこと。 */
export function getServerEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('getServerEnv() はブラウザから呼べません');
  }
  serverEnvCache ??= serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    OCR_PROVIDER: process.env.OCR_PROVIDER || undefined,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
    GEO_PROVIDER: process.env.GEO_PROVIDER || undefined,
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || undefined,
    CRON_SECRET: process.env.CRON_SECRET || undefined,
  });
  return serverEnvCache;
}

/** テスト用: キャッシュを破棄する */
export function resetEnvCacheForTest(): void {
  publicEnvCache = undefined;
  serverEnvCache = undefined;
}

/** /api/* を絶対 URL で組み立てる（相対パス fetch('/api/…') は禁止） */
export function apiUrl(path: `/api/${string}`): string {
  return new URL(path, getPublicEnv().NEXT_PUBLIC_API_BASE_URL).toString();
}

/** 認証リダイレクト先（Web URL）。ネイティブ版はカスタムスキームを別途 Supabase に登録する。 */
export function authCallbackUrl(): string {
  return new URL('/auth/callback', getPublicEnv().NEXT_PUBLIC_API_BASE_URL).toString();
}
