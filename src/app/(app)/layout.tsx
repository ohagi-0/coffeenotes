'use client';

// ログイン後の画面共通レイアウト。未ログインなら /login へ。
// 画面はすべてクライアント側で描画する（ネイティブ化制約 N-1）ため、認証ガードもクライアントで行う。
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/features/auth/use-session';
import { BottomNav } from '@/components/bottom-nav';
import { FullScreenLoading } from '@/components/full-screen-loading';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === 'signed_out') router.replace('/login');
  }, [status, router]);

  if (status !== 'signed_in') return <FullScreenLoading />;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md">
      <main className="px-4 pt-[env(safe-area-inset-top,0px)] pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
