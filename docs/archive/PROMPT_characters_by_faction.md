# PROMPT: characters/ 配下を勢力別 subdirectory 構造に再編

## 目的
ユーザー要望でキャラクター md を所属勢力（factionId）別にディレクトリ分割する。視認性向上のための構造変更。

## 前提
- README.md §4 / §5.1、sync_spec.md §4.1 は Chat が事前更新済（編集禁止）
- 8 勢力: `faction_tohoku` / `faction_red` / `faction_green` / `faction_yellow` / `faction_new01` / `faction_new02` / `faction_new03` / `faction_new04`
- `factionId: null` のキャラ 14 件は `characters/` 直下フラット維持

## 成果物
1. **ファイル移動**: 既存 90 件の char md（factionId 持ち）を `characters/<factionId>/` subdirectory へ移動
2. **`tools/wiki_build.cjs` 修正**: characters/ スキャンを「直下 + 1 階層 subdir」に変更
3. **動作確認**: 再ビルドで生成 JSON が再編前と diff 0（または sort 後 set 一致）

## 実装詳細

### 1. ディレクトリ作成
characters/ 直下に subdir を作成（実出現 factionId 値のみ）:

```bash
# 全 characters/*.md の frontmatter を読み取り、factionId 値（null 以外）でユニーク化
# 該当 subdir を mkdir -p
```

8 勢力すべてに char が存在する場合は 8 subdir。出現しない faction は subdir 不要。

### 2. ファイル移動
全 `docs/wiki/characters/<キャラ名>.md` について:
- frontmatter `factionId` が文字列値（`faction_tohoku` 等）→ `docs/wiki/characters/<factionId>/<キャラ名>.md` へ移動
- `factionId: null` または欠落 → 移動しない（直下維持）

ファイル内容（frontmatter, 本文）は **一切変更禁止**。`git mv` 相当の純粋な移動のみ。

### 3. wiki_build.cjs スキャンロジック修正

修正対象関数: characters/ ディレクトリをスキャンしている箇所のみ。

修正前（推定）:
```js
const files = fs.readdirSync(charactersDir).filter(f => f.endsWith('.md'));
```

修正後:
```js
function scanCharactersDir(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      result.push(path.join(dir, entry.name));
    } else if (entry.isDirectory()) {
      // 1 階層のみ再帰（factionId subdir）
      for (const subentry of fs.readdirSync(path.join(dir, entry.name), { withFileTypes: true })) {
        if (subentry.isFile() && subentry.name.endsWith('.md')) {
          result.push(path.join(dir, entry.name, subentry.name));
        }
      }
    }
  }
  return result;
}
```

**追加検証**: subdir 内 md の frontmatter `factionId` 値が subdir 名と一致するか検証。不一致は ID 重複検査と同レベルのエラーとして §10.1 一括収集に追加。

エラーメッセージ例:
```
- character: factionId mismatch (file: characters/faction_red/紲星あかり.md, expected: faction_red, got: faction_tohoku)
```

### 4. wiki_watch.cjs 変更不要
chokidar の `docs/wiki/**/*.md` パターンは既に再帰対応。動作確認のみ。

### 5. 単体テスト追加
`tools/wiki_build.test.cjs`（または `.mjs`）に追加:

| 関数 | ケース | 期待 |
|---|---|---|
| `scanCharactersDir`（新規 export） | 直下のみ | 直下 .md 一覧 |
| `scanCharactersDir` | subdir のみ | subdir 内 .md 一覧 |
| `scanCharactersDir` | 直下 + subdir 混在 | 両方を結合した一覧 |
| factionId / subdir 名一致検証関数 | 一致 | エラーなし |
| factionId / subdir 名一致検証関数 | 不一致 | エラー収集 |

合計 5 ケース追加。

## 成功基準

1. `find docs/wiki/characters -mindepth 1 -maxdepth 1 -type d | wc -l` の結果が 1〜8 件（実出現 factionId 数、最大 8）
2. `find docs/wiki/characters -maxdepth 1 -type f -name '*.md' | wc -l` の結果が 14（factionId: null キャラ）
3. `find docs/wiki/characters -mindepth 2 -maxdepth 2 -type f -name '*.md' | wc -l` の結果が 90（factionId 持ちキャラ）
4. 合計 `find docs/wiki/characters -type f -name '*.md' | wc -l` が 104（mob_templates 除く char 全件）
5. `npm run wiki:build` 正常終了、stderr 出力なし
6. 生成 `src/game/data/characters.json` が再編前と **設定差分なし**（jq -S '.' でソート後 diff 0）
7. `npm run wiki:test` 全件 PASS（30 + 5 = 35 ケース以上）
8. watcher 起動状態で `docs/wiki/characters/faction_tohoku/紲星あかり.md` を編集 → 自動再ビルド成功
9. 故意に `docs/wiki/characters/faction_red/紲星あかり.md`（factionId mismatch）の状態を作る → ビルドエラーで「factionId mismatch」が stderr に表示 → 元に戻して再ビルド成功

## 禁止事項

- mob_templates/ 配下の構造変更禁止（factionId: null のため subdir 化しない）
- 他エンティティ（factions/ / bases/ / items/ / 等）のディレクトリ構造変更禁止
- README.md / sync_spec.md / json_schema_inventory.md への書き込み禁止（Chat 管理済）
- ファイル内容（frontmatter, 本文）の変更禁止（移動のみ）
- `src/game/data/companion_lines.json` / `secretary_lines.json` / `facilities.json` への書き込み禁止
- 過剰な抽象化禁止（既存スキャンロジックの差し替えに必要な最小限のヘルパー追加のみ）

## 引き継ぎ報告

1. `ls -la docs/wiki/characters/` の出力（subdir + flat ファイル数）
2. `for d in docs/wiki/characters/*/; do echo "$d: $(ls $d | wc -l)"; done` の出力（各 subdir のファイル数）
3. `find docs/wiki/characters -maxdepth 1 -type f -name '*.md' | wc -l` の値（期待: 14）
4. `find docs/wiki/characters -mindepth 2 -maxdepth 2 -type f -name '*.md' | wc -l` の値（期待: 90）
5. `npm run wiki:build` の標準出力・標準エラー出力
6. `npm run wiki:test` の vitest 結果
7. `jq -S '.' src/game/data/characters.json > /tmp/post.json && jq -S '.' /tmp/data_baseline/characters.json > /tmp/pre.json && diff /tmp/pre.json /tmp/post.json | head -20` の出力（期待: 空または順序差分のみ）
8. watcher 起動後の faction_tohoku 配下キャラ編集 → 再ビルド成功ログ
9. factionId mismatch エラーの stderr 全文

Chat で照合 → 問題なければ本プロンプトを `docs/archive/` へ移動。
