# 一括登録ページ 拡張（5タブ化）

> KNOWLEDGE.md を読んでから作業すること

---

## 背景

`tools/bulk-input.html` は現在キャラクターJSON貼り付け登録のみ（単機能）。
旧版 `/Users/kamatashintarou/MCP_Learning/kiritan/tools/bulk-input.html` には5タブ構成で
特技・迷宮・アサインまで完備されている。これをkiritan_rに移植・統合する。

---

## 方針

旧版コードをベースに kiritan_r の差分を適用して `tools/bulk-input.html` を**全面置き換え**する。

---

## 旧版との差分（変更箇所のみ）

### 1. データ取得エンドポイント

```js
// 旧版
const res = await fetch('/api/bulk-data');

// kiritan_r
const res = await fetch('/api/data');
```

### 2. CSS

旧版は全スタイルをインラインで持つ。kiritan_rでは `editor.css` を流用し、
旧版にしかないクラス（`.bulk-table`, `.char-row`, `.floor-card` 等）のみ `<style>` に残す。

```html
<!-- 追加 -->
<link rel="stylesheet" href="/editor.css">
```

旧版の `body`, `header`, `input`, `select`, `button` 等の基本スタイルは **editor.css の変数系に置き換え**:

| 旧版の色直書き | kiritan_r の変数 |
|---|---|
| `#0d0a18` / `#08050f` | `var(--color-background-primary)` |
| `#1a1228` / `#12091e` | `var(--color-background-secondary)` |
| `#c9d1d9` | `var(--color-text-primary)` |
| `#8b949e` | `var(--color-text-secondary)` |
| `#3d2060` / `#2a1040` | `var(--color-border-secondary)` |
| `#c084fc` | `var(--color-text-info)` |
| `#6e40c9` | `var(--color-border-info)` |
| `#3fb950` | `var(--color-text-success)` |
| `#238636` | `var(--color-background-success)` |
| `#b91c1c` | `var(--color-border-danger)` |
| `#f85149` | `var(--color-text-danger)` |

### 3. キャラクターフィールド（addCharRow / addCharRowTemplate）

旧版のデフォルト値をkiritan_rに合わせる（差分のみ）:

```js
// kiritan_r 追加フィールド
kana: '',
recoveryRate: 0.3,
battleCapacity: 30,
strategyRate: 0.5,
```

`addCharRow` のデフォルト:
```js
charHp: 150, charMaxHp: 150,
charAttack: 70,
soldierAtk: 9, soldierDef: 9,
soldiers: 500, maxSoldiers: 1000,
```

`addCharRowTemplate` のデフォルト:
```js
charHp: 120, charMaxHp: 120,
charAttack: 50,
soldierAtk: 8, soldierDef: 7,
soldiers: 400, maxSoldiers: 800,
```

### 4. テーブルヘッダに `battleCapacity` 列を追加

```html
<!-- buildCharRow のヘッダに追加 -->
<th class="col-num">戦闘域</th>
```

```js
// buildCharRow の各セルに追加（soldierDef の次）
<td><input type="number" class="c_battleCapacity" value="${c.battleCapacity ?? 30}" min="0" max="99999" /></td>
```

```js
// collectCharsFromTable に追加
c.battleCapacity = Number(tr.querySelector('.c_battleCapacity').value);
```

### 5. 保存エンドポイント（変更なし）

旧版と同じ、そのまま使用:
- `/api/save/characters`
- `/api/save/skills`
- `/api/save/dungeons`
- `/api/save/bases`

### 6. ヘッダの戻りリンク

```html
<!-- 旧版 -->
<a href="/" class="back-link">← メインエディタ</a>

<!-- kiritan_r（editor.cssのスタイルに合わせる） -->
<a href="/" style="font-size:13px;color:var(--color-text-info);text-decoration:none;margin-left:auto">← メインエディタ</a>
```

---

## タブ構成（旧版から変更なし）

1. **キャラクター一括登録** — テーブル直接編集 + まとめて保存
2. **特技 (skills)** — 追加フォーム + 登録済みリスト + 削除
3. **特技アサイン** — キャラ × skillId の一括割り当て
4. **迷宮 (dungeons)** — 追加 + 階層ごとの敵・報酬編集 + 削除
5. **迷宮アサイン** — 拠点 × dungeonId の一括割り当て

---

## editor.cjs の確認

`/api/bulk-register/characters` が存在するが今回のタブ1は `/api/save/characters` を使う（旧版準拠）。
`/api/bulk-register/characters` は残しておいてよい（既存コードへの影響なし）。

---

## 完了条件

- [ ] `http://localhost:3001/bulk-input.html` に5タブが表示される
- [ ] キャラクタータブ: テーブル編集 → まとめて保存 が動作する
- [ ] 特技タブ: 追加・削除が動作する
- [ ] 特技アサインタブ: 保存が動作する
- [ ] 迷宮タブ: 追加・階層編集・削除が動作する
- [ ] 迷宮アサインタブ: 拠点への割り当て保存が動作する
- [ ] `battleCapacity` 列がキャラテーブルに表示・保存される
- [ ] editor.cssのCSS変数が適用されており、色の直書きがない
- [ ] QA環境（`?qa=battlefull`）でゲーム本体の動作が壊れていない

---

## 完了後

このファイルを `docs/archive/` に移動する。
KNOWLEDGE.md §18 の残タスク4b を完了済みに更新する。
