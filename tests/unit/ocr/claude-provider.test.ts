// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { OcrError } from '@/lib/ocr';
import {
  BEAN_CARD_TOOL,
  TOOL_NAME,
  createClaudeOcrProvider,
  sanitizeExtraction,
} from '@/lib/ocr/providers/claude';

const fixture = JSON.parse(readFileSync('tests/fixtures/cards/sample-card-front.recorded.json', 'utf8'));
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });

function fakeClient(impl: (params: Anthropic.MessageCreateParams) => unknown) {
  const create = vi.fn(async (params: Anthropic.MessageCreateParams) => impl(params));
  return { client: { messages: { create } } as unknown as Pick<Anthropic, 'messages'>, create };
}

describe('createClaudeOcrProvider', () => {
  it('表・裏を 1 リクエストで送り、tool_use を強制する', async () => {
    const { client, create } = fakeClient(() => fixture.response);
    const provider = createClaudeOcrProvider({ client });
    await provider.extractBeanCard({ front: jpeg(), back: jpeg() });
    const params = create.mock.calls[0]![0];
    expect(params.model).toBe('claude-haiku-4-5');
    expect(params.max_tokens).toBe(1024);
    expect(params.tool_choice).toEqual({ type: 'tool', name: TOOL_NAME });
    expect(params.tools).toEqual([BEAN_CARD_TOOL]);
    const content = params.messages[0]!.content as Anthropic.ContentBlockParam[];
    expect(content.filter((b) => b.type === 'image')).toHaveLength(2);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('録画済みの応答を Zod 検証済みの抽出結果に変換し、生出力も返す', async () => {
    const { client } = fakeClient(() => fixture.response);
    const r = await createClaudeOcrProvider({ client }).extractBeanCard({ front: jpeg() });
    expect(r.provider).toBe('claude');
    expect(r.model).toBe('claude-haiku-4-5');
    expect(r.extraction.name.value).toBe('Lusitania Lime Geisha');
    expect(r.extraction.taste.value?.flavor).toBe(5);
    // URL でない参照先は null に落ちる（1 項目の揺れで全体を失敗させない）
    expect(r.extraction.referenceUrl.value).toBeNull();
    expect((r.raw as { input: unknown }).input).toBeDefined();
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('画像形式が対応外なら unsupported_image', async () => {
    const { client, create } = fakeClient(() => fixture.response);
    const bad = new Blob(['x'], { type: 'application/pdf' });
    await expect(createClaudeOcrProvider({ client }).extractBeanCard({ front: bad })).rejects.toMatchObject({
      code: 'unsupported_image',
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('tool_use が無い応答は invalid_output', async () => {
    const { client } = fakeClient(() => ({ ...fixture.response, content: [{ type: 'text', text: 'hi' }] }));
    await expect(
      createClaudeOcrProvider({ client }).extractBeanCard({ front: jpeg() }),
    ).rejects.toMatchObject({
      code: 'invalid_output',
    });
  });

  it('タイムアウトは timeout、API エラーは provider に写す', async () => {
    const timeout = fakeClient(() => {
      throw new Anthropic.APIConnectionTimeoutError({ message: 'timeout' });
    });
    await expect(
      createClaudeOcrProvider({ client: timeout.client }).extractBeanCard({ front: jpeg() }),
    ).rejects.toSatisfy((e) => e instanceof OcrError && e.code === 'timeout');
    const api = fakeClient(() => {
      throw new Anthropic.APIError(
        429,
        { error: { type: 'rate_limit_error' } },
        'rate limited',
        new Headers(),
      );
    });
    await expect(
      createClaudeOcrProvider({ client: api.client }).extractBeanCard({ front: jpeg() }),
    ).rejects.toSatisfy((e) => e instanceof OcrError && e.code === 'provider');
  });
});

describe('sanitizeExtraction', () => {
  it('小数の標高は丸め、範囲外の味覚と不正な URL は null、空文字は null にする', () => {
    const out = sanitizeExtraction({
      name: { value: '  ', confidence: 0.9 },
      altitudeM: { value: 1649.6, confidence: 0.8 },
      taste: { value: { flavor: 6, sweetness: 3, acidity: 0, aftertaste: null, body: 2.4 }, confidence: 0.7 },
      referenceUrl: { value: 'not a url', confidence: 0.9 },
      priceGrams: { value: 0, confidence: 0.9 },
      flavorNotes: { value: ['Lime', ' ', 3, 'Bergamot'], confidence: 0.9 },
      roastLevel: { value: 'burnt', confidence: 0.9 },
    }) as Record<string, { value: unknown; confidence: number }>;
    expect(out.name).toEqual({ value: null, confidence: 0 });
    expect(out.altitudeM).toEqual({ value: 1650, confidence: 0.8 });
    expect(out.taste!.value).toEqual({
      flavor: null,
      sweetness: 3,
      acidity: null,
      aftertaste: null,
      body: 2,
    });
    expect(out.referenceUrl).toEqual({ value: null, confidence: 0 });
    expect(out.priceGrams).toEqual({ value: null, confidence: 0 });
    expect(out.flavorNotes).toEqual({ value: ['Lime', 'Bergamot'], confidence: 0.9 });
    expect(out.roastLevel).toEqual({ value: null, confidence: 0 });
    expect(out.roaster).toEqual({ value: null, confidence: 0 });
  });
  it('confidence は 0〜1 に丸める', () => {
    const out = sanitizeExtraction({ name: { value: 'A', confidence: 7 } }) as Record<
      string,
      { confidence: number }
    >;
    expect(out.name!.confidence).toBe(1);
  });
});
