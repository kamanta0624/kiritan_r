# PROMPT_engine_base_attack_ctx

イベント条件で「今発火中のトリガーの対象拠点はどれか」を判定できるようにする。
**1ファイル・1箇所の小修正。**

## 前提（調査済み）

- `base_attack` は**プレイヤーの攻撃時にのみ**発火する。
  呼び出しは `App.jsx:571` の `game.actions.beforeAttack(fNode?.baseId, playerFaction?.id)` 1箇所だけ
- 敵の攻撃は `base_defense`（`App.jsx:227`）。ctx に `attackerFactionId` と `baseId` が既に入っている
- `base_conquered`（`GameContext.jsx:1009-1012`）の ctx にも `baseId` が入っている

つまり不足しているのは **ctx.baseId を読む条件型だけ**。
`attackerFactionId` を `base_attack` の ctx に足す必要はない。使うイベントが無い。

---

## 成功基準

1. `baseId` 条件を持つイベントが、指定した拠点が対象のときにのみ発火する
2. `baseId` 条件を持たない既存イベントの挙動が変わらない
3. `npm run dev` でコンソールエラーが出ない
4. 上記を自分で確認してから完了報告すること

---

## 修正. baseId 条件型を追加

`src/game/systems/EventEngine.js` の `_evalCondition` に case を1つ追加する。

```js
case 'baseId':
  return ctx.baseId === cond.baseId;
```

挿入位置は `case 'attackerFaction':` の直前。

`baseOwned` / `baseConquered` とは別物。混同するな。
- `baseOwned` … その拠点をプレイヤーが所有しているか
- `baseConquered` … `conquered_<baseId>` フラグが立っているか
- `baseId`（新規）… **今発火中のトリガーの対象拠点がそれか**

---

## 確認のみ・変更不要

この1件の追加で、`base_attack` / `base_defense` / `base_conquered` の3トリガーすべてで
`baseId` 条件が使えるようになる。ctx 側の追加作業は無い。

---

## やるな

- `_evalCondition` の既存 case の変更
- `GameContext.jsx` の `beforeAttack`（L1051-1054）の変更
- `beforeAttack` の呼び出し元（`App.jsx:571`）の変更
- 新しい条件型を上記1つ以外に追加すること
- イベントJSONの変更
- 指示範囲外のコードやコメントの整形
