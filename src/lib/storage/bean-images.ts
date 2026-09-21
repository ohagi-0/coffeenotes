// カード画像の Supabase Storage 保存（F-BEAN-12）。
// バケットは非公開の `bean-images`、パスは {user_id}/{bean_id}/{front|back}.jpg。
// Storage ポリシーは先頭フォルダ名（= 自分の uid）で判定するため、パスの組み立てを beanImagePath に寄せて単体テストする。
// bean_images テーブルへの行の挿入はここでは行わない（データ層 features/beans の責務）。
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { COMPRESSED_MIME } from '@/lib/image/compress';
import type { Database } from '@/types/database';

export const BEAN_IMAGES_BUCKET = 'bean-images';
/** 署名付き URL の既定の有効期限（秒）。 */
export const SIGNED_URL_TTL_SEC = 60 * 60;

export type BeanImageSide = 'front' | 'back';

export class BeanImageStorageError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'BeanImageStorageError';
  }
}

function assertPathSegment(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.includes('/')) {
    throw new BeanImageStorageError(`${label} が不正です（${JSON.stringify(value)}）`);
  }
  return trimmed;
}

/**
 * Storage 上のオブジェクトパスを組み立てる純粋関数。
 * 先頭が user_id であることが Storage ポリシーの前提なので、ここがずれると保存できない。
 */
export function beanImagePath(userId: string, beanId: string, side: BeanImageSide): string {
  if (side !== 'front' && side !== 'back') {
    throw new BeanImageStorageError(`side は front か back を指定してください（${JSON.stringify(side)}）`);
  }
  return `${assertPathSegment(userId, 'userId')}/${assertPathSegment(beanId, 'beanId')}/${side}.jpg`;
}

export interface UploadBeanImageInput {
  userId: string;
  beanId: string;
  side: BeanImageSide;
  /** 圧縮済みの JPEG（src/lib/image/compress.ts の compressImage を通したもの）。 */
  blob: Blob;
}

type Client = SupabaseClient<Database>;

/** カード画像をアップロードし、bean_images.storage_path に入れる値を返す。同じ面を撮り直したら上書きする。 */
export async function uploadBeanImage(
  { userId, beanId, side, blob }: UploadBeanImageInput,
  client: Client = getSupabaseBrowserClient(),
): Promise<string> {
  const path = beanImagePath(userId, beanId, side);
  const { error } = await client.storage.from(BEAN_IMAGES_BUCKET).upload(path, blob, {
    contentType: blob.type || COMPRESSED_MIME,
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw new BeanImageStorageError('カード画像をアップロードできませんでした', error);
  return path;
}

/** 非公開バケットなので、表示用には署名付き URL を発行する。 */
export async function getBeanImageUrl(
  storagePath: string,
  expiresInSec: number = SIGNED_URL_TTL_SEC,
  client: Client = getSupabaseBrowserClient(),
): Promise<string> {
  const { data, error } = await client.storage
    .from(BEAN_IMAGES_BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error || !data?.signedUrl) {
    throw new BeanImageStorageError('カード画像の URL を取得できませんでした', error);
  }
  return data.signedUrl;
}

/** カード画像を削除する。bean_images の行削除は呼び出し側で行う。 */
export async function deleteBeanImage(
  storagePath: string,
  client: Client = getSupabaseBrowserClient(),
): Promise<void> {
  const { error } = await client.storage.from(BEAN_IMAGES_BUCKET).remove([storagePath]);
  if (error) throw new BeanImageStorageError('カード画像を削除できませんでした', error);
}
