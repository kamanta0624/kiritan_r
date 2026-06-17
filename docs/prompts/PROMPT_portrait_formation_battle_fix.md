# PROMPT_portrait_formation_battle_fix

## 目的
FormationScene・BattleScene で立ち絵が表示されない不具合を修正する。

## 根本原因（コード確証済み）
`characters.json` に `portrait` フィールドは存在しない（grep 一致 0 件）。
両シーンが `char.portrait` / `c.portrait` / `u.char.portrait` を直参照しているため、常に `undefined`/`null` → プレースホルダ（`?`）表示になる。

正準パス規約: `/characters/portraits/<id>.png`（`id` = `characters.json` の `id` フィールド）。
既存 `ADVScene.jsx:68 getPortrait`・`PartyScene.jsx:7 portraitPath` と同一規約。

## 修正方針
- `characters.json` は変更しない
- ファイル冒頭にヘルパー関数を1行追加し、全 portrait 参照を置き換える
- `onError` フォールバックがない箇所には追加する
- 行番号は最終確認時点の参考値。**変更前コード文字列でマッチさせること**（行番号は前後 1〜2 行ズレる場合あり）

## 注記（director 判断保留）
`portraitPath` は PartyScene に既存。本修正で Formation・Battle にも各々定義し計3箇所の重複となる。
DRY 観点では `src/shared` 等への共通化が望ましいが、本プロンプトは最小スコープを優先し各ファイル内定義とする。共通化は別タスクで判断。

---

## FormationScene.jsx

### ① ファイル冒頭にヘルパー追加

既存の import 群の直後（`const ATK_LABEL` 等の定数より前）に追記:

```js
const portraitPath = (id) => id ? `/characters/portraits/${id}.png` : null;
```

### ② L82-83（SlotCard の `<img src={char.portrait}`）

**変更前:**
```jsx
{char.portrait
  ? <img src={char.portrait} alt={char.name}
      style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 12%' }}/>
```

**変更後:**
```jsx
{portraitPath(char.id)
  ? <img src={portraitPath(char.id)} alt={char.name}
      onError={e => { e.currentTarget.style.display='none'; }}
      style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 12%' }}/>
```

### ③ L134-135（CharCard の `<img src={char.portrait}`）

**変更前:**
```jsx
{char.portrait
  ? <img src={char.portrait} alt={char.name} style={{
      width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 8%',
      filter: disabled ? 'grayscale(.7)' : 'none',
    }}/>
```

**変更後:**
```jsx
{portraitPath(char.id)
  ? <img src={portraitPath(char.id)} alt={char.name}
      onError={e => { e.currentTarget.style.display='none'; }}
      style={{
        width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 8%',
        filter: disabled ? 'grayscale(.7)' : 'none',
      }}/>
```

### ④ L226（Slot コンポーネントの `<img src={char.portrait}`）

**変更前:**
```jsx
<img src={char.portrait} alt="" style={{
  width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 10%',
  transform: flip ? 'scaleX(-1)' : 'none',
}}/>
```

**変更後:**
```jsx
<img src={portraitPath(char.id)} alt=""
  onError={e => { e.currentTarget.style.display='none'; }}
  style={{
    width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 10%',
    transform: flip ? 'scaleX(-1)' : 'none',
  }}/>
```

※ Slot コンポーネントは `char.portrait` の truthy チェックをしていないので `img` を常にレンダリングし、404時は `onError` で非表示にする。

### ⑤ L369-370（UnitMiniRow の `<img src={char.portrait}`）

**変更前:**
```jsx
{char.portrait
  ? <img src={char.portrait} alt="" style={{
      width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 10%',
      transform: ally ? 'none' : 'scaleX(-1)',
    }}/>
```

**変更後:**
```jsx
{portraitPath(char.id)
  ? <img src={portraitPath(char.id)} alt=""
      onError={e => { e.currentTarget.style.display='none'; }}
      style={{
        width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 10%',
        transform: ally ? 'none' : 'scaleX(-1)',
      }}/>
```

---

## BattleScene.jsx

### ① ファイル冒頭にヘルパー追加

既存の import 群の直後に追記:

```js
const portraitPath = (id) => id ? `/characters/portraits/${id}.png` : null;
```

### ② `normalizeChar()` 内 L59（unit オブジェクト生成）

> ⚠️ 関数名は `normalizeChar`（L53 定義）。旧称「buildAlly」ではない。
> ⚠️ **このフィールドは表示には効かない（冗長）。** display unit は ⑦ の `make()` が `u.char.portrait` を読むため、本行の修正は engine unit の `.portrait` にのみ反映され、現状どの表示経路からも読まれない。データ整合性のため規約パスへ揃える目的で修正する。表示の本命は ⑦。

