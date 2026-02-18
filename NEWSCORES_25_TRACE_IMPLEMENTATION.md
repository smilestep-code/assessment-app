# 【newScores[25] TRACE】実装完了

## 🎯 目的

newScores[25]（職業生活__欠席等の連絡）に4が入る原因を特定し、5に修正する。

---

## ✅ 実装内容

### newScores代入時の詳細トレース

```javascript
if (scoreMap.has(key)) {
    const score = scoreMap.get(key);
    
    // ===== 【NEWSCORES TRACE】index=25専用デバッグ =====
    if (index === 25 || key === debugKey) {
        console.log("\n=== NEWSCORES TRACE START ===");
        console.log("target index:", index);
        console.log("target key:", JSON.stringify(key));
        console.log("item.category:", JSON.stringify(item.category));
        console.log("item.name:", JSON.stringify(item.name));
        console.log("before newScores[" + index + "]:", newScores[index]);
        console.log("ASSIGN SOURCE:");
        console.log("  from: scoreMap.get(key)");
        console.log("  key:", JSON.stringify(key));
        console.log("  raw value from scoreMap:", score);
        console.log("  type:", typeof score);
        console.log("  scoreMap.has(key):", scoreMap.has(key));
    }
    
    if (score !== null) {
        newScores[index] = score;
        
        if (index === 25 || key === debugKey) {
            console.log("after newScores[" + index + "]:", newScores[index]);
            console.trace("STACK TRACE");
            console.log("=== NEWSCORES TRACE END ===");
        }
    }
}
```

---

## 🔍 期待される出力

### ケース1: 正常（scoreMapに5がある）

```
🔍🔍🔍 [特定キー追跡開始] 🔍🔍🔍
scoreMapに存在: true
✅ scoreMap.get("職業生活__欠席等の連絡") = 5 (type: number)

=== NEWSCORES TRACE START ===
target index: 25
target key: "職業生活__欠席等の連絡"
item.category: "職業生活"
item.name: "欠席等の連絡"
before newScores[25]: undefined
ASSIGN SOURCE:
  from: scoreMap.get(key)
  key: "職業生活__欠席等の連絡"
  raw value from scoreMap: 5
  type: number
  scoreMap.has(key): true
after newScores[25]: 5
STACK TRACE
    at assessment.js:1058
    at Array.forEach (<anonymous>)
=== NEWSCORES TRACE END ===

📝 newScoresへの代入:
  newScores[25] = 5

📊 currentAssessment.scoresへの反映:
  currentAssessment.scores[25] = 5

UI = 5
✅ 一致しています！
```

### ケース2: 異常（scoreMapに4がある）

```
🔍🔍🔍 [特定キー追跡開始] 🔍🔍🔍
scoreMapに存在: true
❌ 達成条件未達成：スコアが 4 です（期待値: 5）

=== NEWSCORES TRACE START ===
target index: 25
target key: "職業生活__欠席等の連絡"
before newScores[25]: undefined
ASSIGN SOURCE:
  from: scoreMap.get(key)
  key: "職業生活__欠席等の連絡"
  raw value from scoreMap: 4  ← ★ここが問題
  type: number
after newScores[25]: 4
=== NEWSCORES TRACE END ===
```

**原因**: scoreMapに4が入っている  
**対処**: CSV読み込み処理（scoreMap.set箇所）を確認

### ケース3: キーが存在しない

```
=== NEWSCORES TRACE START (KEY NOT FOUND) ===
target index: 25
target key: "職業生活__欠席等の連絡"
item.category: "職業生活"
item.name: "欠席等の連絡"
scoreMap.has(key): false
Available keys in scoreMap (職業生活):
  - "職業生活__報告・連絡・相談" → 3
  - "職業生活__職務に関する支援機器の使用" → 4
newScores[25] will remain undefined (not assigned)
=== NEWSCORES TRACE END ===
```

**原因**: キーが完全一致していない  
**対処**: 
- items.jsonの項目名を確認
- CSVの項目名を確認
- 正規化処理を確認

---

## 📋 達成条件

### ✅ 条件1: scoreMap.get()が5

```
scoreMap.get("職業生活__欠席等の連絡") = 5
```

### ✅ 条件2: newScores[25]が5

```
after newScores[25]: 5
```

### ✅ 条件3: currentAssessment.scores[25]が5

```
currentAssessment.scores[25] = 5
```

### ✅ 条件4: UIが5

```
選択中のスコア（UIラジオボタン）: 5
✅ 一致しています！
```

---

## 🐛 問題の特定と修正

### 問題1: scoreMapに4が入っている

**確認**:
```
scoreMap.get("職業生活__欠席等の連絡") = 4
raw value from scoreMap: 4
```

