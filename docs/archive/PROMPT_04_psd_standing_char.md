# PROMPT_04_psd_standing_char

## 環境・共通ルール

- リポジトリ: `/Users/kamatashintarou/MCP_Learning/kiritan_r/`
- Node v22必須: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"`
- devサーバ: `npm run dev` → localhost:5173（5173のみ、5174以降はkill）
- 問題原因の特定は必ずコードを根拠にすること。推論での断定禁止
- ブラウザキャッシュ／ハードリロードが解決策という結論に至った場合、そこまでの調査結果をまとめて停止・報告
- 不明点は勝手に判断せず、停止して質問
- QAの1次担当は人間。ブラウザ目視確認は完了条件に含めず、人間QAへ引き継ぐ
- 問題を解く最小限のコードのみ。投機的実装・不要な抽象化禁止
- 完了後、本ファイルを `docs/archive/` へ移動

## 目的

`StandingChar`（ADVScene内、静止画PNG1枚）をPSDパーツ合成の動く立ち絵（自動まばたき）に対応させる。方式は**事前展開**：ツールでPSD→パーツPNG+メタJSONに展開して `public/` に保持し、ゲームは合成表示とまばたきタイマーのみ。ゲーム実行時のPSDパース・Go/GopherJS依存は一切持ち込まない（音声の事前生成方式と同じ思想）。

## 決定事項（確定済み、変更禁止)

- 対象キャラ: **彩澄しゅお・四国めたんの2体**。他60キャラは既存PNG静止画のまま併存（フォールバック）
- PSDToolKit命名規則there依存しない。まばたき列はキャラごとの**リグ定義JSON**で明示指定（めたんPSDは`*`プレフィックス欠落のため命名規則ベースは不成立。調査報告 `03_REPORT_psd_investigation.md` 項目6）
- デモのアニメは**自動まばたきのみ**。口パク・表情切替は将来課題（データ構造で拒まない程度でよく、実装禁止）

## 検証済みの事実（`03_REPORT_psd_investigation.md` より）

- PSD所在: `docs/assets/psd/`
  - `四国めたん.psd`: 1500×1500px, 8bit RGB, 124レイヤー。目グループ: 普通/半目/閉じ 等15種（3段階まばたき可）。`*`なし
  - `彩澄しゅお縮小_800pix.psd`: 518×800px, 8bit RGB, 139レイヤー。目グループ: `*普通`/`*ちょっと閉じ`/`*半目`/`*閉じ` 等36種（4段階まばたき可）。`*`あり
- レイヤー抽出は依存追加なしの純NodeでPSDバイナリ直接パースの実績あり（Shift-JIS Pascal文字列・`luni`・`lsct` 解析。調査時スクリプトはリポジトリに残っていない、再作成）
- `src/scenes/ADVScene.jsx`: `getPortrait` L68、`StandingChar` L73定義・L859レンダー、`PersonaCutin` L330（**今回スコープ外、変更禁止**）
- `portraitPath` 複製が PartyScene L7 / FormationScene L4 / BattleScene L9 にあり（**全てスコープ外、変更禁止**）
- 立ち絵PNG: `public/characters/portraits/char_*.png` 62枚（フォールバック用に無変更で維持）

## 事前確認（着手前に必ず実施、不明なら停止して質問）

1. しゅお・めたんの charKey（`char_NNN`）を characters データから特定する。特定できなければ停止して人間に質問
2. 両PSDの使用レイヤーに normal 以外のブレンドモードが含まれるか展開時に検出し、含まれる場合は該当レイヤーを報告（デモでは normal + 不透明度のみ対応）

## 作業内容

### 1. PSD展開ツール（`tools/psd_extract.cjs`、新規）

`node tools/psd_extract.cjs <psdファイル> <charKey>` で実行。npm依存追加禁止（Node組み込みzlibでPNGエンコード）。

