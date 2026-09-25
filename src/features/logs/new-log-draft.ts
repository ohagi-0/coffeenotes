import type { BeanFormInput } from '@/lib/schemas/bean';

// 記録作成ウィザードの下書き（S3 ② → ③ の受け渡し）。
// 豆は保存（③の「保存する」）まで DB に作らない。途中でやめても孤児の豆を残さないため、
// ②の内容は sessionStorage に置き、③で豆と記録を一緒に保存する。
// カードを撮った場合は画像（data URL）と OCR の生出力も一緒に持ち、③の保存で Storage と beans.ocr_raw に入れる。

export const NEW_LOG_DRAFT_KEY = 'coffeenotes:new-log-draft';

/** ②で入力した豆。ロースターは既存（id あり）か新規（名前だけ） */
export type DraftBeanForm = Omit<BeanFormInput, 'roaster_id'>;
export type DraftRoaster = { id: string | null; name: string };
/** 撮影したカード画像（長辺 1,600px の JPEG を data URL にしたもの） */
export type DraftImages = {
  front: string;
  back?: string;
  /** 撮影時に元画像から読んだ QR の中身 */ qr?: string;
};

export type NewLogDraft =
  | {
      bean: {
        kind: 'new';
        form: DraftBeanForm;
        roaster: DraftRoaster;
        images?: DraftImages;
        /** OCR を通したときのプロバイダ生出力（beans.ocr_raw） */
        ocrRaw?: unknown;
      };
    }
  | { bean: { kind: 'existing'; id: string; name: string } };

export function readNewLogDraft(): NewLogDraft | null {
  try {
    const raw = sessionStorage.getItem(NEW_LOG_DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !('bean' in parsed)) return null;
    return parsed as NewLogDraft;
  } catch {
    return null;
  }
}

export function writeNewLogDraft(draft: NewLogDraft): void {
  try {
    sessionStorage.setItem(NEW_LOG_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // 保存できない環境（プライベートブラウズ等）では次の画面で入力し直してもらう
  }
}

export function clearNewLogDraft(): void {
  try {
    sessionStorage.removeItem(NEW_LOG_DRAFT_KEY);
  } catch {
    // noop
  }
}
