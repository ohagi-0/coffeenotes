'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SettingsView } from '@/components/settings/settings-view';
import { signOut } from '@/features/auth/sign-in';
import { useSession } from '@/features/auth/use-session';

// S9 設定。表示は SettingsView（props 駆動）に任せ、ここではセッションとログアウトをつなぐ。
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
      toast.error(e instanceof Error ? e.message : 'ログアウトできませんでした');
      setBusy(false);
    }
  }

  const providers = (session?.user.app_metadata?.providers as string[] | undefined) ?? [];

  return (
    <SettingsView
      email={session?.user.email ?? null}
      providers={providers}
      onSignOut={handleSignOut}
      signingOut={busy}
    />
  );
}
