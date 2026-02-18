# 【根本修正】CSV インポート処理の完全書き直し

## 実装日時
2026-02-18 02:30

## 問題の確定

### 現象
- CSV で「職業生活__欠席等の連絡」のスコアは **5**
- インポート後、`scoreMap.get("職業生活__欠席等の連絡")` が **4** のまま
- `newScores[25]` が 4 になる（CSV の値が反映されない）

### 根本原因
**CSVインポート処理が既存の値（currentAssessment / localStorage等）を参照し、CSV で上書きできていない**

具体的には：
1. インポート前の `currentAssessment.scores` が残っている
2. どこかで既存の `scoreMap` を参照している
3. CSV→scoreMap のログが出ないため、処理が実行されていない可能性

---

## 実装内容

### 1. 状態を完全初期化（既存値への依存を排除）

#### Before（既存値が残る）:
```javascript
const scoreMap = new Map();  // 既存のscoreMapと名前が被る可能性
// currentAssessment.scores はそのまま
```

#### After（完全初期化）:
```javascript
// currentAssessment.scores を全項目 null に初期化
currentAssessment.scores = {};
assessmentItems.forEach((item, index) => {
    currentAssessment.scores[index] = null;
});
console.log('✅ currentAssessment.scores を全項目nullに初期化');

// インポート専用のMap（既存のscoreMapは使わない）
const importScoreMap = new Map();
const importMemoMap = new Map();
```

### 2. importScoreMap を新規作成（既存 scoreMap とは別）

```javascript
console.log('🔥🔥🔥 importScoreMap構築開始（CSV専用・header名アクセス方式） 🔥🔥🔥');

dataRows.forEach((row, rowIndex) => {
    const categoryRaw = row['カテゴリ'];
    const itemNameRaw = row['項目'];
    const scoreRaw = row['スコア'];      // ← 必ず「スコア」列のみ
    const hyokaText = row['評価'] || '';  // 参照のみ（計算には使用しない）
    const memo = row['メモ'] || '';
    
    const key = makeItemKey(categoryRaw, itemNameRaw, false);
    
    // ===== 【強制】スコア算出: Number(String(row["スコア"]).trim()) のみ =====
    const scoreTrimmed = String(scoreRaw || '').trim();
    const scoreNum = Number(scoreTrimmed);
    const score = (!isNaN(scoreNum) && scoreNum >= 1 && scoreNum <= 5) ? scoreNum : null;
    
    importScoreMap.set(key, score);
    if (memo) {
        importMemoMap.set(key, memo);
    }
});
```

### 3. 決着ログ（必須）

#### CSV ループ中（対象キーのみ）:
```javascript
if (key === "職業生活__欠席等の連絡") {
    console.log("\n=== CSV DEBUG ===");
    console.log("key:", key);
    console.log("row['スコア']=", row['スコア']);
    console.log("row['評価']=", row['評価']);
    console.log("computed score=", score);
    console.log("=== CSV DEBUG END ===");
}
```

#### CSV ループ後:
```javascript
console.log("\n=== POST IMPORT ===");
console.log("職業生活__欠席等の連絡:", importScoreMap.get("職業生活__欠席等の連絡"));
console.log("=== POST IMPORT END ===");
```

### 4. newScores を importScoreMap だけから構築

#### Before（既存 scoreMap を参照）:
```javascript
if (scoreMap.has(key)) {
    const score = scoreMap.get(key);  // ← 既存のscoreMap
    newScores[index] = score;
}
```

#### After（importScoreMap のみ使用）:
```javascript
// newScores を全項目 null で初期化
const newScores = {};
const newMemos = {};
assessmentItems.forEach((item, index) => {
    newScores[index] = null;
    newMemos[index] = null;
});

// importScoreMap だけを見る（既存scoreMap禁止）
assessmentItems.forEach((item, index) => {
    const key = makeItemKey(item.category, item.name, false);
    
    if (importScoreMap.has(key)) {
        const score = importScoreMap.get(key);  // ← importScoreMapのみ
        if (score !== null) {
            newScores[index] = score;
        }
    }
    
    if (importMemoMap.has(key)) {
        newMemos[index] = importMemoMap.get(key);
    }
});
```

---

## 期待される出力

### 正常な場合（スコア=5）:

```
🔥🔥🔥 CSV インポート: 状態初期化開始 🔥🔥🔥
✅ currentAssessment.scores を全項目nullに初期化

🔥🔥🔥 importScoreMap構築開始（CSV専用・header名アクセス方式） 🔥🔥🔥

=== CSV DEBUG ===
key: 職業生活__欠席等の連絡
row['スコア']= 5
row['評価']= できる
computed score= 5
=== CSV DEBUG END ===

=== POST IMPORT ===
職業生活__欠席等の連絡: 5
=== POST IMPORT END ===

✅ importScoreMap.get("職業生活__欠席等の連絡") = 5 (type: number)
🎉🎉🎉 達成条件クリア：スコアが5です！ 🎉🎉🎉

🔥🔥🔥 newScores構築: importScoreMapのみ使用（既存scoreMap禁止） 🔥🔥🔥
✅ newScores を全項目nullに初期化

=== NEWSCORES TRACE START ===
target index: 25
target key: "職業生活__欠席等の連絡"
before newScores[25]: null
ASSIGN SOURCE:
  from: importScoreMap.get(key)
  raw value from importScoreMap: 5
after newScores[25]: 5
=== NEWSCORES TRACE END ===

📊 currentAssessment.scoresへの反映:
  currentAssessment.scores[25] = 5

🎨 UI描画後のラジオボタン状態:
  職業生活__欠席等の連絡: ラジオボタン値 = 5
```

