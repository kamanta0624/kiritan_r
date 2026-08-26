# PROMPT: 立ち絵カメラ（cm座標系）とデフォルト立ち絵エディタ

対象: ClaudeCode
作成: 2026-08-20
前提: `PROMPT_moiky_import.md`（完了）, `docs/DESIGN_PORTRAIT_SCALE.md`

## 0. 背景（目視で判明した設計の誤り）

`?qa=portrait` の目視で、これまでの立ち絵まわりの設計が2点とも間違っていた。

**誤り1: 立ち絵を枠の中央に置いていた**
人間は地面に足をつけて立つ。中央固定にすると、低身長キャラは全身が入り、
高身長キャラは顔と膝下がはみ出す。身長差の表現になっていない。

**誤り2: 全身を映そうとしていた**
ボイロ劇場・恋愛ADVの立ち絵は**バストアップ**で画面を大きく占有する。
`PX_PER_CM` はスライダ最小の2.0でも全身表示には大きすぎた。全身を入れる前提が誤り。

**誤り3（このプロンプトで採用しない案）**
目線基準や頭頂基準で切り出し位置をキャラごとに変える案は**却下された**。
キャラごとに基準を変えると身長差が消えるため。**採用するな。**

## 1. 正しい方式 — カメラのパン

全キャラを**共通の地面ライン**に立たせたまま、
**全キャラ共通で「地面から何cm〜何cmを画面に映すか」**を決める。実写のカメラと同じ。

```
VIEW_BOTTOM_CM  画面下端が地面から何cmか
VIEW_TOP_CM     画面上端が地面から何cmか
PX_PER_CM = viewportH / (VIEW_TOP_CM - VIEW_BOTTOM_CM)
```

- 135cm の東北きりたんは頭頂が帯の下寄り → 頭上に空間が空く
- 175cm の中部つるぎは頭頂が帯の上端付近 → 頭が画面の高い位置にくる
- **身長差は「頭頂の位置の差」としてそのまま残る**

`PX_PER_CM` を直接いじらせるな。**映す範囲を cm で決める。**

### 1-1. 配置の数式

`portrait.json` の `canvas` と `body` を使う。

```
scale   = (height_cm * PX_PER_CM) / body.height   // 画像全体の拡大率
imgH    = canvas.h * scale
imgW    = canvas.w * scale

// 地面(足元)の画面Y座標。画面下端より VIEW_BOTTOM_CM 分だけ下にある
groundY = viewportH + VIEW_BOTTOM_CM * PX_PER_CM

// 画像内で body.bottom が足元。そこが groundY に来るよう配置する
imgTop  = groundY - body.bottom * scale
```

`height_cm` は `src/game/data/characterHeight.json`。未設定キャラは **155cm**（基準身長）。

横位置は現行の `left/center/right` を維持しろ。

## 2. デフォルト立ち絵エディタ

表情が変・イタコが服を着ていない・きりたんにバニー耳が付く、はすべて
`portrait.json` の `default` の選択ミス。`[立ち絵用]` が「バニー衣装の立ち絵」の
個体が実在する（`[立ち絵用＿バニー]` が実在）。**機械的な選択では決まらない。**

人間が全キャラのデフォルトを画面上で選べるようにする。

### 2-1. 保存先

`src/game/data/portraitDefaults.json` を新規作成。

```json
{
  "char_004": { "体": "通常.png", "口": "微笑み.png", "目": "通常.png", "眉": "通常.png", "顔色": "通常.png", "髪": "前髪.png" },
  "char_015": { "体": "巫女服.png", "口": "閉じ.png" }
}
```

解決順を **`portrait.json.default` → `portraitDefaults.json` で上書き** とする。
`portraitDefaults.json` に無いキャラ・無いカテゴリは `portrait.json.default` のまま。
`後` `他` は明示的に空文字 `""` を指定できるようにしろ（非表示の意思表示）。

## 3. 成果物

### 3-1. `?qa=adv` — ADVパートでの検証モード

`src/App.jsx:410-414` の `qaParam` 分岐に `adv` を追加。
`?qa=battlefull` `?qa=promotion` と同じ作りにしろ。

**ADVScene を `DEMO_SCENARIO` で直接起動する。** 通常フローを進ませるな。
前回の報告で「DEMO_SCENARIOへの導線が無い」と指摘があった件の解消も兼ねる。

