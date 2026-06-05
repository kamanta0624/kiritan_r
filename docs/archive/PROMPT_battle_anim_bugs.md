# 戦闘バグ修正（ターゲット選択 / 再攻撃 / ダメージ表示）

## 前提
- 壊滅(撃破)の正定義は engine `BattleEngineV3.js:130` `isDead(u){ return u.charHp <= 0; }`。SP(`soldiers`)0は参戦の極致で、charHp>0 なら生存・攻撃対象。
- デザイントークンは `src/shared/tokens.js` から import。色直書き禁止。
- **現状: 本プロンプトは未実装**（`BattleScene.jsx:361` `dead=soldiers<=0` 無改変 / `doAction:1174` 無改変）。3バグ全未解消。

## Bug A: SP0の敵を攻撃対象に選べない【画像1で再現】
画像1: 関西しのび SP0/1196・HP6/8 で「壊滅」表示＝生存中なのに壊滅誤判定。
原因: `BattleScene.jsx:361` `const dead = unit.soldiers <= 0;`。engine の `isDead=charHp<=0` と矛盾。
- `:372 targetable = !ally && !dead && ...` → 選択不可
- 壊滅ラベル・グレーアウトも同 `dead` 由来
修正:
```js
const dead = unit.charHp <= 0;
```

## Bug①: 同一標的への再攻撃（生死無関係）【画像3-6で再現】
画像3-4: 彩澄しゅお→関西しのび 交換1（HP8→6）。画像5-6: 同→同 交換2（HP6→4）。標的生存中の再攻撃。**死亡は無関係**（前案の「死亡defガード」は誤り・撤回）。

### コード根拠（構造から確定）
- 攻撃エフェクト生成元は `_resolveExchange → _onExchangeResult`（engine:498 → scene:1285）のみ。1交換=1 state を `animQueueRef` に push、順次再生（scene:1459）。
- 本来 1クリック=1 `doAction`=1 `_doAttack`=1交換。
- だが `doAction`(scene:1174) に再入ガードが無い。かつ `markActed`(scene:1183) が overlay 終了後まで遅延。overlay はクリック待ち＝長時間、その間 unit は `_actedThisRound=false`。
- この未acted窓中に `doAction` が2度目に入ると2つ目の `_resolveExchange` が積まれ再生＝再攻撃。`nextActor:101` の除外は dead/retreated/acted のみ＝未acted中は同一unit再選出可。標的の生死は無関係。
- **トリガ（クリック重複 / 残存タイマ / nextActor再選出）の静的特定は不可** → 下記ログで実機確定。

### 修正（再攻撃クラスを一括で消す）
```js
// scene 既存 ref 群の近く
const actionLockRef = useRef(false);
```
```js
const doAction = useCallback(async (unit, isPlayer) => {
  if (actionLockRef.current) return;        // 再入ガード（全トリガ網羅）
  actionLockRef.current = true;
  try {
    const eng = engineRef.current;
    unit.action = ACTION_MAP[unit.action] ?? unit.action;
    await eng.executeAction(unit, isPlayer);
    eng.markActed(unit);                     // await より前（未acted窓を閉じる）
    if (animStateRef.current || animQueueRef.current.length) {
      await new Promise(resolve => { animResolveRef.current = resolve; });
    }
    syncDisplay(null);
    if (eng.checkGameOver()) return;          // finally でロック解放されるので return 可
    setTimeout(() => processNextRef.current?.(), 300);
  } finally {
    actionLockRef.current = false;
  }
}, [syncDisplay]);
```

### トリガ確定用ログ（推論排除・確認後すぐ外す）
`doAction` 冒頭（lock判定の前）に1行:
```js
console.log('[doAction]', unit.char.id, 'lock=', actionLockRef.current, 'acted=', unit._actedThisRound);
```
QA再現で「同一 unit.id・lock=false の2回目」が出れば未acted窓での再入が確定。lock=true で弾かれていれば修正成功。

