# TASK: BattleScene UIに特技・集中・必殺ボタンを追加

## 前提

このタスクは `TASK_battleengine_v3_migration.md` の実装後に行う。
エンジン移植により `executeAction` が `skill` / `focus` / `special` を
受け付けるようになっている前提で進めること。

---

## 対象ファイル

`src/scenes/BattleScene.jsx`（1ファイルのみ）

---

## 現状の問題

`BActionPanel` に攻撃・防御・撤退の3ボタンしかない。
移植後のエンジンが対応する以下のアクションがUIから選択できない：

| アクション | 条件 |
|------------|------|
| `skill`    | `active.skillId` があり、`skillUsed === false`、`charged === false` |
| `focus`    | `active.skillId` の trigger が `'charge'`、`charged === false`、`skillUsed === false` |
| `special`  | `active.charged === true` |

---

## 修正方針

### 1. `BActionPanel` の props に `activeUnit` を追加

現在 `active` という名前で名前・ステータスのみ渡しているが、
`skillId` / `skillUsed` / `charged` を参照するために
`activeUnit`（エンジンユニットオブジェクト）を追加で受け取る。

`BActionScene` 側では `allies` 配列の `active` ユニットが持つ
`_raw` フィールド（元キャラデータ）か、
`BattleFlow` から渡された `skillId` / `skillUsed` / `charged` を参照する。

### 2. ボタンの構成変更

現行：横並び3ボタン（攻撃・防御・撤退）

変更後：2行レイアウト

```
行1: [攻撃] [防御] [撤退]
行2: [特技] or [集中] or [必殺発動！]  ← activeに応じて動的に表示
```

行2は `active.skillId` が存在する場合のみ表示する。

### 3. 各ボタンの仕様

**特技ボタン**（instant型）
- 表示条件: `skillId` あり、`skill.trigger === 'instant'`、`skillUsed === false`、`charged === false`
- 色: `#8a2be2`（紫）
- クリック: `onAction('skill')` を呼ぶ（対象選択不要・即時）
- グレーアウト: `skillUsed === true`

**集中ボタン**（charge型1ターン目）
- 表示条件: `skillId` あり、`skill.trigger === 'charge'`、`charged === false`、`skillUsed === false`
- ラベル: `集中`
- 色: `#b87010`（AC）
- クリック: `onAction('focus')` を呼ぶ（対象選択不要）

**必殺発動ボタン**（charge型2ターン目）
- 表示条件: `charged === true`
- ラベル: `必殺発動！`
- 色: `#c4427a`（PK）、pulse アニメーション付き
- クリック: `onAction('special')` を呼ぶ → その後 targeting フェーズへ（対象選択あり）

### 4. `handleAction` の変更（BActionScene内）

```js
const handleAction = key => {
  if (key === 'attack' || key === 'special') {
    setAction(key);
    setPhase('targeting');
  } else {
    // defend / retreat / skill / focus は対象選択不要
    if (onRoundActions && active) {
      onRoundActions(p => [...p, { unitId: active.id, action: key, targetId: null }]);
    }
    const label = {
      defend: '防御態勢', retreat: '撤退', skill: '特技発動', focus: '集中'
    }[key] ?? key;
    setLog(p => [...p, { txt: `${active.name} → ${label}` }]);
    setPhase('idle');
    setAction(null);
    setTargetId(null);
    advance();
  }
};
```

### 5. `BattleFlow` から `BActionScene` へ skillsデータを渡す

エンジンユニットの `skillUsed` / `charged` は `engineRef.current.playerSide` を
参照すれば取得できる。ただし React の再レンダリングに乗らないため、
`engineRef` を BActionScene に直接渡すか、
`calcRound` 後に状態を抽出してstateに同期する方法を取る。

**推奨**: `BattleFlow` に `unitStates` という state を追加し、
`calcRound` 後に `playerSide` の `skillUsed`/`charged` を抽出してセットする。

```js
// BattleFlow 内
const [unitStates, setUnitStates] = useState({});

// calcRound の末尾に追加
const newStates = {};
eng.playerSide.forEach(u => {
  newStates[u.char.id] = { skillUsed: u.skillUsed, charged: u.charged };
});
setUnitStates(newStates);
```

`BActionScene` には `unitStates` を props で渡し、
`active.id` をキーにして `skillUsed`/`charged` を取得する。

### 6. スキルトリガーの取得

`skills.json` を BattleScene.jsx 内で import して
`active._raw?.skillId` からスキル定義を引く：

```js
import skillsData from '../game/data/skills.json';
const SKILLS = Object.fromEntries((skillsData.skills ?? []).map(s => [s.id, s]));
```

---

## 動作確認

1. `http://localhost:5174/?qa=battle`
2. skillId を持つキャラが active のとき、行2にボタンが表示されること
3. skillId がない（null）キャラが active のとき、行2が表示されないこと
4. 「特技」ボタンを押したとき対象選択なしで即 advance すること
5. 「集中」→ 次ターンで「必殺発動！」が点滅表示されること
6. 「必殺発動！」を押したとき targeting フェーズに入り、敵を選択して確定できること
7. `skillUsed === true` のとき特技ボタンがグレーアウトすること

---

## 注意

- `BActionPanel` のボタン数が増えるので `fontSize` を `12` に下げてよい
- `BResolveScene` / `BCurtain` は変更不要
- `?qa=battle` の QAシーンでは `initAllies` にスキル情報がないため
  行2は表示されないのが正常（エラーにならなければよい）
