'use client';

import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Tables } from '@/types/database';

export type Tag = Tables<'tags'>;

export const tagKeys = {
  all: ['tags'] as const,
  list: () => [...tagKeys.all, 'list'] as const,
};

/** 自分が過去に使ったタグ（候補表示用、F-TAG-2）。RLS により自分の行だけが返る。 */
export function useTags() {
  return useQuery({
    queryKey: tagKeys.list(),
    queryFn: async (): Promise<Tag[]> => {
      const { data, error } = await getSupabaseBrowserClient().from('tags').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
}
