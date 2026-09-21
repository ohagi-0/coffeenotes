import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/empty-state';
import { ErrorCallout } from '@/components/error-callout';
import { Row } from '@/components/row';
import { DateGroup, formatDateGroupLabel } from '@/components/date-group';
import { BeanSpecGrid } from '@/components/beans/bean-spec-grid';
import { CardImage } from '@/components/beans/card-image';
import { LogListItem } from '@/components/logs/log-list-item';
import { LogListSkeleton } from '@/components/logs/log-list-item-skeleton';
import { BeanDetailSkeleton } from '@/components/beans/bean-detail-skeleton';

afterEach(() => cleanup());

describe('EmptyState / ErrorCallout', () => {
  it('空状態は見出し・説明・主ボタンを出す', () => {
    render(
      <EmptyState
        title="まだ記録がありません"
        description="最初の一杯を残しましょう。"
        action={<button>最初の記録を追加</button>}
      />,
    );
    expect(screen.getByText('まだ記録がありません')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '最初の記録を追加' })).toBeInTheDocument();
  });

  it('失敗表示は role="alert" で、再試行ボタンが onRetry を呼ぶ', () => {
    const onRetry = vi.fn();
    render(
      <ErrorCallout
        title="記録を読み込めませんでした"
        what="通信が途中で切れました。"
        next="電波の良い場所でもう一度お試しください。"
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('記録を読み込めませんでした');
    fireEvent.click(screen.getByRole('button', { name: 'もう一度読み込む' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('onRetry が無ければボタンを出さない', () => {
    render(<ErrorCallout title="x" what="y" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Row', () => {
  it('頭文字のアバターと、href があればリンクになる', () => {
    render(
      <Row
        initial="KIELO"
        title="KIELO COFFEE 蔵前"
        subtitle="カフェ · 台東区 · 3 回"
        value="4.5"
        href="/shops"
      />,
    );
    const link = screen.getByRole('link', { name: /KIELO COFFEE 蔵前/ });
    expect(link).toHaveAttribute('href', '/shops');
    expect(link).toHaveTextContent(/^K/);
    expect(screen.getByText('4.5')).toBeInTheDocument();
  });

  it('onClick ならボタン、値が無ければ chevron を出す', () => {
    const onClick = vi.fn();
    const { container } = render(<Row initial="A" title="行" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('DateGroup', () => {
  const now = new Date(2026, 8, 21, 12); // 2026-09-21（月）
  it('今日・昨日・それ以外・別の年を出し分ける', () => {
    expect(formatDateGroupLabel('2026-09-21', now)).toBe('今日 · 9月21日（月）');
    expect(formatDateGroupLabel('2026-09-20', now)).toBe('昨日 · 9月20日（日）');
    expect(formatDateGroupLabel('2026-09-19', now)).toBe('9月19日（土）');
    expect(formatDateGroupLabel('2025-12-03', now)).toBe('2025年12月3日（水）');
  });
  it('見出しに time 要素を持つ', () => {
    render(<DateGroup date="2026-09-19" now={now} />);
    expect(screen.getByRole('heading')).toHaveTextContent('9月19日（土）');
    expect(document.querySelector('time')).toHaveAttribute('datetime', '2026-09-19');
  });
});

describe('BeanSpecGrid', () => {
  it('null の項目は省き、単位を添える', () => {
    render(
      <BeanSpecGrid
        items={[
          { label: '生産国', value: 'Colombia' },
          { label: '地域', value: null },
          { label: '標高', value: 1650, unit: 'm' },
        ]}
      />,
    );
    expect(screen.queryByText('地域')).toBeNull();
    expect(screen.getByText('標高')).toBeInTheDocument();
    expect(screen.getByText('1650').parentElement).toHaveTextContent('1650m');
  });
  it('全部 null なら何も描かない', () => {
    const { container } = render(<BeanSpecGrid items={[{ label: 'a', value: null }]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('CardImage', () => {
  it('src が無ければ印刷物風のプレースホルダ', () => {
    render(<CardImage beanName="Lusitania Lime Geisha" roasterName="KIELO COFFEE" country="Colombia" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('data-card-image', 'placeholder');
    expect(img).toHaveTextContent('KIELO COFFEE');
    expect(img).toHaveTextContent('Colombia');
  });
  it('src があれば画像と読み込み中のスケルトン', () => {
    const { container } = render(<CardImage src="https://example.com/a.jpg" beanName="A" />);
    expect(container.querySelector('[data-card-image="photo"]')).not.toBeNull();
    expect(screen.getByRole('img', { name: 'A のカード' })).toBeInTheDocument();
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });
});

describe('LogListItem', () => {
  const base = {
    id: '11111111-2222-4333-8444-555555555555',
    beanName: 'Lusitania Lime Geisha',
    roasterName: 'KIELO COFFEE',
    rating: 4.5,
  };

  it('記録詳細へのリンクで、店名とフレーバー 3 つまでを出す', () => {
    render(
      <LogListItem
        {...base}
        place="shop"
        shopName="アオゾラ珈琲店"
        flavorNotes={['Lime', 'Bergamot', 'Laurier', 'Jasmine']}
      />,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', `/logs?id=${base.id}`);
    expect(screen.getByText('アオゾラ珈琲店')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByText('Jasmine')).toBeNull();
  });

  it('自宅は「自宅」ピル、星なしは — ', () => {
    render(<LogListItem {...base} rating={null} place="home" detail="V60 · 1:15 · 92 ℃" />);
    expect(screen.getByText('自宅')).toBeInTheDocument();
    expect(screen.getByText('V60 · 1:15 · 92 ℃')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('40 文字の豆名でも描ける（折り返しクラスを持つ）', () => {
    const long = 'Finca La Esperanza Gesha Natural Anaerobic Lot 42';
    const { container } = render(<LogListItem {...base} beanName={long} place="shop" />);
    // 豆名はカード画像のプレースホルダにも出るので、display 書体の方を見る
    expect(container.querySelector('.font-display')).toHaveTextContent(long);
    expect(container.querySelector('.font-display')).toHaveClass('break-words');
  });
});

describe('スケルトン', () => {
  it('ログ行 4 件と豆詳細は role="status" で読み込み中を伝える', () => {
    const { container } = render(
      <>
        <LogListSkeleton />
        <BeanDetailSkeleton />
      </>,
    );
    expect(screen.getAllByRole('status')).toHaveLength(2);
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(4);
  });
});
