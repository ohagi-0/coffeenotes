import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/stats',
  useRouter: () => ({ replace, push: vi.fn() }),
}));
const signOut = vi.fn(async () => {});
vi.mock('@/features/auth/sign-in', () => ({ signOut: () => signOut() }));

import { SiteNav } from '@/components/site-nav';
import { ADD_LOG_HREF, NAV_ITEMS } from '@/components/nav';

afterEach(() => cleanup());

describe('SiteNav', () => {
  it('5 項目と「記録を追加」を出し、現在地が aria-current になる', () => {
    render(<SiteNav email="kota@example.com" />);
    const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
    expect(nav.querySelectorAll('a')).toHaveLength(NAV_ITEMS.length);
    expect(screen.getByRole('link', { name: '好みの分析' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '入力記録一覧' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: '記録を追加' })).toHaveAttribute('href', ADD_LOG_HREF);
    expect(screen.getByText('kota@example.com')).toBeInTheDocument();
  });

  it('ログアウトで signOut → /login', async () => {
    render(<SiteNav email="kota@example.com" />);
    fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }));
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
