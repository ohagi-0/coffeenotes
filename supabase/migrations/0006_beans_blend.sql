-- 0006: 豆に「種類（シングルオリジン / ブレンド）」を足す（F-BEAN-19、Issue #46、2026-10-20）。
-- ブレンドかどうかは品種や生産国から推定できない（カードに「BLEND」と書いてあることが多い）ので、豆の項目として持つ。
-- 手入力とカード読み取りの両方で入る。既存の豆は NULL（未設定）のまま。RLS は変更なし。
alter table public.beans
  add column blend text
    check (blend is null or blend in ('single_origin', 'blend'));
