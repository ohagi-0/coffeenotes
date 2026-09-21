import { Construction } from 'lucide-react';

export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="space-y-6 py-4">
      <h1 className="text-xl font-bold">{title}</h1>
      <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
        <Construction className="size-8" aria-hidden />
        <p className="text-sm">{phase} で実装予定です</p>
      </div>
    </div>
  );
}
