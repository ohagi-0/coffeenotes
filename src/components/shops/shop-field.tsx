'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronRight, Store, X } from 'lucide-react';
import { TextInput } from '@/components/form/field';
import type { ShopCandidate } from '@/components/shops/shop-candidate-tools';
import { ShopPicker, type ShopPickerHint, type ShopPickerOption } from '@/components/shops/shop-picker';
import type { ShopCandidateSources } from '@/features/geo/search';
import type { PickedShop } from '@/features/shops/find-or-create-shop';
import { cn } from '@/lib/utils';

// 「飲んだ店」の入力欄（F-SHOP-2/3/4/6）。記録作成③・記録の編集・豆の編集の「飲んだ店」で同じものを使う（2026-10-19）。
// - 未選択: 「店を選ぶ」を押すと全画面の検索シート（ShopPicker）
// - 選択済み: 押すと選び直し、× で外す（未設定に戻す）
// - 「手動で登録する」: 店名 + 住所の手入力。決定時に住所から位置を引く（F-SHOP-6。ピン刺しはスマホでは使わない）
// 値は親が持つ（制御コンポーネント）。保存時の店の作成は features/shops/find-or-create-shop.ts。

export type ShopFieldProps = {
  /** 選んだ店。null は未設定 */
  value: PickedShop | null;
  onChange: (value: PickedShop | null) => void;
  /** 登録済みの店 */
  shopOptions?: ShopPickerOption[];
  shopOptionsPending?: boolean;
  /** 検索語が変わったとき（親が登録済みの店をサーバーで絞るとき用） */
  onShopSearch?: (query: string) => void;
  /** 地図上の候補の取り方。渡さなければ登録済みと手入力だけ */
  candidates?: ShopCandidateSources;
  /** 検索シートの上に出す手がかり（カードのロースター名など） */
  hint?: ShopPickerHint | null;
  /** この値が変わるたびに検索シートを開く（「店で」を押したときなど、外から開く用） */
  openSignal?: number;
  /** 見出し。省略すると出さない */
  label?: string;
  /** 欄の下の注記 */
  note?: string;
  className?: string;
};

