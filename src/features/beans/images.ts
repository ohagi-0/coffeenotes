'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  SIGNED_URL_TTL_SEC,
  getBeanImageUrl,
  uploadBeanImage,
  type BeanImageSide,
} from '@/lib/storage/bean-images';
import type { Database } from '@/types/database';

// カード画像（F-BEAN-12）: Storage へのアップロードと bean_images 行の upsert、表示用の署名付き URL。

export interface BeanImageBlobs {
  front: Blob;
  back?: Blob | null;
}

/** 圧縮済み画像をアップロードし、bean_images に (bean_id, side) で upsert する。 */
export async function saveBeanImages(
  client: SupabaseClient<Database>,
  { userId, beanId, images }: { userId: string; beanId: string; images: BeanImageBlobs },
): Promise<void> {
  const sides: [BeanImageSide, Blob][] = [['front', images.front]];
  if (images.back) sides.push(['back', images.back]);
  // 表・裏は並列に上げ、bean_images の行は 1 回の upsert にまとめる（保存の待ち時間を縮める）
  const rows = await Promise.all(
    sides.map(async ([side, blob]) => ({
      user_id: userId,
      bean_id: beanId,
      side,
      storage_path: await uploadBeanImage({ userId, beanId, side, blob }, client),
    })),
  );
  const { error } = await client.from('bean_images').upsert(rows, { onConflict: 'bean_id,side' });
  if (error) throw error;
}

/** 表面の storage_path を取り出す（豆の関連 bean_images から）。 */
export function frontImagePath(
  images: readonly { side: string; storage_path: string }[] | null | undefined,
): string | null {
  return images?.find((i) => i.side === 'front')?.storage_path ?? null;
}

// 署名付き URL の小さなキャッシュ（期限の 1 分前まで再利用）。
// react-query を使わないのは、LogListItem のような表示部品からも呼べるようにするため（QueryClient を要求しない）。
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_TTL_MS = (SIGNED_URL_TTL_SEC - 60) * 1000;

function cachedUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const hit = urlCache.get(path);
  return hit && hit.expiresAt > Date.now() ? hit.url : null;
}

/** テスト用 */
export function clearBeanImageUrlCacheForTest(): void {
  urlCache.clear();
}

/** 非公開バケットの署名付き URL を解決する。path が無ければ何もしない。失敗は null（プレースホルダ表示）。 */
export function useBeanImageUrl(storagePath: string | null | undefined): { data: string | null } {
  const [url, setUrl] = useState<string | null>(() => cachedUrl(storagePath));
  useEffect(() => {
    if (!storagePath) {
      setUrl(null);
      return;
    }
    const hit = cachedUrl(storagePath);
    if (hit) {
      setUrl(hit);
      return;
    }
    let active = true;
    getBeanImageUrl(storagePath, SIGNED_URL_TTL_SEC, getSupabaseBrowserClient())
      .then((u) => {
        urlCache.set(storagePath, { url: u, expiresAt: Date.now() + CACHE_TTL_MS });
        if (active) setUrl(u);
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => {
      active = false;
    };
  }, [storagePath]);
  return { data: url };
}
