'use client';

// 入力欄の下に出す候補リスト（ロースター・生産国・品種で共通の見た目）。
// onMouseDown で preventDefault し、入力欄の blur より先に候補を押せるようにする。

export function SuggestBox({
  open,
  options,
  label,
  onPick,
}: {
  open: boolean;
  options: readonly string[];
  label: string;
  onPick: (value: string) => void;
}) {
  if (!open || options.length === 0) return null;
  return (
    <ul
      role="listbox"
      aria-label={label}
      className="bg-card border-border absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border py-1 shadow-[0_12px_30px_-10px_rgba(0,0,0,.6)]"
    >
      {options.map((o) => (
        <li key={o}>
          <button
            type="button"
            role="option"
            aria-selected={false}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(o)}
            className="hover:bg-secondary flex h-11 w-full items-center px-3.5 text-left text-sm"
          >
            {o}
          </button>
        </li>
      ))}
    </ul>
  );
}
