import type { BeanFormInput } from '@/lib/schemas/bean';
import type { LogFormInput } from '@/lib/schemas/log';
import type { RoasterFormInput } from '@/lib/schemas/roaster';
import type { ShopFormInput } from '@/lib/schemas/shop';
import type { NewLogDraft } from './new-log-draft';

// 記録作成ウィザードの「保存する」（S3 ③）。豆・ロースター・店・記録をこの順に作る。
// フックから切り離し、mutation 関数を外から渡す形にして偽物で単体テストできるようにする。

export type LogFormDraft = {
  fields: Omit<LogFormInput, 'bean_id' | 'shop_id'>;
  /** 店で飲んだとき。既存（id あり）か手入力の新規（名前だけ）か、選ばなかった（null） */
  shop: { id: string | null; name: string } | null;
};

export type SaveNewLogDeps = {
  createRoaster: (input: RoasterFormInput) => Promise<{ id: string }>;
  createBean: (input: BeanFormInput) => Promise<{ id: string }>;
  createShop: (input: ShopFormInput) => Promise<{ id: string }>;
  createLog: (input: LogFormInput) => Promise<{ id: string }>;
};

export type SaveNewLogResult = { beanId: string; logId: string; shopId: string | null };

export async function saveNewLog(
  draft: NewLogDraft,
  log: LogFormDraft,
  deps: SaveNewLogDeps,
): Promise<SaveNewLogResult> {
  // 1. 豆（新規なら、先にロースターを解決する）
  let beanId: string;
  if (draft.bean.kind === 'existing') {
    beanId = draft.bean.id;
  } else {
    const roasterId =
      draft.bean.roaster.id ?? (await deps.createRoaster({ name: draft.bean.roaster.name })).id;
    beanId = (await deps.createBean({ ...draft.bean.form, roaster_id: roasterId })).id;
  }

  // 2. 店（自宅なら付けない。DB の CHECK 制約と同じ）
  let shopId: string | null = null;
  if (log.fields.place === 'shop' && log.shop) {
    shopId =
      log.shop.id ??
      (log.shop.name.trim() ? (await deps.createShop({ name: log.shop.name.trim() })).id : null);
  }

  // 3. 記録
  const logId = (await deps.createLog({ ...log.fields, bean_id: beanId, shop_id: shopId })).id;
  return { beanId, logId, shopId };
}
