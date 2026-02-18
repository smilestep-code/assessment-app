# 【最終修正】PapaParse導入による CSV→scoreMap バグ修正

## 実装日時
2026-02-18 02:20

## 問題の確定
ログ解析により、`scoreMap.get("職業生活__欠席等の連絡")` が **4** になっており、その値が `newScores[25]` に代入されていることが確定。
→ **バグは CSV→scoreMap 生成処理にある**

## 根本原因
1. **列番号決め打ち方式** (`row[colMap['スコア']]`) による脆弱性
2. カスタムCSVパーサーは正しく実装されているが、**index ベースのアクセス**が問題
3. メモ列のカンマ、引用符、不可視文字などによる列ズレの可能性

## 実装内容

### 1. PapaParse 導入（CDN追加）
```html
<script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>
```

### 2. header名アクセス方式に統一
```javascript
const parseResult = Papa.parse(text, {
    header: true,           // ヘッダ行を列名として使用
    skipEmptyLines: true,   // 空行をスキップ
    quoteChar: '"',         // 引用符
    delimiter: ',',         // 区切り文字
    trimHeaders: true,      // ヘッダの前後空白を削除
    dynamicTyping: false    // 数値を自動変換しない（文字列として取得）
});

const dataRows = parseResult.data;  // オブジェクト配列: [{カテゴリ: "...", 項目: "...", スコア: "5", ...}, ...]
```

### 3. 列番号決め打ちを完全廃止
**Before（列番号方式）:**
```javascript
const categoryRaw = row[colMap['カテゴリ']];  // インデックス: row[6]
const scoreRaw = row[colMap['スコア']];        // インデックス: row[8]
```

**After（header名方式）:**
```javascript
const categoryRaw = row['カテゴリ'];  // 直接アクセス
const scoreRaw = row['スコア'];        // 直接アクセス
```

### 4. スコア計算を normalizeNumber() に統一
```javascript
const scoreRaw = row['スコア'];      // ← 必ず「スコア」列のみ
const score = normalizeNumber(scoreRaw);
```

`normalizeNumber()` の実装:
- trim() で前後空白除去
- 全角数字（０‑９）→ 半角数字（0-9）変換
- Number() で数値化
- 1〜5 の範囲チェック（範囲外は null）

### 5. 対象キー専用デバッグログ
```javascript
if (key === "職業生活__欠席等の連絡") {
    console.log("\n=== CSV->scoreMap SET DEBUG ===");
    console.log("row['スコア'] raw:", row['スコア'], "json:", JSON.stringify(row['スコア']));
    console.log("row['評価'] raw:", row['評価'], "json:", JSON.stringify(row['評価']));
    console.log("computed score:", score, "type:", typeof score);
    console.log("before has:", scoreMap.has(key), "before val:", scoreMap.get(key));
}

scoreMap.set(key, score);

if (key === "職業生活__欠席等の連絡") {
    console.log("after val:", scoreMap.get(key));
    console.log("=== CSV->scoreMap SET DEBUG END ===");
}
```

### 6. 重複キー警告
```javascript
if (scoreMap.has(key)) {
    console.warn("⚠️ DUPLICATE KEY:", key, "old:", scoreMap.get(key), "new:", score, "row:", row);
}
```

## 期待される出力

### 正常な場合（スコア=5）:
```
🔥🔥🔥 PapaParse によるCSV読み込み開始 🔥🔥🔥
📊 PapaParse 結果:
  パース成功: true
  データ行数: 26
  ヘッダ列（フィールド名）: ["記入日", "利用者名", "管理番号", "評価実施者名", "評価期間開始", "評価期間終了", "カテゴリ", "項目", "スコア", "評価", "メモ"]
  最初のデータ行（オブジェクト形式）: {カテゴリ: "職業生活", 項目: "欠席等の連絡", スコア: "5", 評価: "できる", ...}

🔥🔥🔥 scoreMap構築開始（header名アクセス方式） 🔥🔥🔥

=== CSV->scoreMap SET DEBUG ===
row['スコア'] raw: 5 json: "5"
row['評価'] raw: できる json: "できる"
computed score: 5 type: number
before has: false before val: undefined
after val: 5
=== CSV->scoreMap SET DEBUG END ===

✅ scoreMap.get("職業生活__欠席等の連絡") = 5
🎉🎉🎉 達成条件クリア：スコアが5です！ 🎉🎉🎉
```

### 重複キーが検出された場合:
```
⚠️ DUPLICATE KEY: 職業生活__欠席等の連絡 old: 4 new: 5 row: {カテゴリ: "職業生活", 項目: "欠席等の連絡", スコア: "5", ...}
```

## 達成条件

- ✅ `row['スコア'] raw` が "5"
- ✅ `computed score` が 5 (number型)
- ✅ `after val` が 5
- ✅ `scoreMap.get("職業生活__欠席等の連絡")` が 5
- ✅ `newScores[25]` が 5
- ✅ UI のラジオボタンが 5

## 変更ファイル

```
modified:   index.html
  - PapaParse CDN追加
  - バージョン v202602180220

modified:   js/assessment.js
  - カスタムCSVパーサー削除
  - PapaParse導入（header: true）
  - 列番号決め打ち方式（colMap[列名]）廃止
  - header名直接アクセス方式（row[列名]）に統一
  - normalizeNumber()によるスコア正規化
  - 対象キー専用デバッグログ追加
  - 重複キー警告追加
```

## 確認手順

1. **アプリを開く**: https://smilestep-code.github.io/assessment-app/
2. **キャッシュクリア**: **Ctrl+Shift+R**
3. **F12** → **Console** タブ
4. CSV読み込み（"職業生活,欠席等の連絡" のスコア=5 のデータを含む）
5. 以下のログを確認：
   - PapaParse 結果（オブジェクト形式）
   - `row['スコア'] raw: 5`
   - `computed score: 5`
   - `after val: 5`
   - `scoreMap.get("職業生活__欠席等の連絡") = 5`
   - `newScores[25] = 5`
   - UI のラジオボタンが 5

## 技術的メリット

### PapaParse の利点
1. **業界標準**: RFC 4180 準拠の CSV パーサー
2. **引用符処理**: ダブルクォート、エスケープを正しく処理
3. **header モード**: オブジェクト配列で直感的
4. **エラーハンドリング**: パースエラーを詳細に報告
5. **保守性**: カスタムコードより信頼性が高い

### header名アクセスの利点
1. **列順序に依存しない**: CSV の列順が変わっても動作
2. **可読性**: `row['スコア']` は `row[8]` より明確
3. **バグ減少**: インデックスズレのリスクがゼロ
4. **拡張性**: 新しい列を追加しやすい

## 関連ドキュメント
- [RAW_LINE_TRACE_IMPLEMENTATION.md](./RAW_LINE_TRACE_IMPLEMENTATION.md)
- [NEWSCORES_25_TRACE_IMPLEMENTATION.md](./NEWSCORES_25_TRACE_IMPLEMENTATION.md)

## バージョン情報
- バージョン: v202602180220
- コミット: （次のコミットで記録）
- PapaParse: 5.4.1
- デプロイ: GitHub Pages（自動デプロイ）
