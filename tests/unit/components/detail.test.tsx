import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BeanDetail } from '@/components/beans/bean-detail';
import { LogDetail } from '@/components/logs/log-detail';
import { EMPTY_TASTE } from '@/components/beans/taste-dots';
import { beanSpecItems, beanTaste, formatPrice, hasAnyTaste } from '@/features/beans/presenters';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(() => cleanup());

describe('beans presenters', () => {
  it('価格・データグリッド・味覚', () => {
    expect(formatPrice(3800, 100)).toBe('¥3,800 / 100 g');
    expect(formatPrice(3800, null)).toBe('¥3,800');
    expect(formatPrice(null, 100)).toBeNull();
    const bean = {
      country: 'Colombia',
      region: null,
      farm: 'Finca Los Senisos',
      harvest_year: 2025,
      variety: 'Geisha',
      process: null,
      altitude_m: 1650,
      price_jpy: 3800,
      price_grams: 100,
      roast_level: 'light',
      roasted_on: null,
      taste_flavor: 5,
      taste_sweetness: null,
      taste_acidity: null,
      taste_aftertaste: null,
      taste_body: null,
    };
    const items = beanSpecItems(bean);
    expect(items.find((i) => i.label === '標高')).toMatchObject({ value: '1,650', unit: 'm' });
    expect(items.find((i) => i.label === '焙煎度')?.value).toBe('浅煎り');
    expect(beanTaste(bean)).toEqual({ ...EMPTY_TASTE, flavor: 5 });
    expect(hasAnyTaste(beanTaste(bean))).toBe(true);
    expect(hasAnyTaste(EMPTY_TASTE)).toBe(false);
  });
});

describe('BeanDetail', () => {
  it('豆名・ロースター・回数・記録・もう一度記録を出す', () => {
    const onLogAgain = vi.fn();
    render(
      <BeanDetail
        name="Lusitania Lime Geisha"
        roasterName="KIELO COFFEE"
        country="Colombia"
        spec={[{ label: '生産国', value: 'Colombia' }]}
        flavorNotes={['Lime', 'Bergamot']}
        description="ライムのよう"
        taste={{ ...EMPTY_TASTE, flavor: 5 }}
        stat={{ count: 2, avgRating: 4.5 }}
        logs={[
          {
            id: 'l1',
            loggedOn: '2026-09-21',
            beanName: 'Lusitania Lime Geisha',
            rating: 4.5,
            place: 'shop',
            shopName: 'KIELO',
          },
        ]}
        logsPending={false}
        logsError={null}
        editHref={'/beans?id=x&edit=1' as never}
        onLogAgain={onLogAgain}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Lusitania Lime Geisha');
    expect(screen.getByText('2 回')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '編集' })).toHaveAttribute('href', '/beans?id=x&edit=1');
    expect(screen.getByRole('img', { name: /味覚チャート/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'この豆をもう一度記録する' }));
    expect(onLogAgain).toHaveBeenCalledTimes(1);
  });
});

describe('LogDetail', () => {
  const props = {
    loggedOn: '2026-09-21',
    bean: { id: 'b1', name: 'Geisha', roasterName: 'KIELO', country: 'Colombia', process: 'Washed' },
    place: 'shop' as const,
    shopName: 'KIELO 蔵前',
    shopId: 's1',
    brewMethod: 'ハンドドリップ',
    rating: 4.5,
    memo: '良い',
    tags: ['ゲイシャ'],
    others: [],
    othersPending: false,
    othersError: null,
  };

  it('日付・豆・店・タグを出し、削除は確認ダイアログを挟む', async () => {
    const onDelete = vi.fn(async () => {});
    const { container } = render(<LogDetail {...props} onDelete={onDelete} />);
    expect(screen.getByText('2026年9月21日（月）')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '豆の詳細を見る' })).toHaveAttribute('href', '/beans?id=b1');
    expect(screen.getByRole('link', { name: '店の詳細を見る' })).toHaveAttribute(
      'href',
      '/shops/detail?id=s1',
    );
    expect(screen.getByText('#ゲイシャ')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'この記録を削除' }));
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '記録を削除' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });

  it('「やめる」で閉じる', () => {
    const { container } = render(<LogDetail {...props} onDelete={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'この記録を削除' }));
    fireEvent.click(screen.getByRole('button', { name: 'やめる' }));
    expect((container.querySelector('dialog') as HTMLDialogElement).open).toBe(false);
  });
});
