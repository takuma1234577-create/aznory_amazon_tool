# AZONRY　商品ページ改善AIツール

Amazon商品ページAI分析SaaS

## 構成

- **Backend**: Next.js (App Router) + Prisma (SQLite)
- **Extension**: Chrome Extension (Manifest V3)

## セットアップ

### 1. 依存関係のインストール

```bash
# プロジェクトルートで実行
npm install

# Chrome拡張機能の依存関係をインストール
cd apps/extension && npm install
```

### 2. 環境変数の設定

`.env` ファイルを作成し、`env.example` を参考に設定してください。

```bash
# env.example を .env にコピー
cp env.example .env

# .env を編集して必要な値を設定
# 最低限、DATABASE_URL は設定済み（file:./prisma/dev.db）です
```

**重要**: `.env` ファイルは Git 管理されません（`.gitignore` に含まれています）。

### 3. データベースのセットアップ（初回のみ）

Prisma Studio を使用する前に、データベースを初期化する必要があります。

```bash
# プロジェクトルートで実行（コピペ可能）
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed  # テストユーザーを作成（オプション）
npx prisma studio
```

**テストユーザーを作成する場合**:
- `npm run db:seed` を実行すると、テストユーザー（email: `test@local.dev`）が作成されます
- **userId がコンソールに表示される**ので、拡張機能の設定で使用できます

**何が起きているか**:
- `prisma generate`: Prisma Client（TypeScript型定義）を生成します
- `prisma migrate dev`: SQLiteデータベース（`prisma/dev.db`）を作成し、スキーマに基づいてテーブルを作成します
- `prisma studio`: ブラウザでデータベースを閲覧・編集できるGUIを起動します（http://localhost:5555）

**Prisma Studio で User を確認**:
- Prisma Studio が起動したら、左側のメニューから「User」を選択
- User テーブルのデータが表示されます
- 新規ユーザーを作成する場合は「Add record」ボタンを使用

**userId を取得する方法**:
1. **Prisma Studio で取得**:
   - Prisma Studio で User テーブルを開く
   - `id` 列の値をコピー（例: `clx1234567890abcdef`）

2. **SQLite コマンドで取得**:
   ```bash
   sqlite3 prisma/dev.db "SELECT id, email FROM User LIMIT 20;"
   ```
   これにより、User テーブルの id と email が最大20件表示されます。

**よくあるエラーと対処**:

| エラー | 原因 | 対処法 |
|--------|------|--------|
| `Environment variable not found: DATABASE_URL` | `.env` ファイルが存在しない、または `DATABASE_URL` が設定されていない | `cp env.example .env` を実行して `.env` を作成。`DATABASE_URL="file:./prisma/dev.db"` が設定されていることを確認 |
| `Error: P3005` | データベースファイルへの書き込み権限がない | `prisma/` ディレクトリの権限を確認。必要に応じて `chmod 755 prisma` |
| `Error: P1001` | データベースファイルがロックされている | 他のプロセス（Prisma Studio等）がデータベースを使用していないか確認。Prisma Studio を終了してから再試行 |
| `Migration engine error` | マイグレーションファイルが破損している | `prisma/migrations/` を削除して `prisma migrate dev --name init` を再実行 |
| `Database file not found` | データベースファイルが `prisma/prisma/dev.db` など別の場所に作成された | `find . -name "dev.db"` でファイルの場所を確認。正しい場所（`prisma/dev.db`）に移動するか、`.env` の `DATABASE_URL` を確認 |
| `Schema file not found` | `prisma/schema.prisma` が存在しない | プロジェクトルートに `prisma/schema.prisma` が存在することを確認 |

### 4. 開発サーバーの起動

```bash
# Webサーバー
npm run dev

# 拡張機能のビルド（別ターミナル）
npm run build:extension
# または watch モード
npm run dev:extension
```

## データベース初期化の完全手順

Prisma Studio を初めて使用する場合、以下の手順でデータベースを初期化してください。

### ステップ1: .env ファイルの作成

```bash
# プロジェクトルートで実行
cp env.example .env
```

これにより、`DATABASE_URL="file:./prisma/dev.db"` が設定された `.env` ファイルが作成されます。

