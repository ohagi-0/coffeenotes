'use client';

import { Suspense, useEffect } from 'react';
import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { FullScreenLoading } from '@/components/full-screen-loading';
import { routes } from '@/lib/routes';

// 旧 S7 記録したお店のマップ。2026-09-24 に地図を S6（/shops）へ統合したので、ここは /shops へ転送するだけ。
// 共有済みの URL（/map?shop=…）が生きるよう ?shop= を引き継ぐ。ミドルウェアは使わない（静的出力のため）。

function MapRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const shop = params.get('shop');
    router.replace((shop ? `${routes.shops}?shop=${encodeURIComponent(shop)}` : routes.shops) as Route);
  }, [params, router]);
  return <FullScreenLoading />;
}

export default function MapPage() {
  return (
    <Suspense fallback={<FullScreenLoading />}>
      <MapRedirect />
    </Suspense>
  );
}
