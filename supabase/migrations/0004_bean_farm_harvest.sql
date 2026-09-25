-- 0004: 豆に「農園」と「収穫年度」を足す（F-BEAN-16 / F-BEAN-17、2026-09-25）。
-- 日本の店のテイスティングカードには「農園 / 生産地 / 収穫年度」が別項目で載ることが多く、
-- 地域の欄に農園名を押し込むと表記が揺れるため列を分ける。どちらも NULL 可。
alter table public.beans
  add column farm text,
  add column harvest_year smallint
    check (harvest_year is null or harvest_year between 1900 and 2100);
