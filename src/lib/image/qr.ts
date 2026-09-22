// カード画像の QR コードを読む（F-OCR-4）。ブラウザ内で完結（@zxing/browser）。見つからなければ null。
// 読み取り本体は動的 import にして、撮影を使わない画面のバンドルに入れない。

export async function readQrFromBlob(blob: Blob): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  const { BrowserQRCodeReader } = await import('@zxing/browser');
  const url = URL.createObjectURL(blob);
  try {
    const result = await new BrowserQRCodeReader().decodeFromImageUrl(url);
    const text = result.getText().trim();
    return text || null;
  } catch {
    return null; // NotFoundException など。QR が無いのは正常
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** QR の中身が URL なら正規化して返す。URL でなければ null（参照 URL として保存しない） */
export function qrTextToUrl(text: string | null): string | null {
  if (!text) return null;
  try {
    const u = new URL(text);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}
