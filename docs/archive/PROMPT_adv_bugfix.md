# ADV StrictModeバグ修正

> 作業前に `KNOWLEDGE.md` を読むこと
> 修正対象: `src/scenes/ADVScene.jsx` / `src/App.jsx`

---

## 背景

React 18 StrictModeがdev環境でuseEffectを2回実行するため、
ADVSceneの`setup`useEffectが`setIdx`を2回積み、`idx: 0→2`にジャンプする。
結果として全イベントの最初のセリフが常にスキップされる。

詳細: `docs/adv_strictmode_bug.md`

---

## 根本方針

`setup`ステップという概念を廃止する。

- `cast` / `bg` / `location` はscenarioの中身ではなくシーン設定
- ADVSceneのpropsで直接受け取る形に変更
- `convertEventScript`はsetupステップを出力しない。代わりにオブジェクト`{ scenario, cast, bg, location }`を返す
- ADVScene内のsetup useEffectを完全削除

---

## 変更仕様

### 1. `convertEventScript`（ADVScene.jsx named export）

**変更前:**
```js
export function convertEventScript(script, { bg=null, location='' }={}) {
  // ...
  scenario.push({ type:'setup', cast, bg, location }); // setupを出力していた
  // ...
  return scenario; // 配列を返していた
}
```

**変更後:**
```js
export function convertEventScript(script, { bg=null, location='' }={}) {
  // castMapの構築ロジックはそのまま維持
  const cast = Array.from(castMap.entries()).map(([pos, id]) => ({ id, pos }));
  const scenario = [];
  // setupステップを出力しない
  // dialog/narration/end のみ出力（既存ロジックそのまま）
  return { scenario, cast, bg, location }; // オブジェクトで返す
}
```

---

### 2. `ADVScene` コンポーネント（ADVScene.jsx default export）

**props変更:**
```js
// 変更前
export default function ADVScene({ scenario, onExit, onChoice, transparent })

// 変更後
export default function ADVScene({ scenario, cast: castProp=[], bg: bgProp=null, location: locationProp='', onExit, onChoice, transparent })
```

**useState初期値変更:**
```js
// 変更前
const [idx,      setIdx]      = useState(0);
const [cast,     setCast]     = useState([]);
const [bg,       setBg]       = useState(null);
const [location, setLocation] = useState('');

// 変更後
const [idx,      setIdx]      = useState(0);
const [cast,     setCast]     = useState(castProp);
const [bg,       setBg]       = useState(bgProp);
const [location, setLocation] = useState(locationProp);
```

**setup useEffect削除:**

以下のuseEffectブロックを完全に削除する:
```js
// 削除対象
useEffect(() => {
  if(idx >= scenario.length) return;
  const e = scenario[idx];
  if(e.type === 'setup') {
    setCast(e.cast);
    if(e.bg) setBg(e.bg);
    if(e.location) setLocation(e.location);
    setIdx(i => i + 1);
  } else if(e.type === 'end') {
    onExit();
  }
}, [idx, scenario]);
```

**`end`ステップの処理を`advance`に移管:**

setup useEffect削除により`end`ステップの検出も消える。
`advance`関数はすでに`scenario[idx]?.type === 'end'`で`onExit()`を呼んでいるが、
history useEffectと合わせて`end`ステップが最初に来るケースも考慮する。

`idx=0`のrender時に`current.type === 'end'`なら即`onExit()`するuseEffectを追加:
```js
useEffect(() => {
  if (scenario[idx]?.type === 'end') onExit();
}, [idx]);
```

これはsetup useEffectより単純で、StrictModeで2回実行されても`onExit()`が2回呼ばれるだけ。
`onExit`はnavigateなので冪等。問題なし。

**`handleContextMenu`のsetup処理も削除:**

skipロジック内にsetupステップを処理する箇所がある:
```js
// 削除対象（skipジャンプ時のsetup処理）
for(let i = idx + 1; i <= next; i++) {
  const e = scenario[i];
  if(e?.type === 'setup') {
    setCast(e.cast);
    if(e.bg) setBg(e.bg);
    if(e.location) setLocation(e.location);
  }
}
```
setupステップが廃止されるため不要。削除する。

---

### 3. `App.jsx`

