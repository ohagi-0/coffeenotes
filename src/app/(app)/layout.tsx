'use client';

// ログイン後の画面共通レイアウト。未ログインなら /login へ。
// 画面はすべてクライアント側で描画する（ネイティブ化制約 N-1）ため、認証ガードもクライアントで行う。
// ナビは Web サイトの作法（DESIGN.md §3、ADR 0007 追記）: サイトヘッダー + 右からのドロワー + フッター。
// 下タブは iOS アプリ版だけが持つ。PC のサイドバーは UI-15 で追加する。
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/features/auth/use-session';
import { isWizardPath } from '@/components/nav';
import { SiteHeader } from '@/components/site-header';
import { NavDrawer } from '@/components/nav-drawer';
import { SiteFooter } from '@/components/site-footer';
import { FullScreenLoading } from '@/components/full-screen-loading';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (status === 'signed_out') router.replace('/login');
  }, [status, router]);

  if (status !== 'signed_in') return <FullScreenLoading />;

  const wizard = isWizardPath(pathname);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[env(safe-area-inset-top,0px)]">
      <SiteHeader variant={wizard ? 'wizard' : 'default'} onOpenMenu={() => setMenuOpen(true)} />
      <main className="flex-1">{children}</main>
      {!wizard && <SiteFooter />}
      <NavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} email={session.user.email} />
    </div>
  );
}
