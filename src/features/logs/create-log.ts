import type { SupabaseClient } from '@supabase/supabase-js';
import { logFormFieldsSchema, logInsertSchema, type LogFormInput } from '@/lib/schemas/log';
import { pickProvided } from '@/lib/schemas/common';
import type { Database } from '@/types/database';
import { ensureTags } from '@/features/tags/ensure-tags';

// フックから切り離した本体。偽クライアントで単体テストするため。

/** 記録を作り、タグを付ける。戻り値は新しい記録の ID。 */
export async function createLogWithTags(
  client: SupabaseClient<Database>,
  input: LogFormInput,
  userId: string,
): Promise<string> {
  const { tag_names, ...fields } = logFormFieldsSchema.parse(input);
  // place=home なら店は付けない（DB の CHECK 制約）。フォームが店を残していても保存前に落とす
  const values = logInsertSchema.parse({
    ...fields,
    shop_id: fields.place === 'home' ? null : fields.shop_id,
    user_id: userId,
  });
  const inserted = await client.from('logs').insert(values).select('id').single();
  if (inserted.error) throw inserted.error;
  await syncLogTags(client, inserted.data.id, tag_names, userId);
  return inserted.data.id;
}

export type LogPatch = Partial<LogFormInput>;

/** 記録を部分更新する。`tag_names` を渡したときだけタグを差し替える。 */
export async function updateLogWithTags(
  client: SupabaseClient<Database>,
  id: string,
  patch: LogPatch,
  userId: string,
): Promise<void> {
  const normalized: LogPatch = patch.place === 'home' ? { ...patch, shop_id: null } : patch;
  const { tag_names, ...fields } = pickProvided(logFormFieldsSchema.partial().parse(normalized), normalized);
  if (Object.keys(fields).length > 0) {
    const updated = await client.from('logs').update(fields).eq('id', id);
    if (updated.error) throw updated.error;
  }
  if (tag_names !== undefined) await syncLogTags(client, id, tag_names, userId);
}

/** 記録のタグを名前の配列に合わせる（無いタグは作り、外れたタグは log_tags から消す）。 */
export async function syncLogTags(
  client: SupabaseClient<Database>,
  logId: string,
  tagNames: readonly string[],
  userId: string,
): Promise<void> {
  const desired = await ensureTags(client, tagNames, userId);
  const desiredIds = new Set(desired.map((t) => t.id));

  const current = await client.from('log_tags').select('tag_id').eq('log_id', logId);
  if (current.error) throw current.error;
  const currentIds = new Set(current.data.map((r) => r.tag_id));

  const toRemove = Array.from(currentIds).filter((id) => !desiredIds.has(id));
  if (toRemove.length > 0) {
    const removed = await client.from('log_tags').delete().eq('log_id', logId).in('tag_id', toRemove);
    if (removed.error) throw removed.error;
  }

  const toAdd = Array.from(desiredIds).filter((id) => !currentIds.has(id));
  if (toAdd.length > 0) {
    // log_tags.user_id も NOT NULL（RLS の対象）
    const added = await client
      .from('log_tags')
      .insert(toAdd.map((tag_id) => ({ log_id: logId, tag_id, user_id: userId })));
    if (added.error) throw added.error;
  }
}