### ステップ2: Prisma Client の生成

```bash
npx prisma generate
```

**何が起きているか**: Prisma Client（TypeScript型定義）が生成され、`node_modules/.prisma/client` に配置されます。

### ステップ3: データベースの初期化

```bash
npx prisma migrate dev --name init
```

**何が起きているか**: 
- `prisma/dev.db` ファイルが作成されます（SQLiteデータベース）
- `prisma/migrations/` ディレクトリにマイグレーションファイルが作成されます
- スキーマに基づいてテーブル（User, Account, Session等）が作成されます

### ステップ3.5: テストユーザーの作成（オプション）

拡張機能のテスト用にテストユーザーを作成する場合:

```bash
npm run db:seed
```

**何が起きているか**: 
- `prisma/seed.ts` が実行されます
- テストユーザー（email: `test@local.dev`, name: `Test User`）が作成されます
- 既に存在する場合は更新されません（既存データを保持）
- **userId がコンソールに表示されます**（拡張機能の設定で使用）

**出力例**:
```
🌱 Seeding database...
✅ Test user created/updated:
   userId: cmkg930yk0000csptcip1krqz
   email: test@local.dev
   name: Test User

📋 Use this userId in extension settings:
   cmkg930yk0000csptcip1krqz
```

この `userId` をコピーして、拡張機能の popup で「User ID」として設定してください。

### ステップ4: Prisma Studio の起動

```bash
npx prisma studio
```

**何が起きているか**: 
- ブラウザで http://localhost:5555 が自動的に開きます
- データベースの内容をGUIで閲覧・編集できます

**User テーブルを確認**:
- 左側のメニューから「User」を選択
- User テーブルのデータが表示されます
- まだデータがない場合は空のテーブルが表示されます

### userId を取得する方法

拡張機能の設定やAPIテストで userId が必要な場合、以下の方法で取得できます。

#### 方法1: Seedスクリプトで取得（最短・推奨）

```bash
npm run db:seed
```

**出力例**:
```
🌱 Seeding database...
✅ Test user created/updated:
   userId: cmkg930yk0000csptcip1krqz
   email: test@local.dev
   name: Test User

📋 Use this userId in extension settings:
   cmkg930yk0000csptcip1krqz
```

この `userId` をコピーして、拡張機能の popup で「User ID」として設定してください。

**何が起きているか**:
- テストユーザー（email: `test@local.dev`, name: `Test User`）が作成されます
- 既に存在する場合は更新されません（既存データを保持）
- **userId がコンソールに表示される**ので、すぐにコピーできます

#### 方法2: Prisma Studio で取得

1. Prisma Studio を起動（`npx prisma studio`）
2. 左側のメニューから「User」を選択
3. `id` 列の値をコピー（例: `clx1234567890abcdef`）
4. この値を拡張機能の popup で「User ID」として設定

#### 方法3: SQLite コマンドで取得

```bash
sqlite3 prisma/dev.db "SELECT id, email FROM User LIMIT 20;"
```

**出力例**:
```
id|email
cmkg930yk0000csptcip1krqz|test@local.dev
clx9876543210fedcba|admin@example.com
```

### よくあるエラーと対処

| エラー | 原因 | 対処法 |
|--------|------|--------|
| `Environment variable not found: DATABASE_URL` | `.env` ファイルが存在しない、または `DATABASE_URL` が設定されていない | `cp env.example .env` を実行して `.env` を作成 |
| `Error: P3005` | データベースファイルへの書き込み権限がない | `prisma/` ディレクトリの権限を確認。必要に応じて `chmod 755 prisma` |
| `Error: P1001` | データベースファイルがロックされている | 他のプロセス（Prisma Studio等）がデータベースを使用していないか確認。Prisma Studio を終了してから再試行 |
| `Migration engine error` | マイグレーションファイルが破損している | `prisma/migrations/` を削除して `prisma migrate dev --name init` を再実行 |
| `Schema file not found` | `prisma/schema.prisma` が存在しない | プロジェクトルートに `prisma/schema.prisma` が存在することを確認 |
| `DATABASE_URL` のパスが間違っている | `env.example` と `.env` の `DATABASE_URL` が異なる | `.env` の `DATABASE_URL` を `"file:./prisma/dev.db"` に設定 |

