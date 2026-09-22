// Claude Haiku 4.5 Vision による OCR（ADR 0001、CLAUDE.md §5.2）。
// 表・裏を 1 リクエストで送り、tool_use でスキーマどおりの JSON を強制する。max_tokens 1,024、タイムアウト 15 秒。
// このファイルはサーバー専用（API キーを扱う）。ブラウザから import しない。
import Anthropic from '@anthropic-ai/sdk';
import { beanCardExtractionSchema, type BeanCardExtraction } from '@/lib/schemas/bean-card';
import { OcrError, type OcrImages, type OcrProvider, type OcrResult } from '@/lib/ocr';

export const CLAUDE_OCR_MODEL = 'claude-haiku-4-5';
export const CLAUDE_OCR_TIMEOUT_MS = 15_000;
export const CLAUDE_OCR_MAX_TOKENS = 1024;
export const TOOL_NAME = 'record_bean_card';

const IMAGE_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

function isImageMediaType(v: string): v is ImageMediaType {
  return (IMAGE_MEDIA_TYPES as readonly string[]).includes(v);
}

/** { value, confidence } の 1 項目分の JSON Schema */
function field(value: Record<string, unknown>, description: string) {
  return {
    type: 'object',
    description,
    properties: {
      value,
      confidence: { type: 'number', description: '0〜1。読み取れなかった・推測なら 0 に近く' },
    },
    required: ['value', 'confidence'],
    additionalProperties: false,
  } as const;
}
const nullableString = { type: ['string', 'null'] } as const;
const nullableInteger = { type: ['integer', 'null'] } as const;
const nullableScore = { type: ['integer', 'null'], enum: [1, 2, 3, 4, 5, null] } as const;

/** bean-card.ts の Zod スキーマと 1 対 1 に対応する tool の input_schema */
export const BEAN_CARD_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    'コーヒーのテイスティングカード（表・裏）から読み取った項目を記録する。読み取れない項目は value を null、confidence を 0 にする。',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      name: field(nullableString, '豆の名前。カードの表記のまま（言語を変えない）'),
      roaster: field(nullableString, 'ロースター（焙煎所・店）の名前'),
      country: field(nullableString, '生産国。英語表記のまま'),
      region: field(nullableString, '地域・農園'),
      variety: field(nullableString, '品種（Geisha, Bourbon など）'),
      process: field(nullableString, '精製方法（Washed, Natural, Lime infused など）'),
      altitudeM: field(nullableInteger, '標高（メートル）。"1,650m" は 1650。範囲表記は下限'),
      flavorNotes: field(
        { type: 'array', items: { type: 'string' } },
        'フレーバーノート。カンマや改行で区切られた語を配列に',
      ),
      description: field(nullableString, '説明文。書いてある言語のまま全文'),
      taste: field(
        {
          type: ['object', 'null'],
          properties: {
            flavor: nullableScore,
            sweetness: nullableScore,
            acidity: nullableScore,
            aftertaste: nullableScore,
            body: nullableScore,
          },
          required: ['flavor', 'sweetness', 'acidity', 'aftertaste', 'body'],
          additionalProperties: false,
        },
        '味覚チャート。塗りつぶされたドットの数（1〜5）。軸が無ければ null',
      ),
      priceJpy: field(nullableInteger, '価格（円、税込か不明ならそのまま）。"¥3,800" は 3800'),
      priceGrams: field(nullableInteger, '価格に対応するグラム数。"/100g" は 100'),
      roastLevel: field({ type: ['string', 'null'], enum: ['light', 'medium', 'dark', null] }, '焙煎度'),
      referenceUrl: field(nullableString, 'カードに印字された URL（QR の下の文字列など）。無ければ null'),
    },
    required: [
      'name',
      'roaster',
      'country',
      'region',
      'variety',
      'process',
      'altitudeM',
      'flavorNotes',
      'description',
      'taste',
      'priceJpy',
      'priceGrams',
      'roastLevel',
      'referenceUrl',
    ],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `あなたはスペシャルティコーヒーのテイスティングカードを読み取る係です。
渡された画像（1 枚目が表、2 枚目があれば裏）から項目を抜き出し、必ずツール ${TOOL_NAME} で記録してください。
- 書いてあることだけを書く。書いていない項目は value を null、confidence を 0 にする。推測で埋めない。
- 固有名詞（豆名・ロースター・地域・品種）は表記と言語をそのまま写す。
- 味覚チャートは、塗りつぶされた丸の数を数えて 1〜5 にする。読めない軸は null。
- 価格は円の整数、標高はメートルの整数。単位や記号は数値に含めない。
- confidence は 1 が「はっきり読めた」、0.5 が「かすれ・傾きで自信がない」、0 が「無い・読めない」。`;

function clamp01(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.min(1, Math.max(0, n));
}
function intOrNull(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.round(v);
}
function scoreOrNull(v: unknown): number | null {
  const n = intOrNull(v);
  return n !== null && n >= 1 && n <= 5 ? n : null;
}
function urlOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  try {
    return new URL(v.trim()).toString();
  } catch {
    return null;
  }
}
function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
}
function pick(input: Record<string, unknown>, key: string): { value: unknown; confidence: number } {
  const f = asRecord(input[key]);
  return { value: f.value ?? null, confidence: clamp01(f.confidence) };
}

