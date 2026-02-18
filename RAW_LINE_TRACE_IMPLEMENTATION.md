# RAW LINE TRACE実装レポート

## 実装日時
2026-02-18 02:10

## 問題の背景
`newScores[25]`（"職業生活__欠席等の連絡"）が期待値5ではなく4になる問題について、これまでのデバッグログでは：
- `scoreMap.set` のフックが発火しない
- CSV→scoreMapのログは出ているが、パース結果のみ表示
- **生のCSV行**（パース前の文字列）が見えていない

## 根本原因の仮説
カスタムCSVパーサー `parseCSVLine()` は正しく実装されているが、以下の可能性がある：
1. **CSVファイル自体**に不可視文字や特殊文字が含まれている
2. パーサーが正しく動作していても、**元データが誤っている**
3. 列インデックスのズレ（他の列のデータを読んでいる）

## 実装内容

### 1. 生のCSV行の保持
```javascript
// ===== 【RAW LINE TRACE】生のCSV行を保持 =====
const rawLines = lines.slice(1); // ヘッダを除く

dataRows.forEach((row, rowIndex) => {
    const rawLine = rawLines[rowIndex]; // 対応する生の行
```

### 2. 詳細デバッグログ追加
対象項目（カテゴリ=職業生活、項目=欠席等の連絡）について：

```javascript
console.log("🔥🔥🔥 RAW LINE (before parse):", JSON.stringify(rawLine));
console.log("parsed columns array:", row);
console.log("parsed columns.length:", row.length);
console.log("🔥🔥🔥 scoreRaw = row[" + colMap['スコア'] + "]:", scoreRaw, "json:", JSON.stringify(scoreRaw));
console.log("  row配列の全要素:");
row.forEach((cell, idx) => {
    console.log(`    [${idx}]: ${JSON.stringify(cell)}`);
});
```

### 3. 期待されるログ出力

#### スコアが正しく5の場合：
```
=== CSV->scoreMap DEBUG START ===
lineNo: 27
🔥🔥🔥 RAW LINE (before parse): "2025-02-18,田中太郎,U001,山田花子,2025-02-01,2025-02-15,職業生活,欠席等の連絡,5,できる,"
parsed columns array: ["2025-02-18", "田中太郎", "U001", "山田花子", "2025-02-01", "2025-02-15", "職業生活", "欠席等の連絡", "5", "できる", ""]
parsed columns.length: 11
  スコア列index: 8
  評価列index: 9
  メモ列index: 10
🔥🔥🔥 scoreRaw = row[8]: 5 json: "5"
  row配列の全要素:
    [0]: "2025-02-18"
    [1]: "田中太郎"
    [2]: "U001"
    [3]: "山田花子"
    [4]: "2025-02-01"
    [5]: "2025-02-15"
    [6]: "職業生活"
    [7]: "欠席等の連絡"
    [8]: "5"
    [9]: "できる"
    [10]: ""
score算出過程:
  1. trim: "5"
  2. Number(): 5
  3. 範囲チェック(1〜5): 5
final score: 5 type: number
key: "職業生活__欠席等の連絡"
=== CSV->scoreMap DEBUG END ===
```

#### スコアが誤って4になる場合の例：
```
🔥🔥🔥 RAW LINE (before parse): "2025-02-18,田中太郎,U001,山田花子,2025-02-01,2025-02-15,職業生活,欠席等の連絡,4,支援があればできる,"
...
🔥🔥🔥 scoreRaw = row[8]: 4 json: "4"
```

または列ズレの場合：
```
🔥🔥🔥 RAW LINE (before parse): "...,欠席等の連絡,5,できる,「連絡先に電話、メール送信できる」"
parsed columns array: [..., "欠席等の連絡", "5", "できる", "「連絡先に電話", "メール送信できる」"]
  row配列の全要素:
    [8]: "5"
    [9]: "できる"
    [10]: "「連絡先に電話"  ← メモ内のカンマでズレている
```

## デバッグ手順

1. アプリを開く: https://smilestep-code.github.io/assessment-app/
2. キャッシュクリア: **Ctrl+Shift+R**
3. F12 → Console
4. CSV読み込み実行（"職業生活,欠席等の連絡" のスコア=5 のデータを含むCSV）
5. コンソールで以下を確認：
   - `🔥🔥🔥 RAW LINE (before parse):` の出力
   - `parsed columns array:` の長さと内容
   - `row[8]` が正しく "5" になっているか
   - `final score: 5` になっているか
   - `scoreMap.get("職業生活__欠席等の連絡") = 5` になっているか

## 達成条件

- 生のCSV行が `JSON.stringify()` で完全に可視化される
- パース後の配列要素がすべて表示される
- スコア列のインデックスと実際の値が一致することが確認できる
- `scoreRaw` が "5" で、`final score` が 5 (number型) になる
- `scoreMap.get("職業生活__欠席等の連絡")` が 5 を返す

## 次のステップ

1. ログを確認し、生のCSV行に問題があるか判定
2. 問題が見つかった場合：
   - CSVファイル自体を修正（スコア列の値を5に）
   - または、パーサーのバグを修正
   - または、列インデックスのマッピングを修正
3. 問題が見つからない場合：
   - `newScores` への代入時のログを再確認
   - `renderAssessmentItems()` でのUI反映を確認

## 関連ドキュメント
- [NEWSCORES_25_TRACE_IMPLEMENTATION.md](./NEWSCORES_25_TRACE_IMPLEMENTATION.md)
- [SCOREMAP_SET_HOOK_IMPLEMENTATION.md](./SCOREMAP_SET_HOOK_IMPLEMENTATION.md)
- [DECISIVE_DEBUG_IMPLEMENTATION.md](./DECISIVE_DEBUG_IMPLEMENTATION.md)

## バージョン情報
- バージョン: v202602180210
- コミット: （次のコミットで記録）
- デプロイ: GitHub Pages（自動デプロイ）
