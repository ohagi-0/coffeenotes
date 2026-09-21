import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RatingStars, clampRating, formatRating } from '@/components/logs/rating-stars';

afterEach(() => cleanup());

const half = (container: HTMLElement, star: number, side: 'left' | 'right') => {
  const el = container.querySelector(`[data-star="${star}"][data-half="${side}"]`);
  if (!el) throw new Error(`star ${star} ${side} が無い`);
  return el;
};

describe('clampRating', () => {
  it('0.5 刻みに丸めて 1.0〜5.0 に収める', () => {
    expect(clampRating(0)).toBe(1);
    expect(clampRating(0.5)).toBe(1);
    expect(clampRating(3.3)).toBe(3.5);
    expect(clampRating(5.5)).toBe(5);
  });
});

describe('RatingStars 表示', () => {
  it('値に応じて full / half / empty を塗り分け、数値を隣に出す', () => {
    const { container } = render(<RatingStars value={3.5} />);
    const fills = [...container.querySelectorAll('[data-star][data-fill]')].map((el) =>
      el.getAttribute('data-fill'),
    );
    expect(fills).toEqual(['full', 'full', 'full', 'half', 'empty']);
    expect(screen.getByRole('img')).toHaveAccessibleName('星評価 3.5 / 5');
    expect(screen.getByText('3.5')).toBeInTheDocument();
  });

  it('null は全部 empty で、数値は — と未評価', () => {
    const { container } = render(<RatingStars value={null} />);
    expect(container.querySelectorAll('[data-fill="empty"]')).toHaveLength(5);
    expect(screen.getByRole('img')).toHaveAccessibleName('星評価 未評価');
    expect(formatRating(null)).toBe('—');
  });

  it('表示モードでは半分タップの領域を作らない', () => {
    const { container } = render(<RatingStars value={4} />);
    expect(container.querySelector('[data-half]')).toBeNull();
    expect(screen.queryByRole('slider')).toBeNull();
  });
});

describe('RatingStars 入力', () => {
  it('星の左半分で .5、右半分で .0 になる', () => {
    const onChange = vi.fn();
    const { container } = render(<RatingStars value={null} size="lg" onChange={onChange} />);
    fireEvent.click(half(container, 4, 'left'));
    expect(onChange).toHaveBeenLastCalledWith(3.5);
    fireEvent.click(half(container, 4, 'right'));
    expect(onChange).toHaveBeenLastCalledWith(4);
    fireEvent.click(half(container, 5, 'right'));
    expect(onChange).toHaveBeenLastCalledWith(5);
  });

  it('1 つ目の星の左半分は 0.5 ではなく下限の 1.0 になる', () => {
    const onChange = vi.fn();
    const { container } = render(<RatingStars value={3} onChange={onChange} />);
    fireEvent.click(half(container, 1, 'left'));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('role="slider" を持ち、左右キーで 0.5 ずつ動き、上下限で止まる', () => {
    const onChange = vi.fn();
    render(<RatingStars value={3} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuemin', '1');
    expect(slider).toHaveAttribute('aria-valuemax', '5');
    expect(slider).toHaveAttribute('aria-valuenow', '3');

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(3.5);
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith(2.5);
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(5);
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('上限 5.0 で右キーを押しても onChange を呼ばない', () => {
    const onChange = vi.fn();
    render(<RatingStars value={5} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('未評価から右キーで 1.0 になる', () => {
    const onChange = vi.fn();
    render(<RatingStars value={null} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    expect(slider).not.toHaveAttribute('aria-valuenow');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(1);
  });
});
