import type { LogFormInput } from '@/lib/schemas/log';
import type { RoasterFormInput } from '@/lib/schemas/roaster';
import type { RoastFormValues } from '@/lib/schemas/roast';
import type { ShopFormInput } from '@/lib/schemas/shop';
import type { Json } from '@/types/database';
import type { CreateBeanInput } from '@/features/beans/mutations';
import type { DraftImages, NewLogDraft } from './new-log-draft';

// 記録作成ウィザードの「保存する」（S3 ③）。豆・ロースター・（画像）・店・記録をこの順に作る。
// フックから切り離し、mutation 関数を外から渡す形にして偽物で単体テストできるようにする。

export type NewLogShop = {
  id: string | null;
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  externalPlaceId?: string | null;
};

export type LogFormDraft = {
  fields: Omit<LogFormInput, 'bean_id' | 'shop_id'>;
  /** 店で飲んだとき。既存（id あり）か新規（名前 + 候補や地図で決めた座標）か、選ばなかった（null） */
  shop: NewLogShop | null;
  /** 自家焙煎の豆で、この記録と一緒に新しい焙煎バッチを登録するとき（F-ROAST-1〜7） */
  newRoast?: RoastFormValues | null;
};

/** 進捗の段階（UI の「〜しています」表示用） */
export type SaveNewLogStage = 'bean' | 'images' | 'shop' | 'roast' | 'log';

export type SaveNewLogDeps = {
  createRoaster: (input: RoasterFormInput) => Promise<{ id: string }>;
  createBean: (input: CreateBeanInput) => Promise<{ id: string }>;
  createShop: (input: ShopFormInput) => Promise<{ id: string }>;
  createLog: (input: LogFormInput) => Promise<{ id: string }>;
  createRoast?: (input: RoastFormValues & { bean_id: string }) => Promise<{ id: string }>;
  /** カード画像の保存（F-BEAN-12）。渡さなければ画像は保存しない */
  saveBeanImages?: (beanId: string, images: DraftImages) => Promise<void>;
  /** 段階が進むたびに呼ぶ（任意） */
  onProgress?: (stage: SaveNewLogStage) => void;
};

export type SaveNewLogResult = {
  beanId: string;
  logId: string;
  shopId: string | null;
  /** 画像だけ保存できなかったとき（豆と記録は保存済み）。UI は注意を出す */
  imageError?: string;
};

export async function saveNewLog(
  draft: NewLogDraft,
  log: LogFormDraft,
  deps: SaveNewLogDeps,
): Promise<SaveNewLogResult> {
  const progress = deps.onProgress ?? (() => {});
  // 1. 豆（新規なら、先にロースターを解決する）
  let beanId: string;
  let imageError: string | undefined;
  /** 画像のアップロードは店・焙煎・記録の作成と並列に走らせ、最後に待つ（一番時間がかかる処理なので直列にしない） */
  let imagesDone: Promise<void> | null = null;
  if (draft.bean.kind === 'existing') {
    beanId = draft.bean.id;
  } else {
    progress('bean');
    // ロースターは任意。名前も無ければ付けない
    const roasterId =
      draft.bean.roaster.id ??
      (draft.bean.roaster.name.trim()
        ? (await deps.createRoaster({ name: draft.bean.roaster.name.trim() })).id
        : null);
    beanId = (
      await deps.createBean({
        ...draft.bean.form,
        roaster_id: roasterId,
        ocr_raw: (draft.bean.ocrRaw ?? null) as Json,
      })
    ).id;
    // 1'. カード画像。失敗しても豆と記録の保存は続ける（画像は後から撮り直せる）
    if (draft.bean.images && deps.saveBeanImages) {
      progress('images');
      imagesDone = deps.saveBeanImages(beanId, draft.bean.images).catch((e: unknown) => {
        imageError = e instanceof Error ? e.message : 'カード画像を保存できませんでした';
      });
    }
  }

  // 2. 店（自宅なら付けない。DB の CHECK 制約と同じ）
  let shopId: string | null = null;
  if (log.fields.place === 'shop' && log.shop) {
    if (!log.shop.id && log.shop.name.trim()) progress('shop');
    shopId =
      log.shop.id ??
      (log.shop.name.trim()
        ? (
            await deps.createShop({
              name: log.shop.name.trim(),
              // 候補や地図で決めた座標があるときだけ付ける（無ければ店名だけの登録）
              ...(log.shop.address != null ? { address: log.shop.address } : {}),
              ...(log.shop.lat != null && log.shop.lng != null
                ? { lat: log.shop.lat, lng: log.shop.lng }
                : {}),
              ...(log.shop.externalPlaceId != null ? { external_place_id: log.shop.externalPlaceId } : {}),
            })
          ).id
        : null);
  }

  // 3. 焙煎バッチ（新規なら豆の後に作り、記録に付ける）
  let roastId = log.fields.roast_id ?? null;
  if (log.newRoast && deps.createRoast) {
    progress('roast');
    roastId = (await deps.createRoast({ ...log.newRoast, bean_id: beanId })).id;
  }

  // 4. 記録
  progress('log');
  const logId = (await deps.createLog({ ...log.fields, bean_id: beanId, shop_id: shopId, roast_id: roastId }))
    .id;
  // 5. 画像が終わるのを待つ（並列で走らせていた分）
  if (imagesDone) {
    progress('images');
    await imagesDone;
  }
  return { beanId, logId, shopId, ...(imageError ? { imageError } : {}) };
}