### データベースの再初期化（全データ削除）

**警告**: この操作はすべてのデータを削除します。

```bash
# データベースファイルを削除
rm prisma/dev.db
rm -rf prisma/migrations/

# 再初期化
npx prisma migrate dev --name init
```

## ビルドコマンドの分離

このプロジェクトは **Webアプリ（Next.js）** と **Chrome拡張機能** が完全に分離されています。

### Webアプリのビルド

```bash
# プロジェクトルートで実行
npm run build:web
# または
npm run build  # build:web のエイリアス
```

**注意**: `apps/extension` は Webアプリのビルドから完全に除外されています。Chrome拡張機能のビルドは別途実行してください。

### Chrome拡張機能のビルド

```bash
# プロジェクトルートから実行
npm run build:extension

# または、拡張機能ディレクトリで実行
cd apps/extension
npm run build
```

**重要**: 
- Webアプリのビルド（`npm run build:web`）では Chrome拡張機能はビルドされません
- Chrome拡張機能のビルド（`npm run build:extension`）では Webアプリはビルドされません
- 両者は完全に独立しており、互いに影響しません

## 完全手順：Chrome拡張を動かす（初心者向け）

この手順に従えば、必ずChrome拡張を読み込んで動作確認までできます。

### 手順A: Backend起動

```bash
# プロジェクトルートで
npm install
npm run dev
```

**何が起きているか**: Next.jsの開発サーバーが起動し、APIが利用可能になります。

**確認**: ターミナルに `Ready` と表示され、エラーが出ていなければOKです。

### 手順B: Health確認（Backend動作確認）

ブラウザで以下を開く:
```
http://localhost:3000/api/health
```

**成功条件**: 以下のJSONが表示されること
```json
{
  "ok": true,
  "env": "development",
  "db": true,
  ...
}
```

**`db: true` が重要**: データベース接続が正常であることを示します。`db: false` の場合は、`.env` の `DATABASE_URL` を確認してください。

### 手順C: 拡張機能のビルド

```bash
# 拡張機能ディレクトリに移動
cd apps/extension

# 依存関係をインストール（初回のみ）
npm install

# ビルド実行（自動検証も実行されます）
npm run build
```

**何が起きているか**: 
- TypeScriptファイルがJavaScriptにコンパイルされます
- `dist` フォルダに必要なファイルがすべて出力されます
- 自動検証スクリプトが実行され、問題があればエラーが表示されます

**成功条件**: 
- ターミナルに `✅ All checks passed! dist folder is ready for Chrome extension.` と表示される
- `apps/extension/dist` フォルダに以下が存在する:
  - `manifest.json`
  - `popup.html`
  - `popup.js`
  - `background.js`
  - `contentScript.js`

**重要**: `manifest.json` を変更した場合は、必ず以下を実行してください:
1. `npm run build` で再ビルド
2. `chrome://extensions/` で拡張機能の「再読み込み」ボタン（🔄）をクリック
3. Amazon商品ページを**リロード**（F5 または Cmd+R）

### 手順D: Chromeに拡張機能を読み込む

1. Chromeで `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」をONにする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. **重要**: 以下のフォルダを選択してください:
   - ✅ **正しい**: `apps/extension/dist` フォルダ
   - ❌ **間違い**: `apps/extension` フォルダ（親フォルダ）
   - ❌ **間違い**: `apps/extension/src` フォルダ
   
   **パスの確認方法**:
   - プロジェクトルートから見て: `~/Desktop/重要/Amazon_AI_page_Checker/apps/extension/dist`
   - このフォルダの中に `manifest.json` が存在することを確認してください
5. 「FITPEAK Analyzer」が一覧に表示されれば成功

**エラーが出た場合**:
- `Manifest file is missing or unreadable` というエラーが出た場合:
  - **原因**: `apps/extension` フォルダを選択してしまった可能性があります
  - **対処**: `apps/extension/dist` フォルダを選択してください
  - **確認**: 選択するフォルダの中に `manifest.json` が存在することを確認してください

**確認**: エラーが表示されず、拡張機能が有効になっていればOKです。

**重要: サイトアクセス権限の設定**

Content ScriptがAmazonページに注入されない場合、以下の手順でサイトアクセス権限を設定してください:

1. `chrome://extensions/` を開く
2. 「FITPEAK Analyzer」の「詳細」をクリック
3. 「サイトへのアクセス」セクションを確認
4. **「すべてのサイトで実行」** を選択（開発中はこれが最も確実）
   - または「特定のサイトで実行」を選択し、`https://www.amazon.co.jp/*` を追加
