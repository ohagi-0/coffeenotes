import { describe, expect, it } from 'vitest';
import { idFromSearchParams, routes } from '@/lib/routes';

const ID = '11111111-1111-4111-8111-111111111111';

describe('routes（ADR 0008: 詳細ページはクエリ文字列）', () => {
  it('詳細ページの URL を組み立てる', () => {
    expect(routes.bean(ID)).toBe(`/beans?id=${ID}`);
    expect(routes.log(ID)).toBe(`/logs?id=${ID}`);
    expect(routes.shop(ID)).toBe(`/shops/detail?id=${ID}`);
  });
  it('id は URL エンコードする', () => {
    expect(routes.bean('a b&c')).toBe('/beans?id=a%20b%26c');
  });
  it('固定ページの URL', () => {
    expect(routes.newLog).toBe('/logs/new');
    expect(routes.shops).toBe('/shops');
  });
});

describe('idFromSearchParams', () => {
  it('UUID なら小文字で返す', () => {
    expect(idFromSearchParams(new URLSearchParams(`id=${ID.toUpperCase()}`))).toBe(ID);
  });
  it('無い・空・UUID でないときは null', () => {
    expect(idFromSearchParams(new URLSearchParams(''))).toBeNull();
    expect(idFromSearchParams(new URLSearchParams('id='))).toBeNull();
    expect(idFromSearchParams(new URLSearchParams('id=abc'))).toBeNull();
    expect(idFromSearchParams(null)).toBeNull();
  });
});
