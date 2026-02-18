# 【CSV パース確定＆修正】transformHeader + ROW PARSE DEBUG

## 実装日時
2026-02-18 02:50

## 問題の確定

### 現象
- `importScoreMap.get("職業生活__欠席等の連絡")` が **4** になっている
- CSV 原本では同項目のスコアは **5**
- つまり **CSV→row→score の段階で誤読/フォールバック**が起きている

### 根本原因
1. **ヘッダーに BOM や空白**が含まれ、`row["スコア"]` でアクセスできない
2. スコアが取れない場合の**フォールバック処理**が存在する可能性
3. デバッグログが不足しており、パース結果を確認できない

---

## 実装内容

### 1. デバッグログ（必須）

CSV パース後の各 row 処理で、**対象キーだけ**必ず出力：

```javascript
// ===== 【デバッグ（必須）】ROW PARSE DEBUG =====
// 対象キーだけ必ず出す
const categoryNorm = normalizeString(categoryRaw);
const itemNorm = normalizeString(itemNameRaw);
if (categoryNorm === "職業生活" && itemNorm === "欠席等の連絡") {
    console.log("\n=== ROW PARSE DEBUG START ===");
    console.log("row keys:", Object.keys(row));
    console.log("row['カテゴリ']:", row['カテゴリ']);
    console.log("row['項目']:", row['項目']);
    console.log("row['スコア']:", row['スコア'], "json:", JSON.stringify(row['スコア']));
    console.log("row['評価']:", row['評価'], "json:", JSON.stringify(row['評価']));
    console.log("=== ROW PARSE DEBUG END ===");
}
```

**効果**: 「スコア列が取れているか」を確定

### 2. PapaParse の transformHeader（必須）

BOM や空白で `row["スコア"]` が取れない問題を潰す：

#### Before（trimHeaders のみ）:
```javascript
Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    quoteChar: '"',
    trimHeaders: true,      // ← 不十分
    dynamicTyping: false
});
```

#### After（transformHeader 追加）:
```javascript
Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    quoteChar: '"',
    dynamicTyping: false,
    transformHeader: (h) => h.replace(/^\uFEFF/, '').trim()  // ← BOMと空白を除去
});
```

**効果**: ヘッダー名が確実に正規化される

### 3. スコア採用ルール（必須・ここ重要）

スコアは**必ず `row["スコア"]` だけ**を使う。評価列からの変換を**完全禁止**：

#### Before（複雑な処理）:
```javascript
const scoreTrimmed = String(scoreRaw || '').trim();
const scoreNum = Number(scoreTrimmed);
const score = (!isNaN(scoreNum) && scoreNum >= 1 && scoreNum <= 5) ? scoreNum : null;
```

#### After（シンプル＆厳格）:
```javascript
// ===== 【強制・重要】スコア採用ルール =====
// スコアは必ず row["スコア"] だけを使う。
// 評価列から点数変換するフォールバックを完全に禁止（削除）。
const scoreNum = Number(String(scoreRaw ?? '').trim());
const score = (scoreNum >= 1 && scoreNum <= 5) ? scoreNum : null;
// ※ scoreRawが取れない/NaNの時も「評価」から作らない。必ずnull。
```

**重要**: 
- `scoreRaw ?? ''` で undefined/null を '' に変換
- `Number()` で変換し、1〜5 の範囲チェック
- 範囲外や NaN は **null**（評価列からの変換は一切しない）

---

## 期待される出力

### 正常な場合（スコア=5）:

```
🔥🔥🔥 PapaParse によるCSV読み込み開始 🔥🔥🔥
📊 PapaParse 結果:
  パース成功: true
  データ行数: 26
  ヘッダ列（フィールド名）: ["記入日", "利用者名", ..., "カテゴリ", "項目", "スコア", "評価", "メモ"]

🔥🔥🔥 CSV インポート: 状態初期化開始 🔥🔥🔥
✅ currentAssessment.scores を全項目nullに初期化

🔥🔥🔥 importScoreMap構築開始（CSV専用・header名アクセス方式） 🔥🔥🔥

=== ROW PARSE DEBUG START ===
row keys: ["記入日", "利用者名", "管理番号", "評価実施者名", "評価期間開始", "評価期間終了", "カテゴリ", "項目", "スコア", "評価", "メモ"]
row['カテゴリ']: 職業生活
row['項目']: 欠席等の連絡
row['スコア']: 5 json: "5"
row['評価']: できる json: "できる"
=== ROW PARSE DEBUG END ===

=== CSV DEBUG ===
key: 職業生活__欠席等の連絡
row['スコア']= 5
row['評価']= できる
computed score= 5
=== CSV DEBUG END ===

=== POST IMPORT ===
職業生活__欠席等の連絡: 5
=== POST IMPORT END ===

✅ importScoreMap.get("職業生活__欠席等の連絡") = 5
🎉🎉🎉 達成条件クリア：スコアが5です！ 🎉🎉🎉
```

### ヘッダーが正規化されない場合（BOM問題）:

