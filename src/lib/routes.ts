// 画面の URL をここで一元的に組み立てる（ADR 0008）。
// 詳細ページは `[id]` の動的セグメントではなくクエリ文字列にする。静的出力（Capacitor 化）で
// 動的セグメントはビルドできないため。画面側で `/beans?id=` のような文字列を直接書かない。

const withId = <P extends string>(path: P, id: string) =>
  `${path}?id=${encodeURIComponent(id)}` as `${P}?id=${string}`;

export const routes = {
  home: '/',
  login: '/login',
  /** 入力記録一覧（S2）。ホームは豆のコレクション（S10）になった（2026-09-24） */
  logs: '/logs',
  newLog: '/logs/new',
  /** 旧 URL。/ へ転送する */
  collection: '/collection',
  shops: '/shops',
  map: '/map',
  stats: '/stats',
  settings: '/settings',
  privacy: '/privacy',
  terms: '/terms',
  /** 豆詳細（S4） */
  bean: (id: string) => withId('/beans', id),
  /** 記録詳細・編集（S5） */
  log: (id: string) => withId('/logs', id),
  /** 店詳細（S6 の行から遷移） */
  shop: (id: string) => withId('/shops/detail', id),
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `?id=` を読んで UUID として妥当なら返す。無い・壊れているときは null（画面は「見つかりません」を出す）。
 * `useSearchParams()` の戻り値をそのまま渡せる。静的出力では `useSearchParams` を `Suspense` の中で呼ぶこと。
 */
export function idFromSearchParams(
  params: { get(name: string): string | null } | null | undefined,
): string | null {
  const raw = params?.get('id')?.trim() ?? '';
  return UUID_RE.test(raw) ? raw.toLowerCase() : null;
}
