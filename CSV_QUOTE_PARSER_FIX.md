# 🎯 CSV読み込み修正 - クォート対応パーサー実装

## 実装日時
2026-02-18 04:20 JST

## 問題の概要

CSV読み込み時に、CSV上のスコア（例: 5）がUIで別スコア（例: 4）として復元される不具合が発生していました。

### 原因

1. **列ずれの発生**: `line.split(',')` を使用しており、ダブルクォートやメモ内カンマで列がずれる
2. **アプリのCSV出力仕様**: 当アプリは全セルを `"..."` で囲む仕様のため、単純な `split(',')` では正しく解析できない
3. **キー生成の不一致**: `category + '__' + item` という単純な連結では、items.json 側と正規化方法が異なる
4. **スコア正規化の欠如**: `Number()` では全角数字や `"5.0"` などを正しく処理できない

### 具体例

```csv
"2024-01-15","山田太郎","A001","評価者名","2024-01-01","2024-01-31","職業生活","欠席等の連絡","5","適切","メモに、カンマが含まれる"
```

上記の行を `split(',')` で分割すると、メモ欄のカンマで列がずれ、スコア列が正しく読み取れない。

## 実装内容

### 1. クォート対応のCSVパーサー追加

`processImportedCSV` の直前に以下の関数を追加：

```javascript
// ===== クォート対応のCSVパーサー =====
function unquoteCsvCell(s) {
    if (s == null) return '';
    s = String(s).trim();
    if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
        s = s.slice(1, -1).replace(/""/g, '"');
    }
    return s;
}

function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        
        if (ch === ',' && !inQuotes) {
            out.push(cur);
            cur = '';
            continue;
        }
        
        cur += ch;
    }
    out.push(cur);
    return out.map(unquoteCsvCell);
}
```

**機能**:
- ダブルクォート内のカンマを無視
- エスケープされたダブルクォート (`""`) を正しく処理
- 各セルからクォートを除去して trim

### 2. 全ての `split(',')` を `parseCsvLine()` に置換

#### A) ヘッダー行の解析

```javascript
// ❌ 旧コード
const headers = header.split(',').map(h => h.replace(/^\uFEFF/, '').trim());

// ✅ 新コード
const headers = parseCsvLine(header).map(h => h.replace(/^\uFEFF/, '').trim());
```

#### B) 基本情報の1行目

```javascript
// ❌ 旧コード
const firstColumns = firstLine.split(',');

// ✅ 新コード
const firstColumns = parseCsvLine(firstLine);
```

#### C) 各データ行

```javascript
// ❌ 旧コード
const cols = line.split(',');

// ✅ 新コード
const cols = parseCsvLine(line);
```

### 3. スコア取得を `normalizeNumber()` に変更

```javascript
// ❌ 旧コード
const score = Number((cols[idxScore] ?? "").trim());
const finalScore = (score >= 1 && score <= 5) ? score : null;

// ✅ 新コード
const finalScore = normalizeNumber(cols[idxScore]);
```

**`normalizeNumber()` の機能**:
- 全角数字を半角に変換
- `"5.0"` → `5` に変換
- 1〜5 の範囲外は `null` を返す
- 空文字や無効な値は `null` を返す

### 4. キー生成を `makeItemKey()` に統一

```javascript
// ❌ 旧コード
const key = category + '__' + item;

// ✅ 新コード
const key = makeItemKey(category, item);
```

**`makeItemKey()` の機能**:
- `normalizeString()` で正規化（全角→半角、トリム、空白正規化）
- items.json 側と同じ正規化を適用
- 不要な空白やゼロ幅文字を除去

## 期待される効果

### ✅ 修正前の問題

| 問題 | 原因 | 影響 |
|------|------|------|
| 列ずれ | メモ欄のカンマ | スコアが間違った列から読み取られる |
| 全角数字 | `Number()` では処理できない | スコアが `NaN` になる |
| キー不一致 | 正規化方法が異なる | importScoreMap にキーが見つからない |
| クォート処理 | `split(',')` では対応不可 | セル内のカンマで分割される |

### ✅ 修正後の効果

