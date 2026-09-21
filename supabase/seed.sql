-- ローカル開発用シード。auth.users に依存するデータは置かない（ユーザーはログインで作られる）。
-- 共有マスタのロースターだけ最小限入れておく。
insert into public.roasters (name, website)
values ('KIELO COFFEE', 'https://kielocoffee.com')
on conflict (name_normalized) do nothing;
