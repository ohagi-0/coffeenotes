'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdvancedMarker, APIProvider, Map, useApiIsLoaded, useMap } from '@vis.gl/react-google-maps';
import type { ShopMapProps } from '@/components/map/map-types';
import { Skeleton } from '@/components/ui/skeleton';
import { PIN_COLORS, pinTextColor, pinTier, type MapShop } from '@/features/shops/map-pins';
import { getPublicEnv } from '@/lib/env';
import { createLongPressDetector } from '@/lib/map/long-press';
import { useOnline } from '@/lib/platform/network';
import { cn } from '@/lib/utils';

// 店の地図の Google マップ版（S6、F-MAP-1〜4、F-SHOP-7。ADR 0011 / Issue #37）。ShopMapProps は Leaflet 版（shop-map.tsx）と同じ。
// 切り替えは shop-map-switch.tsx（NEXT_PUBLIC_MAP_PROVIDER）。ピンは AdvancedMarker + 自前の丸（記録件数入り、平均星で色分け）。
// ダーク配色は Map ID（Cloud 側のスタイル）が持つので、コードから styles は渡さない（Map ID と併用できない）。
// 地図内に Google のロゴが出るので、帰属表示はそれで足りる。OSM の店のデータも出るので © OpenStreetMap contributors を地図の下に出す。
// Capacitor 版では WebView の参照元（capacitor://localhost、https://localhost）をブラウザ用キーの許可に入れてあること（USER-SETUP §5）。

type Pos = { lat: number; lng: number };

function Pin({ shop, selected }: { shop: MapShop; selected: boolean }) {
  const tier = pinTier(shop.avgRating);
  const bg = PIN_COLORS[tier];
  return (
    <div
      role="img"
      aria-label={shop.name}
      style={{
        width: 30,
        height: 30,
        borderRadius: '50%',
        background: bg,
        color: pinTextColor(tier),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: '700 12px/1 Manrope, system-ui, sans-serif',
        border: '2px solid #17120F',
        boxShadow: selected ? `0 0 0 6px ${bg}55, 0 0 0 1px ${bg}` : undefined,
      }}
    >
      {shop.count}
    </div>
  );
}

