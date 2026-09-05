# PROMPT: 立ち絵アセットのパック化（配布用パッカー）

対象: ClaudeCode
作成: 2026-08-26
前提: `KNOWLEDGE.md` §17, `docs/ROADMAP.md` §3-1c-2 論点2, `tools/psd2ymm4.cjs`
後続: `PROMPT_electron_shell.md`（未作成。Electron シェルと protocol ハンドラ）

## 0. 背景と要件

素材作者の大半が再配布・二次頒布を禁止している（ROADMAP §3-1c-2 論点2）。
現状のビルド成果物は作者素材のPNGがそのまま並ぶ。

```
dist/  548MB  （うち dist/characters/ 541MB・PNG 4390枚）
```

`public/` は Vite のモジュールグラフ外で dist へ無変換コピーされる（`vite.config.js` のコメント参照）。

**要件: 配布パッケージから、作者素材の画像が画像ファイルの形で取り出せない状態にする。**

配布形態は **Electron**、圧縮は **WebP q88**（2026-08-26 オーナー決定）。

**本プロンプトの範囲はパッカー（Node CLI）のみ。`src/` は触るな。** Electron 側は後続プロンプトで扱う。

## 1. 成果物

| パス | 内容 |
|---|---|
| `tools/pack_portraits.cjs` | パックCLI |
| `tools/unpack_portraits.cjs` | 検証用アンパックCLI（ラウンドトリップ確認に使う） |

```
node tools/pack_portraits.cjs
→ build/portraits/<charKey>.pak  および  build/portraits/index.pak
```

`.gitignore` に `build/portraits/` を追加しろ。141MB を追跡させるな。

## 2. pak フォーマット

1キャラ1ファイル。全体を AES-256-CTR で暗号化する。

```
[ 16B ] IV
[ 暗号化領域 ]
    [ 4B LE ] 索引JSONのバイト長
    [ N B   ] 索引JSON（UTF-8）
    [ ...   ] 各エントリのWebPバイト列を索引順に連結
```

索引JSONのスキーマ:

```json
{
  "charKey": "char_004",
  "portrait": { ... },
  "entries": [
    { "cat": "体", "name": "基本.png", "off": 0, "len": 20481 }
  ]
}
```

- `portrait` — 元の `portrait.json` の内容をそのまま埋める。**個別ファイルとしては出力するな**（カテゴリ名・ファイル名を平文で置かない）
- `name` は元のPNGファイル名を維持しろ。実体はWebPだが、`portrait.json` の `categories` / `default` / `presets` が `.png` 名で参照しているため、**リネームすると全参照が壊れる**
- `off` は暗号化領域の先頭からではなく、**連結データ部の先頭からのオフセット**
- `index.pak` は同形式で、`entries` を空、`portrait` の代わりに `{"charKeys":[...]}` を持つ

鍵は `tools/pack_portraits.key`（32バイト・16進テキスト）に置き、無ければ生成しろ。
**このファイルを `.gitignore` に追加しろ。** 鍵の Electron 側への埋め込みは後続プロンプトで扱う。

暗号化は Node 標準 `crypto` で行え。**依存パッケージを追加するな**（既存ツールは依存ゼロで動いている）。

## 3. WebP 変換

`sharp` が要る。**実装前にオーナーへ確認しろ**（下記 §5）。

- 品質 88、`alphaQuality` は既定のまま
- **トリムするな。** 全PNGがキャンバス全域である前提で ADVScene が座標計算を省いている（`PROMPT_portrait_json.md` §2）。寸法を変えると合成がズレる
- 変換前後で `width` / `height` が一致することを全件検証しろ

## 4. 進捗と冪等性

- 4390枚の変換は時間がかかる。charKey 単位で進捗を標準エラーに出せ
- 既に `.pak` があり、入力側のどのPNGも `.pak` より新しくない場合はスキップしろ。`--force` で無効化

## 5. 実装前にオーナーへ確認すること（勝手に決めるな）

1. `sharp` を `devDependencies` に追加してよいか。ネイティブ依存が入る
2. `char_pending_daishogun` を pak に含めるか（`characters.json` 未登録）
3. `_deprecated_parts_20260820/` は対象外でよいか

回答が出るまで該当箇所に手を付けるな。

## 6. 成功基準

以下が全て満たされるまでループしろ。**すべて数値またはコマンドの終了状態で確認できる。目視は使うな。**

1. `node tools/pack_portraits.cjs` が 53 個の `.pak` と `index.pak` を出力する
2. `build/portraits/` の合計サイズが **200MB 未満**
3. `find build/portraits -name "*.png" -o -name "*.webp" -o -name "*.json"` が **0件**
4. 各 `.pak` の先頭16バイトが、既知の画像・アーカイブのマジックナンバーと一致しない
   （`file build/portraits/char_004.pak` が `data` を返す）
5. `node tools/unpack_portraits.cjs char_004 /tmp/rt` が全エントリを復元し、
   復元された各WebPの `width`/`height` が元PNGと**全件一致**する
6. `index.pak` の `charKeys` が `public/characters/ymm4/_index.json` と**完全一致**する
7. 各 `.pak` の `portrait` 索引に含まれる全ファイル名が、その pak の `entries[].name` に**全件存在**する
   （`portrait.json` の `categories` / `default` / `presets` の参照切れがゼロ）
8. `git status --porcelain build/` が空（`.gitignore` が効いている）
9. `npm run build` が通り、`dist/` の内容が本プロンプト適用前と**変わらない**
   （`src/` を触っていないことの確認。dist は依然 548MB のままでよい）

## 7. やるな

- `src/` の変更（ローダ差し替えは後続プロンプト）
- `public/characters/ymm4/` の変更・削除（原本は残す）
- PNGのトリム・リサイズ・寸法変更
- ファイル名の `.png` → `.webp` リネーム
- 暗号化以外の依存パッケージ追加
- 鍵ファイルのコミット
- Electron 関連の実装
- Playwright の起動

## 8. 報告に含めろ

- charKey ごとの 変換前PNG合計 / 変換後pak サイズ / 圧縮率
- 全体の合計サイズと、541MB からの削減率
- 成功基準5のラウンドトリップ検証件数（何エントリ照合したか）
- 成功基準7で参照切れが出たキャラがあれば charKey とファイル名
- 変換に要した実時間
