'use client';

import { useState, type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { Coffee, List, PencilLine, Store } from 'lucide-react';
import { AppButton } from '@/components/app-button';
import { BeanSpecGrid } from '@/components/beans/bean-spec-grid';
import { CardImage } from '@/components/beans/card-image';
import { EMPTY_TASTE, TasteDots, type TasteValues } from '@/components/beans/taste-dots';
import { TasteRadar } from '@/components/beans/taste-radar';
import { DateGroup } from '@/components/date-group';
import { EmptyState } from '@/components/empty-state';
import { ErrorCallout } from '@/components/error-callout';
import { FilterChips } from '@/components/filter-chips';
import { Field, Select, TextInput, Textarea } from '@/components/form/field';
import { EntryOption } from '@/components/logs/entry-option';
import { LogListItem } from '@/components/logs/log-list-item';
import { LogListSkeleton } from '@/components/logs/log-list-item-skeleton';
import { OcrField } from '@/components/logs/ocr-field';
import { PlaceSegment } from '@/components/logs/place-segment';
import { RatingStars } from '@/components/logs/rating-stars';
import { Row } from '@/components/row';
import { SettingRow, SettingSection } from '@/components/settings/setting-row';
import { ShopList } from '@/components/shops/shop-list';
import { PHASE1_STEPS, WIZARD_STEPS, WizardStepper } from '@/components/wizard-stepper';
import type { LogPlace } from '@/lib/schemas/log';
import { routes } from '@/lib/routes';

// 開発用の部品ページ（Issue #15、DESIGN.md §7-4）。Storybook の代わりに全部品をサンプル値で並べる。
// 本番ビルドでは 404。認証ガードの内側（(app) 配下）。URL: /dev/components
// フォルダ名を `_dev` にすると App Router がルートにしないので `dev` にしている。

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="border-border border-t py-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {note && <p className="text-muted-foreground mt-0.5 mb-3 text-xs">{note}</p>}
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground font-num text-[11px]">{children}</p>;
}

const TASTE: TasteValues = { flavor: 5, sweetness: 3, acidity: 5, aftertaste: 3, body: 3 };
const TASTE_AVG: TasteValues = { flavor: 4.4, sweetness: 3.2, acidity: 4.1, aftertaste: 3.4, body: 3.0 };

export default function DevComponentsPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <DevComponents />;
}

