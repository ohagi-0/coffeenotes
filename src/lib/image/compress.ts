// 画像圧縮（CLAUDE.md §5.3 / REQUIREMENTS.md §9）。
// カード画像は保存前にここで長辺 1,600px・JPEG 品質 0.8 まで落とし、Storage 容量と OCR のトークンを節約する。
// UI からは compressImage だけを呼ぶ。Canvas 系のブラウザ API に触れるのはこのファイルと src/lib/platform/* だけ。
// 入出力は File ではなく Blob で扱う（ネイティブ化制約 N-5。Capacitor のカメラは Blob/base64 を返す）。

/** 長辺の既定値（px）。 */
export const DEFAULT_MAX_EDGE = 1600;
/** JPEG 品質の既定値。 */
export const DEFAULT_QUALITY = 0.8;
/** 出力の MIME。Storage のパスが `.jpg` 固定なので JPEG に揃える。 */
export const COMPRESSED_MIME = 'image/jpeg';

export interface CompressImageOptions {
  /** 長辺の上限（px）。既定 1,600。 */
  maxEdge?: number;
  /** JPEG 品質（0 < q <= 1）。既定 0.8。 */
  quality?: number;
}

export interface ImageSize {
  width: number;
  height: number;
}

export class ImageCompressError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ImageCompressError';
  }
}

/**
 * 縦横比を保ったまま長辺が maxEdge 以下になる寸法を返す純粋関数。
 * 既に上限以下なら拡大せずそのまま返す（小さい画像を引き伸ばして容量を増やさないため）。
 * Canvas の無い jsdom でも単体テストできるよう、寸法計算だけを切り出してある。
 */
export function fitWithin(width: number, height: number, maxEdge: number): ImageSize {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new ImageCompressError(`画像の寸法が不正です（${width}x${height}）`);
  }
  if (!Number.isFinite(maxEdge) || maxEdge <= 0) {
    throw new ImageCompressError(`maxEdge は正の数で指定してください（${maxEdge}）`);
  }
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  /** ImageBitmap の close / object URL の revoke。使い終わったら必ず呼ぶ。 */
  release: () => void;
}

/**
 * Blob を Canvas に描ける形にデコードする。内部用（テストからの注入のため export している）。
 * createImageBitmap があれば `imageOrientation: 'from-image'` で EXIF の向きを反映させる。
 * 無い環境（古い Safari など）は <img> にフォールバックする。<img> はブラウザ既定で EXIF の向きを適用する。
 */
export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  let lastError: unknown;
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch (err) {
      lastError = err;
    }
  }
  if (
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    throw new ImageCompressError('この環境では画像をデコードできません', lastError);
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new ImageCompressError('画像を読み込めませんでした'));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err instanceof ImageCompressError ? err : new ImageCompressError('画像を読み込めませんでした', err);
  }
}

/**
 * 指定寸法に描き直して JPEG の Blob にする。内部用（テストからの注入のため export している）。
 * OffscreenCanvas があればそれを使い、無ければ <canvas> にフォールバックする。
 */
export async function encodeJpeg(source: CanvasImageSource, size: ImageSize, quality: number): Promise<Blob> {
  if (typeof OffscreenCanvas === 'function') {
    const canvas = new OffscreenCanvas(size.width, size.height);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(source, 0, 0, size.width, size.height);
      return canvas.convertToBlob({ type: COMPRESSED_MIME, quality });
    }
  }
  if (typeof document === 'undefined') {
    throw new ImageCompressError('この環境では画像を変換できません');
  }
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageCompressError('2D コンテキストを取得できませんでした');
  ctx.drawImage(source, 0, 0, size.width, size.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ImageCompressError('JPEG への変換に失敗しました'))),
      COMPRESSED_MIME,
      quality,
    );
  });
}

/**
 * 画像を長辺 maxEdge 以内の JPEG に圧縮する（F-OCR-1 / F-BEAN-12 の保存前処理）。
 * 縮小が不要で元が JPEG、かつ再エンコードで大きくなる場合は元の Blob をそのまま返す。
 * 失敗時は ImageCompressError を投げる（握りつぶさない。UI は手入力への導線を出す）。
 */
export async function compressImage(input: Blob, options: CompressImageOptions = {}): Promise<Blob> {
  const maxEdge = options.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = options.quality ?? DEFAULT_QUALITY;
  if (!Number.isFinite(quality) || quality <= 0 || quality > 1) {
    throw new ImageCompressError(`quality は 0 より大きく 1 以下で指定してください（${quality}）`);
  }
  const decoded = await decodeImage(input);
  try {
    const size = fitWithin(decoded.width, decoded.height, maxEdge);
    const output = await encodeJpeg(decoded.source, size, quality);
    const notResized = size.width === decoded.width && size.height === decoded.height;
    if (notResized && input.type === COMPRESSED_MIME && output.size >= input.size) return input;
    return output;
  } finally {
    decoded.release();
  }
}
