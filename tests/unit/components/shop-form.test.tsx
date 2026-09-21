import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ShopForm } from '@/components/shops/shop-form';

afterEach(() => cleanup());

describe('ShopForm', () => {
  it('店名だけで登録できる（座標は null）', async () => {
    const onSubmit = vi.fn();
    render(<ShopForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('店名'), { target: { value: ' KIELO COFFEE 蔵前 ' } });
    fireEvent.click(screen.getByRole('button', { name: '登録する' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: 'KIELO COFFEE 蔵前',
      kind: 'cafe',
      address: null,
      lat: null,
      lng: null,
    });
  });

  it('店名が空なら送信しない', async () => {
    const onSubmit = vi.fn();
    render(<ShopForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: '登録する' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('店名を入力してください'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('緯度だけ入れると両方入力のエラー', async () => {
    const onSubmit = vi.fn();
    render(<ShopForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('店名'), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText('緯度'), { target: { value: '35.7' } });
    fireEvent.click(screen.getByRole('button', { name: '登録する' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('両方'));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('経度'), { target: { value: '139.79' } });
    fireEvent.click(screen.getByRole('button', { name: '登録する' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ lat: 35.7, lng: 139.79 });
  });
});
