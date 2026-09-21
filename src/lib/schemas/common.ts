import { z } from 'zod';

// フォーム入力（空文字・NaN・数値文字列が混ざる）を DB の形（null か値）に寄せるための共通部品。

export const uuidSchema = z.uuid();

function isRealDate(v: string): boolean {
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** DB の date 列に対応する `YYYY-MM-DD`。存在しない日付（2 月 30 日など）は弾く。 */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD の形式で入力してください')
  .refine(isRealDate, '存在しない日付です');

/** 空文字・空白のみを null に寄せる。それ以外はそのまま返す。 */
export function emptyToNull(v: unknown): unknown {
  return typeof v === 'string' && v.trim() === '' ? null : v;
}

/** 任意の文字列項目。空なら null、あれば前後の空白を除いた文字列。 */
export function textOrNull(max = 2000) {
  return z.preprocess(emptyToNull, z.string().trim().max(max).nullable()).default(null);
}

/** 任意の数値項目。空文字・NaN・undefined は null、数値文字列は数値に変換してから検証する。 */
export function numberOrNull<T extends z.ZodType<number>>(schema: T) {
  return z
    .preprocess((v) => {
      if (v === '' || v === undefined || v === null) return null;
      if (typeof v === 'number') return Number.isNaN(v) ? null : v;
      if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
      return v;
    }, schema.nullable())
    .default(null);
}

/** 任意の enum 項目。空なら null。 */
export function enumOrNull<T extends z.ZodEnum>(schema: T) {
  return z.preprocess(emptyToNull, schema.nullable()).default(null);
}

// 型レベルの整合チェック用。`Expect<Extends<A, B>>` は A が B に代入できないとコンパイルエラーになる。
export type Extends<A, B> = [A] extends [B] ? true : false;
export type Expect<T extends true> = T;

/**
 * 部分更新用。`schema.partial().parse(patch)` の結果から、呼び出し側が実際に渡したキーだけを残す。
 * `.default(null)` を持つ項目は省略時に null が入るため、そのまま送ると既存値を消してしまう。
 */
export function pickProvided<T extends object>(parsed: Partial<T>, provided: object): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(parsed) as (keyof T)[]) {
    if (key in provided && (provided as Record<keyof T, unknown>)[key] !== undefined) out[key] = parsed[key];
  }
  return out;
}
