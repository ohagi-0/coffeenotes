'use client';

import { useEffect, useState } from 'react';
import { Camera, Image as ImageIcon, RefreshCw, X } from 'lucide-react';
import { AppButton } from '@/components/app-button';
import { ErrorCallout } from '@/components/error-callout';
import { compressImage } from '@/lib/image/compress';
import { readQrFromBlob } from '@/lib/image/qr';
import { capturePhoto, type PhotoSource } from '@/lib/platform/camera';
import { cn } from '@/lib/utils';

// S3 ① カード撮影（F-OCR-1 / F-BEAN-12、DESIGN.md §5）。
// Web はアプリ内カメラを持たず、OS のカメラ／写真選択を開く（src/lib/platform/camera.ts 経由）。
// 撮った直後に長辺 1,600px の JPEG に圧縮する。Blob のまま親へ渡す（ネイティブ化制約 N-5）。
// QR は圧縮前の元画像から読む（小さく印刷された QR は 1,600px に縮めると読めないことがある。2026-09-25）。

export type CapturedImages = { front: Blob; back: Blob | null; qrText?: string | null };

type Side = 'front' | 'back';

function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function Tile({
  side,
  blob,
  busy,
  onTake,
  onClear,
}: {
  side: Side;
  blob: Blob | null;
  busy: boolean;
  onTake: (source: PhotoSource) => void;
  onClear: () => void;
}) {
  const url = useObjectUrl(blob);
  const label = side === 'front' ? '表' : '裏';
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-[11px]">
        {label}面{side === 'back' && '（任意）'}
      </p>
      <div
        className={cn(
          'bg-card border-border relative aspect-[3/4] overflow-hidden rounded-[14px] border',
          !blob && 'border-dashed',
        )}
        data-capture-tile={side}
      >
        {url ? (
          // 撮った本人の画像をその場で見せるだけなので next/image は使わない
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`${label}面のカード`} className="size-full object-cover" />
        ) : (
          <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-2 p-3">
            <Camera className="size-7" aria-hidden />
            <span className="text-center text-[12px] leading-snug">
              {side === 'front' ? 'カードの表を' : 'カードの裏を'}
              <br />
              枠いっぱいに
            </span>
          </div>
        )}
      </div>
      {blob ? (
        <div className="flex gap-2">
          <AppButton variant="secondary" size="sm" onClick={() => onTake('camera')} loading={busy}>
            <RefreshCw aria-hidden />
            撮り直す
          </AppButton>
          <AppButton variant="ghost" size="sm" width="auto" onClick={onClear} aria-label={`${label}面を外す`}>
            <X aria-hidden />
          </AppButton>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AppButton variant="secondary" size="sm" onClick={() => onTake('camera')} loading={busy}>
            <Camera aria-hidden />
            カメラで撮る
          </AppButton>
          <AppButton variant="ghost" size="sm" onClick={() => onTake('library')} disabled={busy}>
            <ImageIcon aria-hidden />
            写真を選ぶ
          </AppButton>
        </div>
      )}
    </div>
  );
}

export type CaptureStepProps = {
  onSubmit: (images: CapturedImages) => void;
  submitting?: boolean;
  className?: string;
};

export function CaptureStep({ onSubmit, submitting, className }: CaptureStepProps) {
  const [front, setFront] = useState<Blob | null>(null);
  const [back, setBack] = useState<Blob | null>(null);
  const [qr, setQr] = useState<{ front: string | null; back: string | null }>({ front: null, back: null });
  const [busy, setBusy] = useState<Side | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function take(side: Side, source: PhotoSource) {
    setBusy(side);
    setError(null);
    try {
      const raw = await capturePhoto({ source });
      if (!raw) return; // キャンセル
      const [blob, qrText] = await Promise.all([compressImage(raw), readQrFromBlob(raw)]);
      if (side === 'front') setFront(blob);
      else setBack(blob);
      setQr((q) => ({ ...q, [side]: qrText }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '画像を読み込めませんでした');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {error && (
        <ErrorCallout
          title="画像を読み込めませんでした"
          what={error}
          next="別の写真を選ぶか、入口に戻って「手で入力する」を選んでください。"
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Tile
          side="front"
          blob={front}
          busy={busy === 'front'}
          onTake={(s) => take('front', s)}
          onClear={() => setFront(null)}
        />
        <Tile
          side="back"
          blob={back}
          busy={busy === 'back'}
          onTake={(s) => take('back', s)}
          onClear={() => setBack(null)}
        />
      </div>
      <div className="mt-1 flex flex-col gap-2">
        <AppButton
          onClick={() => front && onSubmit({ front, back, qrText: qr.front ?? qr.back })}
          disabled={!front}
          loading={submitting}
        >
          この内容で読み取る
        </AppButton>
        <p className="text-muted-foreground text-center text-[11px] leading-relaxed">
          画像は長辺 1,600px に縮小して送ります。読み取りは 1 日 50 回まで。
        </p>
      </div>
    </div>
  );
}
