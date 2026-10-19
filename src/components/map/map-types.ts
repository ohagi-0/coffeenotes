import type { MapShop } from '@/features/shops/map-pins';

// 店の地図の props（Leaflet 版と Google 版で共通）。ADR 0011。
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
  /** 検索語から引いた場所（登録済みの店ではない）。点線のピンを出し、変わったらそこへ移動する */
  focus?: { lat: number; lng: number; label: string } | null;
  /** 地図の高さ（px）。既定 300 */
  height?: number;
  className?: string;
};
