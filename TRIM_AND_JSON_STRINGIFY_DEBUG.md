# キー生成の強化: trim()とJSON.stringify()デバッグ

## 📋 実施内容

キー生成処理に以下の強化を実施しました：

1. ✅ **必須のtrim()追加**: `makeItemKey()` 関数内で、`category` と `itemName` に対して必ず `.trim()` を実行
2. ✅ **JSON.stringify()によるデバッグ**: キーに含まれる不可視文字（スペース、改行、タブなど）を確認可能に
3. ✅ **CSV読込時の詳細ログ**: 「職業生活」+「欠席」を含む項目の生成過程を追跡
4. ✅ **items.json読込時の詳細ログ**: 対応する項目のキー生成過程を追跡

---

## 🔍 変更内容の詳細

### 1. makeItemKey() 関数の強化

**修正前**:
```javascript
function makeItemKey(category, itemName) {
    const normCat = normalizeString(category);
    const normItem = normalizeString(itemName);
    return `${normCat}__${normItem}`;
}
```

**修正後**:
```javascript
function makeItemKey(category, itemName, debugLog = false) {
    // ===== 【重要】trim()を必ず実行 =====
    category = String(category || '').trim();
    itemName = String(itemName || '').trim();
    
    const normCat = normalizeString(category);
    const normItem = normalizeString(itemName);
    const key = `${normCat}__${normItem}`;
    
    // ===== 【デバッグ】不可視文字チェック =====
    if (debugLog) {
        console.log('🔑 makeItemKey() called:');
        console.log('  category (raw):', JSON.stringify(category));
        console.log('  itemName (raw):', JSON.stringify(itemName));
        console.log('  category (normalized):', JSON.stringify(normCat));
        console.log('  itemName (normalized):', JSON.stringify(normItem));
        console.log('  key (final):', JSON.stringify(key));
    }
    
    return key;
}
```

**重要な変更点**:
- `category` と `itemName` を文字列に変換後、**必ず `.trim()` を実行**
- `debugLog` パラメータが `true` の場合、各段階の値を `JSON.stringify()` で出力
- `JSON.stringify()` により、以下の不可視文字が可視化される:
  - スペース: `" "` → `" "`（見える）
  - タブ: `\t` → `"\\t"`
  - 改行: `\n` → `"\\n"`
  - 全角スペース: `　` → `"\\u3000"`

---

### 2. CSV読込時のデバッグログ

```javascript
dataRows.forEach((row, rowIndex) => {
    const categoryRaw = row[colMap['カテゴリ']];
    const itemNameRaw = row[colMap['項目']];
    
    // ===== 【デバッグ】特定項目の詳細ログ =====
    const isDebugTarget = (categoryRaw && categoryRaw.includes('職業生活')) && 
                         (itemNameRaw && itemNameRaw.includes('欠席'));
    
    if (isDebugTarget) {
        console.log(`\n🔍 [行${rowIndex + 2}] デバッグ対象項目を検出:`);
        console.log('  categoryRaw:', JSON.stringify(categoryRaw));
        console.log('  itemNameRaw:', JSON.stringify(itemNameRaw));
    }
    
    // 一意キーを生成（debugLog=true で詳細ログ出力）
    const key = makeItemKey(categoryRaw, itemNameRaw, isDebugTarget);
    
    if (isDebugTarget) {
        console.log('  生成されたキー:', JSON.stringify(key));
        console.log('  スコア:', scoreRaw);
    }
    
    // ...
});
```

**出力例**:
```
🔍 [行3] デバッグ対象項目を検出:
  categoryRaw: "職業生活 "
  itemNameRaw: "欠席等の連絡\n"

🔑 makeItemKey() called:
  category (raw): "職業生活"
  itemName (raw): "欠席等の連絡"
  category (normalized): "職業生活"
  itemName (normalized): "欠席等の連絡"
  key (final): "職業生活__欠席等の連絡"

  生成されたキー: "職業生活__欠席等の連絡"
  スコア: 4
```

→ **CSV内の値に末尾スペースや改行があっても、`trim()` で除去されることが確認できる**

---

### 3. scoreMap確認時のJSON.stringify()追加