**convertEventScript呼び出し箇所（setStartDialogHandler内）:**
```js
// 変更前
const scenario = convertEventScript(script);
navigate('adv', { scenario, returnTo: 'map', _onComplete: onComplete });

// 変更後
const { scenario, cast, bg, location } = convertEventScript(script);
navigate('adv', { scenario, cast, bg, location, returnTo: 'map', _onComplete: onComplete });
```

**case 'adv' のADVScene呼び出し:**
```jsx
// 変更前
<ADVScene
  scenario={sceneParams.scenario ?? []}
  transparent={sceneParams.transparent ?? false}
  onExit={...}
  onChoice={...}
/>

// 変更後
<ADVScene
  scenario={sceneParams.scenario ?? []}
  cast={sceneParams.cast ?? []}
  bg={sceneParams.bg ?? null}
  location={sceneParams.location ?? ''}
  transparent={sceneParams.transparent ?? false}
  onExit={...}
  onChoice={...}
/>
```

**`defenseAdvScenario`（useMemo）のsetupステップ削除:**

防衛フローのシナリオからsetupステップを除去し、
cast/bg/locationをADVScene propsで渡す形に変更する。

```js
// 変更前（useMemo内）
return [
  { type: 'setup', cast: [], bg: 'assets/bg_battle.jpg', location: defenderBase?.name ?? '拠点' },
  { type: 'narration', text: `...` },
  { type: 'choice', ... },
  { type: 'end' },
];

// 変更後（useMemo）
// scenarioのみ返す。bg/locationは別stateまたはそのままuseMemoで計算して渡す。
```

`defenseAdvScenario`は現在`scenario`のみ返しているが、
`defenseAdvBg` / `defenseAdvLocation` を別途useMemoで算出するか、
オブジェクト`{ scenario, cast, bg, location }`で返してApp.jsx側で分解する。

シンプルにオブジェクトで返す方針で実装すること:
```js
const defenseAdvConfig = useMemo(() => {
  if (!defenseFlow) return { scenario: [], cast: [], bg: null, location: '' };
  // ...
  return {
    scenario: [...],   // setupなし
    cast: [],
    bg: 'assets/bg_battle.jpg',
    location: defenderBase?.name ?? '拠点',
  };
}, [defenseFlow, factions]);
```

オーバーレイのADVScene呼び出し:
```jsx
// 変更前
<ADVScene
  key={`defense-adv-${defenseFlow.phase}`}
  scenario={defenseAdvScenario}
  transparent={true}
  ...
/>

// 変更後
<ADVScene
  key={`defense-adv-${defenseFlow.phase}`}
  scenario={defenseAdvConfig.scenario}
  cast={defenseAdvConfig.cast}
  bg={defenseAdvConfig.bg}
  location={defenseAdvConfig.location}
  transparent={true}
  ...
/>
```

---

### 4. `DEMO_SCENARIO`（ADVScene.jsx）

setupステップが残っていても、ADVScene側がsetupを無視するようになれば無害。
ただしDEMOを動作確認で使う場合に混乱するため、setupステップを削除し
cast/bg/locationを別途定数として定義しておく。

```js
// 変更前: DEMO_SCENARIOの先頭にsetupステップがある
// 変更後: setupステップを削除。DEMO用のcast/bg/locationを定数で持つ
export const DEMO_CAST = [
  { id:'c1', pos:'left' },
  { id:'c4', pos:'center' },
  { id:'c3', pos:'right' },
];
export const DEMO_BG = 'assets/bg_battle.jpg';
export const DEMO_LOCATION = '東北 — 仙台城本丸';
```

---

## 完了条件

- [ ] QA環境（`?qa=battlefull`）で既存機能が壊れていない
- [ ] `startNewGame()`後のgame_startイベントでADVSceneが開き、最初のセリフが表示される
- [ ] 防衛フローのADVオーバーレイで最初のnarrationが表示される
- [ ] バックログに最初のセリフが記録される
- [ ] StrictModeが有効な状態（main.jsxそのまま）で再現しない

---

## 完了後

このファイルを `docs/archive/` に移動する。
`KNOWLEDGE.md §13` の解決済みバグに追記する。
`docs/adv_strictmode_bug.md` を `docs/archive/` に移動する。
