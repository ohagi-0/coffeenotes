// Claude Haiku 4.5 Vision による OCR（ADR 0001、CLAUDE.md §5.2）。
// 表・裏を 1 リクエストで送り、tool_use でスキーマどおりの JSON を強制する。max_tokens 1,024、タイムアウト 15 秒。
// このファイルはサーバー専用（API キーを扱う）。ブラウザから import しない。
import Anthropic from '@anthropic-ai/sdk';
import { beanCardExtractionSchema, type BeanCardExtraction } from '@/lib/schemas/bean-card';
import { OcrError, type OcrImages, type OcrProvider, type OcrResult, type OcrWarmUpResult } from '@/lib/ocr';

export const CLAUDE_OCR_MODEL = 'claude-haiku-4-5';
// 読み取り本体のタイムアウト。strict スキーマの文法コンパイル（初回のみ 15〜30 秒）が 1 回目に重なっても
// リトライ無しで通るよう 30 秒にしている（2026-09-24。キャッシュが温まっていれば 4〜5 秒）
export const CLAUDE_OCR_TIMEOUT_MS = 30_000;
/** ウォームアップは裏で走るので長めに待つ（コンパイルが終わるまで） */
export const CLAUDE_OCR_WARMUP_TIMEOUT_MS = 90_000;
export const CLAUDE_OCR_MAX_TOKENS = 1024;
export const TOOL_NAME = 'record_bean_card';

const IMAGE_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

function isImageMediaType(v: string): v is ImageMediaType {
  return (IMAGE_MEDIA_TYPES as readonly string[]).includes(v);
}

/** 値の型に説明を付ける（strict モードの文法を小さく保つため、項目ごとの入れ子は作らない） */
function withDesc<T extends Record<string, unknown>>(schema: T, description: string) {
  return { ...schema, description } as const;
}
const nullableString = { type: ['string', 'null'] } as const;
const nullableInteger = { type: ['integer', 'null'] } as const;
// strict モードは配列型（['integer','null']）と enum の併用を 400 で拒否するため、anyOf で null を分ける（2026-09-24 実 API で確認）
const nullableScore = {
  anyOf: [{ type: 'integer', enum: [1, 2, 3, 4, 5] }, { type: 'null' }],
} as const;
const nullableRoastLevel = {
  anyOf: [{ type: 'string', enum: ['light', 'medium', 'dark'] }, { type: 'null' }],
} as const;
const confidenceNumber = { type: 'number' } as const;

/** 値を持つ項目名（confidence オブジェクトのキーと一致させる） */
export const BEAN_CARD_FIELDS = [
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
] as const;
type BeanCardField = (typeof BEAN_CARD_FIELDS)[number];

/**
 * bean-card.ts の Zod スキーマに対応する tool の input_schema。
 * アプリ側の形（項目ごとの { value, confidence }）とは違い、値はフラットに、confidence は別オブジェクトにまとめる。
 * 項目ごとに { value, confidence } を入れ子にすると strict モードの文法コンパイルが
 * 「The compiled grammar is too large」で 400 になるため（2026-09-24 実 API で確認）。sanitizeExtraction でアプリ側の形へ戻す。
 */
