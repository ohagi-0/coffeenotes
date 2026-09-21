import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TasteRadar, radarPoint, radarPoints } from '@/components/beans/taste-radar';
import type { TasteValues } from '@/components/beans/taste-dots';

afterEach(() => cleanup());

const sample: TasteValues = { flavor: 5, sweetness: 3, acidity: 5, aftertaste: 3, body: 3 };

describe('TasteRadar', () => {
  it('頂点の座標がモック（docs/design/mobile.html）と一致する', () => {
    // 半径 80、中心 (100,100)、上から時計回り
    expect(radarPoint(0, 5)).toEqual({ x: 100, y: 20 });
    const p1 = radarPoint(1, 5);
    expect(p1.x).toBeCloseTo(176.1, 0);
    expect(p1.y).toBeCloseTo(75.3, 0);
    // モックの値（手で丸めてある）と 0.15 以内で一致すること
    const mock = [
      [100, 20],
      [145.6, 85.2],
      [147, 164.7],
      [71.8, 138.8],
      [54.4, 85.2],
    ];
    const actual = radarPoints(sample)
      .split(' ')
      .map((pair) => pair.split(',').map(Number));
    actual.forEach(([x, y], i) => {
      expect(Math.abs(x - mock[i][0])).toBeLessThanOrEqual(0.15);
      expect(Math.abs(y - mock[i][1])).toBeLessThanOrEqual(0.15);
    });
  });

  it('null の軸は 0（中心）として描き、ラベルは —', () => {
    render(<TasteRadar value={{ ...sample, body: null }} />);
    expect(radarPoints({ ...sample, body: null }).endsWith(' 100,100')).toBe(true);
    expect(screen.getByText('Body —')).toBeInTheDocument();
    expect(screen.getByText('Flavor 5')).toBeInTheDocument();
  });

  it('compare を渡すと点線のポリゴンを重ね、平均は小数 1 桁で出す', () => {
    const { container } = render(
      <TasteRadar
        value={{ flavor: 4.4, sweetness: 3.2, acidity: 4.1, aftertaste: 3.4, body: 3 }}
        compare={sample}
      />,
    );
    expect(container.querySelector('polygon[data-role="compare"]')).toHaveAttribute(
      'stroke-dasharray',
      '3 3',
    );
    expect(screen.getByText('Flavor 4.4')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName(/Flavor 4.4/);
  });

  it('compare が無ければ点線は描かない', () => {
    const { container } = render(<TasteRadar value={sample} />);
    expect(container.querySelector('polygon[data-role="compare"]')).toBeNull();
    expect(container.querySelectorAll('circle')).toHaveLength(5);
  });
});
