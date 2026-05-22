# 戦闘背景画像システム実装

> KNOWLEDGE.md を読んでから作業すること

---

## 事前確認: 一括登録ページが未実装

`http://localhost:3001/bulk-input.html` が 404 になる。
**本タスク着手前に以下を完了させること。**

### bulk-input.html 未実装の対処（先行作業）

#### `tools/bulk-input.html` 新規作成

キャラクター一括登録画面。editor.cssを流用。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>一括登録 — Kiritan Editor</title>
<link rel="stylesheet" href="/editor.css">
<style>
  .bulk-layout { display:flex; gap:20px; flex:1; overflow:hidden; padding:20px; }
  .bulk-input-col { width:400px; display:flex; flex-direction:column; gap:12px; flex-shrink:0; }
  .bulk-preview-col { flex:1; overflow-y:auto; }
  textarea#bulkJson { flex:1; min-height:300px; font-family:monospace; font-size:12px; resize:none; }
  .preview-table { width:100%; border-collapse:collapse; font-size:12px; }
  .preview-table th { background:#21262d; color:#8b949e; padding:5px 8px; text-align:left; border-bottom:1px solid #30363d; }
  .preview-table td { padding:5px 8px; border-bottom:1px solid #21262d; color:#c9d1d9; }
</style>
</head>
<body>
<header>
  <h1>🎮 一括登録</h1>
  <div class="tab-bar">
    <a href="/" style="padding:6px 16px;border-radius:6px;color:#8b949e;font-size:13px;text-decoration:none">← エディタに戻る</a>
  </div>
</header>
<div class="main" style="flex-direction:column">
  <div class="bulk-layout">
    <div class="bulk-input-col">
      <div class="form-section-title" style="font-size:11px;color:#8b949e;padding:0">JSON配列を貼り付け</div>
      <textarea id="bulkJson" placeholder='[
  {
    "id": "char_xxx",
    "name": "キャラ名",
    "soldiers": 100,
    "factionId": "faction_player"
  }
]'></textarea>
      <button class="btn-secondary" onclick="previewBulk()">プレビュー</button>
      <button class="btn-primary" id="registerBtn" disabled onclick="registerBulk()">一括登録</button>
      <div id="bulkStatus" style="font-size:12px;color:#8b949e;min-height:20px"></div>
    </div>
    <div class="bulk-preview-col">
      <div id="previewArea" style="color:#484f58;font-size:13px;padding-top:4px">プレビューがここに表示されます</div>
    </div>
  </div>
</div>
<div id="toast"></div>
<script>
let _parsed = null;

function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = type === 'error' ? 'show error' : 'show';
  setTimeout(() => { t.className = ''; }, 2800);
}

function previewBulk() {
  const raw = document.getElementById('bulkJson').value.trim();
  const status = document.getElementById('bulkStatus');
  const area = document.getElementById('previewArea');
  try {
    _parsed = JSON.parse(raw);
    if (!Array.isArray(_parsed)) throw new Error('配列で入力してください');
    status.textContent = `${_parsed.length} 件を確認`;
    status.style.color = '#3fb950';
    document.getElementById('registerBtn').disabled = false;
    area.innerHTML = `
      <table class="preview-table">
        <thead><tr><th>id</th><th>name</th><th>soldiers</th><th>factionId</th></tr></thead>
        <tbody>${_parsed.map(c => `<tr>
          <td style="font-family:monospace">${c.id ?? '—'}</td>
          <td>${c.name ?? '—'}</td>
          <td>${c.soldiers ?? '—'}</td>
          <td>${c.factionId ?? '—'}</td>
        </tr>`).join('')}</tbody>
      </table>`;
  } catch(e) {
    _parsed = null;
    status.textContent = 'エラー: ' + e.message;
    status.style.color = '#f85149';
    document.getElementById('registerBtn').disabled = true;
    area.innerHTML = `<div class="error-box"><pre>${e.message}</pre></div>`;
  }
}