5. 拡張機能の「再読み込み」ボタン（🔄）をクリック
6. Amazon商品ページを**完全リロード**（Cmd+Shift+R または Ctrl+Shift+R）

**確認方法**:
- Amazon商品ページを開いたとき、右下に「FITPEAK injected」バッジが表示される
- DevTools Console に `[FITPEAK] contentScript injected:` が表示される
- Console で `window.__FITPEAK_INJECTED__` を実行して `true` が返される

### 手順E: Popupの接続テスト

1. 拡張機能のアイコンをクリックしてpopupを開く
2. 以下の設定を入力:
   - **API URL**: `http://localhost:3000`（BackendのURL）
   - **API Key**: `.env` の `EXTENSION_API_KEY` の値
   - **User ID**: データベースに存在するユーザーID（例: `test-user-123`）
3. 「設定を保存」をクリック
4. 「接続テスト」をクリック

**成功条件**: 
- 「✓ 接続成功」と表示される
- Status: 200
- DB: ✓
- レイテンシが表示される

**失敗時**: 下記の「典型エラーと対処」を参照

### 手順F: ContentScript注入確認

1. Amazon商品ページ（`https://www.amazon.co.jp/dp/ASIN` 形式）を開く
2. **右下に「FITPEAK injected」バッジが表示されることを確認**（緑色の小さなバッジ）
3. **DevTools Console を開く**（F12 または Cmd+Option+I）
4. Console に以下が表示されることを確認:
   ```
   [FITPEAK] contentScript injected: https://www.amazon.co.jp/dp/...
   [FITPEAK] sendPageSnapshot called, ASIN: B00V20CIDY, URL: ...
   [FITPEAK] PAGE_SNAPSHOT sent successfully, ASIN: B00V20CIDY
   ```
5. Console で以下を実行して確認:
   ```javascript
   window.__FITPEAK_INJECTED__
   ```
   **成功条件**: `true` が返される

**もしバッジやログが表示されない場合**:

1. **拡張機能を完全に再読み込み**（最も確実な方法）:
   - `chrome://extensions/` を開く
   - 「FITPEAK Analyzer」の「削除」ボタンをクリック
   - 「パッケージ化されていない拡張機能を読み込む」をクリック
   - **`apps/extension/dist` フォルダを再度選択**
   - これにより、キャッシュされた古いバージョンが完全にクリアされます

2. **サイトアクセス権限を確認**（最重要）:
   - `chrome://extensions/` → 「FITPEAK Analyzer」→ 「詳細」
   - 「サイトへのアクセス」が「すべてのサイトで実行」になっているか確認
   - なっていない場合は設定を変更し、拡張機能を再読み込み
   - **これが最も一般的な原因です**

2. **PopupのConsoleログを確認**:
   - Popupを開いた状態で、右クリック → 「検証」をクリック
   - Consoleタブで以下のログを確認:
     - `[FITPEAK][popup] Updating snapshot for tab: ...`
     - `[FITPEAK][popup] Background response: ...`
     - `[FITPEAK][popup] ContentScript responded: ...` またはエラーメッセージ
   - エラーメッセージに「Could not establish connection」や「Receiving end does not exist」が含まれている場合、ContentScriptが注入されていません

4. **Service WorkerのConsoleログを確認**:
   - `chrome://extensions/` → 「FITPEAK Analyzer」→ 「サービスワーカー」→ 「検証」をクリック
   - Consoleタブで以下のログを確認:
     - `[FITPEAK][background] Snapshot updated for tab ...`
     - `[FITPEAK][background] GET_SNAPSHOT requested for tab ...`
   - エラーメッセージがあれば内容を確認

