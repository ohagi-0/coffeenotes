'use client';

import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { OCR_DAILY_LIMIT } from '@/lib/ocr';
import type { OcrUsage } from '@/lib/schemas/ocr-response';

export const ocrKeys = {
  all: ['ocr'] as const,
  usage: (day: string) => [...ocrKeys.all, 'usage', day] as const,
};

/** 日本時間の今日（DB 関数 ocr_today() と同じ規則） */
export function ocrTodayJst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(now); // YYYY-MM-DD
}

/** 今日の読み取り回数（S9 設定の「今日の回数 3 / 50」）。行が無ければ 0。 */
export function useOcrUsage() {
  const today = ocrTodayJst();
  return useQuery({
    queryKey: ocrKeys.usage(today),
    queryFn: async (): Promise<OcrUsage> => {
      const { data, error } = await getSupabaseBrowserClient()
        .from('ocr_usage')
        .select('count')
        .eq('used_on', today)
        .maybeSingle();
      if (error) throw error;
      return { used: data?.count ?? 0, limit: OCR_DAILY_LIMIT };
    },
  });
}
