# PROMPT: 防衛編成「戻る」+ ADV背景MAP表示

> 作成: 2026-05-20
> 担当: ClaudeCode
> 完了後: docs/archive/ へ移動
> 関連: PROMPT_defense_flow.md（archiveに移動済み）

---

## 概要

防衛編成画面の「撤退（都市を明け渡す）」ボタンを「戻る」に変更し、
ADV（防衛するか放棄するかの選択）に戻るループを実装する。
またそのADVでは背景を非表示にしてマップを透過表示し、
どの拠点に誰が攻めてきたかわかるようにする。

---

## 1. FormationScene.jsx — ボタンラベル変更

L758 の `isDefense` 分岐ボタン：

```jsx
// 変更前
<button onClick={onCancel} ...>撤退（都市を明け渡す）</button>

// 変更後
<button onClick={onCancel} ...>戻る</button>
```

スタイルは攻撃時の「戻る」と同じ通常色に変更する（ピンク→デフォルト）：

```jsx
<button
  onClick={onCancel}
  style={{
    flex:1, height:52, borderRadius:6, border:`1px solid ${BR}`,
    background:'rgba(255,253,251,.7)', color:TX,
    fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:13, letterSpacing:'.2em',
    cursor:'pointer',
  }}
>戻る</button>
```

---

## 2. App.jsx — formation case の onCancel を ADV 再実行に変更

PROMPT_defense_flow.md に記述済みの `launchDefenseADV` を前提とする。

```jsx
// formation case
onCancel={async () => {
  if (fIsDefense) {
    if (sceneParams._onCancel) {
      sceneParams._onCancel();  // ADV再実行（launchDefenseADVに戻る）
    } else {
      // 旧来の放棄処理（後方互換・通常攻撃側のキャンセル）
      navigate('map');
    }
  } else {
    navigate('map');
  }
}}
```

`_onCancel` は `launchDefenseADV` 内で以下のように渡される：

```js
navigate('formation', {
  ...
  _onCancel: () => launchDefenseADV(item, onDone),  // ADV再実行
  _onDone: onDone,
});
```

---

## 3. ADVScene / App.jsx — 防衛選択ADVの背景をマップ透過表示

### ADVScene.jsx — `transparent` prop 追加

```jsx
export default function ADVScene({ scenario, onExit, onChoice, transparent }) {
  ...
  return (
    <div style={{
      position:'absolute', inset:0,
      // transparent=true のとき背景を非表示
      background: transparent ? 'transparent' : 'rgba(0,0,0,.72)',
      ...
    }}>
      ...
    </div>
  );
}
```

### App.jsx — adv case に transparent を渡す

```jsx
case 'adv':
  return <ADVScene
    scenario={sceneParams.scenario ?? []}
    transparent={sceneParams.transparent ?? false}
    onExit={...}
    onChoice={...}
  />;
```

### launchDefenseADV — transparent + MapScene 同時表示

防衛ADVはMapSceneの上にオーバーレイとして表示する。
`navigate('adv', ...)` ではなく、MapSceneを表示したまま ADVScene を上に重ねる。

App.jsx の scene 判定を以下のように変更：

```jsx
// 現状：sceneがadvのときADVSceneのみ表示
// 変更後：isDefenseAdvフラグがtrueのときはMapScene + ADVSceneを重ねて表示

const [defenseAdvParams, setDefenseAdvParams] = useState(null);

// launchDefenseADVの実装変更
const launchDefenseADV = useCallback((item, onDone) => {
  const scenario = [...];  // 既存通り

  // navigate('adv', ...) の代わりに defenseAdvParams をセット
  // MapSceneは navigate('map') で表示済みを前提
  navigate('map', { focusBaseId: item.defenderBase?.id });
  setDefenseAdvParams({
    scenario,
    transparent: true,
    _onChoice: (value) => {
      setDefenseAdvParams(null);
      if (value === 'abandon') {
        game.actions.battleEnd({ ... conquered:true ... }).then(() => onDone());
      } else {
        navigate('formation', {
          mode:'defense',
          ...
          _onCancel: () => launchDefenseADV(item, onDone),
          _onDone: onDone,
        });
      }
    },
  });
}, [...]);

// レンダリング
return (
  <div style={{position:'relative', width:'100vw', height:'100vh'}}>
    {currentScene === 'map' && <MapScene ... />}
    {currentScene === 'formation' && <FormationScene ... />}
    {/* 他シーン */}

    {/* 防衛ADVオーバーレイ：MapScene表示中のみ */}
    {defenseAdvParams && currentScene === 'map' && (
      <div style={{position:'absolute', inset:0, zIndex:100}}>
        <ADVScene
          scenario={defenseAdvParams.scenario}
          transparent={true}
          onExit={() => setDefenseAdvParams(null)}
          onChoice={defenseAdvParams._onChoice}
        />
      </div>
    )}
  </div>
);
```

### ADVScene テキストボックスのスタイル調整

`transparent=true` のときテキストボックスを画面下部固定・半透明背景にする：

```jsx
// ADVScene.jsx
const boxStyle = transparent ? {
  position:'absolute', bottom:40, left:'50%', transform:'translateX(-50%)',
  width:'80%', maxWidth:700,
  background:'rgba(10,5,15,.82)', border:'1px solid rgba(255,255,255,.15)',
  borderRadius:12, padding:'20px 28px',
} : {
  /* 既存スタイル */
};
```

---

## 変更ファイル

| ファイル | 変更箇所 |
|---------|---------|
| `src/scenes/FormationScene.jsx` | isDefense時のonCancelボタンラベル・スタイル変更 |
| `src/scenes/ADVScene.jsx` | `transparent` prop追加、テキストボックスの条件スタイル |
| `src/App.jsx` | `defenseAdvParams` state追加、`launchDefenseADV`変更、レンダリングにオーバーレイ追加、formation onCancel修正 |

---

## 確認

1. 防衛編成で「戻る」ボタンが表示されること（ピンクではなく通常色）
2. 「戻る」押下でADVが再表示されること
3. ADV表示中、背後にマップが見えること（拠点・色が確認できる）
4. ADVで「防衛する」→ 編成 → 「戻る」→ ADV → 「防衛する」のループが動作すること
5. ADVで「放棄する」→ 拠点陥落 → 次の防衛キューへ進むこと
