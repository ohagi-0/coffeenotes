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
      {/* トースト（DESIGN.md §4）: 上部、地はクレマ・文字はエスプレッソ、3 秒。
          ダーク専用なので OS 設定に関係なく dark を固定する（sonner.tsx は生成物なので触らない） */}
      <Toaster
        theme="dark"
        position="top-center"
        duration={3000}
        style={
          {
            '--normal-bg': 'var(--foreground)',
            '--normal-text': 'var(--background)',
            '--normal-border': 'var(--foreground)',
            '--border-radius': '12px',
          } as React.CSSProperties
        }
        toastOptions={{
          classNames: {
            toast: 'cn-toast font-medium text-[13px] shadow-[0_12px_30px_-10px_rgba(0,0,0,.6)]',
            success: '[&_svg]:text-ok',
            error: '[&_svg]:text-destructive',
          },
        }}
      />
    </QueryClientProvider>
  );
}
