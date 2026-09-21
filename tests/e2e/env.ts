import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// .env.local を読んで、未設定の環境変数だけ埋める（dotenv を依存に足さないための最小実装。scripts/seed-dev.mjs と同じ）。
export function loadEnvLocal(root = process.cwd()): void {
  const path = resolve(root, '.env.local');
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/** E2E のログインに使う資格情報。無ければ null（テストは skip する） */
export function e2eCredentials(): { email: string; password: string } | null {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  return email && password ? { email, password } : null;
}
