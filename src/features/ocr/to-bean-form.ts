import type { BeanCardExtraction } from '@/lib/schemas/bean-card';
import type { BeanFormInput } from '@/lib/schemas/bean';
import { countryDisplayName, varietyDisplayName } from '@/lib/vocab';

// OCR の抽出結果を豆フォームの defaultValues と、項目ごとの信頼度に写す純粋関数（F-OCR-2 / F-OCR-5）。
// フォームへは初期値として流すだけで、確定は必ずユーザー操作（CLAUDE.md §5.3）。

/** 豆フォームの項目名（roaster_name は BeanForm 側の拡張項目） */
export type BeanFormFieldName = keyof Omit<BeanFormInput, 'roaster_id'> | 'roaster_name';

export type BeanFormPrefill = {
  values: Partial<Omit<BeanFormInput, 'roaster_id'>> & { roaster_name?: string };
  /** 項目ごとの信頼度 0〜1。値が入った項目だけ持つ */
  confidence: Partial<Record<BeanFormFieldName, number>>;
};

export function extractionToBeanForm(e: BeanCardExtraction): BeanFormPrefill {
  const values: BeanFormPrefill['values'] = {};
  const confidence: BeanFormPrefill['confidence'] = {};

  const put = <K extends BeanFormFieldName>(key: K, value: unknown, conf: number) => {
    if (value === null || value === undefined) return;
    (values as Record<string, unknown>)[key] = value;
    confidence[key] = conf;
  };

  put('name', e.name.value, e.name.confidence);
  put('roaster_name', e.roaster.value, e.roaster.confidence);
  // 生産国と品種はカードの英語のままではなく、語彙にあれば日本語の呼び名で見せる（Colombia → コロンビア）
  put('country', countryDisplayName(e.country.value), e.country.confidence);
  put('region', e.region.value, e.region.confidence);
  put('farm', e.farm.value, e.farm.confidence);
  put('harvest_year', e.harvestYear.value, e.harvestYear.confidence);
  put('variety', varietyDisplayName(e.variety.value), e.variety.confidence);
  put('process', e.process.value, e.process.confidence);
  put('altitude_m', e.altitudeM.value, e.altitudeM.confidence);
  if (e.flavorNotes.value && e.flavorNotes.value.length > 0) {
    put('flavor_notes', e.flavorNotes.value, e.flavorNotes.confidence);
  }
  put('description', e.description.value, e.description.confidence);
  if (e.taste.value) {
    const t = e.taste.value;
    put('taste_flavor', t.flavor, e.taste.confidence);
    put('taste_sweetness', t.sweetness, e.taste.confidence);
    put('taste_acidity', t.acidity, e.taste.confidence);
    put('taste_aftertaste', t.aftertaste, e.taste.confidence);
    put('taste_body', t.body, e.taste.confidence);
  }
  put('price_jpy', e.priceJpy.value, e.priceJpy.confidence);
  put('price_grams', e.priceGrams.value, e.priceGrams.confidence);
  put('roast_level', e.roastLevel.value, e.roastLevel.confidence);
  put('reference_url', e.referenceUrl.value, e.referenceUrl.confidence);

  return { values, confidence };
}