export const BEAN_CARD_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    'コーヒーのテイスティングカード（表・裏）から読み取った項目を記録する。読み取れない項目は null にし、confidence の同じ名前のキーを 0 にする。',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      name: withDesc(nullableString, '豆の名前。カードの表記のまま（言語を変えない）'),
      roaster: withDesc(nullableString, 'ロースター（焙煎所・店）の名前'),
      country: withDesc(nullableString, '生産国。英語表記のまま'),
      region: withDesc(nullableString, '地域・農園'),
      variety: withDesc(nullableString, '品種（Geisha, Bourbon など）'),
      process: withDesc(nullableString, '精製方法（Washed, Natural, Lime infused など）'),
      altitudeM: withDesc(nullableInteger, '標高（メートル）。"1,650m" は 1650。範囲表記は下限'),
      flavorNotes: withDesc(
        { type: 'array', items: { type: 'string' } },
        'フレーバーノート。カンマや改行で区切られた語を配列に。無ければ空配列',
      ),
      description: withDesc(nullableString, '説明文。書いてある言語のまま全文'),
      taste: withDesc(
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
      priceJpy: withDesc(nullableInteger, '価格（円、税込か不明ならそのまま）。"¥3,800" は 3800'),
      priceGrams: withDesc(nullableInteger, '価格に対応するグラム数。"/100g" は 100'),
      roastLevel: withDesc(nullableRoastLevel, '焙煎度'),
      referenceUrl: withDesc(
        nullableString,
        'カードに印字された URL（QR の下の文字列など）。https:// が無ければ補う。無ければ null',
      ),
      confidence: {
        type: 'object',
        description:
          '各項目の自信度（0〜1）。キーは値の項目名と同じ。1 = はっきり読めた、0.5 = かすれ・傾きで自信がない、0 = 無い・読めない',
        properties: Object.fromEntries(BEAN_CARD_FIELDS.map((k) => [k, confidenceNumber])),
        required: [...BEAN_CARD_FIELDS],
        additionalProperties: false,
      },
    },
    required: [...BEAN_CARD_FIELDS, 'confidence'],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `あなたはスペシャルティコーヒーのテイスティングカードを読み取る係です。
渡された画像（1 枚目が表、2 枚目があれば裏）から項目を抜き出し、必ずツール ${TOOL_NAME} で記録してください。
- 書いてあることだけを書く。書いていない項目は null にし、confidence の同じ名前のキーを 0 にする。推測で埋めない。
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
  const t = v.trim();
  if (t === '') return null;
  // カードには "kielocoffee.com/lusitania" のようにスキーム無しで印字されることが多いので https:// を補う
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const url = new URL(withScheme);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}
function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
}
/**
 * 1 項目の値と自信度を取り出す。
 * 本来の形はフラットな値 + `confidence` オブジェクト（BEAN_CARD_TOOL）だが、
 * 旧形式の { value, confidence } 入れ子で返ってきても読めるようにしておく（録画済みの応答・モデルの揺れ対策）。
 */
function pick(input: Record<string, unknown>, key: BeanCardField): { value: unknown; confidence: number } {
  const raw = input[key];
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw) && 'value' in raw) {
    const f = raw as Record<string, unknown>;
    return { value: f.value ?? null, confidence: clamp01(f.confidence) };
  }
  return { value: raw ?? null, confidence: clamp01(asRecord(input.confidence)[key]) };
}

/**
 * モデル出力を Zod スキーマに通る形へ寄せる純粋関数。
 * 小数の標高・範囲外の味覚・URL でない参照先など、よくある揺れを落として null にし、
 * 1 項目の揺れで抽出全体が失敗しないようにする。
 */
export function sanitizeExtraction(input: unknown): unknown {
  const i = asRecord(input);
  const str = (k: BeanCardField) => {
    const f = pick(i, k);
    const v = typeof f.value === 'string' && f.value.trim() !== '' ? f.value.trim() : null;
    return { value: v, confidence: v === null ? 0 : f.confidence };
  };
  const int = (k: BeanCardField, min = 0) => {
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
          throw new OcrError(
            `読み取りが ${Math.round(timeout / 1000)} 秒以内に終わりませんでした`,
            'timeout',
            err,
          );
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

    // 画像なしの短い文で、本番と同じ tools / tool_choice / system を送る。
    // 文法キャッシュはスキーマ（とモデル）単位なので、これで次の実リクエストの初回コンパイルが省ける。
    async warmUp(): Promise<OcrWarmUpResult> {
      const started = Date.now();
      try {
        const response = await client.messages.create(
          {
            model,
            max_tokens: CLAUDE_OCR_MAX_TOKENS,
            system: SYSTEM_PROMPT,
            tools: [BEAN_CARD_TOOL],
            tool_choice: { type: 'tool', name: TOOL_NAME },
            messages: [
              {
                role: 'user',
                content:
                  '（ウォームアップ）画像はありません。すべての項目を null、flavorNotes を空配列、confidence をすべて 0 にして記録してください。',
              },
            ],
          },
          { timeout: CLAUDE_OCR_WARMUP_TIMEOUT_MS, maxRetries: 0 },
        );
        return { provider: 'claude', model: response.model, durationMs: Date.now() - started };
      } catch (err) {
        if (err instanceof Anthropic.APIConnectionTimeoutError) {
          throw new OcrError('ウォームアップが時間内に終わりませんでした', 'timeout', err);
        }
        if (err instanceof Anthropic.APIError) {
          throw new OcrError(`読み取りサービスがエラーを返しました（${err.status ?? '?'}）`, 'provider', err);
        }
        throw new OcrError('読み取りサービスに接続できませんでした', 'provider', err);
      }
    },
  };
}
