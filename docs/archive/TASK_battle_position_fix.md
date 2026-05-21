# TASK: BattleScene position表示修正（role誤参照除去）

## 背景

旧kiritan（正実装）では前衛/後衛は `buildUnit` の編成順（index）で自動決定する。
`role`（attacker/guardian/commander）はEnemyAIがキャラ選出に使うデータであり、
戦闘UIの前衛/後衛表示とは無関係。

kiritan_r の現行実装は `role` を `ROLE_LABEL` で「前衛」「後衛」に読み替えてUIに
表示しており、これが誤り。

旧kiritan `BattleCardUI.js` の正実装:
```js
unit.position === 'front' ? '前衛' : '後衛'
```

旧kiritan `BattleEngineV3.buildUnit`:
```js
position: index < 2 ? 'front' : 'rear',
```

## 対象ファイル

`src/scenes/BattleScene.jsx`（1ファイルのみ）

## 修正内容

### 1. `ROLE_LABEL` 定数を削除

```js
// 削除する
const ROLE_LABEL = {attacker:'前衛',guardian:'前衛',commander:'後衛',...};
```

### 2. `normalizeChar` の `role` フィールドを `position` に変更

```js
// 修正前
function normalizeChar(c, idx) {
  return { id:c.id, name:c.name, role:ROLE_LABEL[c.role]??'前衛', ... };
}

// 修正後
function normalizeChar(c, idx) {
  return { id:c.id, name:c.name, position: idx < 2 ? 'front' : 'rear', ... };
}
```

`_raw:c` はそのまま保持すること（skillId参照で使用）。

### 3. `buildDefaultEnemies` の `role` フィールドを `position` に変更

```js
// 修正前
{ id:'e1', role:'前衛', ... },
{ id:'e2', role:'後衛', ... },

// 修正後
{ id:'e1', position:'front', ... },
{ id:'e2', position:'rear',  ... },
{ id:'e3', position:'front', ... },
{ id:'e4', position:'rear',  ... },
```

### 4. `BRoleTag` コンポーネントを `BPositionTag` に改名し `position` を受け取るよう修正

```js
// 修正前
function BRoleTag({role}){
  const m={'前衛':{...},'間接':{...},'後衛':{...}};
  const s=m[role]||m['後衛'];
  return <span ...>{role}</span>;
}

// 修正後
function BPositionTag({position}){
  const label = position === 'front' ? '前衛' : '後衛';
  const m={
    'front':{bg:'rgba(196,66,122,.12)',c:B_AP.pk,   brd:B_AP.pkBdr},
    'rear': {bg:'rgba(0,0,0,.06)',     c:B_AP.txd,  brd:B_AP.br},
  };
  const s = m[position] ?? m['rear'];
  return <span style={{fontSize:7,padding:'1px 4px',borderRadius:2,fontWeight:700,
    letterSpacing:.3,background:s.bg,color:s.c,
    border:`1px solid ${s.brd}`,flexShrink:0}}>{label}</span>;
}
```

「間接」（ranged）は `position` ではなく `attackType` の概念なので削除する。

### 5. `BUnitCard` 内の `BRoleTag` 呼び出しを `BPositionTag` に変更

```js
// 修正前
<BRoleTag role={unit.role}/>

// 修正後
<BPositionTag position={unit.position}/>
```

## 動作確認

1. `http://localhost:5174/?qa=battle` を開く
2. 自軍カード（左列）の1〜2枚目に「前衛」タグが表示されること
3. 3〜4枚目に「後衛」タグが表示されること
4. コンソールエラーなし

## 注意

- `role` フィールド（attacker/guardian/commander）は `characters.json` および
  `_raw` 経由でEnemyAIが参照するため、データから削除しないこと
- `normalizeChar` の戻り値に `role` キーを含めないこと（UIで参照しない）
- `BattleEngineV3.js` は変更不要（`buildUnit` が `position` を正しくセット済み）