5. **AmazonページのConsoleログを確認**:
   - Amazon商品ページで DevTools Console を開く（F12）
   - 以下のログが表示されるか確認:
     - `[FITPEAK] contentScript injected: ...`
     - `[FITPEAK] sendPageSnapshot called, ASIN: ...`
   - これらのログが表示されない場合、ContentScriptが注入されていません

6. **ビルドと再読み込みを実行**:
   ```bash
   # プロジェクトルートから
   npm run build:extension
   
   # または、拡張機能ディレクトリで
   cd apps/extension
   npm run build
   ```
   - `chrome://extensions/` で拡張機能の「再読み込み」ボタン（🔄）をクリック
   - Amazonページを**完全リロード**（Cmd+Shift+R または Ctrl+Shift+R）

7. **拡張機能のエラーを確認**:
   - `chrome://extensions/` で「FITPEAK Analyzer」の「エラー」リンクをクリック
   - エラーがあれば内容を確認

8. **読み込み先を確認**:
   - `chrome://extensions/` で「FITPEAK Analyzer」の「詳細」を開く
   - 「ID」の下に表示されるパスが `apps/extension/dist` を指しているか確認

### 手順G: Amazon商品ページでScore実行

1. Amazon商品ページ（`https://www.amazon.co.jp/dp/ASIN` 形式）を開く
2. 拡張機能が動作する（実装により異なる）
3. Service Workerのログを確認:
   - `chrome://extensions/` → 「FITPEAK Analyzer」→ 「サービスワーカー」→ 「検証」をクリック
   - Consoleタブでログを確認

**ログ確認の場所**: 
- `chrome://extensions/` を開く
- 「FITPEAK Analyzer」のカード内に「サービスワーカー」というリンクがある
- クリックすると「検証」ボタンが表示される
- 「検証」をクリックするとDevToolsが開き、Consoleタブでログを確認できる

**期待されるログ**:
```
[EXT][analyze:score] POST /api/analyze/score-extension status=200 elapsed=842ms payload=120kb
```

### 典型エラーと対処

| エラー | 原因 | 対処法 |
|--------|------|--------|
| **CORS/Network** | API_URLが間違っている、またはCORS設定の問題 | API_URLが `http://localhost:3000` になっているか確認。Backendが起動しているか確認 |
| **401 認証エラー** | API_KEYが未設定または不一致 | `.env` の `EXTENSION_API_KEY` とpopupで設定したAPI_KEYが一致しているか確認 |
| **403 アクセス拒否** | userIdが不正/未登録、またはUsage Guard制限 | データベースにユーザーが存在するか確認。Usage Guardの制限に引っかかっていないか確認 |
| **413 Payload過大** | リクエストサイズが大きすぎる | 画像データを圧縮するか、サイズを削減 |
| **5xx サーバーエラー** | サーバー側のエラー | Backendのターミナルでエラーログを確認 |

### コピー用：現在の設定

Popupに「コピー用：現在の設定」ボタンがあります。クリックすると、以下の形式でクリップボードにコピーされます:

```
API_URL: http://localhost:3000
API_KEY: xxxx***
userId: test-user-123
LOG_LEVEL: info
```

問い合わせや共有時に便利です。

---

## Chrome拡張機能のビルドと読み込み（詳細手順）

### 前提条件

- Node.js がインストールされていること
- Chrome ブラウザがインストールされていること

### ステップ1: 依存関係のインストール

```bash
# プロジェクトルートで
npm install

# 拡張機能ディレクトリで
cd apps/extension
npm install
```

**何が起きているか**: `package.json` に記載された依存パッケージ（Vite、TypeScript等）をインストールします。

### ステップ2: 拡張機能のビルド

**重要**: `manifest.json` や `contentScript.ts` を変更した場合は、必ず以下を実行してください:
1. `npm run build` で再ビルド
2. `chrome://extensions/` で拡張機能の「再読み込み」ボタン（🔄）をクリック
3. Amazon商品ページを**リロード**（F5 または Cmd+R）

これにより、変更が確実に反映されます。

