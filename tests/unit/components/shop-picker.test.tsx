import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ShopPicker, type ShopPickerProps } from '@/components/shops/shop-picker';

// 店の検索シート（S3 ③）。開閉、一番上の「自分で登録する」、登録済みの絞り込み、
// カードのロースター名からの先読み、入力語での候補検索（デバウンス）を確かめる。

beforeAll(() => {
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
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const cand = (name: string, address = '東京都') => ({
  name,
  address,
  lat: 35.7,
  lng: 139.8,
  externalPlaceId: `node/${name}`,
  distanceM: 120,
});

function setup(over: Partial<ShopPickerProps> = {}) {
  const props: ShopPickerProps = {
    open: true,
    onClose: vi.fn(),
    query: '',
    onQueryChange: vi.fn(),
    registered: [
      { id: '1', name: 'KIELO COFFEE 蔵前', address: '台東区蔵前' },
      { id: '2', name: 'Onibus', address: '目黒区' },
    ],
    onPickShop: vi.fn(),
    onPickCandidate: vi.fn(),
    onRegisterManually: vi.fn(),
    ...over,
  };
  const utils = render(<ShopPicker {...props} />);
  return { props, ...utils };
}

describe('ShopPicker', () => {
  it('一番上に「自分で登録する」があり、検索語があればその名前で呼ばれる', () => {
    const { props, rerender } = setup();
    fireEvent.click(screen.getByRole('button', { name: /自分で登録する/ }));
    expect(props.onRegisterManually).toHaveBeenCalledWith('');
    rerender(<ShopPicker {...props} query="  KIELO " />);
    fireEvent.click(screen.getByRole('button', { name: /「KIELO」を自分で登録する/ }));
    expect(props.onRegisterManually).toHaveBeenLastCalledWith('KIELO');
  });

  it('登録済みの店は名前・住所で絞り、選ぶと onPickShop', () => {
    const { props, rerender } = setup();
    expect(screen.getAllByRole('option')).toHaveLength(2);
    rerender(<ShopPicker {...props} query="目黒" />);
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.click(screen.getByRole('option', { name: /Onibus/ }));
    expect(props.onPickShop).toHaveBeenCalledWith(props.registered[1]);
  });

  it('候補検索が無ければ現在地・地図の欄を出さず、閉じるで onClose', () => {
    const { props } = setup();
    expect(screen.queryByRole('button', { name: /現在地から探す/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('手がかり（カードのロースター名）があれば開いたときに候補を先に引き、住所付きで出す', async () => {
    const geocode = vi.fn(async () => [
      cand('KIELO COFFEE', '台東区蔵前 3-1'),
      cand('KIELO COFFEE', '福岡市'),
    ]);
    const { props } = setup({
      candidates: { geocode, nearby: vi.fn(async () => []) },
      hint: { label: 'カードのロースター', query: 'KIELO COFFEE' },
    });
    expect(await screen.findByText('カードのロースター「KIELO COFFEE」の場所')).toBeInTheDocument();
    expect(geocode).toHaveBeenCalledWith('KIELO COFFEE');
    expect(await screen.findByText('福岡市')).toBeInTheDocument();
    // 登録済みの 1 件 + 候補 2 件
    expect(screen.getAllByRole('option', { name: /KIELO COFFEE/ })).toHaveLength(3);
    fireEvent.click(screen.getByText('福岡市'));
    expect(props.onPickCandidate).toHaveBeenCalledWith(expect.objectContaining({ address: '福岡市' }));
  });

  it('2 文字以上の入力で地図の候補を引く（待ち時間のあと 1 回だけ）', async () => {
    vi.useFakeTimers();
    const geocode = vi.fn(async () => [cand('Blue Bottle 清澄白河')]);
    const { props, rerender } = setup({ candidates: { geocode, nearby: vi.fn(async () => []) } });
    rerender(<ShopPicker {...props} query="B" />);
    rerender(<ShopPicker {...props} query="Bl" />);
    rerender(<ShopPicker {...props} query="Blu" />);
    expect(geocode).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(geocode).toHaveBeenCalledTimes(1);
    expect(geocode).toHaveBeenCalledWith('Blu', undefined);
    vi.useRealTimers();
    expect(await screen.findByRole('option', { name: /Blue Bottle/ })).toBeInTheDocument();
    expect(screen.getByText('地図で見つかった店')).toBeInTheDocument();
  });

  it('候補検索の失敗は文言で出し、自分で登録する導線は残る', async () => {
    const geocode = vi.fn(async () => {
      throw new Error('候補のサービスに接続できませんでした');
    });
    setup({
      candidates: { geocode, nearby: vi.fn(async () => []) },
      hint: { label: 'ロースター', query: 'KIELO' },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('候補のサービスに接続できませんでした');
    expect(screen.getByRole('button', { name: /自分で登録する/ })).toBeInTheDocument();
  });
});
