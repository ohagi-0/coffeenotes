'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SettingsView } from '@/components/settings/settings-view';
import { signOut } from '@/features/auth/sign-in';
import { useSession } from '@/features/auth/use-session';
import { useQueryClient } from '@tanstack/react-query';
import { deleteMyAccount } from '@/features/account/delete-account';
import { requireUserId } from '@/features/auth/require-user-id';
import { useOcrUsage } from '@/features/ocr/queries';
import { buildCsv, buildJson, exportFileName } from '@/features/export/build';
import { LOG_SELECT, type LogWithRelations } from '@/features/logs/queries';
import { downloadBlob } from '@/lib/platform/download';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// S9 設定。表示は SettingsView（props 駆動）に任せ、ここではセッションとログアウトをつなぐ。
export default function SettingsPage() {
  const router = useRouter();
  const { session } = useSession();
  const ocrUsage = useOcrUsage();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
      router.replace('/login');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ログアウトできませんでした');
      setBusy(false);
    }
  }

  const providers = (session?.user.app_metadata?.providers as string[] | undefined) ?? [];

  return (
    <SettingsView
      email={session?.user.email ?? null}
      providers={providers}
      ocrUsedToday={ocrUsage.data?.used ?? 0}
      onSignOut={handleSignOut}
      signingOut={busy}
      onExport={async (format) => {
        const { data, error } = await getSupabaseBrowserClient()
          .from('logs')
          .select(LOG_SELECT)
          .order('logged_on', { ascending: false })
          .order('created_at', { ascending: false });
        if (error) throw error;
        const logs = data as LogWithRelations[];
        const body = format === 'csv' ? buildCsv(logs) : buildJson(logs);
        const type = format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8';
        downloadBlob(new Blob([body], { type }), exportFileName(format));
        toast.success(`${logs.length} 件を書き出しました`);
      }}
      onDeleteAccount={async () => {
        await deleteMyAccount(getSupabaseBrowserClient(), await requireUserId());
        queryClient.clear();
        toast.success('アカウントを削除しました');
        router.replace('/login');
      }}
    />
  );
}
