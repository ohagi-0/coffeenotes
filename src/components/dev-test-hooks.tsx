'use client';

import { useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

// E2E（Playwright）用の seam。本番ビルドには入らない（NODE_ENV=production では何もしない）。
// マジックリンクは自動化できないので、テストはこのクライアントで signInWithPassword を呼ぶ（Issue #24）。

declare global {
  interface Window {
    __coffeenotes?: { supabase: SupabaseClient<Database> };
  }
}

export function DevTestHooks() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    window.__coffeenotes = { supabase: getSupabaseBrowserClient() };
    return () => {
      delete window.__coffeenotes;
    };
  }, []);
  return null;
}
