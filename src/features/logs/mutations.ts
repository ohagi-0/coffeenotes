'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { LogFormInput } from '@/lib/schemas/log';
import { requireUserId } from '@/features/auth/require-user-id';
import { tagKeys } from '@/features/tags/queries';
import { createLogWithTags, type LogPatch, updateLogWithTags } from './create-log';
import { LOG_SELECT, logKeys, type LogWithRelations } from './queries';

async function fetchLog(id: string): Promise<LogWithRelations> {
  const { data, error } = await getSupabaseBrowserClient()
    .from('logs')
    .select(LOG_SELECT)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

/** 記録を作る（F-LOG-1〜3/8、F-TAG-1）。タグは名前で渡し、無ければ作られる。 */
export function useCreateLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LogFormInput): Promise<LogWithRelations> => {
      const id = await createLogWithTags(getSupabaseBrowserClient(), input, await requireUserId());
      return fetchLog(id);
    },
    onSuccess: (log) => {
      queryClient.invalidateQueries({ queryKey: logKeys.all });
      queryClient.invalidateQueries({ queryKey: tagKeys.all });
      queryClient.setQueryData(logKeys.detail(log.id), log);
    },
  });
}

export type UpdateLogInput = { id: string } & LogPatch;

/** 記録を部分更新する（F-LOG-7）。`tag_names` を渡したときだけタグを差し替える。 */
export function useUpdateLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdateLogInput): Promise<LogWithRelations> => {
      await updateLogWithTags(getSupabaseBrowserClient(), id, patch, await requireUserId());
      return fetchLog(id);
    },
    onSuccess: (log) => {
      queryClient.invalidateQueries({ queryKey: logKeys.all });
      queryClient.invalidateQueries({ queryKey: tagKeys.all });
      queryClient.setQueryData(logKeys.detail(log.id), log);
    },
  });
}

/** 記録を削除する（F-LOG-7）。log_tags は ON DELETE CASCADE。豆は残る。 */
export function useDeleteLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await getSupabaseBrowserClient().from('logs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: logKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: logKeys.all });
    },
  });
}
