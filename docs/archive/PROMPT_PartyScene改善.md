# PartyScene 改善タスク — 引き継ぎプロンプト

## 対象ファイル
`src/scenes/PartyScene.jsx` **のみ**を編集すること。他ファイルは触らない。

---

## 変更要件（全6件）

### 1. 未加入キャラを非表示

**削除対象①** — 右カラムの LOCKED セクション全体（区切り線含む）:
```jsx
<div style={{height:1, background:BR, margin:'16px 6px'}}/>

{/* LOCKED */}
<div>
  <div style={{display:'flex', alignItems:'center', ...}}>  {/* LOCKEDヘッダー */}
  ...
  {locked.map((c,i)=>( ... ))}
  </div>
</div>
```

**削除対象②** — LeftPanel の「未加入」プレースホルダー（`!char.joined` 時の画像代替ブロック）:
```jsx
) : (
  <div style={{position:'relative', zIndex:2, ... border:`2px dashed ...`}}>
    <div style={{textAlign:'center', opacity:.4}}>
      <div style={{fontSize:36, ...}}>🔒</div>
      <div ...>未加入</div>
    </div>
  </div>
)}
```
→ `char.joined && char.portrait ?` の三項演算子を `char.portrait ?` に単純化（joinedチェック不要になる）

**削除対象③** — LeftPanel 下部の「まだ仲間になっていません」ブロック:
```jsx
) : (
  <div style={{width:'100%', padding:'10px', ...}}>
    🔒 まだ仲間になっていません
  </div>
)}
```
→ 外側の `{char.joined ? ( ... ) : ( ... )}` を `{char.joined && ( ... )}` に変更

**変更対象④** — TopBar の rightSlot カウント表示:
```jsx
// 変更前
仲間 {joined.length}/{allChars.length}
// 変更後
仲間 {joined.length}
```

**その他** — `NameItem` の `onClick` で `!char.joined` ガードは残してよい（joined のみ表示されるが念のため）

---

### 2. 速度パラメータを削除

以下2箇所から `StatBar label="速度"` 行を削除:

- **LeftPanel** 内（`StatBar label="攻撃"` / `StatBar label="防御"` の並び）:
  ```jsx
  <StatBar label="速度" val={char.spd} max={12} color={AC}/>  // ← 削除
  ```
- **CharDetail** 内 STATS セクション:
  ```jsx
  <StatBar label="速度" val={char.spd} max={12} color={AC}/>  // ← 削除
  ```

---

### 3. ミーム → SP 表記変更

`MemeBar` コンポーネント（ファイル上部）のラベル文字列のみ変更:
```jsx
// 変更前
<div style={{width:28, fontSize:9, color:TXD, flexShrink:0}}>ミーム</div>
// 変更後
<div style={{width:28, fontSize:9, color:TXD, flexShrink:0}}>SP</div>
```
コンポーネント名 `MemeBar` はそのまま維持。

---

### 4. 詳細画面を全画面化

`CharDetail` コンポーネントを以下のように変更:

**外側オーバーレイ** — backdropFilter と背景を削除し、全画面コンテナに:
```jsx
// 変更前
<div style={{position:'fixed', inset:0, zIndex:100,
  background:'rgba(10,8,14,.75)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
  display:'flex', alignItems:'center', justifyContent:'center', animation:'fadeIn .18s ease both'}}
  onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>

// 変更後
<div style={{position:'fixed', inset:0, zIndex:100,
  display:'flex', animation:'fadeIn .18s ease both'}}>
```

**内側ダイアログ** — 全画面フルサイズに:
```jsx
// 変更前
<div style={{...glass({borderRadius:16, border:`1.5px solid ${role.color}55`,
    boxShadow:`0 0 0 1px ${role.color}22, 0 20px 60px rgba(0,0,0,.45)`}),
  width:'min(800px,92vw)', maxHeight:'90vh', display:'flex', overflow:'hidden',
  animation:'detailIn .24s ease both'}}>

// 変更後
<div style={{...glass({borderRadius:0, border:'none',
    boxShadow:'none'}),
  width:'100%', height:'100%', display:'flex', overflow:'hidden',
  animation:'detailIn .24s ease both'}}>
```

