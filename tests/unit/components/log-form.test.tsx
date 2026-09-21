import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LogForm } from '@/components/logs/log-form';

afterEach(() => cleanup());
beforeEach(() => localStorage.clear());

describe('LogForm', () => {
  it('自宅 + 星 4.0 + メモだけで保存できる（店は付かない）', async () => {
    const onSubmit = vi.fn();
    render(<LogForm beanName="Geisha" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('radio', { name: '自宅で' }));
    fireEvent.keyDown(screen.getByRole('slider', { name: '評価' }), { key: 'End' });
    fireEvent.keyDown(screen.getByRole('slider', { name: '評価' }), { key: 'ArrowLeft' });
    fireEvent.keyDown(screen.getByRole('slider', { name: '評価' }), { key: 'ArrowLeft' });
    fireEvent.change(screen.getByLabelText('メモ'), { target: { value: '冷めてからが良い' } });
    fireEvent.click(screen.getByRole('button', { name: '保存する' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.shop).toBeNull();
    expect(arg.fields).toMatchObject({ place: 'home', rating: 4, memo: '冷めてからが良い', kind: 'drank' });
    expect(arg.fields.logged_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.queryByLabelText('店')).toBeNull();
  });

  it('店名を手入力すると新しい店（id null）として渡る。星は空でも保存できる', async () => {
    const onSubmit = vi.fn();
    render(<LogForm beanName="Geisha" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('店'), { target: { value: 'KIELO COFFEE 蔵前' } });
    fireEvent.click(screen.getByRole('button', { name: '保存する' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.shop).toEqual({ id: null, name: 'KIELO COFFEE 蔵前' });
    expect(arg.fields.rating).toBeNull();
  });

  it('候補から店を選ぶと id 付き。選び直しもできる', async () => {
    const onSubmit = vi.fn();
    render(
      <LogForm
        beanName="Geisha"
        onSubmit={onSubmit}
        shopOptions={[
          { id: '22222222-2222-4222-8222-222222222222', name: 'KIELO COFFEE 蔵前', address: '台東区蔵前' },
        ]}
      />,
    );
    const input = screen.getByLabelText('店');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'KI' } });
    fireEvent.click(await screen.findByRole('option', { name: /KIELO COFFEE 蔵前/ }));
    expect(screen.getByText('登録済みの店')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存する' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].shop).toEqual({
      id: '22222222-2222-4222-8222-222222222222',
      name: 'KIELO COFFEE 蔵前',
    });
  });

  it('タグは候補のトグルと手入力（# を落とす）、飲み方は「その他」で自由入力', async () => {
    const onSubmit = vi.fn();
    render(<LogForm beanName="Geisha" onSubmit={onSubmit} tagSuggestions={['ゲイシャ', '朝']} />);
    fireEvent.click(screen.getByRole('button', { name: 'ゲイシャ を付ける' }));
    fireEvent.change(screen.getByLabelText('タグ'), { target: { value: '#蔵前' } });
    fireEvent.keyDown(screen.getByLabelText('タグ'), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'その他' }));
    fireEvent.change(screen.getByLabelText('飲み方（自由入力）'), { target: { value: 'エアロプレス' } });
    fireEvent.click(screen.getByRole('button', { name: '保存する' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].fields).toMatchObject({
      tag_names: ['ゲイシャ', '蔵前'],
      brew_method: 'エアロプレス',
    });
  });

  it('設定でスライダーを選んでいれば range 入力も出る', () => {
    localStorage.setItem('coffeenotes:rating-input', 'slider');
    render(<LogForm beanName="Geisha" onSubmit={() => {}} />);
    expect(screen.getByRole('slider', { name: '評価（スライダー）' })).toBeInTheDocument();
  });
});
