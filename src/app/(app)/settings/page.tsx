'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { signOut } from '@/features/auth/sign-in';
import { useSession } from '@/features/auth/use-session';

export default function SettingsPage() {
  const router = useRouter();
  const { session } = useSession();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
      router.replace('/login');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ログアウトに失敗しました');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 py-4">
      <h1 className="text-xl font-bold">設定</h1>
      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="text-muted-foreground text-sm font-medium">アカウント</h2>
        <p className="text-sm">{session?.user.email ?? '—'}</p>
        <Button variant="outline" className="w-full" onClick={handleSignOut} disabled={busy}>
          {busy ? 'ログアウト中…' : 'ログアウト'}
        </Button>
      </section>
      <p className="text-muted-foreground text-xs">エクスポート・アカウント削除は Phase 5 で実装予定です。</p>
    </div>
  );
}