---

## 達成条件

すべて満たされること：

- ✅ `CSV DEBUG` で `row['スコア']= 5` が出る
- ✅ `CSV DEBUG` で `computed score= 5` が出る
- ✅ `POST IMPORT` で `職業生活__欠席等の連絡: 5` が出る
- ✅ `importScoreMap.get("職業生活__欠席等の連絡") = 5` が出る
- ✅ `newScores[25] = 5` になる
- ✅ `currentAssessment.scores[25] = 5` になる
- ✅ UI のラジオボタンが 5 になる

---

## 変更内容の詳細

### A. 状態初期化の追加
```javascript
// 1. currentAssessment.scores を全項目 null に
currentAssessment.scores = {};
assessmentItems.forEach((item, index) => {
    currentAssessment.scores[index] = null;
});

// 2. importScoreMap を新規作成（既存scoreMapと分離）
const importScoreMap = new Map();
const importMemoMap = new Map();
```

### B. スコア計算の簡略化
```javascript
// normalizeNumber() を使わず、直接 Number() で変換
const scoreTrimmed = String(scoreRaw || '').trim();
const scoreNum = Number(scoreTrimmed);
const score = (!isNaN(scoreNum) && scoreNum >= 1 && scoreNum <= 5) ? scoreNum : null;
```

### C. 決着ログの追加
```javascript
// CSV ループ中
if (key === "職業生活__欠席等の連絡") {
    console.log("\n=== CSV DEBUG ===");
    console.log("key:", key);
    console.log("row['スコア']=", row['スコア']);
    console.log("row['評価']=", row['評価']);
    console.log("computed score=", score);
    console.log("=== CSV DEBUG END ===");
}

// CSV ループ後
console.log("\n=== POST IMPORT ===");
console.log("職業生活__欠席等の連絡:", importScoreMap.get("職業生活__欠席等の連絡"));
console.log("=== POST IMPORT END ===");
```

### D. newScores 構築の変更
```javascript
// 全項目 null で初期化
const newScores = {};
assessmentItems.forEach((item, index) => {
    newScores[index] = null;
});

// importScoreMap のみ使用（既存 scoreMap 禁止）
assessmentItems.forEach((item, index) => {
    const key = makeItemKey(item.category, item.name, false);
    
    if (importScoreMap.has(key)) {  // ← importScoreMap のみ
        const score = importScoreMap.get(key);
        if (score !== null) {
            newScores[index] = score;
        }
    }
});
```

---

## 確認手順

1. **アプリを開く**: https://smilestep-code.github.io/assessment-app/
2. **キャッシュクリア**: **Ctrl+Shift+R**（必須！）
3. **F12** → **Console** タブ
4. CSV読み込み（"職業生活,欠席等の連絡" のスコア=5）
5. ログで以下を確認：
   - `CSV インポート: 状態初期化開始`
   - `currentAssessment.scores を全項目nullに初期化`
   - `=== CSV DEBUG ===` で `row['スコア']= 5`
   - `computed score= 5`
   - `=== POST IMPORT ===` で `職業生活__欠席等の連絡: 5`
   - `importScoreMap.get(...) = 5`
   - `newScores[25] = 5`
   - `currentAssessment.scores[25] = 5`
6. UI で「欠席等の連絡」のラジオボタンが **5** になっていることを確認

---

## 技術的ポイント

### 1. 名前空間の分離
| 変数名 | 用途 | スコープ |
|--------|------|---------|
| `scoreMap` | （既存）グローバルまたは他の関数で使用 | 全体 |
| `importScoreMap` | CSV インポート専用 | インポート関数内 |

これにより、既存の `scoreMap` への依存を完全に排除。

### 2. 初期化のタイミング
```
CSV読み込み開始
  ↓
状態初期化（currentAssessment.scores = null）
  ↓
importScoreMap 作成（新規 Map）
  ↓
CSV パース → importScoreMap に投入
  ↓
newScores 作成（importScoreMap のみ使用）
  ↓
currentAssessment.scores に反映
  ↓
UI 描画
```

### 3. デバッグログの配置
- **CSV ループ中**: 対象キーのみ詳細ログ
- **CSV ループ後**: importScoreMap の最終値を確認
- **newScores 構築時**: index=25 の詳細トレース
- **UI 描画後**: ラジオボタンの状態確認

---

## バージョン情報
- バージョン: v202602180230
- コミット: （次のコミットで記録）
- デプロイ: GitHub Pages（自動デプロイ）

## 関連ドキュメント
- [PAPAPARSE_FINAL_FIX.md](./PAPAPARSE_FINAL_FIX.md)
- [PAPAPARSE_FINAL_FIX_COMPLETION.md](./PAPAPARSE_FINAL_FIX_COMPLETION.md)
