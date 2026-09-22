// Service Worker（F-MISC-1、serwist）。オフライン時は「閲覧のみ」を実現する。
// - アプリの静的資産はプリキャッシュ
// - Supabase REST の GET は NetworkFirst（オンラインなら最新、オフラインなら最後に見た内容）
// - カード画像の署名付き URL と地図タイルは StaleWhileRevalidate
// 書き込み（POST/PATCH/DELETE、/api/*）はキャッシュしない。
import { defaultCache } from '@serwist/next/worker';
import {
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const DAY = 24 * 60 * 60;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url, request }) =>
        url.hostname.endsWith('.supabase.co') &&
        url.pathname.startsWith('/rest/v1/') &&
        request.method === 'GET',
      handler: new NetworkFirst({
        cacheName: 'supabase-rest',
        networkTimeoutSeconds: 8,
        plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 7 * DAY })],
      }),
    },
    {
      matcher: ({ url }) =>
        url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/storage/v1/object/sign/'),
      handler: new StaleWhileRevalidate({
        cacheName: 'supabase-images',
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * DAY })],
      }),
    },
    {
      matcher: ({ url }) => url.hostname === 'tile.openstreetmap.org',
      handler: new StaleWhileRevalidate({
        cacheName: 'osm-tiles',
        plugins: [new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 7 * DAY })],
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
