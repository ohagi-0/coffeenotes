import Link from 'next/link';
import { NAV_ITEMS } from '@/components/nav';
import { routes } from '@/lib/routes';

/** お問い合わせ先。GitHub の Issue を直接立てる（公開リポジトリ。個人開発のため窓口はここ 1 つ） */
export const CONTACT_URL = 'https://github.com/ohagi-0/coffeenotes/issues/new';

// サイトのフッター（DESIGN.md §3）。各ページの末尾に小さく: 1 行目にページへのリンク、2 行目に © と法務・お問い合わせ。
export function SiteFooter() {
  return (
    <footer className="border-border text-muted-foreground -mx-5 mt-9 border-t px-5 pt-3.5 pb-[max(env(safe-area-inset-bottom,0px),10px)] text-[11px] leading-relaxed">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="font-display text-foreground mr-1 text-[15px]">Coffeenotes</span>
        {NAV_ITEMS.map(({ href, label }) => (
          <Link key={href} href={href} className="text-foreground">
            {label}
          </Link>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span>© 2026 Coffeenotes</span>
        <Link href={routes.privacy} className="text-foreground">
          プライバシー
        </Link>
        <Link href={routes.terms} className="text-foreground">
          利用規約
        </Link>
        <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="text-foreground">
          お問い合わせ（GitHub）
        </a>
      </div>
    </footer>
  );
}
