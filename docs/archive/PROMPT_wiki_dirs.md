# PROMPT: docs/wiki/ 配下ディレクトリセットアップ

## 目的
Phase 4（初期インポートスクリプト）の前段として、`docs/wiki/` 配下に全エンティティ用の空ディレクトリを 12 個作成する。

## 成果物
`docs/wiki/` 配下に以下 12 ディレクトリを新規作成し、各ディレクトリ直下に `.gitkeep` 空ファイルを配置する。

```
docs/wiki/characters/.gitkeep
docs/wiki/mob_templates/.gitkeep
docs/wiki/factions/.gitkeep
docs/wiki/bases/.gitkeep
docs/wiki/facilities/.gitkeep
docs/wiki/items/.gitkeep
docs/wiki/legions/.gitkeep
docs/wiki/softwares/.gitkeep
docs/wiki/chapters/.gitkeep
docs/wiki/commands/.gitkeep
docs/wiki/terms/.gitkeep
docs/wiki/archive/.gitkeep
```

## 前提
- `docs/wiki/README.md` 配置済（Phase 2 成果物）
- `docs/wiki/meta/json_schema_inventory.md` 配置済（Phase 1 成果物）
- 上記 2 ファイル・1 ディレクトリは **変更禁止**

## 成功基準
1. 上記 12 ディレクトリが新規作成されている
2. 各ディレクトリ直下に `.gitkeep`（空ファイル、0 バイト）が配置されている
3. `find docs/wiki -mindepth 1 -maxdepth 1 -type d | sort` の結果が以下 13 件（既存 `meta/` 含む）と完全一致:
   ```
   docs/wiki/archive
   docs/wiki/bases
   docs/wiki/chapters
   docs/wiki/characters
   docs/wiki/commands
   docs/wiki/facilities
   docs/wiki/factions
   docs/wiki/items
   docs/wiki/legions
   docs/wiki/meta
   docs/wiki/mob_templates
   docs/wiki/softwares
   docs/wiki/terms
   ```
4. `docs/wiki/README.md` と `docs/wiki/meta/json_schema_inventory.md` の内容が一切変更されていない（git diff で確認）

## 禁止事項
- 既存ファイル（README.md / meta/ 配下）への変更禁止
- README に記載されていないディレクトリの追加禁止
- `.gitkeep` 以外のファイル配置禁止（テンプレ Markdown ファイル等は Phase 4 で投入）
- `.obsidian/` 設定ディレクトリの作成禁止（Obsidian 起動時に自動生成される）

## 実行例
```bash
cd /Users/kamatashintarou/MCP_Learning/kiritan_r
for d in characters mob_templates factions bases facilities items legions softwares chapters commands terms archive; do
  mkdir -p "docs/wiki/$d"
  touch "docs/wiki/$d/.gitkeep"
done
```

## 引き継ぎ
完了後、`find docs/wiki -mindepth 1 -maxdepth 2 | sort` の出力を全文報告。Chat で照合 → 問題なければ本プロンプトを `docs/archive/` へ移動。
