// @vitest-environment node
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createClaudeOcrProvider } from '@/lib/ocr/providers/claude';

// 実 API を叩く確認用。ANTHROPIC_API_KEY が無ければ skip（通常の pnpm test では走らない）。
//   ANTHROPIC_API_KEY=sk-ant-… pnpm vitest run tests/unit/ocr/live.test.ts
// 成功したら応答を tests/fixtures/cards/sample-card-front.recorded.json に録画する（recorded: true）。
const key = process.env.ANTHROPIC_API_KEY;
const FIXTURE = 'tests/fixtures/cards/sample-card-front.recorded.json';

describe.skipIf(!key)('Claude Haiku 4.5 で合成カードを読み取る（実 API）', () => {
  it('主要項目が読め、応答を録画する', async () => {
    const front = new Blob([readFileSync('tests/fixtures/cards/sample-card-front.jpg')], {
      type: 'image/jpeg',
    });
    const provider = createClaudeOcrProvider({ apiKey: key });
    const result = await provider.extractBeanCard({ front });
    const e = result.extraction;
    console.log(
      JSON.stringify({ durationMs: result.durationMs, model: result.model, extraction: e }, null, 2),
    );
    expect(e.name.value?.toLowerCase()).toContain('lusitania');
    expect(e.roaster.value?.toUpperCase()).toContain('KIELO');
    expect(e.country.value).toBe('Colombia');
    expect(e.altitudeM.value).toBe(1650);
    expect(e.priceJpy.value).toBe(3800);
    expect(e.taste.value?.flavor).toBe(5);
    expect(result.durationMs).toBeLessThan(15_000);

    const raw = result.raw as {
      id: string;
      model: string;
      stop_reason: string;
      usage: unknown;
      input: unknown;
    };
    writeFileSync(
      FIXTURE,
      JSON.stringify(
        {
          recorded: true,
          note: '実 API の応答を録画したもの（合成カード画像に対する Claude Haiku 4.5 の出力）',
          recordedAt: new Date().toISOString(),
          response: {
            id: raw.id,
            type: 'message',
            role: 'assistant',
            model: raw.model,
            stop_reason: raw.stop_reason,
            stop_sequence: null,
            usage: raw.usage,
            content: [{ type: 'tool_use', id: 'toolu_recorded', name: 'record_bean_card', input: raw.input }],
          },
        },
        null,
        2,
      ) + '\n',
    );
  }, 30_000);
});
