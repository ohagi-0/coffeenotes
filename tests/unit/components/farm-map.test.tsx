import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CoffeeFarm } from '@/components/beans/coffee-farm';
import { WorldMap } from '@/components/beans/world-map';
import { buildFarm } from '@/features/beans/farm';
import type { CollectionSourceLog } from '@/features/beans/collection';

afterEach(() => cleanup());

const log = (id: string, country: string | null, logged_on = '2026-10-01'): CollectionSourceLog => ({
  id,
  logged_on,
  rating: 4,
  place: 'shop',
  bean: { id: `b-${id}`, name: 'X', country },
});
const NOW = new Date('2026-10-21T00:00:00Z');

describe('CoffeeFarm', () => {
  it('木が無ければ鉢だけ、産地ごとの木と読み上げ', () => {
    render(<CoffeeFarm farm={buildFarm([], NOW)} />);
    expect(screen.getByRole('img', { name: /最初の一杯/ })).toBeInTheDocument();
    cleanup();
    const logs = [
      ...Array.from({ length: 10 }, (_, i) => log(`c${i}`, 'Colombia', '2026-10-15')),
      log('e', 'Ethiopia', '2026-08-01'),
      log('k', 'Kenya', '2026-08-01'),
    ];
    render(<CoffeeFarm farm={buildFarm(logs, NOW)} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toContain('コーヒーの木 3 本');
    expect(img.getAttribute('aria-label')).toContain('COLOMBIA は実がなる');
    expect(img.getAttribute('aria-label')).toContain('花が咲いている木が 1 本');
    // 畑には木の下に札
    expect(img.textContent).toContain('ETHIOPIA');
  });
  it('8 本から丘の農園（本数と杯数の札）', () => {
    const logs = ['Colombia', 'Ethiopia', 'Kenya', 'Brazil', 'Peru', 'Rwanda', 'Panama', 'Yemen'].map(
      (c, i) => log(String(i), c),
    );
    render(<CoffeeFarm farm={buildFarm(logs, NOW)} />);
    expect(screen.getByRole('img').textContent).toContain('8 本 · 8 杯');
  });
});

describe('WorldMap', () => {
  it('飲んだ国を塗り、押すと onSelect に国のキー', () => {
    const onSelect = vi.fn();
    const cups = new Map([
      ['colombia', 6],
      ['jamaica', 1],
    ]);
    render(<WorldMap cups={cups} onSelect={onSelect} />);
    expect(screen.getByRole('img', { name: '飲んだ産地の地図。2 か国' })).toBeInTheDocument();
    const colombia = document.querySelector('path[aria-label="コロンビア"]')!;
    expect(colombia.getAttribute('fill')).toBe('#D48C4E');
    const honduras = document.querySelector('path[aria-label="ホンジュラス"]')!;
    expect(honduras.getAttribute('fill')).toBe('#241C16');
    fireEvent.click(honduras);
    expect(onSelect).toHaveBeenCalledWith('honduras');
    // ジャマイカは小さいので点を重ねる
    expect(document.querySelectorAll('circle').length).toBe(1);
  });
});
