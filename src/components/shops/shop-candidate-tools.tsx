'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { LocateFixed, MapPin, Search } from 'lucide-react';
import { AppButton } from '@/components/app-button';
import { PlatformGeolocationError, getCurrentPosition } from '@/lib/platform/geolocation';
import type { PlaceCandidateDto } from '@/lib/schemas/geo-response';
import { DEFAULT_CENTER } from '@/features/shops/map-pins';
import { cn } from '@/lib/utils';

// 店を探す 3 つの入口（S3 ③ / S6、F-SHOP-3/4/7）: 現在地から探す / 店名で検索 / 地図で指定。
// 候補検索は入力補助で、失敗しても手入力で店を作れる（ADR 0003）。地図は SSR 不可なので dynamic。

const ShopMap = dynamic(() => import('@/components/map/shop-map'), { ssr: false });

export type ShopCandidate = PlaceCandidateDto;

export type ShopCandidateToolsProps = {
  /** 「店名で検索」に使う現在の入力 */
  query: string;
  nearby?: (pos: { lat: number; lng: number }) => Promise<ShopCandidate[]>;
  geocode?: (query: string, near?: { lat: number; lng: number }) => Promise<ShopCandidate[]>;
  onPick: (c: ShopCandidate) => void;
  /** 地図の長押しで座標だけ決める */
  onPickPosition?: (pos: { lat: number; lng: number }) => void;
  /** 地図の初期位置。選択済みの座標があればそこ */
  position?: { lat: number; lng: number } | null;
  className?: string;
};

type Mode = 'idle' | 'nearby' | 'geocode' | 'map';

function formatDistance(m: number | undefined): string | null {
  if (m === undefined) return null;
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

export function ShopCandidateTools({
  query,
  nearby,
  geocode,
  onPick,
  onPickPosition,
  position,
  className,
}: ShopCandidateToolsProps) {
  const [mode, setMode] = useState<Mode>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ShopCandidate[] | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

  async function locate(): Promise<{ lat: number; lng: number } | null> {
    try {
      const p = await getCurrentPosition({ timeoutMs: 8000 });
      const pos = { lat: p.lat, lng: p.lng };
      setUserPos(pos);
      return pos;
    } catch (e) {
      setError(
        e instanceof PlatformGeolocationError && e.kind === 'permission-denied'
          ? '位置情報が許可されていません。端末の設定で許可するか、店名で検索してください。'
          : e instanceof Error
            ? e.message
            : '現在地を取得できませんでした',
      );
      return null;
    }
  }

  async function runNearby() {
    if (!nearby) return;
    setMode('nearby');
    setError(null);
    setCandidates(null);
    setBusy(true);
    try {
      const pos = userPos ?? (await locate());
      if (!pos) return;
      setCandidates(await nearby(pos));
    } catch (e) {
      setError(e instanceof Error ? e.message : '候補を取得できませんでした');
    } finally {
      setBusy(false);
    }
  }

  async function runGeocode() {
    if (!geocode) return;
    const q = query.trim();
    setMode('geocode');
    setError(null);
    setCandidates(null);
    if (!q) {
      setError('店名か住所を入力してから検索してください。');
      return;
    }
    setBusy(true);
    try {
      setCandidates(await geocode(q, userPos ?? undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : '候補を取得できませんでした');
    } finally {
      setBusy(false);
    }
  }

  const chip = (active: boolean) =>
    cn(
      'flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors',
      active
        ? 'border-primary bg-primary/14 text-primary'
        : 'border-border text-muted-foreground hover:text-foreground',
    );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="店を探す方法">
        {nearby && (
          <button type="button" className={chip(mode === 'nearby')} onClick={runNearby} disabled={busy}>
            <LocateFixed className="size-4" aria-hidden />
            現在地から探す
          </button>
        )}
        {geocode && (
          <button type="button" className={chip(mode === 'geocode')} onClick={runGeocode} disabled={busy}>
            <Search className="size-4" aria-hidden />
            店名で検索
          </button>
        )}
        {onPickPosition && (
          <button
            type="button"
            className={chip(mode === 'map')}
            onClick={() => {
              setMode(mode === 'map' ? 'idle' : 'map');
              setError(null);
              setCandidates(null);
            }}
          >
            <MapPin className="size-4" aria-hidden />
            地図で指定
          </button>
        )}
      </div>

      {busy && (
        <p className="text-muted-foreground text-xs" role="status">
          候補を探しています…
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}

      {candidates && !busy && (
        <div>
          {candidates.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              候補が見つかりませんでした。店名を手で入力して登録できます。
            </p>
          ) : (
            <ul
              role="listbox"
              aria-label="店の候補"
              className="border-border bg-card max-h-64 overflow-y-auto rounded-xl border py-1"
            >
              {candidates.map((c, i) => (
                <li key={`${c.externalPlaceId ?? c.name}-${i}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => onPick(c)}
                    className="hover:bg-secondary flex w-full flex-col justify-center px-3.5 py-2 text-left"
                  >
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate">{c.name}</span>
                      {formatDistance(c.distanceM) && (
                        <span className="text-muted-foreground font-num shrink-0 text-[11px]">
                          {formatDistance(c.distanceM)}
                        </span>
                      )}
                    </span>
                    {c.address && (
                      <span className="text-muted-foreground truncate text-[11px]">{c.address}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {mode === 'map' && onPickPosition && (
        <div className="flex flex-col gap-1.5">
          <ShopMap
            shops={[]}
            center={position ?? userPos ?? DEFAULT_CENTER}
            zoom={position ? 16 : 14}
            userLocation={userPos}
            height={220}
            onLongPress={(pos) => onPickPosition(pos)}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-[11px]">
              {position
                ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)} · 長押しで置き直せます`
                : '地図を長押し（PC は右クリック）してピンを置きます'}
            </p>
            <AppButton
              type="button"
              variant="ghost"
              size="sm"
              width="auto"
              onClick={async () => {
                setError(null);
                await locate();
              }}
            >
              <LocateFixed aria-hidden />
              現在地
            </AppButton>
          </div>
        </div>
      )}
    </div>
  );
}
