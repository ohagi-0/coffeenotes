import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InactiveShops } from '@/components/shops/inactive-shops';

// 「まだ記録のない店（N）」の折りたたみ（#43）。既定は閉じ、開くと店名と「削除」。0 件なら出さない。
const mutate = vi.fn();
vi.mock('@/features/shops/mutations', () => ({
  useDeleteShop: () => ({ mutate, isPending: false, error: null }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

afterEach(() => {
  cleanup();
  mutate.mockReset();
});

describe('InactiveShops', () => {
  it('0 件なら見出しごと出さない', () => {
    const { container } = render(<InactiveShops shops={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('既定は閉じていて、開くと店が出る。削除は 2 段階', () => {
    render(
      <InactiveShops
        shops={[
          { id: 's1', name: '先に登録した店' },
          { id: 's2', name: '記録が無くなった店' },
        ]}
      />,
    );
    const toggle = screen.getByRole('button', { name: /まだ記録のない店/ });
    expect(toggle).toHaveTextContent('（2）');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('先に登録した店')).toBeNull();

    fireEvent.click(toggle);
    expect(screen.getByText('先に登録した店')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '店「先に登録した店」を削除' }));
    expect(mutate).not.toHaveBeenCalled(); // 1 段階目は確認だけ
    fireEvent.click(screen.getByRole('button', { name: '削除する' }));
    expect(mutate).toHaveBeenCalledWith('s1', expect.any(Object));
  });

  it('確認で「やめる」を押すと削除しない', () => {
    render(<InactiveShops shops={[{ id: 's1', name: 'A' }]} />);
    fireEvent.click(screen.getByRole('button', { name: /まだ記録のない店/ }));
    fireEvent.click(screen.getByRole('button', { name: '店「A」を削除' }));
    fireEvent.click(screen.getByRole('button', { name: 'やめる' }));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '店「A」を削除' })).toBeInTheDocument();
  });
});
