'use client';

import { useQuery } from '@tanstack/react-query';
import type { QueryData } from '@supabase/supabase-js';
import { format, startOfMonth } from 'date-fns';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { LogKind, LogPlace } from '@/lib/schemas/log';
import { aggregateRatings } from './aggregate';

/**
 * 記録の取得で常に付ける関連。豆は NOT NULL なので `!inner`（豆の列で絞り込める）。
 * 店・焙煎バッチは NULL 可なので通常の埋め込み。
 */
export const LOG_SELECT =
  '*, bean:beans!inner(id, name, source, country, process, variety, roaster_id, price_jpy, roaster:roasters(id, name), bean_images(side, storage_path)), shop:shops(id, name, kind), roast:roasts(id, roasted_on, roast_level), log_tags(tag:tags(id, name))';

function logQuery() {
  return getSupabaseBrowserClient().from('logs').select(LOG_SELECT);
}
export type LogWithRelations = QueryData<ReturnType<typeof logQuery>>[number];

/** 絞り込み（F-LIST-2） */
export interface LogFilters {
  country?: string;
  process?: string;
  variety?: string;
  roasterId?: string;
  shopId?: string;
  tagId?: string;
  /** この星以上 */
  minRating?: number;
  place?: LogPlace;
  kind?: LogKind;
}

/** 並び替え（F-LIST-5）。価格は豆の `price_jpy`。 */
export type LogSort = 'date' | 'rating' | 'price';

export const logKeys = {
  all: ['logs'] as const,
  count: () => [...logKeys.all, 'count'] as const,
  monthlyCount: (month: string) => [...logKeys.all, 'monthly-count', month] as const,
  list: (filters: LogFilters, sort: LogSort) => [...logKeys.all, 'list', filters, sort] as const,
  detail: (id: string) => [...logKeys.all, 'detail', id] as const,
  byBean: (beanId: string) => [...logKeys.all, 'by-bean', beanId] as const,
  byShop: (shopId: string) => [...logKeys.all, 'by-shop', shopId] as const,
  ratingStats: () => [...logKeys.all, 'rating-stats'] as const,
};

async function logIdsWithTag(tagId: string): Promise<string[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from('log_tags')
    .select('log_id')
    .eq('tag_id', tagId);
  if (error) throw error;
  return data.map((r) => r.log_id);
}

/**
 * タイムライン（F-LIST-1）。日付降順、同日内は作成順の逆。
 * 日付見出しでのグループ化は UI 側の責務で、ここでは並んだ配列を返す。
 */
export function useLogs(filters: LogFilters = {}, sort: LogSort = 'date') {
  return useQuery({
    queryKey: logKeys.list(filters, sort),
    queryFn: async (): Promise<LogWithRelations[]> => {
      let q = logQuery();
      if (filters.country) q = q.eq('bean.country', filters.country);
      if (filters.process) q = q.eq('bean.process', filters.process);
      if (filters.variety) q = q.eq('bean.variety', filters.variety);
      if (filters.roasterId) q = q.eq('bean.roaster_id', filters.roasterId);
      if (filters.shopId) q = q.eq('shop_id', filters.shopId);
      if (filters.place) q = q.eq('place', filters.place);
      if (filters.kind) q = q.eq('kind', filters.kind);
      if (filters.minRating !== undefined) q = q.gte('rating', filters.minRating);
      if (filters.tagId) {
        // タグは多対多なので、先に該当する記録 ID を引いてから絞る（埋め込み側を !inner にするとタグ一覧が欠けるため）
        const ids = await logIdsWithTag(filters.tagId);
        if (ids.length === 0) return [];
        q = q.in('id', ids);
      }
      switch (sort) {
        case 'rating':
          q = q
            .order('rating', { ascending: false, nullsFirst: false })
            .order('logged_on', { ascending: false });
          break;
        case 'price':
          q = q
            .order('bean(price_jpy)', { ascending: false, nullsFirst: false })
            .order('logged_on', { ascending: false });
          break;
        default:
          q = q.order('logged_on', { ascending: false }).order('created_at', { ascending: false });
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

/** 記録 1 件（S5）。 */
export function useLog(id: string | null | undefined) {
  return useQuery({
    queryKey: logKeys.detail(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<LogWithRelations> => {
      const { data, error } = await logQuery().eq('id', id!).single();
      if (error) throw error;
      return data;
    },
  });
}

/** 豆詳細の「この豆の記録」（S4）。 */
export function useLogsByBean(beanId: string | null | undefined) {
  return useQuery({
    queryKey: logKeys.byBean(beanId ?? ''),
    enabled: !!beanId,
    queryFn: async (): Promise<LogWithRelations[]> => {
      const { data, error } = await logQuery()
        .eq('bean_id', beanId!)
        .order('logged_on', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** 店詳細の記録一覧（S6）。 */
export function useLogsByShop(shopId: string | null | undefined) {
  return useQuery({
    queryKey: logKeys.byShop(shopId ?? ''),
    enabled: !!shopId,
    queryFn: async (): Promise<LogWithRelations[]> => {
      const { data, error } = await logQuery()
        .eq('shop_id', shopId!)
        .order('logged_on', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** 自分の記録件数（RLS で自分の行だけが数えられる）。 */
export function useLogCount() {
  return useQuery({
    queryKey: logKeys.count(),
    queryFn: async () => {
      const { count, error } = await getSupabaseBrowserClient()
        .from('logs')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** 今月の杯数（S2 の見出し）。端末のローカル日付で月初を求める。 */
export function useMonthlyLogCount(now: Date = new Date()) {
  const from = format(startOfMonth(now), 'yyyy-MM-dd');
  return useQuery({
    queryKey: logKeys.monthlyCount(from),
    queryFn: async () => {
      const { count, error } = await getSupabaseBrowserClient()
        .from('logs')
        .select('id', { count: 'exact', head: true })
        .eq('kind', 'drank')
        .gte('logged_on', from);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/**
 * 豆ごと・店ごとの回数と平均星（S4 の「平均星と回数」、S6 の行の右側）。
 * 全記録の 3 列だけを取ってクライアントで集計する。
 */
export function useRatingStats() {
  return useQuery({
    queryKey: logKeys.ratingStats(),
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowserClient()
        .from('logs')
        .select('bean_id, shop_id, roast_id, rating');
      if (error) throw error;
      return aggregateRatings(data);
    },
  });
}
