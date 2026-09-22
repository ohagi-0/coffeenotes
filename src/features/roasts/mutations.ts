'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { pickProvided } from '@/lib/schemas/common';
import { roastFormSchema, roastInsertSchema, type RoastFormInput } from '@/lib/schemas/roast';
import { requireUserId } from '@/features/auth/require-user-id';
import { logKeys } from '@/features/logs/queries';
import { roastKeys, type Roast } from './queries';

export type CreateRoastInput = RoastFormInput & { bean_id: string };

/** 焙煎バッチを登録する（F-ROAST-1〜7） */
export function useCreateRoast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRoastInput): Promise<Roast> => {
      const values = roastInsertSchema.parse({ ...input, user_id: await requireUserId() });
      const { data, error } = await getSupabaseBrowserClient()
        .from('roasts')
        .insert(values)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (roast) => {
      queryClient.invalidateQueries({ queryKey: roastKeys.byBean(roast.bean_id) });
    },
  });
}

export type UpdateRoastInput = { id: string } & Partial<RoastFormInput>;

export function useUpdateRoast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdateRoastInput): Promise<Roast> => {
      const values = pickProvided(roastFormSchema.partial().parse(patch), patch);
      const { data, error } = await getSupabaseBrowserClient()
        .from('roasts')
        .update(values)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (roast) => {
      queryClient.invalidateQueries({ queryKey: roastKeys.byBean(roast.bean_id) });
      queryClient.invalidateQueries({ queryKey: logKeys.all });
    },
  });
}

/** 焙煎バッチを削除する。紐づく記録の roast_id は ON DELETE SET NULL で外れる（記録は残る） */
export function useDeleteRoast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; beanId: string }): Promise<void> => {
      const { error } = await getSupabaseBrowserClient().from('roasts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { beanId }) => {
      queryClient.invalidateQueries({ queryKey: roastKeys.byBean(beanId) });
      queryClient.invalidateQueries({ queryKey: logKeys.all });
    },
  });
}