## Bug②: SP/本体ダメージ表示 + 0表示【画像4,6で再現】
- 画像4,6: 攻撃側(彩澄)は本体HP無傷(4/4)のため本体DAMAGEが非表示。`BottomPortrait`(scene:609付近) の `showDamage && hpDmg > 0 && !defeated` の `hpDmg>0` ガードが原因。「攻撃したのに本体ダメージ表記が無い」の正体。
- 要望「ダメージが通らなければ0表示」: damages フェーズで SP/本体 とも値0でも数字を出す。

修正:
- `BottomPortrait`(:609付近) 本体ポップ条件から `hpDmg > 0` を外す → `showDamage && !defeated` で `hpDmg`(0含む) を表示。
- SP DamageBurst（:832-833付近）の `allySPdmg>0` / `enemySPdmg>0` ガードを外す → `phase==='damages'` 中は0でも表示。
- 結果、両側 × {SP, 本体} の4数字が damages 中に常時表示。0なら0。バグ②検証も可能化。
- 座標・重なり調整が要れば Design（ロジックは Code）。

### point3 補足: 命中バッジ呼称（§5違反の解消）※前版②b（発生源で合算）は誤り・撤回
**撤回理由**: 「toMeme+toChar→敵SP」「selfMeme+selfChar→敵本体」の合算は、SP突撃が敵本体を叩く分(toChar)と本体本人が敵SPを叩く分(selfMeme)の飛び先を消し、SP→敵SP・本体→敵本体のみの表示にして戦闘表現を破壊した。エンジン(`_calcOneSide`)は不変だが飛行バッジが仕様と矛盾する。

**正**: 4ストリーム（toMeme/toChar/selfMemeHits/selfCharHits、反撃側も同4本）の src/dst ルーティングは**元のまま維持**。ラベルだけ命中先(target)で付ける。
- 敵SPへ命中（→defSP / 反撃→atkSP）: `SP`
- 敵本体へ命中（→defPort / 反撃→atkPort）: `本体`

`将軍`は廃止、§5の `SP`/`本体` のみ。発生源(SP突撃か本体本人か)はストリームの飛び元位置(SP位置/本体位置)と色で表現。

```js
const cfg = {
  spTgt:   { color: STREAM_SP,  textColor:'#0a0816', isSP:true,  prefix:'SP'   },
  bodyTgt: { color: STREAM_HIT, textColor:'#fff',    isSP:false, prefix:'本体' },
}[kind];
// 攻撃側 → 守備側（4本を復元・合算しない）
push(z.atkSP,   z.defSP,   atkToMeme,       'spTgt');   // SP突撃→敵SP
push(z.atkSP,   z.defPort, atkToChar,       'bodyTgt'); // SP突撃→敵本体
push(z.atkPort, z.defSP,   atkSelfMemeHits, 'spTgt');   // 本体本人→敵SP
push(z.atkPort, z.defPort, atkSelfCharHits, 'bodyTgt'); // 本体本人→敵本体
// 反撃側 defTo*/defSelf* も同4本で復元
```
（飛び元の源を色で残したい場合: atkPort発の2本を `STREAM_GEN` 色に。ラベルは命中先 SP/本体 のまま。）

## 修正サマリー
| # | ファイル | 箇所 | 内容 |
|---|---------|------|------|
| A | BattleScene.jsx | :361 | `dead=soldiers<=0` → `charHp<=0` |
| ① | BattleScene.jsx | doAction:1174 | 再入 lock + markActed 前倒し（+確定用ログ）|
| ② | BattleScene.jsx | :609 / :832-833 付近 | SP/本体ダメージを0でも表示 |
| ②b | BattleScene.jsx | :723-737 | 4ストリーム維持。バッジ呼称を命中先 SP/本体 で付与（`将軍`廃止・§5準拠）。前版の発生源合算は撤回・差し戻し |

## 確認（?qa=battlefull）
1. SP0 の敵にカーソル → 攻撃メニュー（壊滅/グレーアウト無し）
2. 1攻撃で overlay 1回のみ。同一標的への連続再攻撃が起きない（標的の生死問わず）
3. damages 中、SP/本体 とも数字表示。ダメージ0なら0。
4. 命中バッジ: SP突撃が敵本体へ飛ぶ分・本体本人が敵SPへ飛ぶ分が復活（SP→敵SP/本体、本体→敵SP/本体 の4方向が出る）。`将軍`表記なし。