async function registerBulk() {
  if (!_parsed) return;
  try {
    const res = await fetch('/api/bulk-register/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characters: _parsed }),
    });
    const json = await res.json();
    if (json.ok) {
      showToast(`登録完了: 追加 ${json.added} 件 / 更新 ${json.updated} 件`);
      document.getElementById('bulkStatus').textContent = `完了: 追加 ${json.added} / 更新 ${json.updated}`;
    } else {
      showToast('登録に失敗しました', 'error');
    }
  } catch(e) {
    showToast('通信エラー: ' + e.message, 'error');
  }
}
</script>
</body>
</html>
```

#### `tools/editor.cjs` への追加（2箇所）

**GET `/bulk-input.html` ルート:**
```js
if (pathname === '/bulk-input.html') {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(path.join(__dirname, 'bulk-input.html')));
  return;
}
```
既存の `pathname === '/'` の分岐の直後に追加する。

**POST `/api/bulk-register/characters` ルート:**
```js
if (pathname === '/api/bulk-register/characters') {
  const body = await readBody(req);
  const { characters: incoming } = JSON.parse(body.toString());
  const filePath = path.join(DATA, 'characters.json');
  const existing = readJSON(filePath);
  const existingMap = Object.fromEntries(existing.characters.map(c => [c.id, c]));

  const DEFAULTS = {
    isTemplate: false, status: 'standby',
    charHp: 100, charMaxHp: 100,
    charAttack: 10, charSong: 5,
    soldierAtk: 8, soldierDef: 5,
    battleCapacity: 30,
    skills: [], nameVariants: [],
  };

  let added = 0, updated = 0;
  for (const c of incoming) {
    const merged = { ...DEFAULTS, ...c, maxSoldiers: c.maxSoldiers ?? c.soldiers ?? 100 };
    if (existingMap[c.id]) { existingMap[c.id] = { ...existingMap[c.id], ...merged }; updated++; }
    else { existingMap[c.id] = merged; added++; }
  }
  existing.characters = Object.values(existingMap);
  writeJSON(filePath, existing);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, added, updated }));
  return;
}
```

先行作業完了後、以下の本タスクに進む。

---

## 概要

- 画像を登録するとIDを自動採番（`bg_001`, `bg_002`, ...）
- 各都市（base）に `battleBgId` で番号を指定
- 戦闘時に `targetNode.battleBgId` から背景画像を解決して表示

---

## Step 1: 画像保存ディレクトリ

`public/battle_backgrounds/` を作成する（存在しなければ）。

画像ファイルの命名規則: `bg_001.jpg`, `bg_002.png` 等（アップロード時に自動採番）。

---

## Step 2: editor.cjs の API 追加

### GET `/api/battle-backgrounds`

`public/battle_backgrounds/` 内の画像ファイルを一覧返却:

```js
if (pathname === '/api/battle-backgrounds') {
  const dir = path.join(ASSETS, 'battle_backgrounds');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const files = fs.readdirSync(dir)
    .filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
    .sort();
  // 採番済みID（ファイル名の拡張子除く）と URLを返す
  const images = files.map(f => ({
    id: path.basename(f, path.extname(f)),    // 例: "bg_001"
    filename: f,
    url: `/assets/battle_backgrounds/${f}`,
  }));
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ images }));
  return;
}
```

### POST `/api/upload/battle-bg`

マルチパートで画像を受け取り、自動採番してsaveする:

```js
if (pathname === '/api/upload/battle-bg') {
  const ct = req.headers['content-type'] || '';
  const boundary = ct.split('boundary=')[1];
  if (!boundary) { res.writeHead(400); res.end('Bad Request'); return; }
  const body = await readBody(req);
  const parts = parseMultipart(body, boundary);
  const filePart = parts.find(p => p.filename);
  if (!filePart) { res.writeHead(400); res.end('Missing file'); return; }

  const dir = path.join(ASSETS, 'battle_backgrounds');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // 自動採番: 既存ファイルの最大番号+1
  const existing = fs.readdirSync(dir)
    .filter(f => /^bg_\d+\./i.test(f))
    .map(f => parseInt(f.match(/^bg_(\d+)\./)[1], 10))
    .filter(n => !isNaN(n));
  const nextNum = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  const ext = path.extname(filePart.filename).toLowerCase() || '.jpg';
  const newFilename = `bg_${String(nextNum).padStart(3, '0')}${ext}`;
  const destPath = path.join(dir, newFilename);

  fs.writeFileSync(destPath, filePart.data);
  const newId = path.basename(newFilename, ext);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, id: newId, url: `/assets/battle_backgrounds/${newFilename}` }));
  return;
}
```

### DELETE `/api/delete-battle-bg`

```js
if (pathname === '/api/delete-battle-bg') {
  const body = await readBody(req);
  const { id } = JSON.parse(body.toString());
  const dir = path.join(ASSETS, 'battle_backgrounds');
  const files = fs.readdirSync(dir).filter(f => f.startsWith(id + '.'));
  files.forEach(f => fs.unlinkSync(path.join(dir, f)));
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
  return;
}
```

---

## Step 3: bases.json への `battleBgId` フィールド追加

**変更しない。** エディタのsaveBase()が保存時にフィールドを含めるだけでよい。
既存のbasesはデフォルト `battleBgId: null`（未設定=フォールバック背景）。

---

## Step 4: tab-map.js のフォームに背景画像セクションを追加

`buildBaseForm()` の「隣接拠点」セクションの**前**に「戦闘背景画像」セクションを追加する。

### UIの仕様

```
┌─ 戦闘背景画像 ──────────────────────────────────────┐
│ [プレビュー画像 120×68 または "未設定" プレースホルダ] │
│ 設定中: bg_003                                        │
│                                                       │
│ [画像を選択▼] (登録済み画像のセレクトボックス)          │
│ ──または──                                           │
│ [📁 新規アップロード] (input file)                   │
└─────────────────────────────────────────────────────┘
```

#### 実装要点

`buildBaseForm()` を async にするか、非同期でフォームにsectionを後付けする。
（`buildBaseForm` は現状 sync なので、フォーム描画後に非同期でセクションをappendする方式を推奨）

```js
// mapMain.appendChild(formArea); の直後に追加
if (selBase) {
  _appendBgSection(formArea, selBase);
}