| 効果 | 実装 | 結果 |
|------|------|------|
| 正確な列解析 | `parseCsvLine()` | メモ欄にカンマがあっても正しく解析 |
| 全角数字対応 | `normalizeNumber()` | "５" や "5.0" も正しく 5 に変換 |
| キー一致 | `makeItemKey()` | items.json 側と完全に一致 |
| クォート対応 | `unquoteCsvCell()` | `""` や `"` を正しく処理 |

## テストケース

### テストケース 1: メモにカンマが含まれる

**CSV行**:
```csv
"2024-01-15","山田太郎","A001","評価者名","2024-01-01","2024-01-31","職業生活","欠席等の連絡","5","適切","メモに、カンマ、が、含まれる"
```

**期待される結果**:
- `category`: "職業生活"
- `item`: "欠席等の連絡"
- `scoreRaw`: "5"
- `finalScore`: 5
- `memo`: "メモに、カンマ、が、含まれる"

### テストケース 2: メモにダブルクォートが含まれる

**CSV行**:
```csv
"2024-01-15","山田太郎","A001","評価者名","2024-01-01","2024-01-31","職業生活","欠席等の連絡","5","適切","彼は""それは良い""と言った"
```

**期待される結果**:
- `memo`: `彼は"それは良い"と言った` (エスケープが解除される)

### テストケース 3: 全角数字

**CSV行**:
```csv
"2024-01-15","山田太郎","A001","評価者名","2024-01-01","2024-01-31","職業生活","欠席等の連絡","５","適切","全角数字のテスト"
```

**期待される結果**:
- `scoreRaw`: "５"
- `finalScore`: 5 (`normalizeNumber()` が全角→半角変換)

### テストケース 4: 小数点スコア

**CSV行**:
```csv
"2024-01-15","山田太郎","A001","評価者名","2024-01-01","2024-01-31","職業生活","欠席等の連絡","5.0","適切","小数点のテスト"
```

**期待される結果**:
- `scoreRaw`: "5.0"
- `finalScore`: 5 (`normalizeNumber()` が整数化)

## 検証手順

### ステップ 1: アプリを開く

https://smilestep-code.github.io/assessment-app/

### ステップ 2: キャッシュをクリア

Ctrl+Shift+R (Windows) または Cmd+Shift+R (Mac)

### ステップ 3: 評価を入力してCSVエクスポート

1. いくつかの評価項目にスコアを入力
2. 特に「職業生活 > 欠席等の連絡」に **5** を入力
3. メモ欄に「テスト, メモ」（カンマ含む）を入力
4. CSV形式でエクスポート

### ステップ 4: CSVファイルを確認

1. エクスポートしたCSVをテキストエディタで開く
2. 全セルが `"..."` で囲まれていることを確認
3. 「職業生活,欠席等の連絡」の行でスコアが **"5"** であることを確認

### ステップ 5: CSVインポート

1. 新しい評価セッション開始（またはページリロード）
2. CSVインポート機能でステップ4のCSVを読み込む
3. DevTools Console を開く

### ステップ 6: Console ログを確認

以下のログが表示されることを確認：

```
🔥🔥🔥 READER.ONLOAD START 🔥🔥🔥
CSV TEXT LENGTH: xxxx
🔥🔥🔥 READER.ONLOAD TEXT CAPTURED 🔥🔥🔥

=== HIT LINE RAW ===
line: "2024-01-15","山田太郎",...,"5",...,"テスト, メモ"
cols.length: 11
cols[8](スコア想定): 5
=== HIT LINE RAW END ===

=== CSV LINE DEBUG ===
idxScore: 8 scoreRaw: 5
key (makeItemKey): 職業生活__欠席等の連絡
finalScore (normalizeNumber): 5
=== CSV LINE DEBUG END ===

POST IMPORT KEY "職業生活__欠席等の連絡" = 5
🎉 達成条件: importScoreMap に 5 が格納されています！
```

### ステップ 7: UIを確認

1. 評価項目「職業生活 > 欠席等の連絡」のラジオボタンが **5** になっていることを確認
2. メモ欄に「テスト, メモ」が正しく復元されていることを確認
3. 他のすべての評価項目も正しく復元されていることを確認

