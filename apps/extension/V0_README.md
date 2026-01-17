# V0 UI Component - Amazon Score Analyzer

このファイルは、V0（VercelのAI UI生成ツール）でUIを改善するために作成されました。

## ファイル構成

- `V0_UI_COMPONENT.tsx` - メインのUIコンポーネント（V0に渡すファイル）

## V0での使用方法

1. V0（https://v0.dev）を開く
2. `V0_UI_COMPONENT.tsx` の内容をコピー＆ペースト
3. プロンプトに以下を入力：
   ```
   このAmazon商品ページのスコア分析UIを改善してください。
   現在の機能を維持しつつ、よりモダンで使いやすいUIにしてください。
   ```

## 現在の機能

### 主要機能
- **URL/ASIN入力**: Amazon商品ページのURLまたはASINを入力
- **Run Score**: スコア分析を実行（usage消費あり）
- **Dry Run**: スコア分析を実行（usage消費なし）
- **実行履歴**: 最新5件の実行履歴を表示・選択可能
- **ステータス表示**: 実行状態（待機中、データ収集中、API呼び出し中、完了、エラー）を表示
- **デバッグ情報**: 収集したsignalsの要約を表示
- **エラー表示**: エラー発生時に詳細を表示

### スコア結果表示
- **総合スコア**: 0-100点のスコアと評価（Excellent/Good/Needs work/Critical）
- **セクション別スコア**: 
  - メイン画像（20点）
  - サブ画像（30点）
  - 説明文（5点）
  - レビュー（20点）
  - A+コンテンツ（15点）
  - ブランドコンテンツ（5点）
- **Missing Signals**: 不足しているデータのリスト
- **Notes**: 分析結果のメモ

## UI構造

### レイアウト
- **2カラムレイアウト**（デスクトップ）:
  - 左: 入力パネル（URL/ASIN、ボタン、履歴、ステータス）
  - 右: 結果パネル（スコア、セクション別スコア、Missing Signals、Notes）
- **1カラムレイアウト**（モバイル）: 縦に並ぶ

### コンポーネント
- `ScoreExtensionUI`: メインコンポーネント
- `ScoreAnalyzerPanel`: 左側の入力パネル
- `ScoreResultPanel`: 右側の結果パネル
- `ScoreSectionCard`: セクション別スコアカード

## 技術スタック

- **React**: useState, useCallback, useEffect
- **shadcn/ui**: Button, Card, Input, Label, Badge, Progress, Separator, Accordion, Sheet
- **lucide-react**: BarChart3, Loader2, X, History, AlertTriangle
- **Tailwind CSS**: スタイリング

## Chrome Extension固有の部分

このコンポーネントはChrome Extension内で動作するため、以下のAPIを使用しています：

- `chrome.runtime.sendMessage`: バックグラウンドサービスワーカーとの通信
- `window.postMessage`: コンテンツスクリプトとの通信

V0でプレビューする際は、`chrome.runtime.sendMessage`がない場合のモック実装が含まれています。

## 改善のポイント（V0に依頼する内容）

1. **UI/UXの改善**:
   - よりモダンなデザイン
   - より直感的な操作
   - レスポンシブデザインの最適化

2. **視覚的な改善**:
   - カラースキームの改善
   - アニメーションの追加
   - アイコンの最適化

3. **機能的な改善**:
   - エラーハンドリングの改善
   - ローディング状態の改善
   - アクセシビリティの向上

4. **パフォーマンス**:
   - レンダリングの最適化
   - メモ化の追加

## 注意事項

- V0で生成されたコードを元のプロジェクトに統合する際は、Chrome Extension固有の部分（`chrome.runtime.sendMessage`など）を元の実装に戻す必要があります
- 型定義やユーティリティ関数は、元のプロジェクトの実装と整合性を保つ必要があります