```bash
# プロジェクトルートから実行（推奨）
npm run build:extension

# または、apps/extension ディレクトリで実行
cd apps/extension
npm run build
```

**注意**: Webアプリのビルド（`npm run build` または `npm run build:web`）では拡張機能はビルドされません。必ず `npm run build:extension` を使用してください。

**何が起きているか**: 
- `vite build` が実行され、TypeScriptファイル（`.ts`）がJavaScript（`.js`）にコンパイルされます
- `src/popup.html` が `dist/popup.html` にコピーされます（Viteのビルドで `dist/src/popup.html` に生成される場合があるため、プラグインで `dist` 直下にコピー）
- `src/background.ts` が `dist/background.js` にコンパイルされます
- `src/contentScript.ts` が `dist/contentScript.js` にコンパイルされます
- `src/popup.ts` が `dist/popup.js` にコンパイルされます
- `src/manifest.json` が `dist/manifest.json` にコピーされます
- すべてのファイルが `apps/extension/dist` フォルダに出力されます
- **自動検証スクリプト** (`verify-dist.mjs`) が実行され、distフォルダの整合性をチェックします

**ビルド成功の確認**:
- ターミナルに `✅ All checks passed! dist folder is ready for Chrome extension.` と表示される
- 以下のファイルが `apps/extension/dist` に存在する:
  - `manifest.json`
  - `popup.html`
  - `popup.js`
  - `background.js`
  - `contentScript.js`

### ステップ3: Chromeに拡張機能を読み込む

1. **Chromeで拡張機能管理ページを開く**
   - アドレスバーに `chrome://extensions/` と入力してEnter
   - または、メニュー → その他のツール → 拡張機能

2. **デベロッパーモードを有効化**
   - ページ右上の「デベロッパーモード」トグルをONにする
   - これにより、パッケージ化されていない拡張機能を読み込めるようになります

3. **拡張機能を読み込む**
   - 「パッケージ化されていない拡張機能を読み込む」ボタンをクリック
   - ファイル選択ダイアログが開きます
   - **重要**: 以下のフォルダを選択してください:
     - ✅ **正しい**: `apps/extension/dist` フォルダ
     - ❌ **間違い**: `apps/extension` フォルダ（親フォルダ）
     - ❌ **間違い**: `apps/extension/src` フォルダ
   
   **パスの確認方法**:
   - プロジェクトルートから見て: `~/Desktop/重要/Amazon_AI_page_Checker/apps/extension/dist`
   - このフォルダの中に `manifest.json` が存在することを確認してください
   
   **エラーが出た場合**:
   - `Manifest file is missing or unreadable` または `Could not load manifest` というエラーが出た場合:
     - **原因**: `apps/extension` フォルダを選択してしまった可能性があります
     - **対処**: `apps/extension/dist` フォルダを選択してください
     - **確認**: 選択するフォルダの中に `manifest.json` が存在することを確認してください

4. **正しいフォルダを選択**
   - **重要**: `apps/extension/dist` フォルダを選択してください
   - `apps/extension` や `apps/extension/src` ではなく、**`dist`** フォルダです
   - フォルダを開いて中身を見て、`manifest.json` が存在することを確認してから選択

5. **読み込み成功の確認**
   - 拡張機能一覧に「FITPEAK Analyzer」が表示されれば成功
   - エラーが表示された場合は、下記の「よくある失敗例」を確認してください

### よくある失敗例と対処法

#### ❌ エラー: "Manifest file is missing or unreadable" / "Could not load manifest" / "マニフェストファイルが見つかりません"

**原因**: 
- `dist` フォルダではなく、`src` フォルダや `apps/extension` フォルダを選択した
- ビルドが実行されていない（`dist` フォルダが存在しない）

**対処法**:
1. **正しいフォルダを選択しているか確認**:
   - ✅ **正しい**: `apps/extension/dist` フォルダ
   - ❌ **間違い**: `apps/extension` フォルダ（親フォルダ）
   - ❌ **間違い**: `apps/extension/src` フォルダ
   
2. **ビルドを実行**:
   ```bash
   cd apps/extension
   npm run build
   ```

