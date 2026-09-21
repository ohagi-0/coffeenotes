'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { requireUserId } from '@/features/auth/require-user-id';
import { ensureTags } from './ensure-tags';
import { tagKeys } from './queries';

/** タグを 1 つ登録する。同名が既にあれば既存行が返る。 */
export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const [tag] = await ensureTags(getSupabaseBrowserClient(), [name], await requireUserId());
      return tag;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tagKeys.all }),
  });
}
