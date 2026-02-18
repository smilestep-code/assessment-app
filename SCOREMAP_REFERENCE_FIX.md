# 【最終バグ修正】scoreMap 参照を完全削除

## 実装日時
2026-02-18 02:40

## 問題の確定

### 現象（ログより）
- `importScoreMap.has("職業生活__欠席等の連絡")` は **true**（CSV 側に値あり）
- しかし `newScores` への代入元が **`scoreMap.get(key)`** のままで、raw value が 4
- さらに **`Uncaught ReferenceError: scoreMap is not defined`** が発生

### 根本原因
CSV インポート処理（`reader.onload` 内）で、まだ **`scoreMap`** という変数を参照している箇所が残っていた。

---

## 修正内容

### 1. デバッグログの参照先を修正

#### Before（scoreMap 参照）:
```javascript
console.log("  from: scoreMap.get(key)");
console.log("  raw value from scoreMap:", score);
```

#### After（importScoreMap 参照）:
```javascript
console.log("  from: importScoreMap.get(key)");
console.log("  raw value from importScoreMap:", score);
```

### 2. 復元ログの表示名を修正

#### Before:
```javascript
restoreLog.push({
    index: index,
    key: key,
    'scoreMapから': score,  // ← 誤解を招く
    'UIに復元': newScores[index],
    '一致': score === newScores[index] ? '✅' : '❌'
});
```

#### After:
```javascript
restoreLog.push({
    index: index,
    key: key,
    'importScoreMapから': score,  // ← 正しい参照元を表示
    'UIに復元': newScores[index],
    '一致': score === newScores[index] ? '✅' : '❌'
});
```

### 3. UI 描画後の確認ログを修正

#### Before（scoreMap 参照）:
```javascript
console.log(`  期待値（scoreMap）: ${scoreMap.get(debugKey)}`);
// ...
if (selectedScore === scoreMap.get(debugKey)) {
    console.log(`  ✅ 一致しています！`);
} else {
    console.error(`  ❌ 不一致！ UI=${selectedScore}, scoreMap=${scoreMap.get(debugKey)}`);
}
```

#### After（importScoreMap 参照）:
```javascript
console.log(`  期待値（importScoreMap）: ${importScoreMap.get(debugKey)}`);
// ...
if (selectedScore === importScoreMap.get(debugKey)) {
    console.log(`  ✅ 一致しています！`);
} else {
    console.error(`  ❌ 不一致！ UI=${selectedScore}, importScoreMap=${importScoreMap.get(debugKey)}`);
}
```

### 4. インポート完了後の確認ログ追加（必須）

```javascript
// ===== 【インポート完了後の確認ログ（必須）】 =====
console.log('\n🔥🔥🔥 POST IMPORT KEY 確認 🔥🔥🔥');
console.log('POST IMPORT KEY "職業生活__欠席等の連絡" =', importScoreMap.get('職業生活__欠席等の連絡'));
if (importScoreMap.get('職業生活__欠席等の連絡') === 5) {
    console.log('🎉 達成条件: importScoreMap に 5 が格納されています！');
} else {
    console.error('❌ importScoreMap の値が 5 ではありません:', importScoreMap.get('職業生活__欠席等の連絡'));
}
```

---

## 修正箇所の詳細

### 修正箇所1: NEWSCORES TRACE のログ（line 1012-1014）
```javascript
console.log("  from: importScoreMap.get(key)");      // ← scoreMap → importScoreMap
console.log("  key:", JSON.stringify(key));
console.log("  raw value from importScoreMap:", score);  // ← scoreMap → importScoreMap
```

### 修正箇所2: 復元検証ログ（line 1039）
```javascript
'importScoreMapから': score,  // ← 'scoreMapから' → 'importScoreMapから'
```

### 修正箇所3: UI 描画後の確認ログ（line 1134-1141）
```javascript
console.log(`  期待値（importScoreMap）: ${importScoreMap.get(debugKey)}`);  // ← scoreMap → importScoreMap
// ...
if (selectedScore === importScoreMap.get(debugKey)) {  // ← scoreMap → importScoreMap
    console.log(`  ✅ 一致しています！`);
} else {
    console.error(`  ❌ 不一致！ UI=${selectedScore}, importScoreMap=${importScoreMap.get(debugKey)}`);  // ← scoreMap → importScoreMap
}
```

