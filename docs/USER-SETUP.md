# ユーザー側の設定手順（2026-09-23 朝の作業用）

開発側の実装は Phase 0〜5 まで完了し、本番 https://coffee-notes.app に反映済み。
残りは「アカウントを持っている本人にしかできない設定」だけ。上から順にやれば 1 時間以内。
各ステップの最後に「Claude Code に伝えること」がある。そこまで済んだら、そのまま次へ。

鍵の受け渡しは会話に貼らず、ホームフォルダの `~/.coffeenotes-secrets/` にファイルで置く（Claude Code が使い終わったら削除する）。

---

## 1. Anthropic の API キー（カード読み取りを有効にする）— 10 分

いま本番は `OCR_PROVIDER=none` で、「カードを撮る」は撮影と画像保存だけ動く。キーを入れると項目の自動読み取りが動く。

1. https://console.anthropic.com/ を開き、ログイン（無ければアカウント作成）。
2. 左下の **Billing**（請求）で支払い方法を登録し、クレジットを **$5** 追加する。読み取り 1 回は 0.5 円前後なので、当面はこれで足りる。
3. 左メニュー **API Keys** → **Create Key** → 名前は `coffeenotes` → **Create**。
4. 表示されたキー（`sk-ant-` で始まる）を **コピー**する。この画面を閉じると二度と表示されない。
5. コピーした直後に、ターミナルで次を 1 行そのまま実行する（コメントは付けない）。

   ```bash
   mkdir -p ~/.coffeenotes-secrets && pbpaste > ~/.coffeenotes-secrets/anthropic.txt
   ```

6. 確認: `head -c 7 ~/.coffeenotes-secrets/anthropic.txt` と打って `sk-ant-` と出れば OK。

**Claude Code に伝えること**: 「Anthropic のキーを置いた」
→ Vercel に `ANTHROPIC_API_KEY` と `OCR_PROVIDER=claude` を設定、合成カード画像で実 API のテストと応答の録画、再デプロイ、ファイル削除まで Claude Code が行う。

自分で入れたい場合: https://vercel.com/kotas-projects-66f79ae1/coffeenotes/settings/environment-variables で `ANTHROPIC_API_KEY`（Production と Preview）を追加し、`OCR_PROVIDER` の値を `none` → `claude` に変更 → Deployments から最新を **Redeploy**。

---

## 2. Google ログイン（要件 F-AUTH-1 の Must）— 20 分

Google Cloud で「このアプリが Google ログインを使う」ための登録をし、その ID とシークレットを Supabase に渡す。

### 2-1. Google Cloud で同意画面を作る

1. https://console.cloud.google.com/ を開く（Google アカウントでログイン）。
2. 上部のプロジェクト選択 → **新しいプロジェクト** → 名前 `coffeenotes` → 作成 → そのプロジェクトを選択する。
3. 左メニュー **API とサービス** → **OAuth 同意画面**（新しい画面では「Google Auth Platform」→ **ブランディング**）。
4. **開始** を押して入力する。
   - アプリ名: `Coffeenotes`
   - ユーザーサポートメール: 自分の Gmail
   - 対象（ユーザーの種類）: **外部**
   - 連絡先情報（デベロッパーのメール）: 自分の Gmail
   - 「作成」
5. **ブランディング** に戻り、次を追加して保存する。
   - アプリのホームページ: `https://coffee-notes.app`
   - アプリのプライバシー ポリシー リンク: `https://coffee-notes.app/privacy`
   - アプリの利用規約リンク: `https://coffee-notes.app/terms`
   - 承認済みドメイン: `coffee-notes.app` と `supabase.co` の 2 つ
6. 左の **対象（Audience）** → 公開ステータスが「テスト」なら **アプリを公開** を押して「本番環境」にする。確認ダイアログは「確認」。
   （メールとプロフィールしか使わないので Google の審査は不要。警告が出ても進んでよい）

### 2-2. クライアント ID を作る

1. 左の **クライアント** → **クライアントを作成**。
2. アプリケーションの種類: **ウェブ アプリケーション**。名前: `coffeenotes-web`。
3. 承認済みの JavaScript 生成元 → **URI を追加**: `https://coffee-notes.app`
4. 承認済みのリダイレクト URI → **URI を追加**（これが一番大事。1 文字も違えないこと）:

   ```
   https://gayhfwmvlxwyuzrvmkoy.supabase.co/auth/v1/callback
   ```

