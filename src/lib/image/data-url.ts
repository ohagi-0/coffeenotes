// Blob と data URL の相互変換。撮影した画像をウィザードの段階間（sessionStorage）で持ち回るために使う。
// Blob は JSON にできないので、①→②→③ の間は data URL（base64）にして保存し、保存時に Blob へ戻す。

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('画像を読み込めませんでした'));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
