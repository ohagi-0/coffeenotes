'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, LocateFixed, MapPin, Plus, Search, Store, X } from 'lucide-react';
import type { ShopCandidate } from '@/components/shops/shop-candidate-tools';
import { GoogleAttribution } from '@/components/shops/google-attribution';
import { isSuggestion, type ShopCandidateSources, type ShopSearchItem } from '@/features/geo/search';
import { matchScore, mergeCandidates, rankCandidates } from '@/lib/geo/match';
import { PlatformGeolocationError, getCurrentPosition } from '@/lib/platform/geolocation';
import { cn } from '@/lib/utils';

// 店を選ぶ全画面の検索シート（S3 ③ / 記録・豆の編集、F-SHOP-2/3/4）。Instagram の場所検索のように上に検索欄。
// 開いたら現在地を取り、周辺のカフェ・コーヒー店をまとめて読み込む（位置情報の許可はこのときブラウザが聞く）。
// 検索語が空なら「近くの店」を近い順に、語を打ったら
//   1. 読み込んだ周辺の店を端末であいまい照合（カタカナで打っても英字名の店に当たる。lib/geo/match.ts）
//   2. 店名検索（/api/geo?op=search。Photon。遠くの店も部分一致で当たる）
// を 1 つの一覧にまとめて出す（ADR 0010、2026-10-19）。その下に登録済みの店、最後に「自分で登録する」。
// ネイティブの <dialog> で開き、フォーカストラップ・Esc・最前面はブラウザに任せる（nav-drawer と同じ）。
// 候補検索（/api/geo）は入力補助で、失敗しても「自分で登録する」から店名 + 住所で作れる（ADR 0003）。
// Google の候補（ADR 0011）: 入力中は座標なしの予測が返り、選んだときに details で座標・正式な名前・住所を取る。
// Google の結果は Google の順のまま出し（並べ替えない）、一覧の下に Google Maps のロゴを出す。
// Autocomplete のセッションはシートを開いたときに作り、店を選んだら（details で閉じる）または閉じたら捨てる。

export type ShopPickerOption = {
  id: string;
  name: string;
  address?: string | null;
  /** 地図サービス側の ID。同じ店が「登録済み」と「候補」に重ねて出ないようにする */
  externalPlaceId?: string | null;
};

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
  /** 登録済みの店（親が検索語で絞っていてもよい。ここでもあいまい照合で絞る） */
  registered: ShopPickerOption[];
  registeredPending?: boolean;
  /** 地図上の候補検索。渡さなければ登録済みと手入力だけ */
  candidates?: Pick<ShopCandidateSources, 'nearby' | 'search' | 'details'>;
  /** カードのロースター名などの手がかり。開いたときに候補を先に引いて上に出す */
  hint?: ShopPickerHint | null;
  onPickShop: (shop: ShopPickerOption) => void;
  onPickCandidate: (candidate: ShopCandidate) => void;
  /** 「自分で登録する」。検索語を店名の初期値として渡す */
  onRegisterManually: (name: string) => void;
};

/** 店名検索を投げるまでの待ち時間（公開サーバーなので 1 文字ごとには叩かない） */
export const SHOP_PICKER_DEBOUNCE_MS = 450;
/** 店名検索（サーバー）を投げる最短の文字数。周辺の店の絞り込みは 1 文字から */
export const SHOP_PICKER_MIN_QUERY = 2;
/** 一覧に出す件数 */
const NEARBY_SHOWN = 30;
const LOCAL_MATCH_SHOWN = 20;

type Fetched =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; items: ShopSearchItem[] }
  | { status: 'error'; message: string };

/** 予測（Google）か、Google 由来の候補か。帰属ロゴと注記の出し分けに使う */
function isGoogleItem(i: ShopSearchItem): boolean {
  return isSuggestion(i) || i.placeProvider === 'google';
}

