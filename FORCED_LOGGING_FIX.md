# 🔥 強制ログ実装 - CSV行の完全可視化

## 実装日時
2026-02-18 03:40 JST

## 問題の現状
- `importScoreMap.get("職業生活__欠席等の連絡")` が **4** のまま
- 対象行の `scoreRaw` 確認ログが出力されていない
- CSVの実際の行内容が不明確

## 実装内容

### 1. 強制ログ追加 (importScoreMap.set の前に配置)

```javascript
dataRows.forEach((line, lineIndex) => {
    // ===== 【強制ログ1】「欠席等の連絡」を含む行を必ず表示 =====
    if (line.includes("欠席等の連絡")) {
        const cols = line.split(",");
        console.log("\n=== HIT LINE RAW ===");
        console.log("line:", line);
        console.log("cols.length:", cols.length);
        console.log("cols[6](カテゴリ想定):", cols[6]);
        console.log("cols[7](項目想定):", cols[7]);
        console.log("cols[8](スコア想定):", cols[8]);
        console.log("cols[9](評価想定):", cols[9]);
        console.log("cols(all):", cols);
        console.log("=== HIT LINE RAW END ===\n");
    }
    
    // ... 既存の処理 ...
});
```

### 2. スコア決定ロジックの強制変更

```javascript
// ❌ 旧コード（scoreRaw変数を経由）
const scoreRaw = (cols[idxScore] ?? '').trim();
const scoreNum = Number(scoreRaw);
const score = (scoreNum >= 1 && scoreNum <= 5) ? scoreNum : null;

// ✅ 新コード（cols[idxScore]を直接使用）
const score = Number((cols[idxScore] ?? "").trim());
const finalScore = (score >= 1 && score <= 5) ? score : null;
```

**重要**: 評価列（`cols[9]` または `row['評価']`）からの点数変換処理は**完全に削除**

### 3. デバッグログの拡張

```javascript
if (key === '職業生活__欠席等の連絡') {
    console.log('\n=== CSV LINE DEBUG ===');
    console.log('CSV LINE DEBUG:', line);
    console.log('headers:', headers);
    console.log('idxCategory:', idxCategory, 'category:', category);
    console.log('idxItem:', idxItem, 'item:', item);
    console.log('idxScore:', idxScore, 'scoreRaw:', scoreRaw);
    console.log('score:', score, 'finalScore:', finalScore);
    console.log('=== CSV LINE DEBUG END ===');
}
```

## 期待されるコンソール出力

```
=== HIT LINE RAW ===
line: 2024-01-15,山田太郎,A001,評価者名,2024-01-01,2024-01-31,職業生活,欠席等の連絡,5,適切,メモ内容
cols.length: 11
cols[6](カテゴリ想定): 職業生活
cols[7](項目想定): 欠席等の連絡
cols[8](スコア想定): 5
cols[9](評価想定): 適切
cols(all): ["2024-01-15","山田太郎","A001","評価者名","2024-01-01","2024-01-31","職業生活","欠席等の連絡","5","適切","メモ内容"]
=== HIT LINE RAW END ===

=== CSV LINE DEBUG ===
CSV LINE DEBUG: 2024-01-15,山田太郎,A001,評価者名,2024-01-01,2024-01-31,職業生活,欠席等の連絡,5,適切,メモ内容
headers: ["記入日","利用者名","管理番号","評価実施者名","評価期間開始","評価期間終了","カテゴリ","項目","スコア","評価","メモ"]
idxCategory: 6 category: 職業生活
idxItem: 7 item: 欠席等の連絡
idxScore: 8 scoreRaw: 5
score: 5 finalScore: 5
=== CSV LINE DEBUG END ===

POST IMPORT KEY "職業生活__欠席等の連絡" = 5
🎉 達成条件: importScoreMap に 5 が格納されています！
```

## 達成条件

- ✅ **cols[8] が "5" と表示される** (強制ログで確認)
- ✅ **score が 5** (数値変換後)
- ✅ **finalScore が 5** (範囲チェック後)
- ✅ **importScoreMap.get("職業生活__欠席等の連絡") が 5**
- ✅ **newScores[25] が 5**
- ✅ **UI ラジオボタンが 5**

## もし cols[8] が "4" と表示される場合

以下を確認する必要があります:

1. **CSVファイル自体が間違っている**
   - ExcelまたはテキストエディタでCSVファイルを開き、該当行のスコア列を直接確認

2. **カンマを含むフィールドによる列ずれ**
   - `メモ` 列にカンマが含まれている場合、`split(',')` では正しく解析できない
   - → PapaParse を再導入するか、カスタムCSVパーサーを実装

3. **BOMや不可視文字の混入**
   - `JSON.stringify(cols[8])` で不可視文字を確認

4. **ヘッダー解析の失敗**
   - `idxScore` が 8 でない場合、ヘッダー行に問題がある

## 検証手順

1. **アプリを開く**: https://smilestep-code.github.io/assessment-app/
2. **キャッシュクリア**: Ctrl+Shift+R (Windows/Linux) または Cmd+Shift+R (Mac)
3. **DevTools Console を開く**: F12 → Console タブ
4. **CSVファイルをインポート**: 「職業生活,欠席等の連絡,5」を含むCSVファイルを選択
5. **コンソール出力を確認**:
   - `=== HIT LINE RAW ===` ブロックで `cols[8]` の値を確認
   - `POST IMPORT KEY` ブロックで最終的な値を確認
6. **UIを確認**: 評価項目「欠席等の連絡」のラジオボタンが「5」になっていることを確認

## デプロイ情報

- **Version**: v202602180340
- **Repository**: https://github.com/smilestep-code/assessment-app
- **GitHub Pages**: https://smilestep-code.github.io/assessment-app/
- **Deployment Status**: ✅ Auto-deployed via GitHub Actions

## 変更ファイル

- `js/assessment.js` (強制ログ追加、スコア決定ロジック変更)
- `FORCED_LOGGING_FIX.md` (本ドキュメント)

## 重要な注意事項

⚠️ **必ずキャッシュをクリアしてからテストしてください！**

ブラウザがキャッシュを使用していると、古いコードが実行されます。

**キャッシュクリア方法**:
- Chrome/Edge: Ctrl+Shift+R (Windows/Linux) または Cmd+Shift+R (Mac)
- Firefox: Ctrl+F5 (Windows/Linux) または Cmd+Shift+R (Mac)
- Safari: Cmd+Option+E → Cmd+R (Mac)
