import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ShopBeansList, ShopBestCard, ShopTrendCard, ShopVisits } from '@/components/shops/shop-recap';
import type { TimelineItem } from '@/features/logs/presenters';

// 店詳細の振り返り部品（#44）。集計は recap.test.ts。ここは描画（見出し・リンク・月ごとの小見出し）を確かめる。
vi.mock('@/features/beans/images', () => ({ useBeanImageUrl: () => ({ data: null }) }));
afterEach(cleanup);

const item = (id: string, loggedOn: string, memo: string | null = null): TimelineItem => ({
  id,
  loggedOn,
  beanName: `豆${id}`,
  rating: 4,
  place: 'shop',
  shopName: '店',
  detail: 'ハンドドリップ',
  memo,
});

describe('shop-recap 部品', () => {
  it('ベスト: 豆名・星・日付が出て、記録詳細へのリンク', () => {
    render(
      <ShopBestCard
        best={{
          logId: 'l9',
          beanId: 'b',
          beanName: 'Lusitania',
          roasterName: 'KIELO',
          rating: 5,
          loggedOn: '2026-09-05',
          imagePath: null,
        }}
      />,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', expect.stringContaining('l9'));
    expect(screen.getAllByText('Lusitania').length).toBeGreaterThan(0);
  });

  it('飲んだ豆: 回数・最後の日・フレーバー・豆詳細へのリンク。0 件なら出さない', () => {
    const { container, rerender } = render(<ShopBeansList beans={[]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(
      <ShopBeansList
        beans={[
          {
            beanId: 'b1',
            beanName: 'A',
            roasterName: null,
            count: 3,
            avgRating: 4.5,
            lastOn: '2026-10-19',
            flavorNotes: ['ベリー'],
          },
        ]}
      />,
    );
    expect(screen.getByText('3 回')).toBeInTheDocument();
    expect(screen.getByText('ベリー')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', expect.stringContaining('b1'));
  });

  it('訪問の記録: 月ごとの小見出しとメモの冒頭', () => {
    render(<ShopVisits items={[item('1', '2026-10-19', 'とても良かった'), item('2', '2026-09-02')]} />);
    expect(screen.getByRole('heading', { name: '2026年10月' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2026年9月' })).toBeInTheDocument();
    expect(screen.getByText('とても良かった')).toBeInTheDocument();
  });

  it('傾向: 星 4 以上の割合・タグ。味覚が全部空ならレーダーは出さない', () => {
    render(
      <ShopTrendCard
        trend={{
          highRatio: 0.75,
          ratedCount: 4,
          topTags: [{ label: '朝', count: 2, percent: 100 }],
          taste: { flavor: null, sweetness: null, acidity: null, aftertaste: null, body: null, beans: 0 },
        }}
      />,
    );
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('朝')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
