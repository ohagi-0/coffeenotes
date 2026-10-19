'use client';

import { useEffect, useState } from 'react';
import {
  LOADING_SCENE_LABELS,
  LoadingScene,
  pickLoadingScene,
  type LoadingSceneKind,
} from '@/components/loading-scene';

// 全画面の読み込み（ログイン判定の間、各ページの初期表示）。コーヒーの所作の小さな動きを 1 つ、ランダムに出す
// （2026-10-20、DESIGN.md §4）。どれが出るかは画面を開くたびに変わる。サーバー側の描画と食い違わないよう、
// 最初の描画では絵を出さず、画面に載ってから選ぶ。読み上げは常に「読み込み中」。

export function FullScreenLoading({ label, scene }: { label?: string; scene?: LoadingSceneKind }) {
  const [picked, setPicked] = useState<LoadingSceneKind | null>(scene ?? null);
  useEffect(() => {
    if (!scene) setPicked(pickLoadingScene());
  }, [scene]);
  const kind = picked;
  return (
    <div
      className="text-muted-foreground flex min-h-dvh flex-col items-center justify-center gap-4"
      role="status"
      aria-label="読み込み中"
    >
      <div className="grid size-[168px] place-items-center">{kind && <LoadingScene kind={kind} />}</div>
      <span className="text-[13px]">{label ?? (kind ? LOADING_SCENE_LABELS[kind] : '読み込み中…')}</span>
    </div>
  );
}
