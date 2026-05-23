# PROMPT: ADVScene UI修正

> 作成: 2026-05-20（差し戻し: 2026-05-22）
> 担当: ClaudeCode
> 完了後: docs/archive/ へ移動

## ⚠️ 差し戻し（未完了項目）

前回実装で以下2件が未完了。再実施すること。

### 未完了①: `SlashEffect` 関数定義が残存
`src/scenes/ADVScene.jsx` L164–179 に `function SlashEffect({ keyId }) { ... }` が残っている。
state・useEffect・JSX・keyframeは削除済みだが関数定義だけ残存。**完全削除すること。**

### 未完了②: DialogBox 全面クリック未実装
セクション2（全面クリックでセリフ送り）が未実装。下記の通り実装すること。

---

## 概要

ADVScene の以下を修正する。

**0. SlashEffect を削除（チカチカ問題）← 最優先**
1. `type:'end'` のエンドオブシーン画面を削除 → `onExit()` を即コール
2. セリフ枠を拡大、セリフ枠外クリックでもセリフ送り
3. 立ち絵なし時のプレースホルダーを実装（シルエット表示）
4. `transparent` 時の背景はマップ透過（既存の `background:'transparent'` で足りるが確認）

---

## 0. SlashEffect 削除（チカチカ問題）

スピーカーが変わるたびに白い光が全画面を横断するアニメーション（`SlashEffect`）が発火し画面がチカチカする。以下を全削除する。

- `function SlashEffect({ keyId }) { ... }` コンポーネント定義
- `const [slashKey, setSlashKey] = useState(0);`
- `const [lastSpeaker, setLastSpeaker] = useState(null);`
- speaker change tracking の `useEffect`（`setSlashKey` / `setLastSpeaker` を含むもの）
- JSX: `{slashKey > 0 && current.type === 'dialog' && <SlashEffect keyId={slashKey}/>}`
- keyframes: `@keyframes slashSweep { ... }`（`__adv_kf` style注入内）

---

## 1. `type:'end'` → `onExit()` 即コール

L828 付近の `end` レンダリングブロックを削除し、`advance()` 関数内で end に到達したとき即 `onExit()` を呼ぶ形に変更する。

```jsx
// advance() 内（L697付近）
const advance = useCallback(() => {
  setAutoReadyToAdvance(false);
  if(idx >= scenario.length - 1 || scenario[idx]?.type === 'end') {
    onExit();  // ← 既にこうなっているが end 画面も描画されている
    return;
  }
  setIdx(i => i + 1);
}, [idx, scenario, onExit]);
```

`processStep`（L645付近）で `type === 'end'` に到達したら即 `onExit()` を呼ぶように変更する：

```jsx
// processStep 内
} else if(e.type === 'end') {
  onExit();   // ← 「hold — exit on advance」を即コールに変更
  return;
}
```

レンダリング側の `{current.type === 'end' && ...}` ブロック（L828–852）は丸ごと削除する。

---

## 2. セリフ枠の拡大 + 全面クリックでセリフ送り

### セリフ枠サイズ拡大（通常モード・transparent両方）

`boxStyle` の `transparent` 版（L220付近）：

```jsx
const boxStyle = transparent ? {
  position:'absolute', bottom:0, left:0, right:0,   // 画面幅いっぱい
  background:'rgba(10,5,15,.88)',
  border:'none',
  borderTop:'1px solid rgba(255,255,255,.12)',
  borderRadius:0,
  padding:'28px 10vw 32px 10vw',                    // 左右余白は画面幅の10%
  boxShadow:'0 -8px 32px rgba(0,0,0,.6)',
  backdropFilter:'blur(12px)',
  animation:'dialogFadeIn .3s ease both',
  minHeight:140,
} : { /* 既存の通常スタイル */ };
```

通常モードの `boxStyle` の `minHeight` も `char ? 140 : 100` に拡大する。
フォントサイズも `char ? 20 : 17` に1pt拡大する。

### 全面クリックでセリフ送り

DialogBox の `onClick` コンテナを画面全体に広げる。
現状は `position:'absolute', left:0, right:0, bottom:0` でボックス部分のみクリック可能。