### 修正箇所4: POST IMPORT 確認ログ追加（line 961-969）
```javascript
console.log('\n🔥🔥🔥 POST IMPORT KEY 確認 🔥🔥🔥');
console.log('POST IMPORT KEY "職業生活__欠席等の連絡" =', importScoreMap.get('職業生活__欠席等の連絡'));
if (importScoreMap.get('職業生活__欠席等の連絡') === 5) {
    console.log('🎉 達成条件: importScoreMap に 5 が格納されています！');
} else {
    console.error('❌ importScoreMap の値が 5 ではありません:', importScoreMap.get('職業生活__欠席等の連絡'));
}
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

✅ importScoreMap.get("職業生活__欠席等の連絡") = 5
🎉🎉🎉 達成条件クリア：スコアが5です！ 🎉🎉🎉

✅ newScores を全項目nullに初期化

🔥🔥🔥 POST IMPORT KEY 確認 🔥🔥🔥
POST IMPORT KEY "職業生活__欠席等の連絡" = 5
🎉 達成条件: importScoreMap に 5 が格納されています！

🔥🔥🔥 newScores構築: importScoreMapのみ使用（既存scoreMap禁止） 🔥🔥🔥

=== NEWSCORES TRACE START ===
target index: 25
target key: "職業生活__欠席等の連絡"
before newScores[25]: null
ASSIGN SOURCE:
  from: importScoreMap.get(key)
  key: "職業生活__欠席等の連絡"
  raw value from importScoreMap: 5
  type: number
  importScoreMap.has(key): true
after newScores[25]: 5
=== NEWSCORES TRACE END ===

📊 currentAssessment.scoresへの反映:
  currentAssessment.scores[25] = 5

🎨 UI描画後のラジオボタン状態:
  選択中のスコア（UIラジオボタン）: 5
  期待値（importScoreMap）: 5
  期待値（newScores）: 5
  期待値（currentAssessment）: 5
  ✅ 一致しています！
```

---

## 達成条件

すべて満たされること：

- ✅ `scoreMap is not defined` エラーが消える
- ✅ `POST IMPORT KEY "職業生活__欠席等の連絡" = 5` が出る
- ✅ `raw value from importScoreMap: 5` が出る
- ✅ `newScores[25] = 5` になる
- ✅ `currentAssessment.scores[25] = 5` になる
- ✅ UI で「欠席等の連絡」が 5 で復元される

---

## 確認手順

1. **アプリを開く**: https://smilestep-code.github.io/assessment-app/
2. **キャッシュクリア**: **Ctrl+Shift+R**（必須！）
3. **F12** → **Console** タブ
4. CSV読み込み（"職業生活,欠席等の連絡" のスコア=5）
5. ログで以下を確認：
   - エラーが出ない（`scoreMap is not defined` が消える）
   - `POST IMPORT KEY "職業生活__欠席等の連絡" = 5`
   - `raw value from importScoreMap: 5`
   - `newScores[25] = 5`
   - `currentAssessment.scores[25] = 5`
   - UI のラジオボタンが 5
6. UI で「欠席等の連絡」のラジオボタンが **5** になっていることを確認

---

## 技術的ポイント

### scoreMap vs importScoreMap の完全分離

| 変数名 | スコープ | 用途 | CSV インポート時の使用 |
|--------|---------|------|----------------------|
| `scoreMap` | グローバル？ | 通常の評価処理 | ❌ 使用禁止 |
| `importScoreMap` | `reader.onload` 内 | CSV インポート専用 | ✅ 唯一のデータソース |

**重要**: CSV インポート処理（`reader.onload` 内）では、`scoreMap` を**一切参照しない**

### デバッグログの参照先統一

| ログ出力箇所 | Before | After |
|------------|--------|-------|
| NEWSCORES TRACE | `scoreMap.get(key)` | `importScoreMap.get(key)` |
| 復元検証ログ | `'scoreMapから'` | `'importScoreMapから'` |
| UI 描画後確認 | `scoreMap.get(debugKey)` | `importScoreMap.get(debugKey)` |

**効果**: すべてのログが正しいデータソースを示す

---

## バージョン情報
- バージョン: v202602180240
- コミット: （次のコミットで記録）
- デプロイ: GitHub Pages（自動デプロイ）

## 関連ドキュメント
- [CSV_IMPORT_ROOT_FIX.md](./CSV_IMPORT_ROOT_FIX.md)
- [CSV_IMPORT_ROOT_FIX_COMPLETION.md](./CSV_IMPORT_ROOT_FIX_COMPLETION.md)
