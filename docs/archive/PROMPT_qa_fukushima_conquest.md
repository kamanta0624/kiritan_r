# PROMPT_qa_fukushima_conquest

## 目的
QA用の拠点制圧イベントを新規作成。`ev_mito_conquest` をベースに制圧拠点を水戸(base_045)→ふくしま(base_003)へ変更し、`effects` を空にしたもの。

## 根拠（コード確認済み）
- 制圧拠点ふくしま = `base_003`（`src/game/data/bases.json:38-39`）
- `base_conquered` トリガーは `GameContext.jsx` 戦闘終了処理で `result.conquered` 真のとき発火（実ハンドラあり）
- ベース元 `ev_mito_conquest` は `trigger: base_conquered` / `conditions: baseOwned + noFlag` / `maxOccurrences:1`

## タスク1: イベントファイル新規作成
パス: `src/game/data/events/ch01_tohoku/ev_qa_fukushima_conquest.json`

内容（このまま作成）:
```json
{
  "id": "ev_qa_fukushima_conquest",
  "name": "【QA】ふくしま占領イベント",
  "trigger": "base_conquered",
  "conditions": [
    {
      "type": "baseOwned",
      "baseId": "base_003"
    },
    {
      "type": "noFlag",
      "flag": "flag_qa_fukushima_conquest_done"
    }
  ],
  "probability": 1,
  "priority": 999,
  "maxOccurrences": 1,
  "script": [
    {
      "type": "conversation",
      "lines": [
        {
          "characterId": "char_020",
          "position": "left",
          "text": "【QA】ふくしま占領イベント　セリフダミー"
        }
      ]
    },
    {
      "type": "end"
    }
  ],
  "effects": {
    "default": []
  }
}
```

## タスク2: _index.json へ登録
`src/game/data/events/_index.json` の `events` 配列、`ev_mito_conquest` エントリ直後に追加:
```json
    {
      "id": "ev_qa_fukushima_conquest",
      "path": "ch01_tohoku/ev_qa_fukushima_conquest.json",
      "chapter": "ch01_tohoku"
    },
```

## 完了条件
- 上記2ファイルが正しく追加・登録されている
- JSON構文エラーなし（末尾カンマ等に注意）
