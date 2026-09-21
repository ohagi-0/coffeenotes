import { cn } from '@/lib/utils';

export const WIZARD_STEPS = ['撮影', '確認', '店と評価'] as const;

type Props = {
  /** 現在の段階（1 始まり） */
  current: number;
  /** 段階の名前。Phase 1 の手入力では「豆 / 店と評価」の 2 段でもよい */
  steps?: readonly string[];
  className?: string;
};

// 記録作成のステッパー（DESIGN.md §3）。済みと現在は銅の上線、先は --border。
export function WizardStepper({ current, steps = WIZARD_STEPS, className }: Props) {
  return (
    <ol
      aria-label="記録の手順"
      className={cn('grid gap-1.5', className)}
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n < current ? 'done' : n === current ? 'now' : 'todo';
        return (
          <li
            key={label}
            aria-current={state === 'now' ? 'step' : undefined}
            className={cn(
              'border-t-[3px] pt-2 text-[11px]',
              state === 'done' && 'border-primary text-foreground',
              state === 'now' && 'border-primary text-primary font-bold',
              state === 'todo' && 'border-border text-muted-foreground',
            )}
          >
            <span className="font-num">{n}</span> {label}
          </li>
        );
      })}
    </ol>
  );
}
