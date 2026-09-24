import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BeanForm } from '@/components/beans/bean-form';

afterEach(() => cleanup());

it('焙煎度はチップで選び、もう一度押すと外れる', async () => {
  const onSubmit = vi.fn();
  render(<BeanForm onSubmit={onSubmit} defaultValues={{ name: 'x', roaster_name: 'y' }} />);
  fireEvent.click(screen.getByRole('radio', { name: '深煎り' }));
  expect(screen.getByRole('radio', { name: '深煎り' })).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(screen.getByRole('button', { name: /次へ/ }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit.mock.calls[0][0].form.roast_level).toBe('dark');
  fireEvent.click(screen.getByRole('radio', { name: '深煎り' }));
  expect(screen.getByRole('radio', { name: '深煎り' })).toHaveAttribute('aria-checked', 'false');
});

describe('BeanForm', () => {
  it('豆名が空なら送信せずエラーを出す（ロースターは任意）', async () => {
    const onSubmit = vi.fn();
    render(<BeanForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: '次へ：どこで飲んだ？' }));
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1));
    expect(screen.getByText('豆名を入力してください')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ロースターが空でも豆名だけで送信でき、roaster は id null・名前空で渡る', async () => {
    const onSubmit = vi.fn();
    render(<BeanForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('豆名'), { target: { value: 'もらい物の豆' } });
    fireEvent.click(screen.getByRole('button', { name: '次へ：どこで飲んだ？' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].roaster).toEqual({ id: null, name: '' });
  });

  it('数値文字列は数値に、空は null に。新しいロースターは id null で渡す', async () => {
    const onSubmit = vi.fn();
    render(<BeanForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('豆名'), { target: { value: '  Lusitania Lime Geisha ' } });
    fireEvent.change(screen.getByLabelText('ロースター'), { target: { value: 'KIELO COFFEE' } });
    fireEvent.change(screen.getByLabelText('標高'), { target: { value: '1650' } });
    fireEvent.change(screen.getByLabelText('価格'), { target: { value: '3800' } });
    fireEvent.click(screen.getByRole('button', { name: '次へ：どこで飲んだ？' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.roaster).toEqual({ id: null, name: 'KIELO COFFEE' });
    expect(arg.form).toMatchObject({
      name: 'Lusitania Lime Geisha',
      altitude_m: 1650,
      price_jpy: 3800,
      price_grams: null,
      country: null,
      source: 'purchased',
      roast_level: null,
      flavor_notes: [],
    });
  });

  it('ロースター候補を選ぶと id が付く', async () => {
    const onSubmit = vi.fn();
    render(
      <BeanForm
        onSubmit={onSubmit}
        roasterOptions={[{ id: '11111111-1111-4111-8111-111111111111', name: 'KIELO COFFEE' }]}
      />,
    );
    fireEvent.change(screen.getByLabelText('豆名'), { target: { value: 'Geisha' } });
    const roaster = screen.getByLabelText('ロースター');
    fireEvent.focus(roaster);
    fireEvent.change(roaster, { target: { value: 'KI' } });
    fireEvent.click(await screen.findByRole('option', { name: 'KIELO COFFEE' }));
    fireEvent.click(screen.getByRole('button', { name: '次へ：どこで飲んだ？' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].roaster).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'KIELO COFFEE',
    });
  });

  it('フレーバーは追加・重複除去・削除ができ、Enter でも追加できる', async () => {
    const onSubmit = vi.fn();
    render(<BeanForm onSubmit={onSubmit} defaultValues={{ name: 'x', roaster_name: 'y' }} />);
    const flavor = screen.getByLabelText('フレーバー');
    fireEvent.change(flavor, { target: { value: ' Lime ' } });
    fireEvent.click(screen.getByRole('button', { name: 'フレーバーを追加' }));
    fireEvent.change(flavor, { target: { value: 'Lime' } });
    fireEvent.keyDown(flavor, { key: 'Enter' });
    fireEvent.change(flavor, { target: { value: 'Bergamot' } });
    fireEvent.keyDown(flavor, { key: 'Enter' });
    expect(screen.getByRole('list', { name: '追加したフレーバー' }).querySelectorAll('li')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Lime を外す' }));
    fireEvent.click(screen.getByRole('button', { name: '次へ：どこで飲んだ？' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].form.flavor_notes).toEqual(['Bergamot']);
  });

  it('味覚チャートの入力が taste_* に入る', async () => {
    const onSubmit = vi.fn();
    render(<BeanForm onSubmit={onSubmit} defaultValues={{ name: 'x', roaster_name: 'y' }} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Flavor 5' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Body 3' }));
    fireEvent.click(screen.getByRole('button', { name: '次へ：どこで飲んだ？' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].form).toMatchObject({
      taste_flavor: 5,
      taste_body: 3,
      taste_acidity: null,
    });
  });
});

describe('BeanForm 生産国・品種の候補', () => {
  it('生産国にフォーカスすると過去の値とよくある国が日本語で出て、押すと入る', async () => {
    const onSubmit = vi.fn();
    render(<BeanForm onSubmit={onSubmit} recentCountries={['Ethiopia', 'エチオピア']} />);
    fireEvent.focus(screen.getByLabelText('生産国'));
    const list = screen.getByRole('listbox', { name: '生産国の候補' });
    const names = Array.from(list.querySelectorAll('[role=option]')).map((o) => o.textContent);
    expect(names[0]).toBe('エチオピア');
    expect(names[1]).toBe('ブラジル');
    expect(names.filter((n) => n === 'エチオピア')).toHaveLength(1);
    fireEvent.click(screen.getByRole('option', { name: 'ブラジル' }));
    expect(screen.getByLabelText('生産国')).toHaveValue('ブラジル');
    expect(screen.queryByRole('listbox', { name: '生産国の候補' })).not.toBeInTheDocument();
  });
  it('品種は入力で絞れる', () => {
    render(<BeanForm onSubmit={vi.fn()} />);
    const input = screen.getByLabelText('品種');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'sl' } });
    const names = Array.from(
      screen.getByRole('listbox', { name: '品種の候補' }).querySelectorAll('[role=option]'),
    ).map((o) => o.textContent);
    expect(names).toEqual(['SL28', 'SL34']);
  });
});