5. **作成** → 表示される **クライアント ID**（`....apps.googleusercontent.com`）と **クライアント シークレット**（`GOCSPX-` で始まる）を控える。この画面を閉じてもクライアント一覧から再表示できる。

### 2-3. Supabase に貼る

1. https://supabase.com/dashboard/project/gayhfwmvlxwyuzrvmkoy/auth/providers を開く。
2. 一覧から **Google** を開き、**Enable Sign in with Google** を ON。
3. **Client IDs** に 2-2 のクライアント ID、**Client Secret (for OAuth)** にシークレットを貼る。他の項目はそのまま。
4. **Save**。

### 2-4. 動作確認

1. スマホか PC で https://coffee-notes.app/login → **Google で続ける**。
2. Google のアカウント選択 → 許可 → ホームが開けば OK。
3. これまでメールリンクでログインしていたのと同じ Gmail を選べば、同じ記録帳が開く。

**Claude Code に伝えること**: 「Google ログインできた」（できなければ、出たエラー文をそのまま）

---

## 3. 実機での確認（スマホ）— 15 分

iPhone の Safari（または Android の Chrome）で https://coffee-notes.app を開いて、上から順に触る。
気になった見た目・文言・動きは、後でまとめて Claude Code に送る（スクリーンショット可）。UI の微調整はそのあと。

- [ ] **ログイン**: メールアドレスを入れてリンクを送る → 届いたメールのリンクをスマホで開く → ホームが出る（Gmail アプリ内で開いても通るはず）
- [ ] **カードを撮る**: 記録を追加 → カードを撮る → 表を撮影 → 「この内容で読み取る」
  - キー設定前: 「読み取りは現在使えません」と出て手入力フォームに切り替わる（画像は残る）。それで正常
  - キー設定後: 3〜8 秒で項目が埋まり、自信の低い項目に「要確認」が付く
- [ ] **保存**: 店で / 自宅で → 星とメモ → 保存 → 豆詳細にカード画像が出る
- [ ] **自宅レシピ**: 記録を追加 → 手で入力する → 自宅で → 「レシピ」を開いて豆量 15・湯量 225 → 比率 1:15 と出る → 保存
- [ ] **店の座標**: 記録したお店 → ＋ お店を登録 → 店名を入れて「店名で検索」→ 候補を選ぶと住所と座標が入る → 登録 → 地図に出る
- [ ] **地図**: 記録したお店のマップ → 「現在地」→ 位置情報を許可 → 青い点が出る。ピンを押すと店カードが出る。地図を長押しすると店登録に飛ぶ
- [ ] **分析**: 好みの分析（記録が 3 件未満なら空状態の文言が出る）
- [ ] **エクスポート**: 設定 → CSV でダウンロード → Safari は「ダウンロード」か「ファイルに保存」
- [ ] **ホーム画面に追加**: Safari の共有 → ホーム画面に追加 → アイコンから起動（全画面で開く）
- [ ] **オフライン閲覧**: アイコンから起動して一覧と豆詳細を一度開く → 機内モード → もう一度開くと直前の内容が見える

**Claude Code に伝えること**: 「実機確認した。直したい点は〜」（箇条書きで）

---

## 4. Vercel と GitHub の連携（任意、5 分）

いまは Claude Code が `vercel deploy --prod` で手動デプロイしている。連携すると `main` への push だけで自動デプロイになる。

1. https://vercel.com/account/login-connections → **GitHub** の **Connect** → GitHub（ohagi-0）で認可。
2. https://vercel.com/kotas-projects-66f79ae1/coffeenotes/settings/git → **Connect Git Repository** → GitHub → `ohagi-0/coffeenotes` を選ぶ。
   Vercel の GitHub App のインストールを求められたら、対象を **Only select repositories → coffeenotes** にして Install。
3. Production Branch が `main` になっていることを確認して保存。直後に 1 回自動デプロイが走ることがある（問題ない）。

**Claude Code に伝えること**: 「Vercel と GitHub をつないだ」
→ CLAUDE.md の運用メモを「push で自動デプロイ」に書き換える。

---

## 詰まったとき

- コマンドはコメント（`#` 以降）を付けずにそのまま貼る（zsh は `#` をコメントにしない）。
- 鍵を貼り間違えたら、もう一度コピーして同じコマンドを打てば上書きされる。
- どの手順でも、出た画面の文言かスクリーンショットを Claude Code に送れば続きを引き取る。
