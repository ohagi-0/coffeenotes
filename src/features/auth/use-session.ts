'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type SessionState =
  | { status: 'loading'; session: null }
  | { status: 'signed_out'; session: null }
  | { status: 'signed_in'; session: Session };

/** 現在のセッションを監視する。初期化中は loading。 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState(
        data.session
          ? { status: 'signed_in', session: data.session }
          : { status: 'signed_out', session: null },
      );
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState(session ? { status: 'signed_in', session } : { status: 'signed_out', session: null });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
