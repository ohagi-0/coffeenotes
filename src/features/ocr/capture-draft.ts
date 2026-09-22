// ①撮影 → ②読み取り の受け渡し（sessionStorage、data URL）。
export const CAPTURE_DRAFT_KEY = 'coffeenotes:capture-draft';

export type CaptureDraft = { front: string; back?: string };

export function readCaptureDraft(): CaptureDraft | null {
  try {
    const raw = sessionStorage.getItem(CAPTURE_DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof (parsed as { front?: unknown }).front !== 'string')
      return null;
    return parsed as CaptureDraft;
  } catch {
    return null;
  }
}

export function writeCaptureDraft(draft: CaptureDraft): boolean {
  try {
    sessionStorage.setItem(CAPTURE_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false; // 容量超過など。呼び出し側は「画像を保持できなかった」旨を出す
  }
}

export function clearCaptureDraft(): void {
  try {
    sessionStorage.removeItem(CAPTURE_DRAFT_KEY);
  } catch {
    // noop
  }
}
