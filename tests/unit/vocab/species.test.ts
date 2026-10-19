import { describe, expect, it } from 'vitest';
import { hasRobusta, SPECIES_LABELS, speciesLabel, speciesOf } from '@/lib/vocab';

describe('speciesOf', () => {
  it('主要品種はアラビカ', () => {
    expect(speciesOf('ゲイシャ')).toBe('arabica');
    expect(speciesOf('Geisha')).toBe('arabica');
    expect(speciesOf('Red Bourbon')).toBe('arabica');
    expect(speciesOf('SL28, SL34')).toBe('arabica');
    expect(speciesOf('74158')).toBe('arabica');
  });
  it('種の名前が書かれていればそれを採る', () => {
    expect(speciesOf('Robusta')).toBe('robusta');
    expect(speciesOf('ロブスタ種')).toBe('robusta');
    expect(speciesOf('Canephora')).toBe('robusta');
    expect(speciesOf('Arabica')).toBe('arabica');
    expect(speciesOf('Liberica')).toBe('liberica');
    expect(speciesOf('Bourbon (Arabica)')).toBe('arabica');
    expect(speciesOf('Conilon')).toBe('robusta');
  });
  it('種が混ざれば mixed', () => {
    expect(speciesOf('SL28, ロブスタ')).toBe('mixed');
    expect(speciesOf('Arabica / Robusta')).toBe('mixed');
    expect(speciesOf('Robusta, Canephora')).toBe('robusta');
  });
  it('空・判断できない品種は null', () => {
    expect(speciesOf('')).toBeNull();
    expect(speciesOf(null)).toBeNull();
    expect(speciesOf(undefined)).toBeNull();
    expect(speciesOf('Sudan Rume')).toBeNull();
  });
  it('表示名とロブスタ入りの判定', () => {
    expect(speciesLabel('arabica')).toBe('アラビカ');
    expect(speciesLabel('mixed')).toBe(SPECIES_LABELS.mixed);
    expect(speciesLabel(null)).toBeNull();
    expect(hasRobusta('ロブスタ')).toBe(true);
    expect(hasRobusta('SL28 / Robusta')).toBe(true);
    expect(hasRobusta('ゲイシャ')).toBe(false);
    expect(hasRobusta(null)).toBe(false);
  });
});
