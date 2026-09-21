import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EMPTY_TASTE, TASTE_AXES, TasteDots, type TasteValues } from '@/components/beans/taste-dots';

afterEach(() => cleanup());

const sample: TasteValues = { flavor: 5, sweetness: 3, acidity: 5, aftertaste: 3, body: 3 };

describe('TasteDots', () => {
  it('軸は 5 つ固定で、この順番', () => {
    expect(TASTE_AXES.map((a) => a.label)).toEqual(['Flavor', 'Sweetness', 'Acidity', 'After taste', 'Body']);
  });

  it('表示モードは値と — を出し、ボタンを持たない', () => {
    render(<TasteDots value={{ ...sample, body: null }} />);
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByLabelText('Flavor 5')).toBeInTheDocument();
    expect(screen.getByLabelText('Body 未入力')).toHaveTextContent('—');
  });

  it('タップで値が入り、同じ値をもう一度タップで null に戻る', () => {
    const onChange = vi.fn();
    render(<TasteDots value={{ ...EMPTY_TASTE, acidity: 4 }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Sweetness 3' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_TASTE, acidity: 4, sweetness: 3 });

    fireEvent.click(screen.getByRole('radio', { name: 'Acidity 4' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_TASTE, acidity: null });
  });

  it('選択中の丸だけ aria-checked になる', () => {
    render(<TasteDots value={sample} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Sweetness 3' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Sweetness 4' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getAllByRole('radiogroup')).toHaveLength(5);
  });

  it('readOnly なら onChange があっても操作できない', () => {
    const onChange = vi.fn();
    render(<TasteDots value={sample} onChange={onChange} readOnly />);
    expect(screen.queryByRole('radio')).toBeNull();
  });
});
