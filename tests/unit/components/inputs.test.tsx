import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FilterChips } from '@/components/filter-chips';
import { PlaceSegment } from '@/components/logs/place-segment';
import { WizardStepper } from '@/components/wizard-stepper';
import { AppButton } from '@/components/app-button';
import { Field, TextInput } from '@/components/form/field';

afterEach(() => cleanup());

describe('FilterChips', () => {
  const chips = [
    { value: 'all', label: 'すべて' },
    { value: 'rating4', label: '星 4 以上' },
    { value: 'home', label: '自宅' },
  ] as const;

  it('選択中のチップだけ aria-pressed になり、押すと onChange', () => {
    const onChange = vi.fn();
    render(<FilterChips chips={chips} value="all" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'すべて' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '自宅' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: '星 4 以上' }));
    expect(onChange).toHaveBeenCalledWith('rating4');
  });

  it('onOpenFilter を渡したときだけ「絞り込み」が先頭に出る', () => {
    const onOpenFilter = vi.fn();
    const { rerender } = render(<FilterChips chips={chips} value="all" onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: '絞り込み' })).toBeNull();
    rerender(<FilterChips chips={chips} value="all" onChange={() => {}} onOpenFilter={onOpenFilter} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('絞り込み');
    fireEvent.click(buttons[0]);
    expect(onOpenFilter).toHaveBeenCalledTimes(1);
  });
});

describe('PlaceSegment', () => {
  it('radiogroup で、選ぶと onChange に place が渡る', () => {
    const onChange = vi.fn();
    render(<PlaceSegment value="shop" onChange={onChange} />);
    expect(screen.getByRole('radiogroup', { name: '飲んだ場所' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '店で' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: '自宅で' }));
    expect(onChange).toHaveBeenCalledWith('home');
  });
});

describe('WizardStepper', () => {
  it('現在の段階に aria-current="step" が付く', () => {
    render(<WizardStepper current={2} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).not.toHaveAttribute('aria-current');
  });

  it('段階の名前を差し替えられる', () => {
    render(<WizardStepper current={1} steps={['豆', '店と評価']} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('豆')).toBeInTheDocument();
  });
});

describe('AppButton', () => {
  it('loading 中は押せず aria-busy', () => {
    const onClick = vi.fn();
    render(
      <AppButton loading onClick={onClick}>
        保存する
      </AppButton>,
    );
    const btn = screen.getByRole('button', { name: /保存する/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });
});

describe('Field', () => {
  it('error があれば role=alert で出し、hint は隠れる', () => {
    const { rerender } = render(
      <Field label="豆名" htmlFor="name" hint="カードの表記のまま">
        <TextInput id="name" />
      </Field>,
    );
    expect(screen.getByText('カードの表記のまま')).toBeInTheDocument();
    expect(screen.getByLabelText('豆名')).toBeInTheDocument();
    rerender(
      <Field label="豆名" htmlFor="name" hint="カードの表記のまま" error="豆名を入力してください">
        <TextInput id="name" aria-invalid />
      </Field>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('豆名を入力してください');
    expect(screen.queryByText('カードの表記のまま')).toBeNull();
  });
});