1. PSDをパースし全レイヤーの {名前, グループ階層, 可視状態, 位置(left/top), サイズ, 不透明度} を取得
2. 各画像レイヤーをレイヤー境界でクロップしたPNGとして `public/characters/parts/<charKey>/<連番3桁>_<サニタイズ名>.png` に出力（RGBA。RLE/Raw圧縮対応。ZIP圧縮に遭遇したら停止・報告）
3. `public/characters/parts/<charKey>/parts.json` を出力: `{ canvas: {w, h}, layers: [{ id, name, group, left, top, w, h, opacity, visible, file }] }`（PSDの重ね順を保持）

### 2. リグ定義（`public/characters/parts/<charKey>/rig.json`、新規・手書き）

parts.json のレイヤー一覧を根拠に、キャラごとに作成:

```json
{
  "base": ["<常時表示レイヤーidの配列（重ね順）>"],
  "blink": { "frames": [["<開き状態のid>"], ["<半目のid>"], ["<閉じのid>"]] }
}
```

- base はデフォルト衣装・デフォルト表情の1組（しゅお: 制服系+普通系、めたん: 通常服+普通顔+普通目+口閉じ系）。差分・エフェクト類は含めない
- blink.frames は開→閉の順（しゅお4段階、めたん3段階）。各フレームは「そのフレームで目として表示するレイヤーid群」
- 参照idが parts.json に実在することをスクリプトで検証すること

### 3. ゲーム側（`src/scenes/ADVScene.jsx` の `StandingChar` のみ改修）

- charKey に対し `/characters/parts/<charKey>/rig.json` が存在すればパーツ合成表示、なければ**現行の静止画PNG表示にフォールバック**（60キャラはこちら）
- 合成表示: parts.json の canvas サイズを基準に、base のレイヤーを絶対配置で重ね、既存 StandingChar の表示枠に収まるようスケール。`pos`（left/center/right）・`isSpeaking` の scale/filter/zIndex 挙動は現行維持
- 自動まばたき: タイマー（間隔はランダム2〜6秒程度）で blink.frames を開→閉→開と高速再生（1フレーム50ms前後）。表示中の目レイヤーだけ差し替える
- rig.json / parts.json の fetch 失敗時は静止画フォールバック（例外をADVに伝播させない）
- `advance` / `finish` / choice分岐 / backlog / `PersonaCutin` / DialogBox のロジック変更禁止

### 4. 展開の実行

両PSDに対しツールを実行し、パーツPNG・parts.json・rig.json を成果物としてコミット対象に含める。

## 成功基準（Codeが自力で確認、満たすまでループ）

1. ツール実行で両キャラの `parts.json` + パーツPNG が生成される。全PNGをNodeで再デコードし、シグネチャ・寸法が parts.json と一致（サイズ>0）
2. 両キャラの `rig.json` が存在し、base / blink.frames の全参照idが parts.json に実在（検証スクリプトで確認）
3. `grep -rn "psd\|PSD" src/` でゲーム側にPSDパース処理が存在しない（事前展開方式の維持。コメント・パス文字列は許容）
4. `npm run dev` 起動・コンソールエラーなし。rig なしキャラ（既存60体）のコードパスが現行の静止画表示と同一
5. `git diff` の変更範囲が「tools/psd_extract.cjs + ADVScene.jsx(StandingChar) + public/characters/parts/ 配下」のみ
6. 展開ツールが再実行可能（同一入力→同一出力で冪等）

## 人間QAへの引き継ぎ事項（Codeは実施しない）

- theater→ADVでしゅお・めたんがパーツ合成で表示され、自動まばたきすること
- 立ち位置・サイズ・発話時の拡大/フィルタ挙動が従来と同等であること
- パーツの重ね順・デフォルト表情が破綻していないこと（欠けパーツ・二重パーツなし）
- rig なしキャラが従来どおり静止画表示されること

## 禁止事項

- npmパッケージ追加禁止。Go/GopherJS/WASM導入禁止。ブラウザ側でのPSDパース禁止
- `PersonaCutin`・PartyScene/FormationScene/BattleScene の portraitPath 系・既存 portraits PNG の変更禁止
- 口パク・表情切替UI・複数衣装対応の実装禁止（将来課題）
- ADVScene の進行ロジック変更禁止
- 色の直書き禁止（UI追加時は `src/shared/tokens.js`）
