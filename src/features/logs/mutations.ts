'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { LogFormInput } from '@/lib/schemas/log';
import { requireUserId } from '@/features/auth/require-user-id';
import { shopKeys } from '@/features/shops/queries';
import { tagKeys } from '@/features/tags/queries';
import { deleteLogsAndOrphanShops, type DeleteLogsResult } from './delete-log';
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

/**
 * 記録を作る（F-LOG-1〜3/8、F-TAG-1）。タグは名前で渡し、無ければ作られる。
 * 作成後に記録を読み直さない（保存の待ち時間を縮める）。一覧・詳細は無効化で次に開いたときに取り直す。
 */
export function useCreateLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LogFormInput): Promise<{ id: string }> => {
      const id = await createLogWithTags(getSupabaseBrowserClient(), input, await requireUserId());
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logKeys.all });
      queryClient.invalidateQueries({ queryKey: tagKeys.all });
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

/**
 * 複数の記録をまとめて削除する（F-LOG-7 の一括版。S2 の選択モード）。
 * 記録が無くなった店も一緒に消す（delete-log.ts）。豆は残る。
 */
export function useDeleteLogs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: readonly string[]): Promise<DeleteLogsResult> =>
      deleteLogsAndOrphanShops(getSupabaseBrowserClient(), ids),
    onSuccess: (result, ids) => {
      for (const id of ids) queryClient.removeQueries({ queryKey: logKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: logKeys.all });
      if (result.removedShopIds.length > 0) queryClient.invalidateQueries({ queryKey: shopKeys.all });
    },
  });
}

/** 記録を削除する（F-LOG-7）。log_tags は ON DELETE CASCADE。記録が無くなった店も一緒に消す。豆は残る。 */
export function useDeleteLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string): Promise<DeleteLogsResult> =>
      deleteLogsAndOrphanShops(getSupabaseBrowserClient(), [id]),
    onSuccess: (result, id) => {
      queryClient.removeQueries({ queryKey: logKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: logKeys.all });
      if (result.removedShopIds.length > 0) queryClient.invalidateQueries({ queryKey: shopKeys.all });
    },
  });
}