左側の立ち絵エリアは `flex:'0 0 320px'` のまま維持。右パネルは `flex:1` で残り全幅。

---

### 5. 「編成に追加」ボタンを削除

`CharDetail` 下部ボタン群から「編成に追加 +」ボタンを削除し、「戻る」を幅いっぱいに:
```jsx
// 変更前
<div style={{display:'flex', gap:10, marginTop:'auto', paddingTop:8}}>
  <button onClick={onClose} style={{flex:1, ...}}>編成に追加 +</button>
  <button onClick={onClose} style={{padding:'11px 16px', ...}}>戻る</button>
</div>

// 変更後
<div style={{marginTop:'auto', paddingTop:8}}>
  <button onClick={onClose} style={{width:'100%', padding:'11px', borderRadius:8,
    background:'rgba(0,0,0,.06)', border:`1px solid ${BR}`,
    color:TXD, cursor:'pointer', fontFamily:"'Noto Sans JP'", fontSize:12, fontWeight:700}}>
    閉じる
  </button>
</div>
```

---

### 6. 強化メニューを LeftPanel → 詳細画面へ移動

#### 6-a. CharDetail のprops拡張

```jsx
// 変更前
function CharDetail({char, onClose}) {

// 変更後
function CharDetail({char, onClose,
  treasury, upgradeUnlocks, onUpgrade,
  secretaryId, onSetSecretary,
  charUpgrades, onPurchaseUpgrade}) {
```

#### 6-b. CharDetail 内に強化UIを移植

「閉じる」ボタンの直前（`marginTop:'auto'` のdivの前）に挿入:

```jsx
{/* 秘書ボタン */}
{onSetSecretary && (
  <button
    onClick={() => onSetSecretary(secretaryId === char.id ? null : char.id)}
    style={{
      width:'100%', padding:'8px', borderRadius:8, marginBottom:8,
      background: secretaryId === char.id ? 'rgba(26,138,150,.12)' : 'rgba(0,0,0,.04)',
      border: secretaryId === char.id ? `1px solid ${TEAL}55` : `1px solid ${BR}`,
      color: secretaryId === char.id ? TEAL : TXD,
      cursor:'pointer', fontFamily:"'Noto Sans JP'", fontSize:11, fontWeight:700,
    }}>
    {secretaryId === char.id ? '👤 秘書を解除' : '👤 秘書に設定'}
  </button>
)}

{/* 汎用強化コマンド */}
{upgradeUnlocks?.length > 0 && onUpgrade && (
  <div style={{display:'flex', flexDirection:'column', gap:5, marginBottom:8}}>
    <div style={{fontSize:9, fontFamily:'Rajdhani', fontWeight:700,
      letterSpacing:'.15em', color:TXD, marginBottom:2}}>UPGRADE</div>
    {upgradeUnlocks.filter(id => UPGRADE_COMMANDS[id]).map(id => {
      const cmd = UPGRADE_COMMANDS[id];
      const affordable = (treasury ?? 0) >= cmd.cost;
      return (
        <button key={id}
          onClick={() => onUpgrade(char.id, id)}
          disabled={!affordable}
          style={{
            width:'100%', padding:'7px 10px', borderRadius:7,
            background: affordable ? `rgba(192,112,16,.1)` : 'rgba(0,0,0,.04)',
            border: affordable ? `1px solid rgba(192,112,16,.3)` : `1px solid ${BR}`,
            color: affordable ? AC : TXF,
            cursor: affordable ? 'pointer' : 'not-allowed',
            fontFamily:"'Noto Sans JP'", fontSize:10, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'space-between',
          }}>
          <span>{cmd.label}</span>
          <span style={{fontFamily:'Rajdhani', fontSize:11}}>
            {cmd.cost.toLocaleString()} ミーム
          </span>
        </button>
      );
    })}
  </div>
)}

{/* キャラ固有強化コマンド */}
{charUpgrades?.length > 0 && onPurchaseUpgrade && (
  <div style={{display:'flex', flexDirection:'column', gap:5, marginBottom:8}}>
    <div style={{fontSize:9, fontFamily:'Rajdhani', fontWeight:700,
      letterSpacing:'.15em', color:TXD, marginBottom:2}}>CHARACTER UPGRADE</div>
    {charUpgrades.map(cmd => {
      const purchased = (char.purchasedUpgrades ?? []).filter(id => id === cmd.id).length;
      const maxReached = cmd.maxPurchase != null && purchased >= cmd.maxPurchase;
      const affordable = (treasury ?? 0) >= cmd.cost;
      const enabled = affordable && !maxReached;
      return (
        <div key={cmd.id} style={{
          padding:'8px 10px', borderRadius:8,
          background: enabled ? `${AC}0e` : 'rgba(0,0,0,.04)',
          border: `1px solid ${enabled ? AC + '44' : BR}`,
        }}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:2}}>
            <span style={{fontSize:11, fontWeight:700, color: enabled ? AC : TXD}}>{cmd.label}</span>
            <span style={{fontSize:9, color:TXD, fontFamily:'Rajdhani'}}>
              {purchased}/{cmd.maxPurchase ?? '∞'}
            </span>
          </div>
          <div style={{fontSize:9, color:TXD, marginBottom:6, lineHeight:1.4}}>{cmd.desc}</div>
          <button
            onClick={() => onPurchaseUpgrade(char.id, cmd.id)}
            disabled={!enabled}
            style={{
              width:'100%', padding:'5px 8px', borderRadius:6,
              background: enabled ? `rgba(192,112,16,.18)` : 'rgba(0,0,0,.04)',
              border: enabled ? `1px solid rgba(192,112,16,.4)` : `1px solid ${BR}`,
              color: enabled ? AC : TXF,
              cursor: enabled ? 'pointer' : 'not-allowed',
              fontFamily:"'Noto Sans JP'", fontSize:10, fontWeight:700,
            }}>
            {maxReached ? '購入上限' : `${cmd.cost.toLocaleString()} ミーム`}
          </button>
        </div>
      );
    })}
  </div>
)}
```

