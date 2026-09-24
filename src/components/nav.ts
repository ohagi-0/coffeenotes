import type { Route } from 'next';
import { BarChart3, Home, Settings, Store, type LucideIcon } from 'lucide-react';

// ナビ定義（DESIGN.md §3、ADR 0007 追記）。ここが唯一の元で、
// Web ではサイトヘッダー + ドロワー、PC ではサイドバー（UI-15）、iOS 版では下タブをここから描く。
// ラベルはページ名そのまま。一文字の略称（「店」「地図」）は使わない。`short` は iOS の下タブ用。
export type NavItem = {
  href: Route;
  label: string;
  short: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: '入力記録一覧', short: 'ホーム', icon: Home },
  // 地図は「記録したお店」に統合（2026-09-24）。/map は /shops へ転送する
  { href: '/shops', label: '記録したお店', short: 'お店', icon: Store },
  { href: '/stats', label: '好みの分析', short: '好み', icon: BarChart3 },
  { href: '/settings', label: '設定', short: '設定', icon: Settings },
];

/** 記録作成の入口。ヘッダーの「＋ 記録する」とドロワーの「記録を追加」が指す先。 */
export const ADD_LOG_HREF: Route = '/logs/new';

/** ウィザード中はヘッダーを「やめる」表示にする（DESIGN.md §3）。 */
export function isWizardPath(pathname: string): boolean {
  return pathname.startsWith('/logs/new');
}

export function isActivePath(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
