import { expect, test } from '@playwright/test';
import {
  compressImage,
  decodeImage,
  encodeJpeg,
  fitWithin,
  ImageCompressError,
  type CompressImageOptions,
} from '../../src/lib/image/compress';

// 圧縮は Canvas / createImageBitmap に依存するため jsdom では確かめられない（寸法計算だけ単体テスト側にある）。
// ここでは実ブラウザに src/lib/image/compress.ts の関数をそのまま流し込み、3,000px 相当の画像で挙動を確認する。
const MODULE_SOURCE = [ImageCompressError, fitWithin, decodeImage, encodeJpeg, compressImage]
  .map((fn) => fn.toString())
  .join('\n\n');

const PRELUDE = `
const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.8;
const COMPRESSED_MIME = 'image/jpeg';
`;

type Measurement = {
  inputSize: number;
  outputSize: number;
  outputType: string;
  width: number;
  height: number;
};

async function measure(
  page: import('@playwright/test').Page,
  source: { width: number; height: number },
  options: CompressImageOptions = {},
): Promise<Measurement> {
  return page.evaluate(
    async ({ code, source, options }) => {
      const load = new Function(`${code}\nreturn compressImage;`) as () => (
        input: Blob,
        options?: CompressImageOptions,
      ) => Promise<Blob>;
      const compress = load();

      // 元画像: 一様色だと JPEG が効きすぎるのでグラデーションとノイズを描く。
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext('2d')!;
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#6b4a2f');
      gradient.addColorStop(1, '#d8c3a5');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = `hsl(${(i * 37) % 360} 70% 50%)`;
        ctx.fillRect((i * 97) % canvas.width, (i * 53) % canvas.height, 24, 24);
      }
      const input: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));

      const output = await compress(input, options);
      const bitmap = await createImageBitmap(output);
      try {
        return {
          inputSize: input.size,
          outputSize: output.size,
          outputType: output.type,
          width: bitmap.width,
          height: bitmap.height,
        };
      } finally {
        bitmap.close();
      }
    },
    { code: PRELUDE + MODULE_SOURCE, source, options },
  );
}

test.describe('compressImage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('about:blank');
  });

  test('3,000px の横長画像は長辺 1,600px の JPEG になり、元より小さくなる', async ({ page }) => {
    const result = await measure(page, { width: 3000, height: 2000 });
    expect({ width: result.width, height: result.height }).toEqual({ width: 1600, height: 1067 });
    expect(result.outputType).toBe('image/jpeg');
    expect(result.outputSize).toBeLessThan(result.inputSize);
  });

  test('縦長画像は高さが 1,600px になる', async ({ page }) => {
    const result = await measure(page, { width: 2000, height: 3000 });
    expect({ width: result.width, height: result.height }).toEqual({ width: 1067, height: 1600 });
  });

  test('長辺が上限以下の画像は拡大しない', async ({ page }) => {
    const result = await measure(page, { width: 900, height: 600 });
    expect({ width: result.width, height: result.height }).toEqual({ width: 900, height: 600 });
  });

  test('maxEdge を指定すればその長辺になる', async ({ page }) => {
    const result = await measure(page, { width: 3000, height: 2000 }, { maxEdge: 800 });
    expect({ width: result.width, height: result.height }).toEqual({ width: 800, height: 533 });
  });
});