export function ShopField({
  value,
  onChange,
  shopOptions = [],
  shopOptionsPending,
  onShopSearch,
  candidates,
  hint,
  openSignal,
  label,
  note,
  className,
}: ShopFieldProps) {
  const uid = useId();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  /** 「手動で登録する」で店名・住所を入力している間 true */
  const [manual, setManual] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [manualNote, setManualNote] = useState<string | null>(null);

  function openPicker() {
    setPickerQuery('');
    onShopSearch?.('');
    setManual(false);
    setPickerOpen(true);
  }

  // 外から開く（初回の描画では開かない）
  const lastSignal = useRef(openSignal);
  useEffect(() => {
    if (openSignal === undefined || openSignal === lastSignal.current) return;
    lastSignal.current = openSignal;
    openPicker();
    // openPicker は毎回作り直されるが、signal が変わったときだけ呼べばよい
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  function setQuery(q: string) {
    setPickerQuery(q);
    onShopSearch?.(q);
  }
  function pickShop(s: ShopPickerOption) {
    onChange({ id: s.id, name: s.name, address: s.address ?? null });
    setManual(false);
    setManualNote(null);
    setPickerOpen(false);
  }
  function pickCandidate(c: ShopCandidate) {
    onChange({
      id: null,
      name: c.name,
      address: c.address,
      lat: c.lat,
      lng: c.lng,
      externalPlaceId: c.externalPlaceId,
      placeProvider: c.placeProvider ?? null,
    });
    setManual(false);
    setManualNote(null);
    setPickerOpen(false);
  }
  function registerManually(name: string) {
    onChange({ id: null, name, address: null });
    setManualAddress('');
    setManualNote(null);
    setPickerOpen(false);
    setManual(true);
  }
  function setManualName(name: string) {
    onChange({ id: null, name, address: manualAddress.trim() || null });
  }
  /** 店名 + 住所で決定。住所があれば位置を引く。引けなくても保存はできる（あとから店の編集で直せる） */
  async function confirmManual() {
    const name = value?.name ?? '';
    const address = manualAddress.trim() || null;
    let picked: PickedShop = { id: null, name, address, lat: null, lng: null, externalPlaceId: null };
    if (address && candidates) {
      setManualBusy(true);
      try {
        const hit = (await candidates.geocode(address))[0];
        if (hit) picked = { ...picked, lat: hit.lat, lng: hit.lng };
        setManualNote(
          hit
            ? null
            : '住所から位置を見つけられませんでした。このまま保存して、あとから店の編集で付けられます',
        );
      } catch {
        setManualNote('位置を調べられませんでした。このまま保存して、あとから店の編集で付けられます');
      } finally {
        setManualBusy(false);
      }
    }
    onChange(picked);
    setManual(false);
  }
  function clear() {
    onChange(null);
    setManual(false);
    setManualNote(null);
  }

  const name = value?.name ?? '';
  const selected = !!value && (!!value.id || (!manual && name.trim() !== ''));
  const registeredInfo = value?.id ? shopOptions.find((o) => o.id === value.id) : undefined;
  const description = !value
    ? ''
    : value.id
      ? registeredInfo?.lastVisit
        ? // 前回の一杯と回数（F-SHOP-8）。記録の途中で「前回これ飲んだな」が見える
          `${registeredInfo.lastVisit} · ${registeredInfo.visitCount} 回`
        : value.address
          ? `登録済みの店 · ${value.address}`
          : '登録済みの店'
      : value.placeProvider === 'google'
        ? `Google マップの店として登録します${value.address ? `（${value.address}）` : ''}`
        : value.lat != null
          ? `新しい店として登録します（地図に出ます${value.address ? ` · ${value.address}` : ''}）`
          : value.address
            ? `新しい店として登録します（${value.address}）`
            : '新しい店として登録します';

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && <span className="text-muted-foreground text-[11px]">{label}</span>}
      {selected ? (
        <div className="border-primary bg-card flex items-center rounded-[14px] border">
          <button
            type="button"
            onClick={openPicker}
            aria-label={`店「${name}」を選び直す`}
            className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3.5 text-left"
          >
            <span className="bg-secondary text-primary font-num grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold">
              {name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{name}</span>
              <span className="text-muted-foreground block truncate text-xs">{description}</span>
            </span>
            <ChevronRight className="text-muted-foreground size-[18px] shrink-0" aria-hidden />
          </button>
          <button
            type="button"
            onClick={clear}
            aria-label="店を外す"
            className="text-muted-foreground hover:text-foreground grid size-11 shrink-0 place-items-center rounded-full"
          >
            <X className="size-[18px]" aria-hidden />
          </button>
        </div>
      ) : manual ? (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Store
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2"
              aria-hidden
            />
            <TextInput
              id={`${uid}-shop`}
              placeholder="店名を入力"
              autoComplete="off"
              autoFocus
              maxLength={120}
              className="pl-10"
              aria-label="店"
              value={name}
              onChange={(e) => setManualName(e.target.value)}
            />
          </div>
          <TextInput
            id={`${uid}-shop-address`}
            placeholder="住所（例: 東京都台東区蔵前 3-1-2）"
            autoComplete="off"
            maxLength={300}
            aria-label="店の住所"
            value={manualAddress}
            onChange={(e) => {
              setManualAddress(e.target.value);
              onChange({ id: null, name, address: e.target.value.trim() || null });
            }}
          />
          <p className="text-muted-foreground text-[11px]">
            住所を入れると地図に出ます。店名だけでも登録できます
          </p>
          <div className="flex items-center justify-between">
            <button type="button" onClick={openPicker} className="text-primary h-11 text-[12px] font-medium">
              検索に戻る
            </button>
            <button
              type="button"
              onClick={() => void confirmManual()}
              disabled={!name.trim() || manualBusy}
              className="text-primary h-11 text-[12px] font-bold disabled:opacity-50"
            >
              {manualBusy ? '位置を調べています…' : 'この内容で決定'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          className="border-border bg-card flex items-center gap-3 rounded-[14px] border px-3.5 py-3 text-left"
        >
          <span className="bg-secondary text-muted-foreground grid size-10 shrink-0 place-items-center rounded-full">
            <Store className="size-[18px]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">店を選ぶ</span>
            <span className="text-muted-foreground block text-xs">近くの店や店名から探せます</span>
          </span>
          <ChevronRight className="text-muted-foreground size-[18px]" aria-hidden />
        </button>
      )}
      {manualNote && !manual && (
        <p role="status" className="text-muted-foreground text-xs">
          {manualNote}
        </p>
      )}
      {note && <p className="text-muted-foreground text-xs">{note}</p>}
      <ShopPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        query={pickerQuery}
        onQueryChange={setQuery}
        registered={shopOptions}
        registeredPending={shopOptionsPending}
        candidates={candidates}
        hint={hint}
        onPickShop={pickShop}
        onPickCandidate={pickCandidate}
        onRegisterManually={registerManually}
      />
    </div>
  );
}