```
=== ROW PARSE DEBUG START ===
row keys: ["記入日", "利用者名", ..., "\uFEFFスコア", ...]  ← BOMが残っている
row['カテゴリ']: 職業生活
row['項目']: 欠席等の連絡
row['スコア']: undefined  ← 取得できない！
row['評価']: できる
=== ROW PARSE DEBUG END ===

computed score= null  ← スコアが取れず null になる
```

→ `transformHeader` でこの問題を解決

---

## 達成条件

すべて満たされること：

- ✅ **ROW PARSE DEBUG** で `row['スコア']` が `"5"` と出る
- ✅ `computed score` が `5` (number型)
- ✅ `importScoreMap.get("職業生活__欠席等の連絡")` が `5`
- ✅ `newScores[25]` が `5`
- ✅ `currentAssessment.scores[25]` が `5`
- ✅ UI で「欠席等の連絡」が `5` で復元される

---

## 確認手順

### ステップ1: アプリを開く
https://smilestep-code.github.io/assessment-app/

### ステップ2: キャッシュクリア
**Ctrl+Shift+R** (Windows/Linux) または **Cmd+Shift+R** (Mac)

### ステップ3: 開発者ツールを開く
**F12** → **Console** タブ

### ステップ4: CSV読み込み
「職業生活,欠席等の連絡」のスコア=5 のデータを含むCSVファイルを読み込む

### ステップ5: ログを確認

以下のログが順番に表示されることを確認：

1. ✅ `=== ROW PARSE DEBUG START ===`
2. ✅ `row keys:` で全ての列名が表示される
3. ✅ `row['スコア']: 5 json: "5"`
4. ✅ `=== CSV DEBUG ===` で `row['スコア']= 5`
5. ✅ `computed score= 5`
6. ✅ `=== POST IMPORT ===` で `職業生活__欠席等の連絡: 5`
7. ✅ `importScoreMap.get(...) = 5`

### ステップ6: UI確認
UI で「欠席等の連絡」のラジオボタンが **5** になっていることを確認

---

## 技術的ポイント

### 1. transformHeader の重要性

| 問題 | Before | After |
|------|--------|-------|
| BOM | `\uFEFFスコア` | `スコア` |
| 前後空白 | ` スコア ` | `スコア` |
| 両方 | `\uFEFF スコア ` | `スコア` |

**実装**:
```javascript
transformHeader: (h) => h.replace(/^\uFEFF/, '').trim()
```

### 2. スコア変換の厳格化

| ケース | Before | After |
|--------|--------|-------|
| `row['スコア']` が `"5"` | 5 | 5 |
| `row['スコア']` が `undefined` | ? | null |
| `row['スコア']` が `""` | ? | null |
| `row['スコア']` が `"6"` | 6 | null |

**ルール**:
- 1〜5 の範囲のみ有効
- 範囲外や NaN は **必ず null**
- 評価列からの変換は**一切しない**

### 3. デバッグログの配置

| フェーズ | ログ名 | 出力内容 |
|---------|--------|---------|
| row 取得直後 | ROW PARSE DEBUG | `row['スコア']` の生の値 |
| スコア計算後 | CSV DEBUG | `computed score` |
| ループ後 | POST IMPORT | `importScoreMap.get()` |

**効果**: パースの各段階を追跡可能

---

## 変更ファイル

```
modified:   index.html
  - バージョン v202602180250

modified:   js/assessment.js
  - transformHeader 追加（BOM + 空白除去）
  - ROW PARSE DEBUG 追加（対象キーのみ）
  - スコア変換を厳格化（評価列フォールバック禁止）
```

---

## 関連ドキュメント

- [SCOREMAP_REFERENCE_FIX.md](./SCOREMAP_REFERENCE_FIX.md)
- [CSV_IMPORT_ROOT_FIX.md](./CSV_IMPORT_ROOT_FIX.md)
- [CSV_IMPORT_ROOT_FIX_COMPLETION.md](./CSV_IMPORT_ROOT_FIX_COMPLETION.md)

---

## バージョン情報
- バージョン: v202602180250
- コミット: （次のコミットで記録）
- デプロイ: GitHub Pages（自動デプロイ）

---

## ⚠️ 重要な注意事項

1. **必ずキャッシュクリア**してください（Ctrl+Shift+R）
2. **ROW PARSE DEBUG が出ない場合**:
   - CSV に「職業生活」「欠席等の連絡」の行が存在しない
   - カテゴリ/項目名が正確に一致していない
3. **`row['スコア']` が undefined の場合**:
   - ヘッダー名に BOM や空白が含まれている
   - CSV の列名が「スコア」ではない（全角/半角の違いなど）

---

## ✨ 期待される成果

この修正により、以下が実現されます：

1. **ヘッダーの確実な正規化**: BOM や空白の影響を受けない
2. **パース結果の可視化**: ROW PARSE DEBUG で生の値を確認
3. **厳格なスコア変換**: 評価列への依存を完全排除
4. **確実なデータ反映**: CSV の値が正しく importScoreMap に格納される