その上に開発用オーバーレイを重ねる。オーバーレイは折りたたみ可能にしろ
（立ち絵の見え方を邪魔するため）。

**オーバーレイの中身:**

| 要素 | 仕様 |
|---|---|
| `VIEW_BOTTOM_CM` スライダ | 0〜150、刻み1。現在値を数値表示 |
| `VIEW_TOP_CM` スライダ | 50〜220、刻み1。現在値を数値表示 |
| 派生値表示 | `PX_PER_CM` と「帯の高さ(cm)」を常時表示 |
| キャラ切替 | `_index.json` の全 charKey を順送り。前/次ボタン＋直接選択 |
| 立ち位置切替 | left / center / right |
| カテゴリ別ドロップダウン | 後/体/口/目/眉/顔色/髪/他 の8つ。`portrait.json.categories` の全ファイルを選択肢に。`後` `他` には「（なし）」の選択肢を入れろ |
| プレビュー | 選択を変えたら即座に立ち絵へ反映 |
| JSON出力ボタン | 全キャラぶんの選択を `portraitDefaults.json` 形式で画面に出す。コピーできるよう `<textarea>` に入れろ |
| リセットボタン | 現在のキャラの選択を `portrait.json.default` に戻す |

選択状態は localStorage に保持しろ（ページを再読込しても消えないこと）。
53体ぶんを一度に選び切るのは無理なので、**中断・再開できることが必須**。

`VIEW_BOTTOM_CM` / `VIEW_TOP_CM` も localStorage に保持しろ。
`src/shared/portraitScale.js` を書き換えて、`PX_PER_CM` 直接指定をやめ、
この2値から算出する方式に変えろ。

### 3-2. `?qa=portrait` の扱い

**消すな。** 一覧で全キャラを俯瞰する用途は残る。
ただし §1 の cm座標系に合わせて配置ロジックを差し替えろ。
中央固定をやめ、共通の地面ラインに足を揃えろ。地面ラインを線で描け。

## 4. 成功基準

1. `npm run build` が通る
2. `?qa=adv` が起動し、`DEMO_SCENARIO` のADV画面が出る
3. `VIEW_BOTTOM_CM` / `VIEW_TOP_CM` を動かすと立ち絵の大きさと位置が連動する
4. 同じ設定で `char_004` 東北きりたん（135cm）と `char_021` 中部つるぎ（175cm）を
   切り替えたとき、**つるぎの頭頂がきりたんより高い位置にある**（数値で確認しろ。
   DOM上の頭頂Y座標を比較すればよい）
5. カテゴリのドロップダウンを変えると立ち絵が即座に変わる
6. JSON出力ボタンが `portraitDefaults.json` 形式の正しいJSONを出す
7. ページを再読込しても選択とスライダ値が保持される
8. `?qa=portrait` でも足元が共通の地面ラインに揃う
9. `PX_PER_CM` を直接指定している箇所が `src/` に残っていない

## 5. 検証手順

**Playwright を使うな。** `npm run dev` で 5173 を起動し、URLを人間に伝えて止まれ。
起動前に `lsof -i :5173 -i :5174 -i :5175 | grep LISTEN` で確認し、
5174以降が生きていたら kill しろ。5173のみ起動する。

成功基準4だけは数値で自分で確認しろ（目視でなく座標の比較）。

## 6. やるな

- 目線基準・頭頂基準での切り出し（§0 誤り3。却下済み）
- `PX_PER_CM` を直接いじるUI（cm範囲から算出しろ）
- `characterHeight.json` の値の改変
- `portrait.json` の `default` の書き換え（上書きは `portraitDefaults.json` でやる）
- `?qa=portrait` の削除
- 色の直書き（`tokens.js` から import）
- Playwright の起動
- 高身長キャラの頭が切れないよう自動で帯を広げること。
  **切れるかどうかは人間がスライダで見て決める。** 勝手に補正するな

## 7. 判断に迷ったら

勝手に決めず質問しろ。特に:

- `VIEW_BOTTOM_CM` / `VIEW_TOP_CM` の初期値（適当な値を入れて報告すればいい。
  どうせスライダで動かす）
- オーバーレイのレイアウトが立ち絵と重なって見えない場合の逃がし方
