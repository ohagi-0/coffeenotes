import { Loader2 } from 'lucide-react';

export function FullScreenLoading({ label = '読み込み中…' }: { label?: string }) {
  return (
    <div className="text-muted-foreground flex min-h-dvh items-center justify-center gap-2" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}
