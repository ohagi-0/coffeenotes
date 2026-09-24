import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ADD_LOG_HREF, NAV_ITEMS, isActivePath, isWizardPath } from '@/components/nav';

// next/navigation と認証はテストでは差し替える
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/shops',
  useRouter: () => ({ replace, push: vi.fn() }),
}));
const signOut = vi.fn(async () => {});
vi.mock('@/features/auth/sign-in', () => ({ signOut: () => signOut() }));

import { NavDrawer } from '@/components/nav-drawer';
import { SiteHeader } from '@/components/site-header';

beforeAll(() => {
  // jsdom は <dialog> の showModal / close を実装していない
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(() => cleanup());

describe('nav 定義', () => {
  it('ページ名をそのままラベルにし、一文字の略称を使わない', () => {
    const labels = NAV_ITEMS.map((n) => n.label);
    expect(labels).toEqual(['入力記録一覧', '豆のコレクション', '記録したお店', '好みの分析', '設定']);
    expect(labels.some((l) => l.length === 1)).toBe(false);
  });

  it('isActivePath はホームだけ完全一致、他は前方一致', () => {
    expect(isActivePath('/', '/')).toBe(true);
    expect(isActivePath('/shops', '/')).toBe(false);
    expect(isActivePath('/shops', '/shops')).toBe(true);
    expect(isActivePath('/shops/detail', '/shops')).toBe(true);
    expect(isActivePath('/shopsx', '/shops')).toBe(false);
  });

  it('isWizardPath は記録作成中だけ true', () => {
    expect(isWizardPath('/logs/new')).toBe(true);
    expect(isWizardPath('/logs/new?step=place')).toBe(true);
    expect(isWizardPath('/logs')).toBe(false);
  });
});

describe('SiteHeader', () => {
  it('既定では「記録する」、wizard では「やめる」', () => {
    const { rerender } = render(<SiteHeader onOpenMenu={() => {}} />);
    expect(screen.getByRole('link', { name: '記録する' })).toHaveAttribute('href', ADD_LOG_HREF);
    rerender(<SiteHeader variant="wizard" onOpenMenu={() => {}} />);
    expect(screen.queryByRole('link', { name: '記録する' })).toBeNull();
    expect(screen.getByRole('link', { name: 'やめる' })).toHaveAttribute('href', '/');
  });

  it('メニューボタンで onOpenMenu が呼ばれる', () => {
    const onOpenMenu = vi.fn();
    render(<SiteHeader onOpenMenu={onOpenMenu} />);
    fireEvent.click(screen.getByRole('button', { name: 'メニューを開く' }));
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
  });
});

describe('NavDrawer', () => {
  it('開くと 5 項目と「記録を追加」が並び、現在地が aria-current になる', () => {
    render(<NavDrawer open onClose={() => {}} email="kota@example.com" />);
    const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
    expect(nav.querySelectorAll('a')).toHaveLength(5);
    expect(screen.getByRole('link', { name: '記録したお店' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '記録を追加' })).toHaveAttribute('href', ADD_LOG_HREF);
    expect(screen.getByText('kota@example.com')).toBeInTheDocument();
  });

  it('項目を選ぶと onClose、ログアウトで signOut → /login', async () => {
    const onClose = vi.fn();
    render(<NavDrawer open onClose={onClose} email="kota@example.com" />);
    fireEvent.click(screen.getByRole('link', { name: '設定' }));
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }));
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('dialog の close イベント（Esc）で onClose が呼ばれる', () => {
    const onClose = vi.fn();
    const { container } = render(<NavDrawer open onClose={onClose} />);
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    dialog.close();
    expect(onClose).toHaveBeenCalled();
  });
});