3. **`dist` フォルダの内容を確認**:
   - `apps/extension/dist/manifest.json` が存在することを確認
   - ターミナルで `ls apps/extension/dist/` を実行して、以下のファイルが存在することを確認:
     - `manifest.json`
     - `popup.html`
     - `popup.js`
     - `background.js`
     - `contentScript.js`

4. **Chromeで再度読み込む**:
   - `chrome://extensions/` を開く
   - 既に読み込まれている場合は「削除」してから再度読み込む
   - 「パッケージ化されていない拡張機能を読み込む」をクリック
   - **`apps/extension/dist` フォルダを選択**（`dist` フォルダの中に `manifest.json` があることを確認してから選択）

#### ❌ エラー: "サービスワーカー 'background.js' を読み込めませんでした"

**原因**:
- `dist/background.js` が存在しない
- ビルドが失敗している

**対処法**:
1. ビルドログを確認してエラーがないか確認
2. `apps/extension/dist/background.js` が存在することを確認
3. 存在しない場合は、`npm run build` を再実行

#### ❌ エラー: "popup.html が見つかりません"

**原因**:
- `dist/popup.html` が存在しない
- ビルドが失敗している

**対処法**:
1. `apps/extension/dist/popup.html` が存在することを確認
2. 存在しない場合は、`npm run build` を再実行

#### ❌ 拡張機能は読み込めたが、アイコンが表示されない

**原因**:
- アイコンファイル（`icon16.png`等）が存在しない
- 現在はアイコンファイルはオプションなので、機能には影響しません

**対処法**:
- アイコンが必要な場合は、`apps/extension/dist/` に `icon16.png`, `icon48.png`, `icon128.png` を配置し、`manifest.json` の `icons` セクションを有効化してください

### 開発中の再ビルド

コードを変更した場合は、再度ビルドが必要です：

```bash
# プロジェクトルートから
npm run build:extension

# または、拡張機能ディレクトリで
cd apps/extension
npm run build
```

**重要**: Webアプリのビルド（`npm run build`）では拡張機能はビルドされません。必ず `npm run build:extension` を使用してください。

**重要**: `manifest.json` や `contentScript.ts` を変更した場合は、必ず以下を実行してください:
1. `npm run build` で再ビルド
2. `chrome://extensions/` で拡張機能の「再読み込み」ボタン（🔄）をクリック
3. Amazon商品ページを**リロード**（F5 または Cmd+R）

これにより、変更が確実に反映されます。特に `content_scripts` の変更は、ページのリロードが必要です。

**自動再ビルド（開発用）**:
```bash
cd apps/extension
npm run dev
```
これにより、ファイル変更時に自動的に再ビルドされます。

## デバッグ手順

### 1. 接続テスト

1. Amazon商品ページを開く
2. 拡張機能のアイコンをクリックしてpopupを開く
3. API_URL, API_KEY, userId を設定して「設定を保存」
4. 「接続テスト」ボタンをクリック
5. 結果を確認:
   - ✓ 接続成功: Status, レイテンシ, 環境, DB状態が表示される
   - ✗ 接続失敗: エラー種別、メッセージ、対処法が表示される

### 2. Score/Deep/Super実行時のログ確認

1. Service Workerのログを確認:
   - `chrome://extensions/` で拡張機能の「サービスワーカー」リンクをクリック
   - Consoleタブでログを確認

2. ログレベルを変更:
   - `chrome.storage.local.set({ LOG_LEVEL: "debug" })` を実行
   - デフォルトは `info`（最小ログ）
   - `off` でログを無効化

3. ログ形式:
   ```
   [EXT][analyze:score] POST /api/analyze/score-extension status=200 elapsed=842ms payload=120kb
   ```

### 3. エラー分類

- **CORS/Network**: API_URLが正しいか、CORS設定を確認
- **401 認証エラー**: API_KEYが未設定または不一致
- **403 アクセス拒否**: userId不正/未登録、またはUsage Guard制限
- **413 Payload過大**: 画像データを圧縮するかサイズを削減
- **5xx サーバーエラー**: サーバーのログを確認

## API デバッグヘッダー

`/api/analyze/*-extension` エンドポイントは以下のデバッグヘッダーを返します:

