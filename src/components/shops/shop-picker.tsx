'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronRight, LocateFixed, MapPin, Plus, Search, Store, X } from 'lucide-react';
import type { ShopCandidate } from '@/components/shops/shop-candidate-tools';
import { PlatformGeolocationError, getCurrentPosition } from '@/lib/platform/geolocation';
import { cn } from '@/lib/utils';

// 店を選ぶ全画面の検索シート（S3 ③、F-SHOP-2/3/4）。Instagram の場所検索のように、
// 上に検索欄。並びは 地図で見つかった店（第一候補）→ 近くの店 → 登録済みの店（該当）→ 最後に「自分で登録する」（2026-09-24 に並び替え）。
// ネイティブの <dialog> で開き、フォーカストラップ・Esc・最前面はブラウザに任せる（nav-drawer と同じ）。
// 候補検索（/api/geo）は入力補助で、失敗しても「自分で登録する」から店名だけで作れる（ADR 0003）。

export type ShopPickerOption = { id: string; name: string; address?: string | null };

export type ShopPickerHint = {
  /** 見出し（「カードのロースター」など） */
  label: string;
  /** 候補を引く検索語（ロースター名） */
  query: string;
};

export type ShopPickerProps = {
  open: boolean;
  onClose: () => void;
  /** 検索語（親が保持する。登録済みの店の絞り込みにも使う） */
  query: string;
  onQueryChange: (query: string) => void;
  /** 登録済みの店（親が検索語で絞っていてもよい。ここでも名前・住所で絞る） */
  registered: ShopPickerOption[];
  registeredPending?: boolean;
  /** 地図上の候補検索。渡さなければ登録済みと手入力だけ */
  candidates?: {
    nearby: (pos: { lat: number; lng: number }) => Promise<ShopCandidate[]>;
    geocode: (query: string, near?: { lat: number; lng: number }) => Promise<ShopCandidate[]>;
  };
  /** カードのロースター名などの手がかり。開いたときに候補を先に引いて上に出す */
  hint?: ShopPickerHint | null;
  onPickShop: (shop: ShopPickerOption) => void;
  onPickCandidate: (candidate: ShopCandidate) => void;
  /** 「自分で登録する」。検索語を店名の初期値として渡す */
  onRegisterManually: (name: string) => void;
};

/** 検索語を投げるまでの待ち時間（公開サーバーの Nominatim なので 1 文字ごとには叩かない） */
export const SHOP_PICKER_DEBOUNCE_MS = 450;
export const SHOP_PICKER_MIN_QUERY = 2;

type Fetched =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; items: ShopCandidate[] }
  | { status: 'error'; message: string };

