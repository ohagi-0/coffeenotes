import Link from 'next/link';
import { NAV_ITEMS } from '@/components/nav';

// サイトのフッター（DESIGN.md §3）。各ページの末尾。ここからも 5 ページへ移動できる。
export function SiteFooter() {
  return (
    <footer className="bg-card border-border text-muted-foreground -mx-5 mt-11 border-t px-5 pt-6 pb-[max(env(safe-area-inset-bottom,0px),12px)] text-[11px] leading-relaxed">
      <div className="font-display text-foreground mb-2 text-xl">Coffeenotes</div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px]">
        {NAV_ITEMS.map(({ href, label }) => (
          <li key={href}>
            <Link href={href} className="text-foreground">
              {label}
            </Link>
          </li>
        ))}
        <li>
          <span aria-disabled="true">エクスポート</span>
        </li>
      </ul>
      <div>
        © 2026 Coffeenotes · <span>プライバシー</span> · <span>お問い合わせ</span>
      </div>
    </footer>
  );
}
