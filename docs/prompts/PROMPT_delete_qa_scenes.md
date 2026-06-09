# QAシーン削除

## 背景

`src/game/data/test/`ディレクトリを手動削除したところ、`BattleQAScene.jsx`が`test_characters.json`をimportしているためViteがクラッシュした。

QAシーン3ファイルは全て削除対象。合わせてApp.jsxのimport行も削除する。

## 作業内容

### 1. ファイル削除

以下3ファイルを削除する。

- `src/scenes/BattleQAScene.jsx`
- `src/scenes/BattleFullQAScene.jsx`
- `src/scenes/WorldMapQAScene.jsx`

### 2. App.jsxのimport削除

`src/App.jsx`の以下3行を削除する。

```js
import BattleQAScene        from './scenes/BattleQAScene.jsx';
import BattleFullQAScene    from './scenes/BattleFullQAScene.jsx';
import WorldMapQAScene      from './scenes/WorldMapQAScene.jsx';
```

## 確認事項

- App.jsxのrenderScene()内にQAシーンのcaseが存在しないことは確認済み
- URLパラメータ（`?qa=battlefull`等）による早期returnも現在は存在しない
- 上記3ファイル以外にQAシーンを参照している箇所がないことを確認してから削除すること

## 完了条件

`npm run dev`でViteが正常に起動すること。
