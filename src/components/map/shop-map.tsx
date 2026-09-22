'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { PIN_COLORS, pinTextColor, pinTier, type MapShop } from '@/features/shops/map-pins';
import { cn } from '@/lib/utils';

// 店の地図（S7、F-MAP-1〜4、F-SHOP-7）。Leaflet + OSM タイル。SSR 不可なので、ページ側で
// dynamic(() => import('@/components/map/shop-map'), { ssr: false }) で読み込む。
// ピンは divIcon（画像アセット不要）。平均星で色分けし、中に記録件数。長押し（Leaflet の contextmenu）で座標を返す。

export type ShopMapProps = {
  shops: MapShop[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** 長押し（PC は右クリック）で呼ぶ。店の登録に使う */
  onLongPress?: (pos: { lat: number; lng: number }) => void;
  center: { lat: number; lng: number };
  zoom?: number;
  /** 現在地。あれば青い点を出し、変わったらそこへ移動する */
  userLocation?: { lat: number; lng: number } | null;
  /** 地図の高さ（px）。既定 300 */
  height?: number;
  className?: string;
};

function pinIcon(shop: MapShop, selected: boolean): L.DivIcon {
  const tier = pinTier(shop.avgRating);
  const bg = PIN_COLORS[tier];
  const fg = pinTextColor(tier);
  const size = 30;
  const ring = selected ? `box-shadow:0 0 0 6px ${bg}55, 0 0 0 1px ${bg};` : '';
  return L.divIcon({
    className: 'coffeenotes-pin',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div role="img" aria-label="${escapeHtml(shop.name)}" style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;font:700 12px/1 Manrope,system-ui,sans-serif;border:2px solid #17120F;${ring}">${shop.count}</div>`,
  });
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

const userIcon = L.divIcon({
  className: 'coffeenotes-user',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#4A90E2;border:3px solid #fff;box-shadow:0 0 0 2px #4A90E266"></div>',
});

function FitOnce({ shops }: { shops: MapShop[] }) {
  const map = useMap();
  const key = shops.map((s) => s.id).join(',');
  useEffect(() => {
    if (shops.length === 0) return;
    if (shops.length === 1) {
      map.setView([shops[0]!.lat, shops[0]!.lng], Math.max(map.getZoom(), 15));
      return;
    }
    map.fitBounds(L.latLngBounds(shops.map((s) => [s.lat, s.lng] as [number, number])), {
      padding: [32, 32],
      maxZoom: 16,
    });
    // 店の集合が変わったときだけ合わせ直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function FlyToUser({ pos }: { pos: { lat: number; lng: number } | null | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.flyTo([pos.lat, pos.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [pos, map]);
  return null;
}

function LongPress({ onLongPress }: { onLongPress?: (pos: { lat: number; lng: number }) => void }) {
  useMapEvents({
    contextmenu(e) {
      if (!onLongPress) return;
      e.originalEvent.preventDefault();
      onLongPress({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function ShopMap({
  shops,
  selectedId,
  onSelect,
  onLongPress,
  center,
  zoom = 13,
  userLocation,
  height = 300,
  className,
}: ShopMapProps) {
  const markers = useMemo(
    () =>
      shops.map((s) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lng]}
          icon={pinIcon(s, s.id === selectedId)}
          eventHandlers={{ click: () => onSelect?.(s.id) }}
          zIndexOffset={s.id === selectedId ? 1000 : 0}
        />
      )),
    [shops, selectedId, onSelect],
  );

  return (
    <div className={cn('border-border overflow-hidden rounded-[14px] border', className)} style={{ height }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: '100%', width: '100%', background: '#211A15' }}
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} interactive={false} />
        )}
        <FitOnce shops={shops} />
        <FlyToUser pos={userLocation} />
        <LongPress onLongPress={onLongPress} />
      </MapContainer>
    </div>
  );
}
