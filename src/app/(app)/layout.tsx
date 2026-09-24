'use client';

// ログイン後の画面共通レイアウト。未ログインなら /login へ。
// 画面はすべてクライアント側で描画する（ネイティブ化制約 N-1）ため、認証ガードもクライアントで行う。
// ナビは Web サイトの作法（DESIGN.md §3、ADR 0007 追記）: サイトヘッダー + 右からのドロワー + フッター。
// 下タブは iOS アプリ版だけが持つ。768px 以上ではヘッダー + ドロワーの代わりに左のサイドバー（SiteNav）。
// 1280px 以上の「一覧 + 詳細」2 ペインはページ側（#23 段階 2、#20 の BeanDetail が前提）。
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/features/auth/use-session';
import { isWizardPath } from '@/components/nav';
import { SiteHeader } from '@/components/site-header';
import { NavDrawer } from '@/components/nav-drawer';
import { SiteFooter } from '@/components/site-footer';
import { SiteNav } from '@/components/site-nav';
import { FullScreenLoading } from '@/components/full-screen-loading';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

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
    <div className="md:flex md:min-h-dvh">
      <SiteNav email={session.user.email} />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[env(safe-area-inset-top,0px)]',
            'md:min-h-0 md:max-w-[680px] md:px-8 md:pt-4 xl:px-10',
            // ホームだけ 2 ペイン（一覧 400px + 詳細）のために広くする（#23 段階 2）
            pathname === routes.logs ? 'xl:max-w-[1320px]' : 'xl:max-w-[920px]',
          )}
        >
          <div className="md:hidden">
            <SiteHeader variant={wizard ? 'wizard' : 'default'} onOpenMenu={() => setMenuOpen(true)} />
          </div>
          <main className="flex-1">{children}</main>
          {!wizard && (
            <div className="md:hidden">
              <SiteFooter />
            </div>
          )}
          <NavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} email={session.user.email} />
        </div>
      </div>
    </div>
  );
}
