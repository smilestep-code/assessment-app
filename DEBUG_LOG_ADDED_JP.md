# デバッグログ追加: "職業生活__欠席等の連絡" キー追跡

## 📋 概要

CSV読み込み処理で、特定のキー **"職業生活__欠席等の連絡"** について、以下の値を詳細にトレースするデバッグログを追加しました:

1. `scoreMap.get(key)` の値（CSVから読み込んだ値）
2. `newScores[index]` の値（内部配列への代入値）
3. `currentAssessment.scores[index]` の値（グローバル変数への反映値）
4. UIラジオボタンで実際に選択されている値（画面表示）

---

## 🔍 追加されたデバッグログ

### 1. scoreMap構築直後: キーの存在確認

```javascript
🔍🔍🔍 [特定キー追跡開始] 🔍🔍🔍
対象キー: "職業生活__欠席等の連絡"
scoreMapに存在: true/false
scoreMap.get("職業生活__欠席等の連絡") = [値]

// キーが存在しない場合は、類似キーを表示
⚠️ scoreMapに該当キーが存在しません
scoreMap内の全キー（職業生活カテゴリ）:
  - "職業生活__報告・連絡・相談"
  - "職業生活__職務に関する支援機器の使用"
  ...
```

### 2. assessmentItems走査中: 項目の発見とスコア代入

```javascript
✅ 対象項目を発見:
  カテゴリ: "職業生活"
  項目名: "欠席等の連絡"
  index: [番号]
  生成されたキー: "職業生活__欠席等の連絡"

📝 newScoresへの代入:
  newScores[[index]] = [スコア値]
```

### 3. currentAssessmentへの反映

```javascript
📊 currentAssessment.scoresへの反映:
  currentAssessment.scores[[index]] = [スコア値]
```

### 4. UI描画後: ラジオボタン状態の確認（100ms後）

```javascript
🎨 UI描画後のラジオボタン状態:
  対象index: [番号]
  選択中のスコア（UIラジオボタン）: [値]
  期待値（scoreMap）: [値]
  期待値（newScores）: [値]
  期待値（currentAssessment）: [値]
  ✅ 一致しています！
  // または
  ❌ 不一致！ UI=[値], scoreMap=[値]

🔍🔍🔍 [特定キー追跡終了] 🔍🔍🔍
```

---

## 🧪 使用方法

### 1. CSV読み込み手順

1. アプリを開く: https://smilestep-code.github.io/assessment-app/
2. **キャッシュクリア**: Ctrl+Shift+R (重要！)
3. ブラウザの開発者ツールを開く: F12 → Console タブ
4. 「CSV読込」ボタンをクリック
5. 「欠席等の連絡」項目を含むCSVファイルを選択

### 2. コンソールログの確認

CSV読み込み後、コンソールに以下の情報が自動的に表示されます:

```
📊 CSV読み込み開始: {データ行数: X, ヘッダ: Array(11)}

📋 scoreMap サンプル [カテゴリ: 基本的労働習慣]:
┌─────────┬────────────────────────────┬───────┐
│ (index) │            key             │ score │
├─────────┼────────────────────────────┼───────┤
...

🔍🔍🔍 [特定キー追跡開始] 🔍🔍🔍
対象キー: "職業生活__欠席等の連絡"
scoreMapに存在: true
scoreMap.get("職業生活__欠席等の連絡") = 4

✅ 対象項目を発見:
  カテゴリ: "職業生活"
  項目名: "欠席等の連絡"
  index: 15
  生成されたキー: "職業生活__欠席等の連絡"

📝 newScoresへの代入:
  newScores[15] = 4

📊 currentAssessment.scoresへの反映:
  currentAssessment.scores[15] = 4

🎨 UI描画後のラジオボタン状態:
  対象index: 15
  選択中のスコア（UIラジオボタン）: 4
  期待値（scoreMap）: 4
  期待値（newScores）: 4
  期待値（currentAssessment）: 4
  ✅ 一致しています！

🔍🔍🔍 [特定キー追跡終了] 🔍🔍🔍
```

---

## 🐛 トラブルシューティング

### ケース1: キーが見つからない

```
⚠️ scoreMapに該当キーが存在しません
scoreMap内の全キー（職業生活カテゴリ）:
  - "職業生活__報告・連絡・相談"
  - "職業生活__職務に関する支援機器の使用"
```

**原因**: CSVの項目名とitems.jsonの項目名が一致していない

**対処法**:
1. CSVの「職業生活」カテゴリの項目名を確認
2. items.jsonの対応する項目名を確認
3. 正規化処理後のキーが表示されるので、スペースや改行の有無を確認

### ケース2: UIの値が期待値と異なる

```
🎨 UI描画後のラジオボタン状態:
  選択中のスコア（UIラジオボタン）: 3
  期待値（scoreMap）: 4
  ❌ 不一致！ UI=3, scoreMap=4
```

**原因**: 
- `currentAssessment.scores` への代入前に値が変更された
- UI描画処理で別の値が参照された
- イベントリスナーが意図しない動作をした

**対処法**:
1. `newScores` と `currentAssessment.scores` の値を比較
2. `renderAssessmentItems()` 関数内の `currentScore` 変数の値を確認
3. 他のイベントリスナーがスコアを上書きしていないか確認

---

## 📝 変更内容の詳細

### 修正ファイル

1. **js/assessment.js**
   - 行数: 約900-1000行付近
   - 追加内容:
     - scoreMap構築後のキー存在確認ログ
     - assessmentItems走査中の項目発見ログ
     - newScoresへの代入ログ
     - currentAssessmentへの反映ログ
     - UI描画後のラジオボタン状態確認ログ（100ms遅延）

2. **index.html**
   - バージョン更新: `?v=202602120252` → `?v=202602180100`
   - 行15: CSSファイルのバージョン
   - 行226: JavaScriptファイルのバージョン

---

## 🎯 デバッグの目的

このデバッグログにより、以下が明確になります:

1. **CSVパース正常性**: scoreMapに正しい値が格納されているか
2. **キー生成正常性**: makeItemKey()が期待通りのキーを生成しているか
3. **配列マッピング正常性**: indexベースの配列に正しく値が移されているか
4. **UI描画正常性**: 最終的にUIに正しい値が表示されているか
5. **不一致箇所の特定**: どの段階で値がずれているかを正確に把握

---

## 🚀 デプロイ情報

- **バージョン**: 202602180100
- **コミット**: (次のコミットで確定)
- **GitHub Pages**: https://smilestep-code.github.io/assessment-app/
- **ブランチ**: main

---

## 📊 期待される結果

### 正常時の出力例

すべての値が一致している場合:

```
scoreMap.get("職業生活__欠席等の連絡") = 5
newScores[15] = 5
currentAssessment.scores[15] = 5
選択中のスコア（UIラジオボタン）: 5
✅ 一致しています！
```

### 異常時の出力例

値が途中で変わっている場合:

```
scoreMap.get("職業生活__欠席等の連絡") = 5
newScores[15] = 5
currentAssessment.scores[15] = 4  ← ここで変化
選択中のスコア（UIラジオボタン）: 4
❌ 不一致！ UI=4, scoreMap=5
```

この場合、`newScores[15] = 5` から `currentAssessment.scores[15] = 4` への代入時に問題があることがわかります。

---

**作成日**: 2026-02-18  
**バージョン**: 202602180100  
**対象ファイル**: js/assessment.js, index.html  
**ステータス**: ✅ デバッグログ追加完了
