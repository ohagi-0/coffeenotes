import { describe, expect, it } from 'vitest';
import { BEAN_IMAGES_BUCKET, BeanImageStorageError, beanImagePath } from '@/lib/storage/bean-images';

const USER = '11111111-1111-4111-8111-111111111111';
const BEAN = '22222222-2222-4222-8222-222222222222';

describe('beanImagePath', () => {
  it('{user_id}/{bean_id}/{side}.jpg を返す', () => {
    expect(beanImagePath(USER, BEAN, 'front')).toBe(`${USER}/${BEAN}/front.jpg`);
    expect(beanImagePath(USER, BEAN, 'back')).toBe(`${USER}/${BEAN}/back.jpg`);
  });

  it('先頭フォルダは user_id（Storage ポリシーの判定対象）', () => {
    expect(beanImagePath(USER, BEAN, 'front').split('/')[0]).toBe(USER);
  });

  it('前後の空白は落とす', () => {
    expect(beanImagePath(` ${USER} `, ` ${BEAN} `, 'back')).toBe(`${USER}/${BEAN}/back.jpg`);
  });

  it.each([
    ['', BEAN],
    ['   ', BEAN],
    [USER, ''],
    ['a/b', BEAN],
    [USER, 'a/b'],
  ])('不正な id（%s, %s）は弾く', (user, bean) => {
    expect(() => beanImagePath(user, bean, 'front')).toThrow(BeanImageStorageError);
  });

  it('front / back 以外の side は弾く', () => {
    expect(() => beanImagePath(USER, BEAN, 'side' as 'front')).toThrow(BeanImageStorageError);
  });
});

describe('バケット名', () => {
  it('マイグレーションと一致する', () => {
    expect(BEAN_IMAGES_BUCKET).toBe('bean-images');
  });
});
