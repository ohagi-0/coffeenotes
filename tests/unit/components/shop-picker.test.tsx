import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ShopPicker, type ShopPickerProps } from '@/components/shops/shop-picker';
import type { ShopSearchItem } from '@/features/geo/search';
import type { ShopCandidate } from '@/components/shops/shop-candidate-tools';
import { PlatformGeolocationError } from '@/lib/platform/geolocation';

// 店の検索シート（S3 ③ / 記録・豆の編集）。開閉、「自分で登録する」、登録済みの絞り込み、
// 開いたときの現在地 → 近くの店、近くの店のあいまい照合 + 店名検索（デバウンス）、手がかりの先読みを確かめる。

const getCurrentPosition = vi.fn();
vi.mock('@/lib/platform/geolocation', async (orig) => ({
  ...(await orig<typeof import('@/lib/platform/geolocation')>()),
  getCurrentPosition: (...a: unknown[]) => getCurrentPosition(...a),
}));
// 戻り値を返すと後片付けとして呼ばれてしまうので、波括弧で包む
beforeEach(() => {
  getCurrentPosition.mockReset().mockResolvedValue({ lat: 35.66, lng: 139.7, accuracy: 10 });
});

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

const cand = (name: string, address = '東京都', distanceM = 120, aliases?: string[]) => ({
  name,
  address,
  lat: 35.7,
  lng: 139.8,
  externalPlaceId: `node/${name}/${address}`,
  distanceM,
  ...(aliases ? { aliases } : {}),
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

  it('開いたら現在地を取り、検索語が空なら近くの店を近い順に出す', async () => {
    const nearby = vi.fn(async () => [cand('Fuglen Tokyo', '渋谷区', 300), cand('猿田彦珈琲', '渋谷区', 80)]);
    const { props } = setup({ candidates: { nearby, search: vi.fn(async () => []) } });
    expect(await screen.findByText('近くの店')).toBeInTheDocument();
    expect(nearby).toHaveBeenCalledWith({ lat: 35.66, lng: 139.7 });
    expect(await screen.findByRole('option', { name: /Fuglen Tokyo/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /猿田彦珈琲/ }));
    expect(props.onPickCandidate).toHaveBeenCalledWith(expect.objectContaining({ name: '猿田彦珈琲' }));
  });

  it('位置情報が許可されていなければ理由と「もう一度」を出し、店名検索と自分で登録はできる', async () => {
    getCurrentPosition.mockImplementation(async () => {
      throw new PlatformGeolocationError('permission-denied');
    });
    const nearby = vi.fn(async () => []);
    setup({ candidates: { nearby, search: vi.fn(async () => []) } });
    expect(await screen.findByText(/位置情報が許可されていないため/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /もう一度、現在地から探す/ })).toBeInTheDocument();
    expect(nearby).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /自分で登録する/ })).toBeInTheDocument();
  });

  it('カタカナで打つと、近くの店の英字名にも当たる（店名検索を待たずに出る）', async () => {
    const nearby = vi.fn(async () => [
      cand('Fuglen Tokyo', '渋谷区', 300),
      cand('Blue Bottle Coffee', '渋谷区', 500, ['ブルーボトルコーヒー']),
      cand('猿田彦珈琲', '渋谷区', 80),
    ]);
    const search = vi.fn(() => new Promise<never>(() => {}));
    const { props, rerender } = setup({ candidates: { nearby, search } });
    await screen.findByRole('option', { name: /Fuglen Tokyo/ });
    rerender(<ShopPicker {...props} candidates={{ nearby, search }} query="フグレン" />);
    expect(screen.getByText('見つかった店')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Fuglen Tokyo/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /猿田彦珈琲/ })).toBeNull();
    expect(screen.getByText('ほかの店も探しています…')).toBeInTheDocument();
    rerender(<ShopPicker {...props} candidates={{ nearby, search }} query="ぶるーぼとる" />);
    expect(screen.getByRole('option', { name: /Blue Bottle Coffee/ })).toBeInTheDocument();
  });

  it('2 文字以上の入力で店名検索（待ち時間のあと 1 回だけ、現在地つき）。近くの店と重複は 1 つにまとめる', async () => {
    const near = cand('Blue Bottle 渋谷', '渋谷区', 500);
    const nearby = vi.fn(async () => [near]);
    const search = vi.fn(async () => [near, cand('Blue Bottle 清澄白河', '江東区', 9000)]);
    const { props, rerender } = setup({ candidates: { nearby, search } });
    await screen.findByRole('option', { name: /Blue Bottle 渋谷/ });
    vi.useFakeTimers();
    rerender(<ShopPicker {...props} candidates={{ nearby, search }} query="B" />);
    rerender(<ShopPicker {...props} candidates={{ nearby, search }} query="Bl" />);
    rerender(<ShopPicker {...props} candidates={{ nearby, search }} query="Blu" />);
    expect(search).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('Blu', { lat: 35.66, lng: 139.7 }, expect.any(String));
    vi.useRealTimers();
    expect(await screen.findByRole('option', { name: /Blue Bottle 清澄白河/ })).toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: /Blue Bottle 渋谷/ })).toHaveLength(1);
  });

  it('手がかり（カードのロースター名）があれば開いたときに候補を先に引き、住所付きで出す', async () => {
    const search = vi.fn(async () => [
      cand('KIELO COFFEE', '台東区蔵前 3-1'),
      cand('KIELO COFFEE', '福岡市'),
    ]);
    const { props } = setup({
      candidates: { search, nearby: vi.fn(async () => []) },
      hint: { label: 'カードのロースター', query: 'KIELO COFFEE' },
    });
    expect(await screen.findByText('カードのロースター「KIELO COFFEE」の場所')).toBeInTheDocument();
    expect(search).toHaveBeenCalledWith('KIELO COFFEE', undefined, expect.any(String));
    expect(await screen.findByText('福岡市')).toBeInTheDocument();
    fireEvent.click(screen.getByText('福岡市'));
    expect(props.onPickCandidate).toHaveBeenCalledWith(expect.objectContaining({ address: '福岡市' }));
  });

  it('候補検索の失敗は文言で出し、自分で登録する導線は残る', async () => {
    const search = vi.fn(async () => {
      throw new Error('候補のサービスに接続できませんでした');
    });
    setup({
      candidates: { search, nearby: vi.fn(async () => []) },
      hint: { label: 'ロースター', query: 'KIELO' },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('候補のサービスに接続できませんでした');
    expect(screen.getByRole('button', { name: /自分で登録する/ })).toBeInTheDocument();
  });

  describe('Google の候補（ADR 0011）', () => {
    const sug = (name: string, id: string, address = '東京都渋谷区') => ({
      externalPlaceId: id,
      name,
      address,
      distanceM: 1269,
    });
    const gcand = (name: string, id: string) => ({
      ...cand(name, '渋谷区', 90),
      externalPlaceId: id,
      placeProvider: 'google' as const,
    });

    it('近くの店は Google の順のまま出し、帰属ロゴ（alt=Google Maps）を付ける', async () => {
      const nearby = vi.fn(async () => [gcand('B店', 'p2'), gcand('A店', 'p1')]);
      setup({ candidates: { nearby, search: vi.fn(async () => []) } });
      await screen.findByRole('option', { name: /B店/ });
      const names = screen.getAllByRole('option').map((o) => o.textContent ?? '');
      expect(names.findIndex((t) => t.includes('B店'))).toBeLessThan(
        names.findIndex((t) => t.includes('A店')),
      );
      expect(screen.getByAltText('Google Maps')).toBeInTheDocument();
    });

    it('OSM の候補だけのときはロゴを出さない', async () => {
      const nearby = vi.fn(async () => [cand('Fuglen Tokyo')]);
      setup({ candidates: { nearby, search: vi.fn(async () => []) } });
      await screen.findByRole('option', { name: /Fuglen Tokyo/ });
      expect(screen.queryByAltText('Google Maps')).toBeNull();
    });

    it('入力 → 予測 → 選ぶと details（同じセッション）で座標を取り、google の候補として渡す', async () => {
      const nearby = vi.fn(async () => []);
      const search = vi.fn<(q: string, near?: unknown, session?: string) => Promise<ShopSearchItem[]>>(
        async () => [sug('フグレントウキョウ', 'pF'), sug('フグレン 羽根木公園', 'pH')],
      );
      let release: () => void = () => {};
      const gate = new Promise<void>((r) => (release = r));
      const details = vi.fn<(id: string, session?: string) => Promise<ShopCandidate>>(async () => {
        await gate;
        return {
          name: 'FUGLEN TOKYO',
          address: '渋谷区富ケ谷１丁目１６−１１',
          lat: 35.6666,
          lng: 139.6924,
          externalPlaceId: 'pF',
        };
      });
      const { props, rerender } = setup({ candidates: { nearby, search, details } });
      await screen.findByText('近くの店');
      vi.useFakeTimers();
      rerender(<ShopPicker {...props} candidates={{ nearby, search, details }} query="フグレン" />);
      await vi.advanceTimersByTimeAsync(500);
      vi.useRealTimers();
      const first = await screen.findByRole('option', { name: /フグレントウキョウ/ });
      expect(screen.getByAltText('Google Maps')).toBeInTheDocument();
      const session = search.mock.calls[0]![2];
      expect(session).toEqual(expect.any(String));
      fireEvent.click(first);
      expect(await screen.findByText('位置を取得しています…')).toBeInTheDocument();
      release();
      await vi.waitFor(() => expect(props.onPickCandidate).toHaveBeenCalled());
      expect(details).toHaveBeenCalledWith('pF', session);
      expect(props.onPickCandidate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'FUGLEN TOKYO', lat: 35.6666, placeProvider: 'google' }),
      );
    });

    it('details が失敗したらその行に文言を出し、選び直せる', async () => {
      const search = vi.fn(async () => [sug('フグレントウキョウ', 'pF')]);
      const details = vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ name: 'F', address: null, lat: 1, lng: 2, externalPlaceId: 'pF' });
      const { props, rerender } = setup({ candidates: { nearby: vi.fn(async () => []), search, details } });
      await screen.findByText('近くの店');
      vi.useFakeTimers();
      rerender(
        <ShopPicker
          {...props}
          candidates={{ nearby: vi.fn(async () => []), search, details }}
          query="フグ"
        />,
      );
      await vi.advanceTimersByTimeAsync(500);
      vi.useRealTimers();
      fireEvent.click(await screen.findByRole('option', { name: /フグレントウキョウ/ }));
      expect(
        await screen.findByText('位置を取得できませんでした。もう一度選んでください'),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('option', { name: /フグレントウキョウ/ }));
      await vi.waitFor(() => expect(props.onPickCandidate).toHaveBeenCalledTimes(1));
    });

    it('登録済みの店と同じ place_id の候補は出さない（登録済みの方を出す）', async () => {
      const nearby = vi.fn(async () => [gcand('Fuglen Tokyo', 'pF'), gcand('B店', 'p2')]);
      setup({
        registered: [{ id: '9', name: 'Fuglen Tokyo', address: '富ケ谷', externalPlaceId: 'pF' }],
        candidates: { nearby, search: vi.fn(async () => []) },
      });
      await screen.findByRole('option', { name: /B店/ });
      expect(screen.getAllByRole('option', { name: /Fuglen Tokyo/ })).toHaveLength(1);
    });
  });
});