async function _appendBgSection(container, base) {
  let images = [];
  try {
    const res = await fetch('/api/battle-backgrounds');
    const json = await res.json();
    images = json.images ?? [];
  } catch {}

  const section = document.createElement('div');
  section.className = 'form-section';
  section.innerHTML = `<div class="form-section-title">🎨 戦闘背景画像</div>`;

  // プレビュー
  const previewWrap = document.createElement('div');
  previewWrap.style.cssText = 'margin-bottom:10px';
  const currentImg = images.find(img => img.id === base.battleBgId);
  if (currentImg) {
    previewWrap.innerHTML = `
      <img src="${currentImg.url}" style="width:120px;height:68px;object-fit:cover;border-radius:5px;border:1px solid #30363d;display:block;margin-bottom:4px"/>
      <div style="font-size:10px;color:#8b949e">設定中: ${base.battleBgId}</div>`;
  } else {
    previewWrap.innerHTML = `
      <div style="width:120px;height:68px;border:2px dashed #30363d;border-radius:5px;display:flex;align-items:center;justify-content:center;color:#484f58;font-size:11px;margin-bottom:4px">未設定</div>`;
  }
  section.appendChild(previewWrap);

  // セレクトボックス（登録済み画像）
  const selRow = document.createElement('div');
  selRow.className = 'form-row';
  const selGroup = document.createElement('div');
  selGroup.className = 'form-group';
  selGroup.innerHTML = '<label>登録済み画像から選択</label>';
  const sel = document.createElement('select');
  sel.id = 'fb_battleBgId';
  sel.innerHTML = `<option value="">（背景なし）</option>` +
    images.map(img => `<option value="${img.id}" ${base.battleBgId === img.id ? 'selected' : ''}>${img.id}</option>`).join('');
  sel.onchange = () => {
    base.battleBgId = sel.value || null;
    // プレビューを即時更新
    const selected = images.find(i => i.id === sel.value);
    const pImg = previewWrap.querySelector('img');
    if (selected) {
      if (pImg) { pImg.src = selected.url; }
      else { previewWrap.innerHTML = `<img src="${selected.url}" style="width:120px;height:68px;object-fit:cover;border-radius:5px;border:1px solid #30363d;display:block;margin-bottom:4px"/><div style="font-size:10px;color:#8b949e">設定中: ${sel.value}</div>`; }
    } else {
      previewWrap.innerHTML = `<div style="width:120px;height:68px;border:2px dashed #30363d;border-radius:5px;display:flex;align-items:center;justify-content:center;color:#484f58;font-size:11px;margin-bottom:4px">未設定</div>`;
    }
  };
  selGroup.appendChild(sel);
  selRow.appendChild(selGroup);
  section.appendChild(selRow);

  // アップロード
  const upRow = document.createElement('div');
  upRow.className = 'form-row';
  upRow.innerHTML = '<div class="form-group"><label>新規アップロード（自動採番）</label></div>';
  const upInput = document.createElement('input');
  upInput.type = 'file'; upInput.accept = 'image/*';
  upInput.style.cssText = 'margin-top:4px;font-size:12px;color:#8b949e';
  upInput.onchange = async () => {
    const file = upInput.files[0]; if (!file) return;
    const fd = new FormData();
    fd.append('file', file, file.name);
    const r = await fetch('/api/upload/battle-bg', { method: 'POST', body: fd });
    const json = await r.json();
    if (json.ok) {
      // セレクトに追加して自動選択
      const opt = document.createElement('option');
      opt.value = json.id; opt.textContent = json.id; opt.selected = true;
      sel.appendChild(opt);
      base.battleBgId = json.id;
      images.push({ id: json.id, url: json.url });
      previewWrap.innerHTML = `<img src="${json.url}" style="width:120px;height:68px;object-fit:cover;border-radius:5px;border:1px solid #30363d;display:block;margin-bottom:4px"/><div style="font-size:10px;color:#8b949e">設定中: ${json.id}</div>`;
      showToast(`${json.id} をアップロードしました`);
    }
  };
  upRow.querySelector('.form-group').appendChild(upInput);
  section.appendChild(upRow);

  // 隣接拠点セクションの前に挿入
  const adjSection = container.querySelector('.form-section:last-of-type');
  // btn-row の前にsectionを挿入（saveBase() が fb_battleBgId を読み取る）
  const btnRow = container.querySelector('.btn-row');
  container.insertBefore(section, btnRow);
}
```

#### saveBase() 修正

`tools/editor-modules/tab-map.js` の `saveBase()` で `battleBgId` を保存に含める:

```js
// 既存のsaveBase内でbaseオブジェクトを組み立てる箇所に追加:
base.battleBgId = document.getElementById('fb_battleBgId')?.value || null;
```

`saveBase()` の実装を確認してから追加すること。

---

## Step 5: BattleScene.jsx の背景を動的に解決

### 変更箇所1: BActionScene の背景スタイル（約927行目）

```jsx
// 変更前
backgroundImage:'url(assets/bg_battle.jpg)',