**原因**: CSV読み込み時のスコア算出が間違っている

**修正箇所**: CSV読み込み処理（dataRows.forEach内）

```javascript
// 【修正前】間違った列を参照
const scoreRaw = row[colMap['評価']];  // ← 評価列を使っている

// 【修正後】正しい列を参照
const scoreRaw = row[colMap['スコア']];  // ← スコア列を使う
```

### 問題2: キーが一致しない

**確認**:
```
scoreMap.has(key): false
Available keys:
  - "職業生活 __欠席等の連絡"  ← 余計なスペース
```

**原因**: 正規化処理が不完全

**修正**:
```javascript
function normalizeString(str) {
    return String(str || '')
        .trim()
        .replace(/\u3000/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[\r\n]+/g, '');
}
```

### 問題3: CSVパースが壊れている

**確認**:
```
raw value from scoreMap: できる  ← 評価列の値
```

**原因**: カラムがずれている（メモ列のカンマで split(',') が壊れた）

**修正**: PapaParse導入（または既存のparseCSVLine関数を確認）

---

## 🧪 テスト方法

### 手順

1. https://smilestep-code.github.io/assessment-app/
2. **Ctrl+Shift+R** でキャッシュクリア
3. **F12** → Console タブ
4. CSV読込
5. コンソールで以下を確認

### 確認ポイント

#### ステップ1: scoreMap確認

```
scoreMap.get("職業生活__欠席等の連絡") = ?
```

→ 5であることを確認。4の場合はCSV読み込み処理を修正

#### ステップ2: newScores TRACE

```
=== NEWSCORES TRACE START ===
raw value from scoreMap: ?
after newScores[25]: ?
=== NEWSCORES TRACE END ===
```

→ 両方とも5であることを確認

#### ステップ3: currentAssessment

```
currentAssessment.scores[25] = ?
```

→ 5であることを確認

#### ステップ4: UI

```
選択中のスコア（UIラジオボタン）: ?
```

→ 5であることを確認

---

## 📊 データフロー全体

```
CSV行
  ↓ parseCSVLine()
row配列
  ↓ row[colMap['スコア']]
scoreRaw ("5")
  ↓ Number(scoreRaw.trim())
score (5)
  ↓ scoreMap.set(key, score)
scoreMap.get("職業生活__欠席等の連絡") = 5
  ↓ newScores[25] = scoreMap.get(key)
newScores[25] = 5
  ↓ currentAssessment.scores = {...newScores}
currentAssessment.scores[25] = 5
  ↓ renderAssessmentItems()
UI表示 = 5
```

**どこかで4になっている場合**:
- scoreMap段階で4 → CSV読み込み処理を修正
- newScores段階で4 → scoreMapの値を確認
- currentAssessment段階で4 → 代入処理を確認
- UI段階で4 → renderAssessmentItems()を確認

---

## 📝 変更ファイル

1. **js/assessment.js**
   - newScores[index]代入時に詳細トレースログ追加
   - index=25専用のデバッグログ
   - キーが存在しない場合のログ
   - スタックトレース

2. **index.html**
   - バージョン更新: `?v=202602180150` → `?v=202602180200`

---

## 🚀 デプロイ情報

- **バージョン**: 202602180200
- **変更内容**: newScores[25]トレース実装
- **コミット**: （次のコミットで確定）
- **GitHub Pages**: https://smilestep-code.github.io/assessment-app/

---

## 💡 重要ポイント

### 1. 問題の切り分け

```
scoreMap.get() = 4  → CSV読み込み処理の問題
scoreMap.get() = 5, newScores[25] = 4  → 代入処理の問題
newScores[25] = 5, UI = 4  → 描画処理の問題
```

### 2. 修正の優先順位

1. **最優先**: scoreMapに5が入るようにする（CSV読み込み処理）
2. **次**: newScores[25]に5が入るようにする（代入処理）
3. **最後**: UIに5が表示されるようにする（描画処理）

### 3. デバッグログの読み方

```
raw value from scoreMap: 4  ← scoreMapの値
after newScores[25]: 4     ← newScoresの値

→ scoreMapが4なので、CSV読み込み処理を確認
```

---

**作成日**: 2026-02-18  
**バージョン**: 202602180200  
**ステータス**: ✅ 実装完了・テスト待ち

---

**重要**: 
- 必ず **Ctrl+Shift+R** でキャッシュをクリアしてください
- `raw value from scoreMap`が4の場合、CSV読み込み処理を修正してください
- `raw value from scoreMap`が5で`after newScores[25]`が4の場合、コードにバグがあります（ただし、現在のコードではこれは起こりません）