/**
 * モデル出力を Zod スキーマに通る形へ寄せる純粋関数。
 * 小数の標高・範囲外の味覚・URL でない参照先など、よくある揺れを落として null にし、
 * 1 項目の揺れで抽出全体が失敗しないようにする。
 */
export function sanitizeExtraction(input: unknown): unknown {
  const i = asRecord(input);
  const str = (k: string) => {
    const f = pick(i, k);
    const v = typeof f.value === 'string' && f.value.trim() !== '' ? f.value.trim() : null;
    return { value: v, confidence: v === null ? 0 : f.confidence };
  };
  const int = (k: string, min = 0) => {
    const f = pick(i, k);
    const v = intOrNull(f.value);
    const ok = v !== null && v >= min;
    return { value: ok ? v : null, confidence: ok ? f.confidence : 0 };
  };
  const notes = pick(i, 'flavorNotes');
  const notesValue = Array.isArray(notes.value)
    ? notes.value
        .filter((s): s is string => typeof s === 'string')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const taste = pick(i, 'taste');
  const t = asRecord(taste.value);
  const tasteValue =
    taste.value === null
      ? null
      : {
          flavor: scoreOrNull(t.flavor),
          sweetness: scoreOrNull(t.sweetness),
          acidity: scoreOrNull(t.acidity),
          aftertaste: scoreOrNull(t.aftertaste),
          body: scoreOrNull(t.body),
        };
  const roast = pick(i, 'roastLevel');
  const roastValue =
    roast.value === 'light' || roast.value === 'medium' || roast.value === 'dark' ? roast.value : null;
  const ref = pick(i, 'referenceUrl');
  const refValue = urlOrNull(ref.value);
  const grams = int('priceGrams', 1);
  return {
    name: str('name'),
    roaster: str('roaster'),
    country: str('country'),
    region: str('region'),
    variety: str('variety'),
    process: str('process'),
    altitudeM: int('altitudeM'),
    flavorNotes: { value: notesValue, confidence: notesValue.length ? notes.confidence : 0 },
    description: str('description'),
    taste: { value: tasteValue, confidence: tasteValue ? taste.confidence : 0 },
    priceJpy: int('priceJpy'),
    priceGrams: grams,
    roastLevel: { value: roastValue, confidence: roastValue ? roast.confidence : 0 },
    referenceUrl: { value: refValue, confidence: refValue ? ref.confidence : 0 },
  };
}

async function toImageBlock(blob: Blob, label: '表' | '裏'): Promise<Anthropic.ImageBlockParam> {
  const mediaType = blob.type;
  if (!isImageMediaType(mediaType)) {
    throw new OcrError(
      `${label}面の画像形式に対応していません（${mediaType || '不明'}）`,
      'unsupported_image',
    );
  }
  const data = Buffer.from(await blob.arrayBuffer()).toString('base64');
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data } };
}

export interface ClaudeOcrOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  /** テスト用に注入する。省略時は apiKey から生成 */
  client?: Pick<Anthropic, 'messages'>;
}

export function createClaudeOcrProvider(options: ClaudeOcrOptions = {}): OcrProvider {
  const model = options.model ?? CLAUDE_OCR_MODEL;
  const timeout = options.timeoutMs ?? CLAUDE_OCR_TIMEOUT_MS;
  const client = options.client ?? new Anthropic({ apiKey: options.apiKey, timeout, maxRetries: 1 });

  return {
    name: 'claude',
    async extractBeanCard(images: OcrImages): Promise<OcrResult> {
      const started = Date.now();
      const content: Anthropic.ContentBlockParam[] = [await toImageBlock(images.front, '表')];
      if (images.back) content.push(await toImageBlock(images.back, '裏'));
      content.push({
        type: 'text',
        text: images.back ? '1 枚目が表、2 枚目が裏です。' : '表面のみです。裏面はありません。',
      });

      let response: Anthropic.Message;
      try {
        response = await client.messages.create({
          model,
          max_tokens: CLAUDE_OCR_MAX_TOKENS,
          system: SYSTEM_PROMPT,
          tools: [BEAN_CARD_TOOL],
          tool_choice: { type: 'tool', name: TOOL_NAME },
          messages: [{ role: 'user', content }],
        });
      } catch (err) {
        if (err instanceof Anthropic.APIConnectionTimeoutError) {
          throw new OcrError('読み取りが 15 秒以内に終わりませんでした', 'timeout', err);
        }
        if (err instanceof Anthropic.APIError) {
          throw new OcrError(`読み取りサービスがエラーを返しました（${err.status ?? '?'}）`, 'provider', err);
        }
        throw new OcrError('読み取りサービスに接続できませんでした', 'provider', err);
      }

      const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      if (!toolUse) {
        throw new OcrError(
          response.stop_reason === 'max_tokens'
            ? '応答が長すぎて途中で切れました'
            : '応答に読み取り結果が含まれていません',
          'invalid_output',
          response,
        );
      }
      const parsed = beanCardExtractionSchema.safeParse(sanitizeExtraction(toolUse.input));
      if (!parsed.success) {
        throw new OcrError('読み取り結果の形式が想定と違います', 'invalid_output', parsed.error.issues);
      }
      const extraction: BeanCardExtraction = parsed.data;
      return {
        extraction,
        raw: {
          id: response.id,
          model: response.model,
          stop_reason: response.stop_reason,
          usage: response.usage,
          input: toolUse.input,
        },
        provider: 'claude',
        model: response.model,
        durationMs: Date.now() - started,
      };
    },
  };
}