- `x-request-id`: リクエストID（UUID）
- `x-usage-remaining-score`: Score残り回数
- `x-usage-remaining-deep`: Deep残り回数
- `x-usage-remaining-super`: Super残り回数
- `x-reset-date-score`: Scoreリセット日時
- `x-reset-date-month`: 月次リセット日時

## ファイル構成

### Backend
- `src/app/api/health/route.ts` - ヘルスチェックエンドポイント
- `src/app/api/analyze/*-extension/route.ts` - 拡張機能用API（debugヘッダー付き）

### Extension
- `apps/extension/src/lib/apiClient.ts` - 共通APIクライアント（ログ機能付き）
- `apps/extension/src/storage.ts` - 設定管理
- `apps/extension/src/popup.ts` - Popup UI（接続テスト機能付き）
- `apps/extension/src/background.ts` - Service Worker（ログ出力）

## トラブルシューティング

### 接続テストが失敗する場合

1. **CORSエラー**: 
   - API_URLが正しいか確認
   - バックエンドのCORS設定を確認（`/api/health` はCORS許可済み）

2. **401エラー**:
   - API_KEYが正しく設定されているか確認
   - バックエンドの `EXTENSION_API_KEY` と一致しているか確認

3. **403エラー**:
   - userIdが正しく設定されているか確認
   - ユーザーがデータベースに存在するか確認
   - Usage Guardの制限に引っかかっていないか確認

### ログが表示されない場合

1. Service WorkerのConsoleを開いているか確認
2. `LOG_LEVEL` が `off` になっていないか確認
3. ブラウザのConsoleフィルタで `[EXT]` を検索

## 最終チェックリスト：この状態なら必ず読み込める

以下の条件をすべて満たしていれば、`chrome://extensions/` で `apps/extension/dist` を選択すれば必ず読み込めます：

### ✅ ビルド前の確認

- [ ] `apps/extension/package.json` が存在する
- [ ] `apps/extension/src/manifest.json` が存在する
- [ ] `apps/extension/src/popup.html` が存在する
- [ ] `apps/extension/src/background.ts` が存在する
- [ ] `apps/extension/src/contentScript.ts` が存在する

### ✅ ビルド実行

- [ ] `cd apps/extension` でディレクトリ移動
- [ ] `npm install` で依存関係をインストール（初回のみ）
- [ ] `npm run build:extension` で拡張機能をビルド（`npm run build` ではない）
- [ ] ビルドがエラーなく完了した

### ✅ dist フォルダの確認

`apps/extension/dist` フォルダに以下のファイルが存在することを確認：

- [ ] `manifest.json` が存在する
- [ ] `manifest.json` の `manifest_version` が `3` になっている
- [ ] `popup.html` が存在する
- [ ] `popup.js` が存在する
- [ ] `background.js` が存在する
- [ ] `contentScript.js` が存在する

### ✅ manifest.json の内容確認

`apps/extension/dist/manifest.json` を開いて確認：

- [ ] `"manifest_version": 3` になっている
- [ ] `"background.service_worker"` が `"background.js"` を指している（`dist` 内のファイル名）
- [ ] `"action.default_popup"` が `"popup.html"` を指している（`dist` 内のファイル名）
- [ ] `"content_scripts[0].js"` が `["contentScript.js"]` を指している（`dist` 内のファイル名）

### ✅ Chromeでの読み込み

- [ ] `chrome://extensions/` を開いた
- [ ] 「デベロッパーモード」をONにした
- [ ] 「パッケージ化されていない拡張機能を読み込む」をクリックした
- [ ] **`apps/extension/dist` フォルダを選択した**（`src` や親フォルダではない）
- [ ] エラーなく読み込まれた
- [ ] 拡張機能一覧に「FITPEAK Analyzer」が表示された

### ✅ 動作確認

- [ ] 拡張機能のアイコンが表示される（アイコンがなくても機能は動作します）
- [ ] アイコンをクリックしてpopupが開く
- [ ] Amazon商品ページで拡張機能が動作する

---

**このチェックリストをすべて満たしていれば、拡張機能は正常に読み込まれます。**
