'use client';

import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export const logKeys = {
  all: ['logs'] as const,
  count: () => [...logKeys.all, 'count'] as const,
};

/** 自分の記録件数（RLS で自分の行だけが数えられる） */
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
