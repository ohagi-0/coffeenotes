'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { RoasterFormInput } from '@/lib/schemas/roaster';
import { requireUserId } from '@/features/auth/require-user-id';
import { createRoasterWithDedupe } from './create-roaster';
import { roasterKeys } from './queries';

/** ロースターを登録する。同名が既にあれば既存行が返る（例外にならない）。 */
export function useCreateRoaster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RoasterFormInput) =>
      createRoasterWithDedupe(getSupabaseBrowserClient(), input, await requireUserId()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roasterKeys.all }),
  });
}
