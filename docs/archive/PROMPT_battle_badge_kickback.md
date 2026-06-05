# 差し戻し: 命中バッジ＆ダメージを「発生源(誰が)」で分離

## 方針
バッジ・ダメージとも **発生源（誰が攻撃したか）= SP / 本体** で表記。命中先（誰に）はストリームの飛び先で表現。`将軍`/`兵士` 不使用（§5）。
- SP（soldiers）発の攻撃 = `SP`
- 本体（charHp）発の攻撃 = `本体`
4ストリーム×2（攻撃/反撃）のルーティングは維持。エンジンの計算は不変、内訳値を渡すだけ。

## 1. エンジン: 内訳ダメージを渡す（BattleEngineV3.js `_onExchangeResult` 呼出し付近 :498頃）
`_calcOneSide` は `memeDmg`(SP発→敵SP) / `charDmg`(SP発→敵本体) / `selfMemeDmg`(本体発→敵SP) / `selfCharDmg`(本体発→敵本体) を分離保持。現状は `atkMem=memeDmg+selfMemeDmg` 等で合算して渡しているため内訳が落ちる。payload に追加:
```js
atkMemeDmg: ar.memeDmg,        atkSelfMemeDmg: ar.selfMemeDmg,
atkCharDmg: ar.charDmg,        atkSelfCharDmg: ar.selfCharDmg,
defMemeDmg: dr?.memeDmg ?? 0,  defSelfMemeDmg: dr?.selfMemeDmg ?? 0,
defCharDmg: dr?.charDmg ?? 0,  defSelfCharDmg: dr?.selfCharDmg ?? 0,
```
（既存 `atkMem/atkChr/defMem/defChr` は残す＝合計表示用）

## 2. バッジ: 発生源でラベル（BattleScene streams :713頃・4×2維持）
```js
// 発生源(誰が) SP / 本体 でラベル＆色。命中先は飛び先(dst)で表現。
const cfg = {
  spSrc:   { color: STREAM_SP,  textColor:'#0a0816', isSP:true,  prefix:'SP'   },
  bodySrc: { color: STREAM_GEN, textColor:'#fff',    isSP:false, prefix:'本体' },
}[kind];
push(z.atkSP,   z.defSP,   atkToMeme,       'spSrc');   // SP発→敵SP
push(z.atkSP,   z.defPort, atkToChar,       'spSrc');   // SP発→敵本体
push(z.atkPort, z.defSP,   atkSelfMemeHits, 'bodySrc'); // 本体発→敵SP
push(z.atkPort, z.defPort, atkSelfCharHits, 'bodySrc'); // 本体発→敵本体
push(z.defSP,   z.atkSP,   defToMeme,       'spSrc');
push(z.defSP,   z.atkPort, defToChar,       'spSrc');
push(z.defPort, z.atkSP,   defSelfMemeHits, 'bodySrc');
push(z.defPort, z.atkPort, defSelfCharHits, 'bodySrc');
```
→ `SP` バッジ（toMeme/toChar）が敵SP・敵本体の両方へ、`本体` バッジ（self*）が両方へ飛ぶ。`将軍`廃止。:712-713 コメントの `将軍命中/将軍本人` も `本体〜` へ。

## 3. ダメージ表記: 発生源で内訳（BattleScene damage表示 :674付近マップ + :828/:843付近表示）
各受け手の SP DAMAGE / 本体 DAMAGE を **発生源 SP/本体 で内訳表示**。`allyIsAttacker` で atk/def を ally/enemy にマップ（既存 `allyHPdmg` 等と同方式）。
- ally が attacker → ally は反撃(def側)を受ける → 内訳は `def*Dmg`。enemy は `atk*Dmg`。逆も同様。
- 受け手の SP DAMAGE 内訳: `SP発 = (相手の)memeDmg` / `本体発 = selfMemeDmg`
- 受け手の 本体 DAMAGE 内訳: `SP発 = charDmg` / `本体発 = selfCharDmg`

表示例（受け手ごと）:
```
SP DAMAGE  −24      本体 DAMAGE  −2
  SP −13            SP −0
  本体 −11           本体 −2
```
（合計＝既存 atkMem/atkChr 等。内訳の2行を追加。0でも表示。レイアウト微調整は Design、ロジック・数値配線は Code）

## 確認（?qa=battlefull）
- バッジ: `SP` 発・`本体` 発 で色分け、各々が敵SP/敵本体の両方へ飛ぶ。`将軍`/`兵士` 表記なし。
- ダメージ: SP/本体 とも「SP発 / 本体発」の内訳が出る。0は0。
- 例: しゅお被弾 SP −21 が「SP発 −21 / 本体発 −0」等と判別できる。
- エンジン計算結果（合計ダメージ・撃破判定）は従来と一致。
- A・①・② 本体は実装済み、再編集しない。

完了後、本ファイルと PROMPT_battle_anim_bugs.md を `docs/archive/` へ。
