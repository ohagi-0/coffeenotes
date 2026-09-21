import type { SpecItem } from '@/components/beans/bean-spec-grid';
import type { TasteValues } from '@/components/beans/taste-dots';
import type { Tables } from '@/types/database';

// 豆の行を表示用に変換する純関数（S4 豆詳細、S5 の豆サマリ）。

type BeanLike = Pick<
  Tables<'beans'>,
  | 'country'
  | 'region'
  | 'variety'
  | 'process'
  | 'altitude_m'
  | 'price_jpy'
  | 'price_grams'
  | 'roast_level'
  | 'roasted_on'
  | 'taste_flavor'
  | 'taste_sweetness'
  | 'taste_acidity'
  | 'taste_aftertaste'
  | 'taste_body'
>;

const ROAST_LABELS: Record<string, string> = { light: '浅煎り', medium: '中煎り', dark: '深煎り' };
const SOURCE_LABELS: Record<string, string> = { purchased: '購入', home_roasted: '自家焙煎' };

export function formatPrice(priceJpy: number | null, priceGrams: number | null): string | null {
  if (priceJpy === null) return null;
  const yen = `¥${priceJpy.toLocaleString('ja-JP')}`;
  return priceGrams ? `${yen} / ${priceGrams} g` : yen;
}

export function roastLevelLabel(v: string | null): string | null {
  return v ? (ROAST_LABELS[v] ?? v) : null;
}

export function sourceLabel(v: string): string {
  return SOURCE_LABELS[v] ?? v;
}

/** データグリッド（生産国 / 地域 / 品種 / 精製 / 標高 / 価格 / 焙煎度）。null の項目はグリッド側が省く */
export function beanSpecItems(bean: BeanLike): SpecItem[] {
  return [
    { label: '生産国', value: bean.country },
    { label: '地域', value: bean.region },
    { label: '品種', value: bean.variety },
    { label: '精製', value: bean.process },
    {
      label: '標高',
      value: bean.altitude_m !== null ? bean.altitude_m.toLocaleString('ja-JP') : null,
      unit: 'm',
    },
    { label: '価格', value: formatPrice(bean.price_jpy, bean.price_grams) },
    { label: '焙煎度', value: roastLevelLabel(bean.roast_level), ja: true },
    { label: '焙煎日', value: bean.roasted_on },
  ];
}

export function beanTaste(bean: BeanLike): TasteValues {
  return {
    flavor: bean.taste_flavor,
    sweetness: bean.taste_sweetness,
    acidity: bean.taste_acidity,
    aftertaste: bean.taste_aftertaste,
    body: bean.taste_body,
  };
}

export function hasAnyTaste(t: TasteValues): boolean {
  return Object.values(t).some((v) => v !== null);
}
