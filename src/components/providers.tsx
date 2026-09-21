'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* ダーク専用なので OS 設定に関係なく dark を固定する（sonner.tsx は生成物なので触らない） */}
      <Toaster theme="dark" position="top-center" />
    </QueryClientProvider>
  );
}
