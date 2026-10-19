import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlaceCandidate } from '@/lib/geo';
import type { RefreshPlaceResult } from '@/lib/geo/providers/google';
import type { Database } from '@/types/database';

// Google の店の 30 日更新（ADR 0011 の 30 日ルール、F-SHOP-1）。
// Google Maps Platform の規約で、Places から取った名前・住所・座標は 30 日までしか保てない（place_id だけが永続）。
// 週 1 回のジョブ（/api/places/refresh）が、20 日より古い写しを Place Details で取り直す。
// 失敗しても 30 日までにもう 1 回走れるよう、対象は 20 日で切る。

export const REFRESH_STALE_DAYS = 20;
export const REFRESH_MAX_PER_RUN = 200;
/** 表示時の保険（店詳細を開いたとき）の期限。これを超えたら取り直す */
export const LAZY_REFRESH_DAYS = 30;

export type RefreshSummary = { refreshed: number; moved: number; demoted: number; failed: number };

type Client = SupabaseClient<Database>;
type RefreshFn = (placeId: string) => Promise<RefreshPlaceResult>;

const DAY_MS = 86_400_000;

/** 写しの取得から days 日より古い Google の店か（表示時の保険の判定にも使う） */
export function isStaleGoogleShop(
  shop: { place_provider: string | null; place_synced_at: string | null },
  now: Date,
  days: number = LAZY_REFRESH_DAYS,
): boolean {
  if (shop.place_provider !== 'google') return false;
  if (!shop.place_synced_at) return true;
  return now.getTime() - new Date(shop.place_synced_at).getTime() > days * DAY_MS;
}

function copyOf(place: PlaceCandidate, now: Date) {
  return {
    name: place.name,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    place_synced_at: now.toISOString(),
  };
}

/** 20 日より古い（または写しの時刻が無い）Google の店を取り直す。1 件の失敗で止めず、結果を数えて返す */
export async function refreshGoogleShops(
  client: Client,
  refresh: RefreshFn,
  opts: { now?: () => Date; limit?: number; staleDays?: number } = {},
): Promise<RefreshSummary> {
  const now = opts.now ?? (() => new Date());
  const cutoff = new Date(now().getTime() - (opts.staleDays ?? REFRESH_STALE_DAYS) * DAY_MS).toISOString();
  const summary: RefreshSummary = { refreshed: 0, moved: 0, demoted: 0, failed: 0 };

  const { data, error } = await client
    .from('shops')
    .select('id, external_place_id')
    .eq('place_provider', 'google')
    .or(`place_synced_at.is.null,place_synced_at.lt.${cutoff}`)
    .order('place_synced_at', { ascending: true, nullsFirst: true })
    .limit(opts.limit ?? REFRESH_MAX_PER_RUN);
  if (error) throw error;

  for (const shop of data ?? []) {
    const placeId = shop.external_place_id;
    if (!placeId) {
      summary.failed++;
      continue;
    }
    try {
      let result = await refresh(placeId);
      let newId: string | null = null;
      if (result.status === 'moved') {
        // 移転先の ID に付け替えて、その最新の写しを取る（1 回だけたどる）
        newId = result.movedPlaceId;
        result = await refresh(newId);
      }
      if (result.status === 'ok') {
        const patch = { ...copyOf(result.place, now()), ...(newId ? { external_place_id: newId } : {}) };
        const { error: upErr } = await client.from('shops').update(patch).eq('id', shop.id);
        if (upErr) throw upErr;
        if (newId) summary.moved++;
        else summary.refreshed++;
      } else {
        // Google に無い（閉店・ID の失効）。手入力の店に落とす。名前は記録のラベルとして残す
        const { error: dErr } = await client
          .from('shops')
          .update({
            place_provider: null,
            external_place_id: null,
            place_synced_at: null,
            address: null,
            lat: null,
            lng: null,
          })
          .eq('id', shop.id);
        if (dErr) throw dErr;
        summary.demoted++;
      }
    } catch {
      // 429 / 5xx / タイムアウトなどの一時的な失敗は飛ばして次へ（次の週に再試行）
      summary.failed++;
    }
  }
  return summary;
}
