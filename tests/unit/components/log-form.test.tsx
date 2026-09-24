import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LogForm } from '@/components/logs/log-form';

beforeAll(() => {
  // jsdom は <dialog> の showModal / close を実装していない（店の検索シートが使う）
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  window.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(0), 0) as unknown as number;
});
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

  it('「店を選ぶ」→ 検索シート → 「自分で登録する」で店名を手入力すると新しい店（id null）として渡る。星は空でも保存できる', async () => {
    const onSubmit = vi.fn();
    render(<LogForm beanName="Geisha" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /店を選ぶ/ }));
    const search = screen.getByLabelText('店名・住所で探す');
    fireEvent.change(search, { target: { value: 'KIELO COFFEE 蔵前' } });
    fireEvent.click(screen.getByRole('button', { name: /「KIELO COFFEE 蔵前」を自分で登録する/ }));
    // 手入力欄に検索語が入った状態で開く
    expect(screen.getByLabelText('店')).toHaveValue('KIELO COFFEE 蔵前');
    fireEvent.click(screen.getByRole('button', { name: 'この店名で決定' }));
    expect(screen.getByText('新しい店として登録します')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存する' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.shop).toEqual({ id: null, name: 'KIELO COFFEE 蔵前' });
    expect(arg.fields.rating).toBeNull();
  });

  it('「店で」を押すと検索シートが開き、登録済みの店を選ぶと id 付き。選び直しもできる', async () => {
    const onSubmit = vi.fn();
    render(
      <LogForm
        beanName="Geisha"
        onSubmit={onSubmit}
        shopOptions={[
          { id: '22222222-2222-4222-8222-222222222222', name: 'KIELO COFFEE 蔵前', address: '台東区蔵前' },
          { id: '33333333-3333-4333-8333-333333333333', name: 'Onibus', address: '目黒区' },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: '店で' }));
    const search = screen.getByLabelText('店名・住所で探す');
    fireEvent.change(search, { target: { value: 'KI' } });
    // 検索語で登録済みの店が絞られる
    expect(screen.queryByRole('option', { name: /Onibus/ })).toBeNull();
    fireEvent.click(await screen.findByRole('option', { name: /KIELO COFFEE 蔵前/ }));
    // 選択中のカード（店名 + 「登録済みの店」）。押すと選び直し（シートが開く）
    const card = screen.getByRole('button', { name: /KIELO COFFEE 蔵前.*登録済みの店/ });
    fireEvent.click(card);
    expect(screen.getByLabelText('店名・住所で探す')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /Onibus/ }));
    fireEvent.click(screen.getByRole('button', { name: '保存する' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].shop).toEqual({
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Onibus',
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
