# PROMPT: 水戸制圧時の勢力壊滅 + 防衛キャンセル復帰バグ

2件の独立したバグを修正する。スコープ競合なし。

---

## BUG-A: 水戸制圧後もfaction_red（大都会）が攻撃を継続する

### 現象
水戸（base_045, faction_redの首都）を制圧しても、faction_redの残拠点（ふくしま・会津・郡山・いわき・三陸）がそのまま残り、LegionAIが攻撃を継続する。

### 原因
`src/game/data/events/ch01_tohoku/ev_mito_conquest.json` の `effects.default` に `setFlagWithTurn` しかなく、勢力壊滅処理がない。

### ディレクター決定
首都制圧で全拠点をプレイヤーに接収する。

### 修正内容
`src/game/data/events/ch01_tohoku/ev_mito_conquest.json` の `effects.default` 配列を以下に差し替え:

```json
"effects": {
  "default": [
    {
      "type": "baseTransfer",
      "fromFactionId": "faction_red",
      "toFactionId": "東北家"
    },
    {
      "type": "setFlagWithTurn",
      "flag": "flag_mito_conquest_done"
    }
  ]
}
```

#### 補足
- `baseTransfer` は既存の純粋エフェクト（GameContext.jsx:481-489）。`fromFactionId` に一致する全拠点の `factionId` を `toFactionId` に書き換える。
- 参照実装: `ev_saitama_absorbed.json` が同パターンで `faction_green` → `faction_new01` の全拠点移管を行っている。
- `toFactionId` にプレイヤー勢力ID `"東北家"` を直書きする（他イベントと同じ慣習）。
- `baseTransfer` は `setFlagWithTurn` より前に置く（先に拠点を移管してからフラグを立てる）。
- キャラ加入処理は本タスクのスコープ外。別途必要ならディレクターが指示する。

### 影響範囲
- 変更ファイル: `src/game/data/events/ch01_tohoku/ev_mito_conquest.json` のみ（JSONデータ変更）
- ロジック変更なし

---

## BUG-B: 防衛編成から「戻る」でMAP固定・ターン進行不能

### 現象
敵の攻撃通知で「防衛する」→ 編成画面 → 「戻る」を押すと、MAPに戻ってしまい防衛選択（防衛する/放棄する）に復帰しない。defenseFlowが未解決のままターン進行も不可になる。

### 原因
`src/App.jsx` 272行目:

```jsx
onCancel={() => {
  setDefenseFlow(prev => prev ? { ...prev, phase: 'adv' } : null);
}}
```

defenseFlowの有効フェーズは `'defense_prompt' | 'formation' | 'battle'` の3つ。`'adv'` は未定義フェーズ。

- `phase === 'formation'` → false → 編成画面描画されず
- `phase === 'defense_prompt'` → false → `defensePromptData` = null → 防衛選択UI非表示
- 通常map描画にフォールスルー、かつ `defenseFlow` が非null → `defenseFlowResolveRef` 未解決 → ターン進行不可

### 修正内容
`src/App.jsx` 272行目の1行を変更:

```
変更前: setDefenseFlow(prev => prev ? { ...prev, phase: 'adv' } : null);
変更後: setDefenseFlow(prev => prev ? { ...prev, phase: 'defense_prompt' } : null);
```

### 影響範囲
- 変更ファイル: `src/App.jsx` の1行のみ
- 防衛フローの他のフェーズ遷移（onLaunch → battle, onAbandon → advanceQueue）に影響なし

---

## 完了後の確認手順

### BUG-A確認
1. ニューゲーム開始
2. 水戸（base_045）を攻撃・制圧
3. `ev_mito_conquest` のADVダイアログが表示されること
4. ダイアログ終了後、faction_redの全拠点（ふくしま・会津・郡山・いわき・三陸）がプレイヤー（東北家）所有に変わっていること
5. 以降のターンでfaction_redからの攻撃が来ないこと

### BUG-B確認
1. ターン終了で敵の攻撃が発生する状態にする
2. 攻撃通知の「防衛する」を押す → 編成画面に遷移すること
3. 編成画面で「戻る」を押す → 攻撃通知（防衛する/放棄する）に戻ること
4. 再度「防衛する」→ 編成 → 出撃 → 戦闘が正常に完了すること
5. 「放棄する」を選択しても正常に動作すること

---

## 完了後の後処理
- `docs/prompts/PROMPT_mito_conquest_nofire.md` を `docs/archive/` に移動（内容が現行コードと乖離、trigger変更済で旧プロンプトの前提は解消済）