function formatDistance(m: number | undefined): string | null {
  if (m === undefined) return null;
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

/** 空白区切りの語がすべて店名か住所に含まれれば一致（順不同・部分一致） */
function matches(shop: ShopPickerOption, q: string): boolean {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const hay = `${shop.name}\n${shop.address ?? ''}`.toLowerCase();
  return terms.every((t) => hay.includes(t));
}

export function ShopPicker({
  open,
  onClose,
  query,
  onQueryChange,
  registered,
  registeredPending,
  candidates,
  hint,
  onPickShop,
  onPickCandidate,
  onRegisterManually,
}: ShopPickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hintResult, setHintResult] = useState<Fetched>({ status: 'idle' });
  /** 先読みした手がかりの語（同じ語なら引き直さない）と、古い応答を捨てるための連番 */
  const hintQueryRef = useRef<string | null>(null);
  const hintSeq = useRef(0);
  const [searchResult, setSearchResult] = useState<Fetched>({ status: 'idle' });
  const [nearbyResult, setNearbyResult] = useState<Fetched>({ status: 'idle' });
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const requestSeq = useRef(0);

  // 開閉をネイティブ dialog に同期し、開いたら検索欄にフォーカス
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // showModal 直後は dialog 自身にフォーカスが移るので、次のフレームで入力欄へ
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    if (!open && d.open) d.close();
  }, [open]);

  // 手がかり（カードのロースター名）は開いたときに 1 回だけ引く。同じ語なら引き直さない
  const geocode = candidates?.geocode;
  const hintQuery = hint?.query.trim() ?? '';
  useEffect(() => {
    if (!open || !geocode || hintQuery.length < SHOP_PICKER_MIN_QUERY || hintQueryRef.current === hintQuery)
      return;
    hintQueryRef.current = hintQuery;
    const seq = ++hintSeq.current;
    setHintResult({ status: 'loading' });
    geocode(hintQuery)
      .then((items) => seq === hintSeq.current && setHintResult({ status: 'ok', items }))
      .catch(
        (e: unknown) =>
          seq === hintSeq.current &&
          setHintResult({
            status: 'error',
            message: e instanceof Error ? e.message : '候補を取得できませんでした',
          }),
      );
  }, [open, geocode, hintQuery]);

  // 入力した語で地図上の候補を引く（デバウンス、古い応答は捨てる）
  useEffect(() => {
    const q = query.trim();
    if (!open || !geocode || q.length < SHOP_PICKER_MIN_QUERY) {
      setSearchResult({ status: 'idle' });
      return;
    }
    const seq = ++requestSeq.current;
    setSearchResult({ status: 'loading' });
    const timer = setTimeout(() => {
      geocode(q, userPos ?? undefined)
        .then((items) => seq === requestSeq.current && setSearchResult({ status: 'ok', items }))
        .catch(
          (e: unknown) =>
            seq === requestSeq.current &&
            setSearchResult({
              status: 'error',
              message: e instanceof Error ? e.message : '候補を取得できませんでした',
            }),
        );
    }, SHOP_PICKER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, geocode, query, userPos]);

  async function runNearby() {
    if (!candidates) return;
    setNearbyResult({ status: 'loading' });
    try {
      let p: { lat: number; lng: number } | null = userPos;
      if (!p) {
        const cur = await getCurrentPosition({ timeoutMs: 8000 });
        p = { lat: cur.lat, lng: cur.lng };
      }
      setUserPos(p);
      setNearbyResult({ status: 'ok', items: await candidates.nearby(p) });
    } catch (e) {
      setNearbyResult({
        status: 'error',
        message:
          e instanceof PlatformGeolocationError && e.kind === 'permission-denied'
            ? '位置情報が許可されていません。端末の設定で許可するか、店名で検索してください。'
            : e instanceof Error
              ? e.message
              : '現在地を取得できませんでした',
      });
    }
  }

  const q = query.trim();
  const registeredRows = registered.filter((s) => matches(s, q));
  const showHint = !!hint && q === '' && hintResult.status !== 'idle';

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      aria-label="店を選ぶ"
      className="bg-background text-foreground md:border-border fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none p-0 backdrop:bg-black/55 md:m-auto md:h-[min(720px,90dvh)] md:w-[calc(100%-40px)] md:max-w-md md:rounded-[18px] md:border"
    >
      <div className="flex h-full flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="border-border flex items-center gap-2 border-b px-3 pt-[max(env(safe-area-inset-top,0px),12px)] pb-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="text-muted-foreground hover:text-foreground grid size-11 shrink-0 place-items-center rounded-full"
          >
            <X className="size-5" aria-hidden />
          </button>
          <label className="border-border bg-card text-muted-foreground flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 text-sm">
            <Search className="size-[18px] shrink-0" aria-hidden />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="店名・住所で探す"
              aria-label="店名・住所で探す"
              autoComplete="off"
              enterKeyHint="search"
              className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange('')}
                aria-label="検索語を消す"
                className="grid size-8 shrink-0 place-items-center rounded-full"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(env(safe-area-inset-bottom,0px),16px)]">
          {showHint && hint && (
            <Section
              title={`${hint.label}「${hint.query}」の場所`}
              note="同じ名前の店が複数あることがあります。住所を確かめてから選んでください"
            >
              <CandidateList
                result={hintResult}
                emptyText="地図上に見つかりませんでした。下の検索欄で探すか、自分で登録できます"
                onPick={onPickCandidate}
              />
            </Section>
          )}

          {candidates && q === '' && (
            <div className="border-border border-b py-2">
              <button
                type="button"
                onClick={runNearby}
                disabled={nearbyResult.status === 'loading'}
                className="text-primary flex h-11 items-center gap-2 text-[13px] font-medium disabled:opacity-60"
              >
                <LocateFixed className="size-4" aria-hidden />
                {nearbyResult.status === 'loading' ? '現在地から探しています…' : '現在地から探す'}
              </button>
              {nearbyResult.status === 'error' && (
                <p role="alert" className="text-destructive text-xs">
                  {nearbyResult.message}
                </p>
              )}
            </div>
          )}

          {candidates && q === '' && nearbyResult.status !== 'idle' && (
            <Section title="近くの店">
              <CandidateList
                result={nearbyResult}
                emptyText="近くにカフェ・ロースターが見つかりませんでした"
                onPick={onPickCandidate}
              />
            </Section>
          )}

          {candidates && q.length >= SHOP_PICKER_MIN_QUERY && (
            <Section
              title="地図で見つかった店"
              note="OpenStreetMap の登録から。見つからなければ下の「自分で登録する」"
            >
              <CandidateList
                result={searchResult}
                emptyText="見つかりませんでした"
                onPick={onPickCandidate}
              />
            </Section>
          )}
          <Section title={q ? '登録済みの店（該当）' : '登録済みの店'}>
            {registeredPending && registered.length === 0 ? (
              <p className="text-muted-foreground py-3 text-xs" role="status">
                読み込んでいます…
              </p>
            ) : registeredRows.length === 0 ? (
              <p className="text-muted-foreground py-3 text-xs">
                {q ? '一致する登録済みの店はありません' : 'まだ登録した店はありません'}
              </p>
            ) : (
              <ul role="listbox" aria-label="登録済みの店">
                {registeredRows.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => onPickShop(s)}
                      className="hover:bg-secondary flex min-h-[56px] w-full items-center gap-3 py-2 text-left"
                    >
                      <span className="bg-secondary text-primary font-num grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold">
                        {s.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{s.name}</span>
                        {s.address && (
                          <span className="text-muted-foreground block truncate text-[11px]">
                            {s.address}
                          </span>
                        )}
                      </span>
                      <Store className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <button
            type="button"
            onClick={() => onRegisterManually(q)}
            className="border-border hover:bg-secondary mt-2 flex min-h-[60px] w-full items-center gap-3 rounded-[12px] border border-dashed px-3 py-3 text-left"
          >
            <span className="bg-primary/14 text-primary grid size-10 shrink-0 place-items-center rounded-full">
              <Plus className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">
                {q ? `「${q}」を自分で登録する` : '自分で登録する'}
              </span>
              <span className="text-muted-foreground block text-[11px]">
                地図で見つからないときに。店名を手で入れて、位置は地図で指定するか、あとから付けられます
              </span>
            </span>
            <ChevronRight className="text-muted-foreground size-[18px] shrink-0" aria-hidden />
          </button>
        </div>
      </div>
    </dialog>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="border-border border-b py-2" aria-label={title}>
      <h3 className="text-muted-foreground pt-1 text-[11px] font-bold tracking-wide">{title}</h3>
      {note && <p className="text-muted-foreground text-[11px]">{note}</p>}
      {children}
    </section>
  );
}

function CandidateList({
  result,
  emptyText,
  onPick,
}: {
  result: Fetched;
  emptyText: string;
  onPick: (c: ShopCandidate) => void;
}) {
  if (result.status === 'loading') {
    return (
      <p className="text-muted-foreground py-3 text-xs" role="status">
        候補を探しています…
      </p>
    );
  }
  if (result.status === 'error') {
    return (
      <p role="alert" className="text-destructive py-3 text-xs">
        {result.message}
      </p>
    );
  }
  if (result.status !== 'ok') return null;
  if (result.items.length === 0) return <p className="text-muted-foreground py-3 text-xs">{emptyText}</p>;
  return (
    <ul role="listbox" aria-label="地図上の候補">
      {result.items.map((c, i) => (
        <li key={`${c.externalPlaceId ?? c.name}-${i}`}>
          <button
            type="button"
            role="option"
            aria-selected={false}
            onClick={() => onPick(c)}
            className={cn('hover:bg-secondary flex min-h-[56px] w-full items-center gap-3 py-2 text-left')}
          >
            <span className="bg-secondary text-muted-foreground grid size-10 shrink-0 place-items-center rounded-full">
              <MapPin className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">{c.name}</span>
                {formatDistance(c.distanceM) && (
                  <span className="text-muted-foreground font-num shrink-0 text-[11px]">
                    {formatDistance(c.distanceM)}
                  </span>
                )}
              </span>
              {c.address && (
                <span className="text-muted-foreground block truncate text-[11px]">{c.address}</span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