```javascript
const debugKey = '職業生活__欠席等の連絡';
console.log('\n🔍🔍🔍 [特定キー追跡開始] 🔍🔍🔍');
console.log(`対象キー: "${debugKey}"`);
console.log(`対象キー(JSON): ${JSON.stringify(debugKey)}`);
console.log(`scoreMapに存在: ${scoreMap.has(debugKey)}`);

if (!scoreMap.has(debugKey)) {
    console.log('⚠️ scoreMapに該当キーが存在しません');
    console.log('scoreMap内の全キー（職業生活カテゴリ）:');
    const syokugyouKeys = [...scoreMap.keys()].filter(k => k.startsWith('職業生活'));
    syokugyouKeys.forEach(k => {
        console.log(`  - キー: "${k}"`);
        console.log(`    JSON: ${JSON.stringify(k)}`);
    });
}
```

**出力例（キーが存在しない場合）**:
```
🔍🔍🔍 [特定キー追跡開始] 🔍🔍🔍
対象キー: "職業生活__欠席等の連絡"
対象キー(JSON): "職業生活__欠席等の連絡"
scoreMapに存在: false
⚠️ scoreMapに該当キーが存在しません
scoreMap内の全キー（職業生活カテゴリ）:
  - キー: "職業生活 __欠席等の連絡"
    JSON: "職業生活 __欠席等の連絡"
  - キー: "職業生活__欠席等の連絡 "
    JSON: "職業生活__欠席等の連絡 "
```

→ **不可視の末尾スペースが `JSON.stringify()` で可視化される**

---

### 4. items.json読込時のデバッグログ

```javascript
assessmentItems.forEach((item, index) => {
    // ===== 【デバッグ】特定項目の詳細ログ =====
    const isDebugTargetItem = (item.category && item.category.includes('職業生活')) && 
                             (item.name && item.name.includes('欠席'));
    
    if (isDebugTargetItem) {
        console.log(`\n🔍 [items.json index=${index}] デバッグ対象項目:`);
        console.log('  item.category:', JSON.stringify(item.category));
        console.log('  item.name:', JSON.stringify(item.name));
    }
    
    const key = makeItemKey(item.category, item.name, isDebugTargetItem);
    
    if (key === debugKey) {
        console.log(`\n✅ 対象項目を発見:`);
        console.log(`  生成されたキー: "${key}"`);
        console.log(`  生成されたキー(JSON): ${JSON.stringify(key)}`);
    }
    
    // ...
});
```

**出力例**:
```
🔍 [items.json index=15] デバッグ対象項目:
  item.category: "職業生活"
  item.name: "欠席等の連絡"

🔑 makeItemKey() called:
  category (raw): "職業生活"
  itemName (raw): "欠席等の連絡"
  category (normalized): "職業生活"
  itemName (normalized): "欠席等の連絡"
  key (final): "職業生活__欠席等の連絡"

✅ 対象項目を発見:
  生成されたキー: "職業生活__欠席等の連絡"
  生成されたキー(JSON): "職業生活__欠席等の連絡"
```

---

## 🧪 テスト方法

### 1. 準備

- アプリを開く: https://smilestep-code.github.io/assessment-app/
- **Ctrl+Shift+R** でキャッシュクリア（重要！）
- **F12** で開発者ツールを開く → **Console** タブ

### 2. テストケース

#### ケース A: CSVに末尾スペースがある場合

CSVファイル内容（カラムに見えないスペースあり）:
```csv
カテゴリ,項目,スコア
職業生活 ,欠席等の連絡,4
```

期待される動作:
```
🔍 [行2] デバッグ対象項目を検出:
  categoryRaw: "職業生活 "    ← 末尾スペースが見える
  itemNameRaw: "欠席等の連絡"

🔑 makeItemKey() called:
  category (raw): "職業生活"   ← trim()で除去済み
  itemName (raw): "欠席等の連絡"
  key (final): "職業生活__欠席等の連絡"

✅ 一致しています！
```

#### ケース B: items.jsonに改行が含まれる場合

items.json内容（項目名に改行あり）:
```json
{
  "category": "職業生活",
  "name": "欠席等の連絡\n"
}
```

期待される動作:
```
🔍 [items.json index=15] デバッグ対象項目:
  item.name: "欠席等の連絡\\n"   ← 改行が見える

🔑 makeItemKey() called:
  itemName (raw): "欠席等の連絡"  ← trim()で除去済み
  key (final): "職業生活__欠席等の連絡"

✅ 一致しています！
```

