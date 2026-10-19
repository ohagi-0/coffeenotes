import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { FullScreenLoading } from '@/components/full-screen-loading';
import { LOADING_SCENES, pickLoadingScene } from '@/components/loading-scene';

afterEach(() => cleanup());

describe('読み込み中の動き', () => {
  it('pickLoadingScene は乱数から 3 つの所作のどれかを返す', () => {
    expect(pickLoadingScene(() => 0)).toBe('drip');
    expect(pickLoadingScene(() => 0.5)).toBe('roast');
    expect(pickLoadingScene(() => 0.999)).toBe('grind');
    expect(LOADING_SCENES).toHaveLength(3);
  });
  it('読み上げは「読み込み中」で、所作に合わせた文言が出る', () => {
    render(<FullScreenLoading scene="drip" />);
    expect(screen.getByRole('status', { name: '読み込み中' })).toBeInTheDocument();
    expect(screen.getByText('お湯を注いでいます…')).toBeInTheDocument();
  });
  it('label を渡せばその文言になる', () => {
    render(<FullScreenLoading scene="grind" label="準備しています…" />);
    expect(screen.getByText('準備しています…')).toBeInTheDocument();
  });
});
