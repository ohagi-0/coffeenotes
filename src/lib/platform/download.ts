'use client';

// ファイルのダウンロード（ネイティブ化制約 N-4）。Web は a[download]、将来 Capacitor の Filesystem / Share に差し替える。
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