#### ケース C: キーが不一致の場合

期待される動作:
```
⚠️ scoreMapに該当キーが存在しません
scoreMap内の全キー（職業生活カテゴリ）:
  - キー: "職業生活__欠席等の連絡 "
    JSON: "職業生活__欠席等の連絡 "   ← 末尾スペースが可視化

対象キー(JSON): "職業生活__欠席等の連絡"
```

→ **末尾スペースの有無が明確にわかる**

---

## 🐛 不可視文字の可視化例

### JSON.stringify() の効果

| 文字列 | 通常表示 | JSON.stringify() |
|--------|---------|------------------|
| `"職業生活 "` | "職業生活 " | `"職業生活 "` |
| `"職業生活\t"` | "職業生活	" | `"職業生活\\t"` |
| `"職業生活\n"` | "職業生活<br>" | `"職業生活\\n"` |
| `"職業生活　"` | "職業生活　" | `"職業生活\\u3000"` |
| `"職業生活 __欠席"` | "職業生活 __欠席" | `"職業生活 __欠席"` |

### よくある不一致の原因

1. **末尾スペース**: `"職業生活 "` vs `"職業生活"`
2. **全角スペース**: `"職業生活　"` vs `"職業生活"`
3. **改行**: `"欠席等の連絡\n"` vs `"欠席等の連絡"`
4. **タブ**: `"欠席等の連絡\t"` vs `"欠席等の連絡"`

**解決策**: すべて `trim()` で除去されます！

---

## 📊 期待される動作

### 正常時

```
🔍 [行3] デバッグ対象項目を検出:
  categoryRaw: "職業生活"
  itemNameRaw: "欠席等の連絡"

🔑 makeItemKey() called:
  category (raw): "職業生活"
  itemName (raw): "欠席等の連絡"
  key (final): "職業生活__欠席等の連絡"

🔍🔍🔍 [特定キー追跡開始] 🔍🔍🔍
対象キー(JSON): "職業生活__欠席等の連絡"
scoreMapに存在: true
scoreMap.get() = 4

🔍 [items.json index=15] デバッグ対象項目:
  item.category: "職業生活"
  item.name: "欠席等の連絡"

🔑 makeItemKey() called:
  category (raw): "職業生活"
  itemName (raw): "欠席等の連絡"
  key (final): "職業生活__欠席等の連絡"

✅ 対象項目を発見:
  生成されたキー(JSON): "職業生活__欠席等の連絡"

UI = 4
✅ 一致しています！
```

### 異常時（不可視文字あり）

```
🔍 [行3] デバッグ対象項目を検出:
  categoryRaw: "職業生活 "    ← 末尾スペース
  itemNameRaw: "欠席等の連絡"

🔑 makeItemKey() called:
  category (raw): "職業生活"   ← trim()で除去
  key (final): "職業生活__欠席等の連絡"

しかし、items.jsonでは:
  item.category: "職業生活 "   ← 末尾スペースがそのまま

→ trim()により両方とも "職業生活__欠席等の連絡" になり、一致する！
```

---

## 📝 変更ファイル

1. **js/assessment.js**
   - `makeItemKey()` 関数に `trim()` とデバッグログ追加
   - CSV読込処理にデバッグログ追加
   - scoreMap確認に `JSON.stringify()` 追加
   - items.json処理にデバッグログ追加

2. **index.html**
   - バージョン更新: `?v=202602180100` → `?v=202602180110`

---

## 🚀 デプロイ情報

- **バージョン**: 202602180110
- **変更内容**: trim()強化 + JSON.stringify()デバッグ
- **コミット**: （次のコミットで確定）
- **GitHub Pages**: https://smilestep-code.github.io/assessment-app/

---

## 💡 重要ポイント

1. ✅ **trim()は二重に実行される**:
   - `makeItemKey()` 内で `trim()`
   - `normalizeString()` 内で `trim()`
   
2. ✅ **JSON.stringify()で不可視文字を検出**:
   - スペース、タブ、改行、全角スペースなどが可視化される
   
3. ✅ **デバッグログは自動検出**:
   - 「職業生活」+「欠席」を含む項目は自動的に詳細ログが出力される

---

**作成日**: 2026-02-18  
**バージョン**: 202602180110  
**ステータス**: ✅ 実装完了・テスト待ち