```jsx
// DialogBox の最外div を画面全体クリックエリアに変更
<div
  onClick={() => { ... }}
  style={{
    position:'absolute', inset:0,   // ← 全面に変更
    zIndex:20,
    cursor:'pointer',
    // 背景は透明（セリフボックス自体は内側のdivで描画）
    background:'transparent',
  }}
>
  {/* Speaker tag */}
  {char && !transparent && (
    <div style={{ position:'absolute', left:24, bottom: boxHeight + 10, zIndex:21 }}>
      <SpeakerTag char={char} color={color}/>
    </div>
  )}

  {/* Box（下部固定） */}
  <div
    style={boxStyle}
    onClick={e => e.stopPropagation()}  // ボックス内クリックは伝播させない（二重発火防止）
  >
    ...
  </div>
</div>
```

ただしバックログ表示中（`showLog === true`）は全面クリックを無効にすること：

```jsx
// ADVScene return 内
<div
  onClick={showLog || current.type === 'choice' ? undefined : handleClick}
  onContextMenu={handleContextMenu}
  ...
>
```

---

## 3. 立ち絵なし時のプレースホルダー

`StandingChar`（L70付近）の `portrait?.primary` がない場合のフォールバックを改善する。

```jsx
if(!portrait?.primary) {
  return (
    <div style={{
      position:'absolute',
      bottom: isSpeaking ? '-2%' : '-6%',
      left:  pos==='left' ? '6%' : pos==='center' ? '50%' : 'auto',
      right: pos==='right' ? '6%' : 'auto',
      transform: pos==='center'
        ? `translateX(-50%) ${isSpeaking ? 'scale(1.04)' : 'scale(1)'}`
        : isSpeaking ? 'scale(1.04)' : 'scale(1)',
      width:'min(28vw, 340px)', height:'76%',
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'flex-end',
      paddingBottom:20,
      transition:'all .45s cubic-bezier(.16,1,.3,1)',
      filter: isSpeaking
        ? 'drop-shadow(0 12px 30px rgba(0,0,0,.5))'
        : 'brightness(.4)',
      zIndex: isSpeaking ? 5 : 2,
      pointerEvents:'none',
    }}>
      {/* シルエット人型SVG */}
      <svg viewBox="0 0 120 240" width="60%" style={{opacity: isSpeaking ? .45 : .2}}>
        <ellipse cx="60" cy="36" rx="28" ry="32" fill="rgba(255,255,255,.9)"/>
        <path d="M12 240 Q20 140 60 130 Q100 140 108 240Z" fill="rgba(255,255,255,.9)"/>
      </svg>
      {/* キャラ名（立ち絵なし時も表示） */}
      {char && isSpeaking && (
        <div style={{
          fontFamily:"'Noto Sans JP'", fontSize:11, color:'rgba(255,255,255,.5)',
          letterSpacing:'.2em', marginTop:8,
        }}>{char.name}</div>
      )}
    </div>
  );
}
```

---

## 4. transparent 時の背景確認

既存実装：

```jsx
background: transparent ? 'transparent' : '#0a0610',
```

これで MapScene が透けて見える。
ただし `{bg && !transparent && ...}` でbg画像も非表示になっている。
dim overlayも `{!transparent && ...}` で非表示。
→ **追加修正不要**。

---

## 変更ファイル

| ファイル | 変更箇所 |
|---------|---------|
| `src/scenes/ADVScene.jsx` | SlashEffect削除、`end` 即onExit化、セリフ枠拡大・全面クリック、立ち絵なしプレースホルダー改善 |
| `KNOWLEDGE.md` | §1 エディタ起動コマンドを `node tools/editor.cjs` に修正 |

---

## エディタ起動コマンド修正

`KNOWLEDGE.md` §1 の表を修正する。

```
誤: node tools/editor.js
正: node tools/editor.cjs
```

実際のファイルは `tools/editor.cjs`（`editor.js` は存在しない）。

---

## 確認

0. ADVシナリオ再生中に画面がチカチカしないこと（SlashEffect削除の確認）
1. ADVシナリオ最終ステップで「END OF SCENE」画面が出ずに即 `onExit` が呼ばれること
2. セリフ枠外（画面上半分など）をクリックしてもセリフが進むこと
3. 立ち絵なしキャラのスロットにシルエットが表示されること
4. `transparent=true` でマップが背景に透けて見えること
5. choiceステップ中・バックログ表示中は全面クリックが無効なこと
