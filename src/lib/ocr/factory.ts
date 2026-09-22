import 'server-only';

// 環境変数からプロバイダを選ぶ（サーバー専用）。`OCR_PROVIDER=none` のときは null（読み取り無効）。
import { getServerEnv } from '@/lib/env';
import type { OcrProvider } from '@/lib/ocr';
import { createClaudeOcrProvider } from '@/lib/ocr/providers/claude';

let cached: OcrProvider | null | undefined;

export function getOcrProvider(): OcrProvider | null {
  if (cached !== undefined) return cached;
  const env = getServerEnv();
  cached = env.OCR_PROVIDER === 'claude' ? createClaudeOcrProvider({ apiKey: env.ANTHROPIC_API_KEY }) : null;
  return cached;
}

/** テスト用 */
export function resetOcrProviderForTest(): void {
  cached = undefined;
}