function DevComponents() {
  const [rating, setRating] = useState<number | null>(4.5);
  const [taste, setTaste] = useState<TasteValues>(TASTE);
  const [chip, setChip] = useState('all');
  const [place, setPlace] = useState<LogPlace>('shop');

  return (
    <div className="pb-6">
      <h1 className="pt-2 text-2xl font-bold">部品ページ</h1>
      <p className="text-muted-foreground mb-2 text-xs">
        開発用。本番では 404。DESIGN.md §4 の部品をサンプル値で並べている。
      </p>

      <Section title="ボタン" note="画面に主ボタンは 1 つ。破壊は必ず確認を挟む">
        <AppButton>保存する（primary lg 52px）</AppButton>
        <AppButton variant="secondary">前回のレシピを複製（secondary）</AppButton>
        <AppButton variant="ghost">手入力に切り替える（ghost）</AppButton>
        <AppButton variant="destructive">この記録を削除（destructive）</AppButton>
        <AppButton variant="white">Google で続ける（white）</AppButton>
        <div className="flex flex-wrap gap-2">
          <AppButton size="md" width="auto">
            md 44px
          </AppButton>
          <AppButton size="sm" width="auto" variant="secondary">
            sm 36px
          </AppButton>
          <AppButton width="auto" loading>
            保存中
          </AppButton>
          <AppButton width="auto" href={routes.home}>
            リンク
          </AppButton>
        </div>
      </Section>

      <Section title="入力欄" note="Field + TextInput / Textarea / Select。エラーは role=alert">
        <Field label="豆名" htmlFor="dev-name" hint="カードの表記のまま">
          <TextInput id="dev-name" placeholder="Lusitania Lime Geisha" />
        </Field>
        <Field label="標高" htmlFor="dev-alt" error="整数で入力してください">
          <TextInput id="dev-alt" type="number" defaultValue="16.5" aria-invalid />
        </Field>
        <Field label="種別" htmlFor="dev-kind">
          <Select id="dev-kind" defaultValue="cafe">
            <option value="cafe">カフェ</option>
            <option value="roaster">ロースター</option>
          </Select>
        </Field>
        <Field label="メモ" htmlFor="dev-memo">
          <Textarea id="dev-memo" placeholder="味の感想" />
        </Field>
      </Section>

      <Section title="チップ・セグメント・ステッパー">
        <FilterChips
          chips={[
            { value: 'all', label: 'すべて' },
            { value: 'rating4', label: '星 4 以上' },
            { value: 'home', label: '自宅' },
            { value: 'Colombia', label: 'Colombia' },
            { value: 'Natural', label: 'Natural' },
          ]}
          value={chip}
          onChange={setChip}
          onOpenFilter={() => {}}
        />
        <PlaceSegment value={place} onChange={setPlace} />
        <WizardStepper current={2} steps={PHASE1_STEPS} />
        <WizardStepper current={2} steps={WIZARD_STEPS} />
      </Section>

      <Section title="星評価" note="左半分で .5、右半分で .0。矢印キーで 0.5 ずつ">
        <Label>sm / md / lg（表示）</Label>
        <RatingStars value={4.5} size="sm" />
        <RatingStars value={4.5} size="md" />
        <RatingStars value={3} size="lg" />
        <Label>入力（lg）</Label>
        <RatingStars value={rating} size="lg" onChange={setRating} />
        <Label>未入力</Label>
        <RatingStars value={null} size="md" />
      </Section>

      <Section title="味覚チャート" note="タップで入力、同じ値をもう一度で未入力">
        <Label>表示</Label>
        <TasteDots value={TASTE} />
        <Label>入力</Label>
        <TasteDots value={taste} onChange={setTaste} />
        <Label>レーダー（単体 / compare）</Label>
        <div className="grid grid-cols-2 gap-4">
          <TasteRadar value={taste} />
          <TasteRadar
            value={TASTE_AVG}
            compare={{ ...EMPTY_TASTE, flavor: 3, sweetness: 3, acidity: 3, aftertaste: 3, body: 3 }}
          />
        </div>
        <TasteRadar value={{ ...EMPTY_TASTE, flavor: 4 }} className="max-w-[160px]" />
      </Section>

      <Section title="要確認フィールド（OCR）" note="しきい値未満は琥珀。編集すると解除">
        <OcrField label="標高" htmlFor="dev-ocr-low" confidence={0.3}>
          <TextInput id="dev-ocr-low" defaultValue="1650" />
        </OcrField>
        <OcrField label="生産国" htmlFor="dev-ocr-high" confidence={0.95}>
          <TextInput id="dev-ocr-high" defaultValue="Colombia" />
        </OcrField>
        <OcrField label="価格" htmlFor="dev-ocr-err" confidence={0.5} error="整数で入力してください">
          <TextInput id="dev-ocr-err" defaultValue="3,800" aria-invalid />
        </OcrField>
      </Section>

      <Section title="状態" note="読み込み・空・失敗（+ 成功トースト）">
        <LogListSkeleton count={2} />
        <EmptyState
          title="まだ記録がありません"
          description="最初の一杯を残しましょう。"
          action={
            <AppButton width="auto" href={routes.newLog}>
              最初の記録を追加
            </AppButton>
          }
        />
        <EmptyState
          icon={Store}
          title="店はまだありません"
          description="記録を作るときに店を選ぶと増えます。"
        />
        <ErrorCallout
          title="記録を読み込めませんでした"
          what="サーバーに接続できませんでした。"
          next="通信状態を確認して、もう一度読み込んでください。"
          onRetry={() => {}}
        />
      </Section>

      <Section title="カード画像" note="sm 62px / md 104px / full。画像が無ければ印刷物風">
        <div className="flex items-end gap-4">
          <CardImage
            beanName="Lusitania Lime Geisha"
            roasterName="KIELO COFFEE"
            country="Colombia"
            size="sm"
          />
          <CardImage
            beanName="Lusitania Lime Geisha"
            roasterName="KIELO COFFEE"
            country="Colombia"
            size="md"
          />
          <div className="w-[140px]">
            <CardImage
              beanName="Ethiopia Guji Anaerobic"
              roasterName="Nagare Roastery"
              country="Ethiopia"
              size="full"
            />
          </div>
        </div>
      </Section>

      <Section title="ログ行・日付見出し">
        <DateGroup date="2026-09-21" now={new Date('2026-09-21T12:00:00')}>
          <LogListItem
            id="dev-1"
            beanName="Lusitania Lime Geisha"
            roasterName="KIELO COFFEE"
            country="Colombia"
            rating={4.5}
            place="shop"
            shopName="KIELO COFFEE 蔵前"
            detail="ハンドドリップ"
            flavorNotes={['Lime', 'Bergamot', 'Laurier', 'Jasmine']}
          />
          <LogListItem
            id="dev-2"
            beanName="Ethiopia Guji Anaerobic Natural Lot 12 Extra Long Name"
            roasterName="Nagare Roastery"
            country="Ethiopia"
            rating={4}
            place="home"
            detail="V60 · 1:15 · 92 ℃"
            flavorNotes={['Blueberry', 'Cacao']}
          />
        </DateGroup>
      </Section>

      <Section title="リスト行・データグリッド">
        <Row
          initial="K"
          title="KIELO COFFEE 蔵前"
          subtitle="カフェ · 台東区蔵前 · 3 回"
          value="4.5"
          valueSub="3 回"
          href={routes.shops}
        />
        <Row initial="LG" title="Lusitania Lime Geisha" subtitle="KIELO COFFEE · 2 回" onClick={() => {}} />
        <Row initial="W" title="生豆本舗ワイルド" subtitle="生豆販売店 · 通販" />
        <BeanSpecGrid
          items={[
            { label: '生産国', value: 'Colombia' },
            { label: '地域', value: 'Caicedonia, Valle del Cauca' },
            { label: '品種', value: 'Geisha' },
            { label: '精製', value: 'Lime infused' },
            { label: '標高', value: '1,650', unit: 'm' },
            { label: '価格', value: '¥3,800 / 100 g' },
            { label: '空の項目', value: null },
          ]}
        />
      </Section>

      <Section title="入口の選択肢・設定の行">
        <EntryOption
          icon={PencilLine}
          title="手で入力する"
          description="カードが無い豆、量り売り、もらい物"
          primary
          onClick={() => {}}
        />
        <EntryOption
          icon={List}
          title="登録済みの豆から"
          description="同じ豆をもう一度飲んだとき"
          onClick={() => {}}
        />
        <EntryOption icon={Coffee} title="無効" description="disabled" disabled onClick={() => {}} />
        <SettingSection title="表示">
          <SettingRow label="今日の読み取り回数" value="3 / 50 回" note="毎日 0 時にリセット" />
          <SettingRow label="ログアウト" onClick={() => {}} />
          <SettingRow label="CSV でダウンロード" disabled />
        </SettingSection>
      </Section>

      <Section title="店一覧">
        <ShopList
          rows={[
            {
              id: 'a',
              name: 'KIELO COFFEE 蔵前',
              kindLabel: 'カフェ',
              area: '台東区蔵前',
              hasCoordinates: true,
              count: 3,
              avgRating: 4.5,
            },
            {
              id: 'b',
              name: '生豆本舗ワイルド',
              kindLabel: '生豆販売店',
              area: null,
              hasCoordinates: false,
              count: 0,
              avgRating: null,
            },
          ]}
          isPending={false}
          error={null}
          newHref={routes.shops}
        />
      </Section>
    </div>
  );
}
