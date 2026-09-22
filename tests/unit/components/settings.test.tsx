import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { SettingsView } from '@/components/settings/settings-view';
import { SettingRow } from '@/components/settings/setting-row';
import { readRatingInputMode, useRatingInputMode } from '@/features/settings/use-preferences';

afterEach(() => cleanup());
beforeEach(() => localStorage.clear());

describe('SettingRow', () => {
  it('onClick があればボタン、無ければ静的な行', () => {
    const onClick = vi.fn();
    const { rerender } = render(<SettingRow label="ログアウト" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<SettingRow label="位置情報" value="記録するときだけ" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('記録するときだけ')).toBeInTheDocument();
  });
});

describe('useRatingInputMode', () => {
  it('既定は tap、変更すると localStorage に残る', () => {
    const { result } = renderHook(() => useRatingInputMode());
    expect(result.current[0]).toBe('tap');
    act(() => result.current[1]('slider'));
    expect(result.current[0]).toBe('slider');
    expect(readRatingInputMode()).toBe('slider');
  });
});

describe('SettingsView', () => {
  it('メール・ログイン方式・読み取り回数を出し、ログアウトを呼べる', async () => {
    const onSignOut = vi.fn(async () => {});
    render(
      <SettingsView
        email="kota@example.com"
        providers={['google', 'email']}
        ocrUsedToday={3}
        onSignOut={onSignOut}
      />,
    );
    expect(screen.getByText('kota@example.com')).toBeInTheDocument();
    expect(screen.getByText('Google / メールリンク でログイン')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '今日の読み取り回数' })).toHaveAttribute(
      'aria-valuenow',
      '3',
    );
    fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('星の入力を切り替えられ、削除ボタンは準備中の説明を出す', () => {
    render(<SettingsView email="k@example.com" providers={['email']} onSignOut={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: 'スライダー' }));
    expect(screen.getByRole('radio', { name: 'スライダー' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'アカウントと全データを削除' }));
    expect(screen.getByRole('dialog', { name: 'アカウント削除の確認' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '削除する' })).toBeDisabled();
  });
});