## 完了条件

- ✅ 当アプリが出力したCSV（全セルが `"..."`）をそのまま読み込んでも、スコアが1件もズレない
- ✅ メモ欄にカンマ（`,`）やダブルクォート（`"`）が入っていてもスコアがズレない
- ✅ 全角数字や小数点スコアも正しく処理される
- ✅ 「職業生活__欠席等の連絡」がCSVで5なら、UIでも必ず5が選択表示される
- ✅ キー生成が items.json 側と完全に一致する

## デプロイ情報

| 項目 | 値 |
|------|-----|
| **Version** | v202602180420 |
| **Repository** | https://github.com/smilestep-code/assessment-app |
| **GitHub Pages** | https://smilestep-code.github.io/assessment-app/ |
| **Deployment Status** | ✅ Auto-deployed via GitHub Actions |

## 変更ファイル

- `js/assessment.js` (クォート対応パーサー追加、すべての `split(',')` を置換)
- `index.html` (キャッシュバスター v=202602180420)
- `CSV_QUOTE_PARSER_FIX.md` (本ドキュメント)

## 技術的詳細

### parseCsvLine() の動作

```javascript
parseCsvLine('"a","b,c","d""e"')
// → ["a", "b,c", "d\"e"]
```

1. ダブルクォート内のカンマは無視
2. `""` は `"` にエスケープ解除
3. 各セルから外側のクォートを除去

### normalizeNumber() の動作

```javascript
normalizeNumber("５")     // → 5
normalizeNumber("5.0")    // → 5
normalizeNumber("5")      // → 5
normalizeNumber("0")      // → null (範囲外)
normalizeNumber("6")      // → null (範囲外)
normalizeNumber("abc")    // → null (無効)
normalizeNumber("")       // → null (空)
```

### makeItemKey() の動作

```javascript
makeItemKey("職業生活", "欠席等の連絡")
// → "職業生活__欠席等の連絡"

makeItemKey("職業生活　", "　欠席等の連絡")  // 全角空白
// → "職業生活__欠席等の連絡" (trim + 正規化)

makeItemKey("職業生活", "欠席等の連絡\u200B")  // ゼロ幅空白
// → "職業生活__欠席等の連絡" (正規化で除去)
```

## トラブルシューティング

### Q: まだスコアがズレる

**A**: 以下を確認してください：

1. キャッシュがクリアされているか（Ctrl+Shift+R）
2. Console に `v=202602180420` が表示されているか
3. `parseCsvLine()` 関数が定義されているか（Console で確認）
4. CSVファイルのフォーマットが正しいか（全セルが `"..."` で囲まれているか）

### Q: Console に「parseCsvLine is not defined」と表示される

**A**: 古いコードがキャッシュされています。以下を実行：

1. DevTools → Application タブ → Storage → "Clear site data"
2. ページをハードリロード（Ctrl+Shift+R）
3. 数分待ってから再度アクセス（GitHub Actions のデプロイ完了待ち）

### Q: デバッグログが表示されない

**A**: ログが大量になっている可能性があります。Console で以下のキーワードで検索：

- `HIT LINE RAW` - 対象行の検出
- `CSV LINE DEBUG` - 詳細デバッグ
- `POST IMPORT KEY` - 最終確認

## まとめ

この修正により、以下が達成されました：

1. **✅ クォート対応**: ダブルクォートで囲まれたCSVを正しく解析
2. **✅ カンマ対応**: メモ欄内のカンマで列がずれない
3. **✅ エスケープ対応**: `""` を `"` に正しく変換
4. **✅ 全角数字対応**: "５" も正しく 5 に変換
5. **✅ 小数点対応**: "5.0" も正しく 5 に変換
6. **✅ キー一致**: items.json 側と完全に一致するキー生成
7. **✅ 正規化統一**: `makeItemKey()` と `normalizeNumber()` で一貫性を確保

これにより、当アプリが出力したCSVを完全に正確にインポートできるようになりました。

---

**実装完了日時**: 2026-02-18 04:20 JST  
**実装者**: AI Assistant  
**ステータス**: ✅ 完了 & デプロイ準備完了
