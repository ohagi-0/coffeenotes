import type { LogFormInput } from '@/lib/schemas/log';
import type { RoasterFormInput } from '@/lib/schemas/roaster';
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
};

export type SaveNewLogDeps = {
  createRoaster: (input: RoasterFormInput) => Promise<{ id: string }>;
  createBean: (input: CreateBeanInput) => Promise<{ id: string }>;
  createShop: (input: ShopFormInput) => Promise<{ id: string }>;
  createLog: (input: LogFormInput) => Promise<{ id: string }>;
  /** カード画像の保存（F-BEAN-12）。渡さなければ画像は保存しない */
  saveBeanImages?: (beanId: string, images: DraftImages) => Promise<void>;
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
  // 1. 豆（新規なら、先にロースターを解決する）
  let beanId: string;
  let imageError: string | undefined;
  if (draft.bean.kind === 'existing') {
    beanId = draft.bean.id;
  } else {
    const roasterId =
      draft.bean.roaster.id ?? (await deps.createRoaster({ name: draft.bean.roaster.name })).id;
    beanId = (
      await deps.createBean({
        ...draft.bean.form,
        roaster_id: roasterId,
        ocr_raw: (draft.bean.ocrRaw ?? null) as Json,
      })
    ).id;
    // 1'. カード画像。失敗しても豆と記録の保存は続ける（画像は後から撮り直せる）
    if (draft.bean.images && deps.saveBeanImages) {
      try {
        await deps.saveBeanImages(beanId, draft.bean.images);
      } catch (e) {
        imageError = e instanceof Error ? e.message : 'カード画像を保存できませんでした';
      }
    }
  }

  // 2. 店（自宅なら付けない。DB の CHECK 制約と同じ）
  let shopId: string | null = null;
  if (log.fields.place === 'shop' && log.shop) {
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

  // 3. 記録
  const logId = (await deps.createLog({ ...log.fields, bean_id: beanId, shop_id: shopId })).id;
  return { beanId, logId, shopId, ...(imageError ? { imageError } : {}) };
}