type Locate =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'ok'; pos: { lat: number; lng: number } }
  | { status: 'denied' }
  | { status: 'error'; message: string };

function formatDistance(m: number | undefined): string | null {
  if (m === undefined) return null;
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
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
  const [locate, setLocate] = useState<Locate>({ status: 'idle' });
  const [nearbyResult, setNearbyResult] = useState<Fetched>({ status: 'idle' });
  const requestSeq = useRef(0);
  const userPos = locate.status === 'ok' ? locate.pos : null;
  /** Autocomplete のセッショントークン（開いたときに作り、店を選ぶか閉じるまで使う） */
  const sessionRef = useRef<string | null>(null);
  /** 予測を選んで座標を取っている行と、失敗した行 */
  const [picking, setPicking] = useState<{ id: string; error?: string } | null>(null);

  // 開閉をネイティブ dialog に同期し、開いたら検索欄にフォーカス
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      sessionRef.current = crypto.randomUUID();
      setPicking(null);
      d.showModal();
      // showModal 直後は dialog 自身にフォーカスが移るので、次のフレームで入力欄へ
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    if (!open && d.open) d.close();
    if (!open) sessionRef.current = null;
  }, [open]);

  async function runNearby() {
    if (!candidates) return;
    setLocate({ status: 'locating' });
    let pos: { lat: number; lng: number };
    try {
      const cur = await getCurrentPosition({ timeoutMs: 8000 });
      pos = { lat: cur.lat, lng: cur.lng };
      setLocate({ status: 'ok', pos });
    } catch (e) {
      setLocate(
        e instanceof PlatformGeolocationError && e.kind === 'permission-denied'
          ? { status: 'denied' }
          : { status: 'error', message: errorMessage(e, '現在地を取得できませんでした') },
      );
      return;
    }
    setNearbyResult({ status: 'loading' });
    try {
      setNearbyResult({ status: 'ok', items: await candidates.nearby(pos) });
    } catch (e) {
      setNearbyResult({ status: 'error', message: errorMessage(e, '近くの店を取得できませんでした') });
    }
  }

  // 開いたら 1 回だけ現在地を取りに行き、周辺の店を読み込む（閉じても保持し、開き直しでは引き直さない）
  const autoLocated = useRef(false);
  useEffect(() => {
    if (!open || !candidates || autoLocated.current) return;
    autoLocated.current = true;
    void runNearby();
    // runNearby は毎回作り直されるが、開いた最初の 1 回だけ呼べばよい
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, candidates]);

  // 手がかり（カードのロースター名）は開いたときに 1 回だけ引く。同じ語なら引き直さない
  const search = candidates?.search;
  const hintQuery = hint?.query.trim() ?? '';
  useEffect(() => {
    if (!open || !search || hintQuery.length < SHOP_PICKER_MIN_QUERY || hintQueryRef.current === hintQuery)
      return;
    hintQueryRef.current = hintQuery;
    const seq = ++hintSeq.current;
    setHintResult({ status: 'loading' });
    search(hintQuery, userPos ?? undefined, sessionRef.current ?? undefined)
      .then((items) => seq === hintSeq.current && setHintResult({ status: 'ok', items }))
      .catch(
        (e: unknown) =>
          seq === hintSeq.current &&
          setHintResult({ status: 'error', message: errorMessage(e, '候補を取得できませんでした') }),
      );
  }, [open, search, hintQuery, userPos]);

  // 入力した語で店名検索（デバウンス、古い応答は捨てる）。現在地が後から分かったら近い順で引き直す
  useEffect(() => {
    const q = query.trim();
    if (!open || !search || q.length < SHOP_PICKER_MIN_QUERY) {
      setSearchResult({ status: 'idle' });
      return;
    }
    const seq = ++requestSeq.current;
    setSearchResult({ status: 'loading' });
    const timer = setTimeout(() => {
      search(q, userPos ?? undefined, sessionRef.current ?? undefined)
        .then((items) => seq === requestSeq.current && setSearchResult({ status: 'ok', items }))
        .catch(
          (e: unknown) =>
            seq === requestSeq.current &&
            setSearchResult({ status: 'error', message: errorMessage(e, '候補を取得できませんでした') }),
        );
    }, SHOP_PICKER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, search, query, userPos]);

  const q = query.trim();
  const nearbyAll = useMemo(() => (nearbyResult.status === 'ok' ? nearbyResult.items : []), [nearbyResult]);
  const nearbyItems = nearbyAll as ShopCandidate[];
  /** 登録済みの店と同じ ID の候補は出さない（登録済みの方を出す） */
  const registeredIds = useMemo(
    () => new Set(registered.map((r) => r.externalPlaceId).filter((v): v is string => !!v)),
    [registered],
  );
  const notRegistered = (items: ShopSearchItem[]) =>
    items.filter((i) => !i.externalPlaceId || !registeredIds.has(i.externalPlaceId));
  /** 検索語ありの一覧。Google の予測が返っていればその順のまま。OSM なら周辺の店のあいまい照合 → 店名検索の結果（重複は除く） */
  const found = useMemo((): ShopSearchItem[] => {
    if (!q) return [];
    const remote = searchResult.status === 'ok' ? searchResult.items : [];
    if (remote.some(isSuggestion)) return notRegistered(remote);
    const local = rankCandidates(q, nearbyItems).slice(0, LOCAL_MATCH_SHOWN);
    return notRegistered(mergeCandidates(local, remote as ShopCandidate[]));
    // notRegistered は registeredIds だけに依存する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, nearbyItems, searchResult, registeredIds]);
  const registeredRows = registered.filter((s) => matchScore(q, [s.name], s.address) > 0);
  const showHint = !!hint && q === '' && hintResult.status !== 'idle';
  const hintItems = hintResult.status === 'ok' ? notRegistered(hintResult.items) : [];
  const nearbyShown = notRegistered(nearbyAll).slice(0, NEARBY_SHOWN);
  const googleMode =
    found.some(isGoogleItem) ||
    nearbyShown.some(isGoogleItem) ||
    hintItems.some(isGoogleItem) ||
    (searchResult.status === 'ok' && searchResult.items.some(isGoogleItem));

  /** 候補を選ぶ。予測（座標なし）は details で座標・正式な名前・住所を取ってから渡す */
  async function pick(item: ShopSearchItem) {
    if (!isSuggestion(item)) return onPickCandidate(item);
    const placeId = item.externalPlaceId;
    if (!candidates?.details) return;
    setPicking({ id: placeId });
    try {
      const d = await candidates.details(placeId, sessionRef.current ?? undefined);
      if (!d) throw new Error('not found');
      sessionRef.current = null; // details でセッションが閉じる
      setPicking(null);
      onPickCandidate({ ...d, placeProvider: 'google' });
    } catch {
      setPicking({ id: placeId, error: '位置を取得できませんでした。もう一度選んでください' });
    }
  }

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
              className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none [&::-webkit-search-cancel-button]:appearance-none"
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
                result={hintResult.status === 'ok' ? { status: 'ok', items: hintItems } : hintResult}
                emptyText="地図上に見つかりませんでした。下の検索欄で探すか、自分で登録できます"
                onPick={pick}
                picking={picking}
              />
            </Section>
          )}

          {candidates && <LocateStatus locate={locate} onRetry={() => void runNearby()} />}

          {candidates && q === '' && nearbyResult.status !== 'idle' && (
            <Section title="近くの店" note="現在地から 2 km 以内のカフェ・コーヒー店を近い順に">
              <CandidateList
                result={nearbyResult.status === 'ok' ? { status: 'ok', items: nearbyShown } : nearbyResult}
                emptyText="近くにカフェ・コーヒー店が見つかりませんでした。店名で検索するか、自分で登録できます"
                onPick={pick}
                picking={picking}
              />
            </Section>
          )}

          {candidates && q !== '' && (
            <Section
              title="見つかった店"
              note={
                googleMode
                  ? userPos
                    ? '近くの店から先に出ます'
                    : '位置情報を許可すると近くの店が先に出ます'
                  : userPos
                    ? '近くの店から先に。OpenStreetMap の登録から探します'
                    : 'OpenStreetMap の登録から探します。位置情報を許可すると近くの店が先に出ます'
              }
            >
              {found.length > 0 && (
                <CandidateList
                  result={{ status: 'ok', items: found }}
                  emptyText=""
                  onPick={pick}
                  picking={picking}
                />
              )}
              {searchResult.status === 'loading' ? (
                <p className="text-muted-foreground py-3 text-xs" role="status">
                  {found.length > 0 ? 'ほかの店も探しています…' : '候補を探しています…'}
                </p>
              ) : searchResult.status === 'error' ? (
                <p role="alert" className="text-destructive py-3 text-xs">
                  {found.length > 0
                    ? `遠くの店は探せませんでした（${searchResult.message}）`
                    : searchResult.message}
                </p>
              ) : (
                found.length === 0 &&
                (q.length >= SHOP_PICKER_MIN_QUERY || nearbyAll.length > 0) && (
                  <p className="text-muted-foreground py-3 text-xs">
                    見つかりませんでした。別の書き方（英字・カタカナ）で探すか、下の「自分で登録する」から登録できます
                  </p>
                )
              )}
            </Section>
          )}
          {googleMode && <GoogleAttribution />}
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
                地図で見つからないときに。店名と住所を入れると登録できます（住所から地図の位置を付けます）
              </span>
            </span>
            <ChevronRight className="text-muted-foreground size-[18px] shrink-0" aria-hidden />
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** 現在地の取得状態。許可されていない・取れないときは理由と、もう一度試すボタン */
function LocateStatus({ locate, onRetry }: { locate: Locate; onRetry: () => void }) {
  if (locate.status === 'ok') return null;
  if (locate.status === 'locating') {
    return (
      <p
        className="text-muted-foreground border-border flex h-11 items-center gap-2 border-b text-xs"
        role="status"
      >
        <LocateFixed className="size-4" aria-hidden />
        現在地を確かめています…
      </p>
    );
  }
  const message =
    locate.status === 'denied'
      ? '位置情報が許可されていないため、近くの店を出せません。端末やブラウザの設定で許可すると、近い店から順に出ます。'
      : locate.status === 'error'
        ? `現在地を取得できませんでした（${locate.message}）。店名で検索できます。`
        : null;
  return (
    <div className="border-border border-b py-2">
      {message && <p className="text-muted-foreground text-xs">{message}</p>}
      <button
        type="button"
        onClick={onRetry}
        className="text-primary flex h-11 items-center gap-2 text-[13px] font-medium"
      >
        <LocateFixed className="size-4" aria-hidden />
        {locate.status === 'idle' ? '現在地から探す' : 'もう一度、現在地から探す'}
      </button>
    </div>
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
  picking,
}: {
  result: Fetched;
  emptyText: string;
  onPick: (c: ShopSearchItem) => void;
  /** 予測を選んで座標を取っている行（スピナー）と、失敗した行（再試行の文言） */
  picking: { id: string; error?: string } | null;
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
            aria-busy={picking?.id === c.externalPlaceId && !picking.error}
            disabled={!!picking && !picking.error && picking.id === c.externalPlaceId}
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
              {picking?.id === c.externalPlaceId &&
                (picking.error ? (
                  <span role="alert" className="text-destructive block text-[11px]">
                    {picking.error}
                  </span>
                ) : (
                  <span role="status" className="text-muted-foreground block text-[11px]">
                    位置を取得しています…
                  </span>
                ))}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
