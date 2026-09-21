'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Coffee, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInWithEmail, signInWithGoogle } from '@/features/auth/sign-in';
import { useSession } from '@/features/auth/use-session';
import { FullScreenLoading } from '@/components/full-screen-loading';

const formSchema = z.object({
  email: z.email('メールアドレスの形式が正しくありません'),
});
type FormValues = z.infer<typeof formSchema>;

// S1 ログイン画面（F-AUTH-1）: メールリンク + Google。
export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (status === 'signed_in') router.replace('/');
  }, [status, router]);

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { email: '' } });

  async function onSubmit({ email }: FormValues) {
    try {
      await signInWithEmail(email);
      setSentTo(email);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'メールを送信できませんでした');
    }
  }

  async function onGoogle() {
    setGoogleBusy(true);
    try {
      await signInWithGoogle(); // 成功すると Google へ遷移する
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Google ログインを開始できませんでした');
      setGoogleBusy(false);
    }
  }

  if (status === 'loading' || status === 'signed_in') return <FullScreenLoading />;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <Coffee className="size-10" aria-hidden />
        <h1 className="text-2xl font-bold">coffeenotes</h1>
        <p className="text-muted-foreground text-sm">飲んだコーヒーを、店と一緒に記録する</p>
      </div>

      {sentTo ? (
        <div className="space-y-4 rounded-lg border p-5 text-center">
          <Mail className="mx-auto size-8" aria-hidden />
          <p className="font-medium">メールを送信しました</p>
          <p className="text-muted-foreground text-sm">
            {sentTo} 宛のリンクを開くとログインできます。届かない場合は迷惑メールも確認してください。
          </p>
          <Button variant="ghost" onClick={() => setSentTo(null)}>
            別のメールアドレスを使う
          </Button>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="h-11"
              aria-invalid={!!form.formState.errors.email}
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <p className="text-destructive text-sm" role="alert">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>
          <Button type="submit" size="lg" className="h-11 w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? '送信中…' : 'ログインリンクを送る'}
          </Button>
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <span className="bg-border h-px flex-1" />
            または
            <span className="bg-border h-px flex-1" />
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 w-full"
            onClick={onGoogle}
            disabled={googleBusy}
          >
            {googleBusy ? 'Google へ移動中…' : 'Google でログイン'}
          </Button>
        </form>
      )}
    </main>
  );
}
