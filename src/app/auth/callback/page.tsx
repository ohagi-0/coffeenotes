'use client';

// 認証コールバック。マジックリンク（PKCE の ?code= または token_hash）と OAuth の戻り先。
// ?code= はブラウザクライアントが自動で交換する。token_hash 形式（別ブラウザで開いた場合など）は verifyOtp で処理する。
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { EmailOtpType } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { FullScreenLoading } from '@/components/full-screen-loading';

const OTP_TYPES: EmailOtpType[] = ['magiclink', 'signup', 'email', 'recovery', 'invite', 'email_change'];

function isEmailOtpType(v: string | null): v is EmailOtpType {
  return v !== null && (OTP_TYPES as string[]).includes(v);
}

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function run() {
      const errorDescription = params.get('error_description');
      if (errorDescription) {
        setError(errorDescription);
        return;
      }
      const tokenHash = params.get('token_hash');
      const type = params.get('type');
      if (tokenHash && isEmailOtpType(type)) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (!active) return;
        if (error) {
          setError(error.message);
          return;
        }
      }
      // ?code= の場合は createBrowserClient が自動交換するので、セッションが立つのを待つ
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        router.replace('/');
        return;
      }
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          subscription.unsubscribe();
          router.replace('/');
        }
      });
      // 10 秒待ってもセッションが立たなければエラー扱い
      setTimeout(() => {
        if (!active) return;
        subscription.unsubscribe();
        setError(
          'ログインを完了できませんでした。リンクの有効期限が切れているか、送信時と別のブラウザで開いた可能性があります。',
        );
      }, 10_000);
    }

    void run();
    return () => {
      active = false;
    };
  }, [params, router]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-destructive font-medium">ログインに失敗しました</p>
        <p className="text-muted-foreground text-sm">{error}</p>
        <Button variant="outline" className="h-11 px-5" render={<Link href="/login" />}>
          ログイン画面へ戻る
        </Button>
      </main>
    );
  }
  return <FullScreenLoading label="ログイン処理中…" />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<FullScreenLoading label="ログイン処理中…" />}>
      <CallbackInner />
    </Suspense>
  );
}
