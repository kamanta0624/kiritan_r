// tools/editor-modules/tab-items.js

import { state, v, n, esc, syncNum, syncRange, showToast, imgPreviewHTML, reloadImages } from './shared.js';

export function renderItemTab(main) {
  const items   = state.data.items?.items ?? [];
  const selItem = items.find(i => i.id === state.selectedId) ?? null;

  main.innerHTML = '';
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <span class="sidebar-title">アイテム（${items.length}種）</span>
      <button class="btn-add" onclick="window.EditorApp.addItem()">＋</button>
    </div>
    <div class="char-list" id="itemList"></div>`;
  main.appendChild(sidebar);

  const itemList = sidebar.querySelector('#itemList');
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'char-item' + (item.id === state.selectedId ? ' active' : '');
    div.onclick = () => { state.selectedId = item.id; window.EditorApp.renderAll(); };
    const iconImgs = (state.images['items/icons'] || []).filter(i => i.filename.startsWith(item.id));
    div.innerHTML = (iconImgs[0]
      ? `<img class="char-thumb" src="${iconImgs[0].url}" />`
      : `<div class="char-thumb-ph">⚔</div>`)
      + `<div class="char-item-info">
          <div class="char-item-name">${esc(item.name)}</div>
          <div class="char-item-sub">${item.type} / ${item.cost}ミーム</div>
        </div>`;
    itemList.appendChild(div);
  });

  const editorWrap = document.createElement('div');
  editorWrap.className = 'editor';
  if (!selItem) {
    editorWrap.innerHTML = '<div class="editor-empty">アイテムを選択してください</div>';
  } else {
    editorWrap.appendChild(buildItemForm(selItem));
    editorWrap.appendChild(buildItemImages(selItem));
  }
  main.appendChild(editorWrap);
}

// ----------------------------------------------------------------
// フォーム構築
// ----------------------------------------------------------------
function buildItemForm(item) {
  const wrap = document.createElement('div');
  wrap.className = 'editor-left';
  const effectTypes = {
    charAttack:  '攻撃力',
    charMaxHp:   '最大HP',
    soldierAtk:  'ミーム攻撃力',
    soldierDef:  'ミーム防御力',
    maxSoldiers: '最大ミーム数',
  };
  wrap.innerHTML = `
    <div class="form-section"><div class="form-section-title">基本情報</div>
      <div class="form-row">
        <div class="form-group w-half"><label>ID</label>
          <input type="text" id="fi_id" value="${esc(item.id)}" /></div>
        <div class="form-group w-half"><label>名前</label>
          <input type="text" id="fi_name" value="${esc(item.name)}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group w-half"><label>タイプ</label>
          <select id="fi_type">${['weapon','armor','accessory']
            .map(t => `<option value="${t}" ${item.type===t?'selected':''}>${t}</option>`).join('')}</select></div>
        <div class="form-group w-half"><label>slotType</label>
          <input type="text" id="fi_slotType" value="${esc(item.slotType||item.type)}" /></div>
      </div>
      <div class="form-row"><div class="form-group"><label>説明文</label>
        <textarea id="fi_description" rows="2">${esc(item.description||'')}</textarea></div></div>
      <div class="form-row">
        <div class="form-group">
          <label>
            <input type="checkbox" id="fi_startWithPlayer"
              ${item.startWithPlayer ? 'checked' : ''} />
            ゲーム開始時から所持
          </label>
        </div>
      </div>
    </div>
    <div class="form-section"><div class="form-section-title">効果</div>
      <div class="form-row">
        <div class="form-group w-half"><label>効果タイプ</label>
          <select id="fi_effectType">${Object.entries(effectTypes)
            .map(([k,l]) => `<option value="${k}" ${item.effect?.type===k?'selected':''}>${l}</option>`).join('')}</select></div>
        <div class="form-group w-half"><label>効果値</label>
          <div class="num-wrap">
            <input type="range" min="1" max="200" value="${item.effect?.value||10}"
              oninput="window.EditorApp.syncNum(this,'fi_effectValue')" />
            <input type="number" id="fi_effectValue" value="${item.effect?.value||10}"
              oninput="window.EditorApp.syncRange(this)" /></div></div>
      </div>
    </div>
    <div class="form-section"><div class="form-section-title">価格</div>
      <div class="form-row">
        <div class="form-group w-half"><label>購入コスト</label>
          <div class="num-wrap">
            <input type="range" min="50" max="2000" step="50" value="${item.cost}"
              oninput="window.EditorApp.syncNum(this,'fi_cost')" />
            <input type="number" id="fi_cost" value="${item.cost}"
              oninput="window.EditorApp.syncRange(this)" /></div></div>
        <div class="form-group w-half"><label>売却価格</label>
          <div class="num-wrap">
            <input type="range" min="10" max="1000" step="10" value="${item.sellPrice}"
              oninput="window.EditorApp.syncNum(this,'fi_sellPrice')" />
            <input type="number" id="fi_sellPrice" value="${item.sellPrice}"
              oninput="window.EditorApp.syncRange(this)" /></div></div>
      </div>
    </div>
    <div class="btn-row">
      <button class="btn-danger"  onclick="window.EditorApp.deleteItem()">削除</button>
      <button class="btn-primary" onclick="window.EditorApp.saveItem()">保存</button>
    </div>`;
  return wrap;
}

function buildItemImages(item) {
  const wrap     = document.createElement('div');
  wrap.className = 'editor-right';
  const iconImgs = (state.images['items/icons'] || []).filter(i => i.filename.startsWith(item.id));
  wrap.innerHTML = `
    <div class="form-section"><div class="form-section-title">画像</div>
      <div class="img-card"><div class="img-card-title">アイコン</div>
        <div class="img-preview-wrap">
          ${iconImgs.map(img => imgPreviewHTML(img, 'icon')).join('')}
          ${!iconImgs.length ? `<div class="img-placeholder" style="width:72px;height:72px;font-size:10px">未設定</div>` : ''}
        </div>
        <input type="file" id="fileItemIcon" accept="image/*"
          onchange="window.EditorApp.uploadImage(this,'items/icons','${item.id}')" />
        <button class="btn-upload" onclick="document.getElementById('fileItemIcon').click()">＋ アップロード</button>
      </div>
    </div>`;
  return wrap;
}

// ----------------------------------------------------------------
// CRUD
// ----------------------------------------------------------------
export function saveItem() {
  const items = state.data.items.items;
  const idx   = items.findIndex(i => i.id === state.selectedId); if (idx === -1) return;
  const item  = items[idx];
  item.id          = v('fi_id');
  item.name        = v('fi_name');
  item.type        = v('fi_type');
  item.slotType    = v('fi_slotType');
  item.description = v('fi_description');
  item.cost        = n('fi_cost');
  item.sellPrice   = n('fi_sellPrice');
  item.effect           = { type: v('fi_effectType'), value: n('fi_effectValue') };
  item.startWithPlayer  = document.getElementById('fi_startWithPlayer')?.checked ?? false;
  state.selectedId = item.id;
  saveItemsToServer();
}

export function addItem() {
  const items = state.data.items.items;
  const nums  = items.map(i => parseInt(i.id.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
  const newId = `item_${String(nums.length > 0 ? Math.max(...nums) + 1 : 1).padStart(4, '0')}`;
  items.push({ id: newId, name: '新規アイテム', type: 'weapon', slotType: 'weapon',
    description: '', effect: { type: 'charAttack', value: 10 }, cost: 300, sellPrice: 150,
    startWithPlayer: false });
  state.selectedId = newId;
  saveItemsToServer();
}

export function deleteItem() {
  if (!confirm('削除しますか？')) return;
  const items = state.data.items.items;
  const idx   = items.findIndex(i => i.id === state.selectedId); if (idx === -1) return;
  items.splice(idx, 1);
  state.selectedId = null;
  saveItemsToServer();
}

async function saveItemsToServer() {
  try {
    const res  = await fetch('/api/save/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.data.items),
    });
    const json = await res.json();
    if (json.ok) showToast('保存しました ✓'); else showToast('保存失敗', true);
  } catch (e) { showToast('通信エラー: ' + e.message, true); }
  await reloadImages();
  window.EditorApp.renderAll();
}
