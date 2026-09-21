import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LogTimeline } from '@/components/logs/log-timeline';
import type { TimelineItem } from '@/features/logs/presenters';

afterEach(() => cleanup());

const now = new Date('2026-09-21T12:00:00');
const items: TimelineItem[] = [
  {
    id: 'a',
    loggedOn: '2026-09-21',
    beanName: 'Lusitania Lime Geisha',
    roasterName: 'KIELO COFFEE',
    rating: 4.5,
    place: 'shop',
    shopName: 'KIELO COFFEE 蔵前',
  },
  {
    id: 'b',
    loggedOn: '2026-09-21',
    beanName: 'Kenya Kiambu AA',
    rating: 3.5,
    place: 'shop',
    shopName: 'Sonar Coffee Stand',
  },
  {
    id: 'c',
    loggedOn: '2026-09-19',
    beanName: 'Ethiopia Guji',
    rating: 4,
    place: 'home',
    detail: 'V60 · 1:15',
  },
];

describe('LogTimeline', () => {
  it('読み込み中はスケルトン', () => {
    render(<LogTimeline items={[]} isPending error={null} />);
    expect(screen.getByRole('status', { name: '読み込み中' })).toBeInTheDocument();
  });

  it('失敗は錆色のコールアウトと再試行', () => {
    const onRetry = vi.fn();
    render(<LogTimeline items={[]} isPending={false} error={new Error('network')} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('記録を読み込めませんでした');
    fireEvent.click(screen.getByRole('button', { name: 'もう一度読み込む' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('0 件は空状態、絞り込み中の 0 件は解除ボタン', () => {
    const onClearFilter = vi.fn();
    const { rerender } = render(<LogTimeline items={[]} isPending={false} error={null} />);
    expect(screen.getByText('まだ記録がありません')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '最初の記録を追加' })).toHaveAttribute('href', '/logs/new');
    rerender(
      <LogTimeline items={[]} isPending={false} error={null} filtered onClearFilter={onClearFilter} />,
    );
    expect(screen.getByText('条件に合う記録はありません')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '絞り込みを解除' }));
    expect(onClearFilter).toHaveBeenCalledTimes(1);
  });

  it('日付ごとにまとめ、今日の見出しと各行を出す', () => {
    render(<LogTimeline items={items} isPending={false} error={null} now={now} />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['今日 · 9月21日（月）', '9月19日（土）']);
    expect(screen.getAllByRole('link')).toHaveLength(3);
    // カード画像のプレースホルダにも豆名が描かれるので複数一致する
    expect(screen.getAllByText('Lusitania Lime Geisha').length).toBeGreaterThan(0);
    expect(screen.getByText('自宅')).toBeInTheDocument();
  });
});