/** 店の集合が変わったときだけ全ピンが収まるよう合わせる（Leaflet 版の FitOnce と同じ） */
function FitOnce({ shops }: { shops: MapShop[] }) {
  const map = useMap();
  const key = shops.map((s) => s.id).join(',');
  useEffect(() => {
    if (!map || shops.length === 0) return;
    if (shops.length === 1) {
      map.setCenter({ lat: shops[0]!.lat, lng: shops[0]!.lng });
      map.setZoom(Math.max(map.getZoom() ?? 0, 15));
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const s of shops) bounds.extend({ lat: s.lat, lng: s.lng });
    map.fitBounds(bounds, 32);
    // 上限の拡大率（近すぎる店 2 つでも寄りすぎない）
    google.maps.event.addListenerOnce(map, 'idle', () => {
      if ((map.getZoom() ?? 0) > 16) map.setZoom(16);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/** 現在地・検索した場所が変わったらそこへ動く */
function PanTo({ pos }: { pos: Pos | null | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !pos) return;
    map.panTo(pos);
    if ((map.getZoom() ?? 0) < 15) map.setZoom(15);
  }, [map, pos]);
  return null;
}

/** 長押し（タッチ）と右クリック（マウス）。Google の Map はタッチの長押しを通知しないので、コンテナの pointer イベントで判定する */
function LongPress({ onLongPress }: { onLongPress?: (pos: Pos) => void }) {
  const map = useMap();
  const lastFired = useRef(0);

  // ピクセル → 緯度経度（Map の表示範囲と投影から求める。コンテナ全体が表示範囲）
  const toLatLng = useCallback(
    (x: number, y: number): Pos | null => {
      const bounds = map?.getBounds();
      const proj = map?.getProjection();
      const zoom = map?.getZoom();
      if (!map || !bounds || !proj || zoom === undefined) return null;
      const ne = proj.fromLatLngToPoint(bounds.getNorthEast());
      const sw = proj.fromLatLngToPoint(bounds.getSouthWest());
      if (!ne || !sw) return null;
      const scale = 2 ** zoom;
      const ll = proj.fromPointToLatLng(new google.maps.Point(x / scale + sw.x, y / scale + ne.y));
      return ll ? { lat: ll.lat(), lng: ll.lng() } : null;
    },
    [map],
  );

  useEffect(() => {
    const el = map?.getDiv();
    if (!el || !onLongPress) return;
    const detector = createLongPressDetector((x, y) => {
      const pos = toLatLng(x, y);
      if (!pos) return;
      lastFired.current = Date.now();
      onLongPress(pos);
    });
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return; // マウスは右クリック（onContextmenu）
      const p = local(e);
      detector.start(p.x, p.y);
    };
    const move = (e: PointerEvent) => {
      const p = local(e);
      detector.move(p.x, p.y);
    };
    const end = () => detector.cancel();
    // 2 本指（ピンチ）や地図のドラッグは取り消す
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', end);
    return () => {
      detector.cancel();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      el.removeEventListener('pointerleave', end);
    };
  }, [map, onLongPress, toLatLng]);

  // PC は右クリック。Android は長押しで contextmenu も飛ぶので、長押しで発火した直後は無視する
  useEffect(() => {
    if (!map || !onLongPress) return;
    const l = map.addListener('contextmenu', (e: google.maps.MapMouseEvent) => {
      e.domEvent?.preventDefault?.();
      if (!e.latLng || Date.now() - lastFired.current < 1000) return;
      onLongPress({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    });
    return () => l.remove();
  }, [map, onLongPress]);
  return null;
}

function MapStatus({
  children,
  height,
  className,
}: {
  children: React.ReactNode;
  height: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        'border-border bg-card text-muted-foreground grid place-items-center rounded-[14px] border px-6 text-center text-sm',
        className,
      )}
      style={{ height }}
    >
      {children}
    </div>
  );
}

function Inner({
  shops,
  selectedId,
  onSelect,
  onLongPress,
  center,
  zoom = 13,
  userLocation,
  focus,
  authFailed,
}: ShopMapProps & { authFailed: boolean }) {
  const loaded = useApiIsLoaded();
  const { NEXT_PUBLIC_GOOGLE_MAP_ID: mapId } = getPublicEnv();
  const markers = useMemo(
    () =>
      shops.map((s) => (
        <AdvancedMarker
          key={s.id}
          position={{ lat: s.lat, lng: s.lng }}
          title={s.name}
          zIndex={s.id === selectedId ? 1000 : 0}
          onClick={() => onSelect?.(s.id)}
        >
          <Pin shop={s} selected={s.id === selectedId} />
        </AdvancedMarker>
      )),
    [shops, selectedId, onSelect],
  );

  if (authFailed) return <AuthFailed />;
  if (!loaded) return <Skeleton className="h-full w-full" />;
  return (
    <Map
      mapId={mapId}
      defaultCenter={center}
      defaultZoom={zoom}
      gestureHandling="greedy"
      disableDefaultUI
      zoomControl
      clickableIcons={false}
      style={{ width: '100%', height: '100%' }}
    >
      {markers}
      {userLocation && (
        <AdvancedMarker position={userLocation} zIndex={500} clickable={false}>
          <div
            role="img"
            aria-label="現在地"
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#4A90E2',
              border: '3px solid #fff',
              boxShadow: '0 0 0 2px #4A90E266',
            }}
          />
        </AdvancedMarker>
      )}
      {focus && (
        <AdvancedMarker position={focus} zIndex={400} clickable={false}>
          <div
            role="img"
            aria-label={focus.label}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: '2px dashed #F0B57A',
              background: '#F0B57A33',
            }}
          />
        </AdvancedMarker>
      )}
      <FitOnce shops={shops} />
      <PanTo pos={userLocation} />
      <PanTo pos={focus} />
      <LongPress onLongPress={onLongPress} />
    </Map>
  );
}

function AuthFailed() {
  return (
    <div role="alert" className="text-destructive grid h-full place-items-center px-6 text-center text-sm">
      地図を読み込めませんでした。設定を確認してください
    </div>
  );
}

export default function GoogleShopMap(props: ShopMapProps) {
  const { height = 300, className } = props;
  const online = useOnline();
  const env = getPublicEnv();
  const [authFailed, setAuthFailed] = useState(false);

  // 鍵の制限・請求の問題は、Google の読み込み後にこのグローバル関数で通知される
  useEffect(() => {
    const w = window as unknown as { gm_authFailure?: () => void };
    w.gm_authFailure = () => setAuthFailed(true);
    return () => {
      delete w.gm_authFailure;
    };
  }, []);

  if (!online) {
    return (
      <MapStatus height={height} className={className}>
        オフラインでは地図を出せません。店の一覧は使えます
      </MapStatus>
    );
  }
  if (!env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY) {
    return (
      <MapStatus height={height} className={className}>
        地図を読み込めませんでした。設定を確認してください
      </MapStatus>
    );
  }
  return (
    <div className={className}>
      <div
        role="region"
        aria-label="店の地図"
        className="border-border overflow-hidden rounded-[14px] border"
        style={{ height }}
      >
        <APIProvider
          apiKey={env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY}
          language="ja"
          region="JP"
          onError={() => setAuthFailed(true)}
        >
          <Inner {...props} authFailed={authFailed} />
        </APIProvider>
      </div>
      <p className="text-muted-foreground mt-1 text-right text-[10px]">
        登録した店の一部は © OpenStreetMap contributors のデータです
      </p>
    </div>
  );
}