// 変更後
backgroundImage: targetNode?.battleBgId
  ? `url(assets/battle_backgrounds/${targetNode.battleBgId}.jpg)`  // ※後述
  : 'url(assets/bg_battle.jpg)',
```

**注意**: 拡張子が `.jpg` と限らないため、`targetNode` に `battleBgUrl` を渡す方式を推奨。
GameContextで `targetNode` にURLを付与してから渡すか、またはBattleScene内でURLを解決する。

#### 推奨方式: BattleScene内でURL解決ヘルパーを定義

```js
// BattleScene.jsx の定数定義エリアに追加
function getBattleBgUrl(targetNode) {
  const id = targetNode?.battleBgId;
  if (!id) return 'assets/bg_battle.jpg';
  // 拡張子はjpg/png/webpどれでも対応するため、idにそのまま対応する
  // editor.cjsがbg_001.jpgのように採番するのでidからURLを推測できる
  // ただし拡張子が不確定なため、GameContextがbattleBgUrlを付与するのがベスト
  return `assets/battle_backgrounds/${id}`;  // 拡張子なし（Viteはそのまま通らない）
}
```

**実際の推奨実装**: `targetNode` に `battleBgUrl` フィールドを持たせる。

#### GameContext での URL 付与

`src/context/GameContext.jsx` 内で戦闘を開始する際に `targetNode` をセットする箇所を探し、
`bases.json` から読み込んだ base の `battleBgId` を元にURLを付与する:

```js
// 戦闘開始時にtargetNodeを構築する箇所（setCurrentBattle等）に追加:
const bgId = base.battleBgId;
// APIから取得した画像一覧を参照するか、拡張子を試行するか
// 最もシンプルな方法: battleBgIdにURLごと保存する方式に変更
// → bases.jsonの battleBgId を "bg_001" ではなく "assets/battle_backgrounds/bg_001.jpg" にする
```

**最もシンプルな実装**: `battleBgId` に拡張子込みのURLを保存する。

エディタでアップロード後、セレクトのvalueを `id`（`bg_001`）ではなく `url`（`/assets/battle_backgrounds/bg_001.jpg`）にする:

```js
// tab-map.jsのsel.innerHTML を変更:
sel.innerHTML = `<option value="">（背景なし）</option>` +
  images.map(img =>
    `<option value="${img.url}" ${base.battleBgId === img.url ? 'selected' : ''}>${img.id}</option>`
  ).join('');
