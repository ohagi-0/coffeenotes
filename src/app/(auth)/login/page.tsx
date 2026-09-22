'use client';

import Link from 'next/link';
import { routes } from '@/lib/routes';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail } from 'lucide-react';
import { AppButton } from '@/components/app-button';
import { Field, TextInput } from '@/components/form/field';
import { FullScreenLoading } from '@/components/full-screen-loading';
import { signInWithEmail, signInWithGoogle } from '@/features/auth/sign-in';
import { useSession } from '@/features/auth/use-session';

const formSchema = z.object({
  email: z.email('メールアドレスの形式が正しくありません'),
});
type FormValues = z.infer<typeof formSchema>;

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4c-.2 1.2-.9 2.3-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6C4.8 19.8 8.1 22 12 22z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1C2.4 8.8 2 10.4 2 12s.4 3.2 1.1 4.6L6.4 14z"
      />
      <path
        fill="#EA4335"
        d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9C17 2.9 14.7 2 12 2 8.1 2 4.8 4.2 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z"
      />
    </svg>
  );
}

// S1 ログイン画面（F-AUTH-1、DESIGN.md §5 S1）: ワードマークを画面下寄せにし、親指の届く位置に
// 「Google で続ける」とメールリンクの 2 つの導線。パスワード欄は存在しない。
export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'signed_in') router.replace('/');
  }, [status, router]);

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { email: '' } });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit({ email }: FormValues) {
    setFailure(null);
    try {
      await signInWithEmail(email);
      setSentTo(email);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'メールを送信できませんでした');
    }
  }

  async function onGoogle() {
    setFailure(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle(); // 成功すると Google へ遷移する
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Google ログインを開始できませんでした');
      setGoogleBusy(false);
    }
  }

  if (status === 'loading' || status === 'signed_in') return <FullScreenLoading />;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-[max(env(safe-area-inset-top,0px),24px)] pb-[max(env(safe-area-inset-bottom,0px),24px)]">
      <div className="mt-auto">
        <h1 className="font-display text-[64px] leading-[0.9]" aria-label="Coffeenotes">
          Coffee
          <br />
          notes
        </h1>
        <p className="text-muted-foreground mt-4 mb-11 max-w-[24em] text-sm leading-relaxed">
          飲んだ豆と、飲んだ店と、あなたの評価。プライベートなコーヒーの記録帳。
        </p>
      </div>

      {sentTo ? (
        <section
          aria-live="polite"
          className="border-border bg-card flex flex-col gap-3 rounded-[18px] border p-5"
        >
          <Mail className="text-primary size-7" aria-hidden />
          <p className="text-base font-bold">リンクを送りました。メールを開いてください</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            <span className="font-num text-foreground">{sentTo}</span>{' '}
            宛のリンクを開くとログインできます。届かない場合は迷惑メールも確認してください。
          </p>
          <div className="mt-1 flex flex-col gap-2">
            <AppButton
              variant="secondary"
              size="md"
              onClick={() => form.handleSubmit(onSubmit)()}
              loading={isSubmitting}
            >
              同じメールにもう一度送る
            </AppButton>
            <AppButton variant="ghost" size="md" onClick={() => setSentTo(null)}>
              別のメールアドレスを使う
            </AppButton>
          </div>
        </section>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-2.5" noValidate>
          <AppButton type="button" variant="white" onClick={onGoogle} loading={googleBusy}>
            {!googleBusy && <GoogleMark />}
            Google で続ける
          </AppButton>
          <Field label="メールアドレス" htmlFor="email" error={errors.email?.message} className="mt-2">
            <TextInput
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              {...form.register('email')}
            />
          </Field>
          <AppButton type="submit" variant="secondary" loading={isSubmitting}>
            ログインリンクを送る
          </AppButton>
          {failure && (
            <div
              role="alert"
              className="border-destructive bg-destructive/10 rounded-[14px] border p-3.5 text-sm"
            >
              <p className="text-destructive font-bold">ログインを始められませんでした</p>
              <p className="text-foreground mt-0.5">{failure} 少し待ってからもう一度試してください。</p>
            </div>
          )}
        </form>
      )}

      <p className="text-muted-foreground mt-5 text-center text-[11px] leading-relaxed">
        パスワードはありません。届いたリンクを開くとログインできます。
        <br />
        同じメールアドレスなら Google でも同じ記録帳が開きます。
      </p>
      <p className="text-muted-foreground mt-3 text-center text-[11px]">
        ログインすると
        <Link href={routes.terms} className="underline underline-offset-2">
          利用規約
        </Link>
        と
        <Link href={routes.privacy} className="underline underline-offset-2">
          プライバシーポリシー
        </Link>
        に同意したことになります。
      </p>
    </main>
  );
}
