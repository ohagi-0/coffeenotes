import type { ReactNode } from 'react';
import Link from 'next/link';
import { routes } from '@/lib/routes';

// 規約・ポリシーの共通枠。ログイン不要で読める（Google の同意画面や App Store 申請から参照されるため）。
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[720px] px-5 pt-[max(env(safe-area-inset-top,0px),16px)] pb-16">
      <p className="text-muted-foreground mb-6 text-[12px]">
        <Link href={routes.home} className="font-display text-foreground text-xl">
          Coffeenotes
        </Link>
      </p>
      <article className="prose-coffee [&_h1]:font-display text-[14px] leading-[1.9] [&_a]:underline [&_a]:underline-offset-2 [&_h1]:text-[30px] [&_h1]:leading-tight [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-[16px] [&_h2]:font-bold [&_li]:my-1 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </article>
      <p className="text-muted-foreground mt-10 text-[12px]">
        <Link href={routes.privacy}>プライバシーポリシー</Link> · <Link href={routes.terms}>利用規約</Link> ·{' '}
        <Link href={routes.login}>ログイン</Link>
      </p>
    </main>
  );
}