// sel.onchange: base.battleBgId = sel.value || null;  ← 変更なし

// bases.jsonには "battleBgId": "/assets/battle_backgrounds/bg_001.jpg" が保存される
```

#### BattleScene.jsx での最終実装

```jsx
// BActionScene の backgroundImage:
backgroundImage: targetNode?.battleBgId
  ? `url(${targetNode.battleBgId})`
  : 'url(assets/bg_battle.jpg)',
```

同様に BattleAnimOverlay の背景も同じ修正を行う（約829行目付近）:

```jsx
// BattleAnimOverlay の return内のdivのstyle:
backgroundColor:'#0a0816',
backgroundImage: targetNode?.battleBgId
  ? `url(${targetNode.battleBgId})`
  : 'url(assets/bg_battle.jpg)',
```

**注意**: `BattleAnimOverlay` には現在 `targetNode` prop が渡されていない。
`BattleFlow` → `BActionScene` → `BattleAnimOverlay` に `targetNode` を追加で渡すこと。

#### BattleAnimOverlay へのtargetNode受け渡し

```jsx
// BActionScene の return 内の BattleAnimOverlay を呼ぶ箇所:
{animState && (
  <BattleAnimOverlay
    anim={animState}
    targetNode={targetNode}   // ← 追加
    onContinue={() => { ... }}
  />
)}

// BattleAnimOverlay の関数シグネチャに追加:
function BattleAnimOverlay({ anim, targetNode, onContinue }) {
```

---

## Step 6: BattleFullQAScene / BattleQAScene の確認

QAシーン（`BattleFullQAScene.jsx`, `BattleQAScene.jsx`）で `targetNode` を渡している場合、
`battleBgId` が未設定でもフォールバック（`assets/bg_battle.jpg`）が使われるため変更不要。

---

## 完了条件

- [ ] `public/battle_backgrounds/` ディレクトリが存在する
- [ ] エディタのマップタブ → 拠点選択 → 戦闘背景画像セクションが表示される
- [ ] 画像をアップロードすると `bg_001`, `bg_002` ... と採番される
- [ ] 拠点に画像を設定して保存すると `bases.json` の `battleBgId` に URL が書き込まれる
- [ ] 戦闘シーン（BActionScene）で設定した背景画像が表示される
- [ ] 戦闘アニメーションオーバーレイ（BattleAnimOverlay）でも同じ背景が表示される
- [ ] `battleBgId` 未設定の拠点ではフォールバック（bg_battle.jpg）が表示される（真っ暗にならない）
- [ ] QA環境（`?qa=battlefull`）でゲーム本体の動作が壊れていない

---

## 完了後

このファイルを `docs/archive/` に移動する。
`KNOWLEDGE.md §18 残タスク` を更新する。
