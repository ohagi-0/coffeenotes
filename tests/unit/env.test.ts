// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiUrl, getPublicEnv, getServerEnv, resetEnvCacheForTest } from '@/lib/env';

const saved = { ...process.env };

describe('env', () => {
  beforeEach(() => {
    resetEnvCacheForTest();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://coffeelog.example.com';
  });
  afterEach(() => {
    process.env = { ...saved };
    resetEnvCacheForTest();
  });

  it('apiUrl は NEXT_PUBLIC_API_BASE_URL を前置した絶対 URL を返す', () => {
    expect(apiUrl('/api/ocr')).toBe('https://coffeelog.example.com/api/ocr');
  });

  it('公開変数が欠けていれば例外', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => getPublicEnv()).toThrow();
  });

  it('OCR_PROVIDER=claude なのに ANTHROPIC_API_KEY が無ければ例外', () => {
    process.env.OCR_PROVIDER = 'claude';
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => getServerEnv()).toThrow();
  });

  it('サーバー変数の既定値は OCR none / GEO nominatim', () => {
    delete process.env.OCR_PROVIDER;
    delete process.env.GEO_PROVIDER;
    const env = getServerEnv();
    expect(env.OCR_PROVIDER).toBe('none');
    expect(env.GEO_PROVIDER).toBe('nominatim');
  });

  it('地図の既定は osm で、Google の鍵は無くてよい', () => {
    delete process.env.NEXT_PUBLIC_MAP_PROVIDER;
    expect(getPublicEnv().NEXT_PUBLIC_MAP_PROVIDER).toBe('osm');
  });

  it('NEXT_PUBLIC_MAP_PROVIDER=google は鍵と Map ID が揃わないと例外', () => {
    process.env.NEXT_PUBLIC_MAP_PROVIDER = 'google';
    expect(() => getPublicEnv()).toThrow();
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY = 'k';
    resetEnvCacheForTest();
    expect(() => getPublicEnv()).toThrow();
    process.env.NEXT_PUBLIC_GOOGLE_MAP_ID = 'm';
    resetEnvCacheForTest();
    expect(getPublicEnv().NEXT_PUBLIC_MAP_PROVIDER).toBe('google');
  });
});