**変更前:**
```js
hp:c.charHp??200, hpMax:c.charMaxHp??200, portrait:c.portrait??null, _raw:c, status:idx===0?'active':'pending',
```

**変更後:**
```js
hp:c.charHp??200, hpMax:c.charMaxHp??200, portrait:portraitPath(c.id), _raw:c, status:idx===0?'active':'pending',
```

### ③ L157（`StrategyCutin` 勝利カットイン `winner.char.portrait`）

`winner.char` は `eng.strategyMult.winnerChar`（生 char）で portrait フィールドを持たない。`id` から解決する。

**変更前:**
```jsx
<img src={winner.char.portrait} alt="" style={{
  width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 8%',
  transform: enemy ? 'scaleX(-1)' : 'none',
}}/>
```

**変更後:**
```jsx
<img src={portraitPath(winner.char?.id ?? winner.id)} alt=""
  onError={e => { e.currentTarget.style.display='none'; }}
  style={{
    width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 8%',
    transform: enemy ? 'scaleX(-1)' : 'none',
  }}/>
```

### ④ L603（`BottomPortrait` の `portrait` 変数）

`unit` は `allyUnit`/`enemyUnit`（`.char` を持つ attacker/defender 由来）。`.char.portrait` は存在しないため `id` で解決する。

**変更前:**
```js
const portrait = unit?.char?.portrait ?? unit?.portrait ?? null;
```

**変更後:**
```js
const portrait = portraitPath(unit?.char?.id ?? unit?.id ?? null);
```

### ⑤ L865-866（`SPPlaceholder` への portrait 渡し）

**変更前:**
```jsx
<SPPlaceholder side="left"  name={allyUnit.char?.name}  portrait={allyUnit.char?.portrait}  color={PK}/>
<SPPlaceholder side="right" name={enemyUnit.char?.name} portrait={enemyUnit.char?.portrait} color={AC}/>
```

**変更後:**
```jsx
<SPPlaceholder side="left"  name={allyUnit.char?.name}  portrait={portraitPath(allyUnit.char?.id)}  color={PK}/>
<SPPlaceholder side="right" name={enemyUnit.char?.name} portrait={portraitPath(enemyUnit.char?.id)} color={AC}/>
```

### ⑥ L935（スキル発動カットイン `attacker.char?.portrait`）

**変更前:**
```jsx
{attacker.char?.portrait && <img src={attacker.char.portrait} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 8%' }}/>}
```

**変更後:**
```jsx
{portraitPath(attacker.char?.id) && <img src={portraitPath(attacker.char?.id)} alt=""
  onError={e => { e.currentTarget.style.display='none'; }}
  style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 8%' }}/>}
```

### ⑦ `syncDisplay` 内 `make()` L1193（display unit の `portrait` フィールド）★表示の本命

> ⚠️ 関数は `syncDisplay`（L1177）内のローカル `make()`（L1180 定義）。旧称「buildUnitFromEngine」ではない。
> この display unit が `allyDisplay`/`enemyDisplay` → `UnitCard`（L413 の `unit.portrait`）へ流れる。**本行の修正で UnitCard の立ち絵表示が直る。**

**変更前:**
```js
portrait:    u.char.portrait ?? null,
```

**変更後:**
```js
portrait:    portraitPath(u.char.id),
```

---

## 変更禁止
- `characters.json` — 変更しない
- `src/shared/tokens.js` の `CHARS` — 変更しない
- 上記以外のファイル — 変更しない

## 自己検証（完了宣言前に必須）
- [ ] 変更後、`grep -n "char\.portrait\|c\.portrait\|\.char\.portrait" src/scenes/FormationScene.jsx src/scenes/BattleScene.jsx` で旧参照が残っていないこと（敵モブの `portrait:null` L67-70 は対象外、残置可）
- [ ] `portraitPath` が両ファイル冒頭に1つずつ定義されていること
- [ ] 各 `<img>` に `onError` フォールバックが付いていること

## 完了確認
1. `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"` 後 `lsof -i :5173 | grep LISTEN` で dev server 起動確認（5174 以降が立っていれば kill）
2. `http://localhost:5173/?qa=battlefull` で BattleScene 立ち絵表示確認
3. 編成画面（formation）でキャラカードに立ち絵が表示されることを確認
4. `public/characters/portraits/` に実ファイルが存在する ID のキャラのみ表示、存在しない ID（char_007 等）は `?` プレースホルダのままであることを確認
