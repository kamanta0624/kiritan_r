# PROMPT: docs/wiki/ 配下ディレクトリ追加（skills / dungeons）

## 目的
Phase 2 バックトラックで `skills` / `dungeons` エンティティテンプレを README.md に追加した。それに伴い対応するディレクトリを 2 件追加する。

## 成果物
以下 2 ディレクトリを新規作成し、各ディレクトリ直下に `.gitkeep` 空ファイルを配置する。

```
docs/wiki/skills/.gitkeep
docs/wiki/dungeons/.gitkeep
```

## 前提
- `docs/wiki/README.md`（511 行版）配置済
- `docs/wiki/` 配下に既存 13 ディレクトリ存在（archive / bases / chapters / characters / commands / facilities / factions / items / legions / meta / mob_templates / softwares / terms）
- 上記既存ファイル・ディレクトリは **変更禁止**

## 成功基準
1. `docs/wiki/skills/` と `docs/wiki/dungeons/` が新規作成されている
2. 各ディレクトリ直下に `.gitkeep`（空ファイル、0 バイト）が配置されている
3. `find docs/wiki -mindepth 1 -maxdepth 1 -type d | sort` の結果が以下 15 件と完全一致:
   ```
   docs/wiki/archive
   docs/wiki/bases
   docs/wiki/chapters
   docs/wiki/characters
   docs/wiki/commands
   docs/wiki/dungeons
   docs/wiki/facilities
   docs/wiki/factions
   docs/wiki/items
   docs/wiki/legions
   docs/wiki/meta
   docs/wiki/mob_templates
   docs/wiki/skills
   docs/wiki/softwares
   docs/wiki/terms
   ```
4. 既存 13 ディレクトリと `README.md` / `meta/json_schema_inventory.md` の内容が一切変更されていない（git diff で確認）

## 禁止事項
- 既存ファイル・ディレクトリへの変更禁止
- `.gitkeep` 以外のファイル配置禁止（テンプレ Markdown は Phase 4 で投入）

## 実行例
```bash
cd /Users/kamatashintarou/MCP_Learning/kiritan_r
for d in skills dungeons; do
  mkdir -p "docs/wiki/$d"
  touch "docs/wiki/$d/.gitkeep"
done
```

## 引き継ぎ
完了後、`find docs/wiki -mindepth 1 -maxdepth 1 -type d | sort` の出力を全文報告。Chat で照合 → 問題なければ本プロンプトを `docs/archive/` へ移動。
