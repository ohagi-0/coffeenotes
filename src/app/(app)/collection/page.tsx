'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FullScreenLoading } from '@/components/full-screen-loading';
import { routes } from '@/lib/routes';

// 豆のコレクションはホーム（/）になった（2026-09-24）。旧 URL はホームへ転送する。
export default function CollectionRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(routes.home);
  }, [router]);
  return <FullScreenLoading />;
}