#### 6-c. CharDetail 呼び出し箇所にpropsを追加

`PartyScene` 本体下部の `<CharDetail>` タグ:
```jsx
// 変更前
{detail && detail.joined && (
  <CharDetail char={detail} onClose={()=>setDetail(null)}/>
)}

// 変更後
{detail && detail.joined && (
  <CharDetail
    char={detail}
    onClose={()=>setDetail(null)}
    treasury={treasury}
    upgradeUnlocks={upgradeUnlocks}
    onUpgrade={onUpgrade}
    secretaryId={secretaryId}
    onSetSecretary={onSetSecretary}
    charUpgrades={detail && buildingSystem
      ? buildingSystem.getUpgradeCommands(detail.id, buildings)
      : []}
    onPurchaseUpgrade={onPurchaseUpgrade}
  />
)}
```

#### 6-d. LeftPanel から強化UI・関連propsを削除

LeftPanel の `char.joined` ブロック内から以下を削除:
- 秘書ボタン（`{onSetSecretary && ( ... )}`）
- 汎用強化コマンド（`{upgradeUnlocks?.length > 0 && onUpgrade && ( ... )}`）
- キャラ固有強化コマンド（`{charUpgrades?.length > 0 && onPurchaseUpgrade && ( ... )}`）

LeftPanel の props 宣言からも `upgradeUnlocks, treasury, onUpgrade, onSetSecretary, secretaryId, charUpgrades, onPurchaseUpgrade` を削除してよい。

LeftPanel への `<LeftPanel>` タグも同様にこれらのprops指定を削除。

---

## 注意事項

- `UPGRADE_COMMANDS` 定義はファイル上部に残す（CharDetail で引き続き使用）
- デザイントークンは `tokens.js` からimport済みのもの（`PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass`）のみ使用
- `StatBar` / `MemeBar` コンポーネント定義自体は変更しない
- `locked` 変数の定義は残っても問題ないが、参照箇所がなくなるため削除してよい
