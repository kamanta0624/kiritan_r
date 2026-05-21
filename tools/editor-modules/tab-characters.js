// tools/editor-modules/tab-characters.js

import {
  state, STATUS_LABELS,
  v, n, esc, syncNum, syncRange, showToast,
  imgPreviewHTML, reloadImages,
  buildBonusSectionHTML, collectBonusFromForm,
} from './shared.js';

export function renderCharTab(main) {
  const allChars = state.data.characters?.characters ?? [];
  const factions = state.data.factions?.factions ?? [];
  const filtered = allChars.filter(c => {
    if (state.charFilter === 'all')      return true;
    if (state.charFilter === 'template') return !!c.isTemplate;
    return !c.isTemplate && c.status === state.charFilter;
  });
  const selChar = allChars.find(c => c.id === state.selectedId) ?? null;

  main.innerHTML = '';
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <span class="sidebar-title">キャラクター（${allChars.length}体）</span>
      <button class="btn-add" onclick="window.EditorApp.addChar()">＋</button>
    </div>
    <div class="filter-bar">
      ${[['all','すべて'],['active','加入済み'],['recruitable','雇用可'],['standby','在野'],['template','テンプレート']]
        .map(([k,l]) => `<button class="filter-btn${state.charFilter===k?' active':''}"
          onclick="window.EditorApp.setFilter('${k}')">${l}</button>`).join('')}
    </div>
    <div class="char-list" id="charList"></div>`;
  main.appendChild(sidebar);

  const charList = sidebar.querySelector('#charList');
  filtered.forEach(c => {
    const div = document.createElement('div');
    div.className = 'char-item' + (c.id === state.selectedId ? ' active' : '');
    div.onclick = () => { state.selectedId = c.id; window.EditorApp.renderAll(); };
    const iconImgs = (state.images['characters/icons'] || []).filter(i => i.filename.startsWith(c.id));
    const iconUrl  = iconImgs[0]?.url ?? null;
    const badgeCls = c.isTemplate ? 'badge-template' : (STATUS_LABELS[c.status]?.cls ?? '');
    const badgeTxt = c.isTemplate ? 'テンプレート' : (STATUS_LABELS[c.status]?.label ?? c.status ?? '?');
    const dispName = (c.isTemplate ? c.displayName : c.name) || '(名前なし)';
    div.innerHTML = (iconUrl
      ? `<img class="char-thumb" src="${iconUrl}?t=${Date.now()}" />`
      : `<div class="char-thumb-ph">${dispName.charAt(0)}</div>`)
      + `<div class="char-item-info">
          <div class="char-item-name">${dispName}</div>
          <div class="char-item-sub">
            <span class="badge ${badgeCls}">${badgeTxt}</span>
            <span>${c.role ?? ''} / ${c.attackType ?? ''}${c.skillId ? ' / ✦特技' : ''}</span>
          </div>
        </div>`;
    charList.appendChild(div);
  });

  const editorWrap = document.createElement('div');
  editorWrap.className = 'editor';
  if (!selChar) {
    editorWrap.innerHTML = '<div class="editor-empty">キャラクターを選択してください</div>';
  } else {
    editorWrap.appendChild(buildCharForm(selChar, factions));
    editorWrap.appendChild(buildCharImages(selChar));
  }
  main.appendChild(editorWrap);
}

// ----------------------------------------------------------------
// フォーム構築
// ----------------------------------------------------------------
function buildSkillOptions(currentSkillId) {
  const skills  = state.data?.skills?.skills ?? [];
  const noneOpt = `<option value="" ${!currentSkillId ? 'selected' : ''}>なし（null）</option>`;
  const opts    = skills.map(s =>
    `<option value="${esc(s.id)}" ${currentSkillId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`
  ).join('');
  return noneOpt + opts;
}

function nameVariantRow(val, idx) {
  return `<div class="name-variant-row" id="nvRow_${idx}">
    <input type="text" class="nv-input" value="${esc(val)}" />
    <button class="btn-icon" onclick="window.EditorApp.removeNameVariant(${idx})">✕</button>
  </div>`;
}

function buildCharForm(c, factions) {
  const wrap       = document.createElement('div');
  wrap.className   = 'editor-left';
  const isTemplate = !!c.isTemplate;
  const factionOpts = factions.map(f =>
    `<option value="${f.id}" ${c.factionId === f.id ? 'selected' : ''}>${f.name}</option>`
  ).join('');

  let html = `
    <div class="form-section">
      <div class="form-section-title">基本情報</div>
      <div class="form-row">
        <div class="form-group w-half"><label>ID</label>
          <input type="text" id="f_id" value="${esc(c.id)}" /></div>
        ${isTemplate
          ? `<div class="form-group w-half"><label>汎用名称</label>
              <input type="text" id="f_displayName" value="${esc(c.displayName||'')}" /></div>`
          : `<div class="form-group w-half"><label>名前</label>
              <input type="text" id="f_name" value="${esc(c.name||'')}" /></div>`}
      </div>
      <div class="form-row">
        <div class="form-group w-half"><label>かな (kana)</label>
          <input type="text" id="f_kana" value="${esc(c.kana||'')}" placeholder="ひらがな / カットイン用" /></div>
        <div class="form-group w-half"></div>
      </div>
      <div class="form-row">
        <div class="form-group w-half"><label>ステータス</label>
          <select id="f_status">${['active','recruitable','standby','dead']
            .map(s => `<option value="${s}" ${c.status===s?'selected':''}>${STATUS_LABELS[s]?.label??s}</option>`)
            .join('')}</select></div>
        <div class="form-group w-half"><label>テンプレート</label>
          <select id="f_isTemplate">
            <option value="false" ${!isTemplate?'selected':''}>ネームド</option>
            <option value="true"  ${isTemplate ?'selected':''}>テンプレートモブ</option>
          </select></div>
      </div>
      ${!isTemplate ? `
      <div class="form-row">
        <div class="form-group w-half"><label>勢力</label>
          <select id="f_factionId">${factionOpts}</select></div>
        <div class="form-group w-half"><label>リーダー</label>
          <select id="f_isLeader">
            <option value="false" ${!c.isLeader?'selected':''}>いいえ</option>
            <option value="true"  ${c.isLeader ?'selected':''}>はい</option>
          </select></div>
      </div>
      <div class="form-row">
        <div class="form-group w-half"><label>加入条件</label>
          <input type="text" id="f_joinCondition" value="${esc(c.joinCondition||'')}" /></div>
        <div class="form-group w-half"><label>雇用コスト</label>
          <div class="num-wrap">
            <input type="range" min="0" max="1000" step="10" value="${c.hireCost||0}"
              oninput="window.EditorApp.syncNum(this,'f_hireCost')" />
            <input type="number" id="f_hireCost" value="${c.hireCost||0}"
              oninput="window.EditorApp.syncRange(this)" />
          </div></div>
      </div>` : ''}
      <div class="form-row">
        <div class="form-group w-half"><label>役割</label>
          <select id="f_role">${['attacker','guardian','commander']
            .map(r => `<option value="${r}" ${c.role===r?'selected':''}>${r}</option>`).join('')}</select></div>
        <div class="form-group w-half"><label>攻撃タイプ</label>
          <select id="f_attackType">
            <option value="melee"  ${c.attackType==='melee' ?'selected':''}>melee（近接）</option>
            <option value="ranged" ${c.attackType==='ranged'?'selected':''}>ranged（間接）</option>
            <option value="song"   ${c.attackType==='song'  ?'selected':''}>song（歌）</option>
          </select></div>
      </div>
      <div class="form-row"><div class="form-group"><label>説明文</label>
        <textarea id="f_description" rows="2">${esc(c.description||'')}</textarea></div></div>
    </div>`;

  if (isTemplate) {
    const variants = c.nameVariants || [];
    html += `<div class="mob-section">
      <div class="form-section-title">テンプレートモブ設定</div>
      <div class="form-row">
        <div class="form-group w-half"><label>デフォルト勢力</label>
          <select id="f_factionId">
            <option value="" ${!c.factionId?'selected':''}>未指定</option>${factionOpts}
          </select></div>
        <div class="form-group w-half"><label>ステータスばらつき</label>
          <div class="num-wrap">
            <input type="range" min="0" max="0.5" step="0.05" value="${c.statVariance||0.15}"
              oninput="window.EditorApp.syncNum(this,'f_statVariance')" />
            <input type="number" id="f_statVariance" value="${c.statVariance||0.15}" step="0.05"
              oninput="window.EditorApp.syncRange(this)" />
          </div></div>
      </div>
      <div class="form-row"><div class="form-group"><label>ランダム名リスト</label>
        <div class="name-variants-wrap" id="nameVariantsWrap">
          ${variants.map((v, i) => nameVariantRow(v, i)).join('')}
        </div>
        <button class="btn-small" style="margin-top:5px"
          onclick="window.EditorApp.addNameVariant()">＋ 追加</button>
      </div></div>
    </div>`;
  }

  html += `
    <div class="form-section"><div class="form-section-title">キャラクターステータス</div>
      <div class="form-row">
        <div class="form-group"><label>HP (charMaxHp)</label>
          <div class="num-wrap">
            <input type="range" min="50" max="500" step="10" value="${c.charMaxHp||150}"
              oninput="window.EditorApp.syncNum(this,'f_charMaxHp')" />
            <input type="number" id="f_charMaxHp" value="${c.charMaxHp||150}"
              oninput="window.EditorApp.syncRange(this)" /></div></div>
        <div class="form-group"><label>攻撃力 (charAttack)</label>
          <div class="num-wrap">
            <input type="range" min="10" max="200" step="5" value="${c.charAttack||60}"
              oninput="window.EditorApp.syncNum(this,'f_charAttack')" />
            <input type="number" id="f_charAttack" value="${c.charAttack||60}"
              oninput="window.EditorApp.syncRange(this)" /></div></div>
        <div class="form-group"><label>防御力 (charDefense)</label>
          <div class="num-wrap">
            <input type="range" min="0" max="300" step="5" value="${c.charDefense??0}"
              oninput="window.EditorApp.syncNum(this,'f_charDefense')" />
            <input type="number" id="f_charDefense" value="${c.charDefense??0}"
              oninput="window.EditorApp.syncRange(this)" /></div></div>
        <div class="form-group"><label>攻撃回数 (attackCount)</label>
          <div class="num-wrap">
            <input type="range" min="1" max="80" step="1" value="${c.attackCount??8}"
              oninput="window.EditorApp.syncNum(this,'f_attackCount')" />
            <input type="number" id="f_attackCount" value="${c.attackCount??8}" min="1"
              oninput="window.EditorApp.syncRange(this)" /></div></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label style="color:#e87aaa">歌 (charSong)</label>
          <div class="num-wrap">
            <input type="range" min="0" max="100" value="${c.charSong??20}"
              oninput="window.EditorApp.syncNum(this,'f_charSong')" />
            <input type="number" id="f_charSong" value="${c.charSong??20}"
              oninput="window.EditorApp.syncRange(this)" /></div></div>
        <div class="form-group w-half"><label>回復率 (recoveryRate)</label>
          <input type="number" id="f_recoveryRate" value="${c.recoveryRate??''}" step="0.01" min="0" max="1" placeholder="未指定" /></div>
      </div>
    </div>
    <div class="form-section"><div class="form-section-title">ミーム（兵士）</div>
      <div class="form-row">
        <div class="form-group w-half"><label>ミームタイプ名</label>
          <input type="text" id="f_soldierName" value="${esc(c.soldierName||'一般兵')}" /></div>
        <div class="form-group w-half"><label>初期ミーム数</label>
          <div class="num-wrap">
            <input type="range" min="100" max="5000" step="100" value="${c.soldiers||500}"
              oninput="window.EditorApp.syncNum(this,'f_soldiers')" />
            <input type="number" id="f_soldiers" value="${c.soldiers||500}"
              oninput="window.EditorApp.syncRange(this)" /></div></div>
      </div>
      <div class="form-row"><div class="form-group"><label>最大ミーム数</label>
        <div class="num-wrap">
          <input type="range" min="100" max="5000" step="100" value="${c.maxSoldiers||1000}"
            oninput="window.EditorApp.syncNum(this,'f_maxSoldiers')" />
          <input type="number" id="f_maxSoldiers" value="${c.maxSoldiers||1000}"
            oninput="window.EditorApp.syncRange(this)" /></div></div>
      </div>
      <div class="form-row">
        <div class="form-group w-half"><label>ミーム攻撃力</label>
          <div class="num-wrap">
            <input type="range" min="1" max="30" value="${c.soldierAtk||9}"
              oninput="window.EditorApp.syncNum(this,'f_soldierAtk')" />
            <input type="number" id="f_soldierAtk" value="${c.soldierAtk||9}"
              oninput="window.EditorApp.syncRange(this)" /></div></div>
        <div class="form-group w-half"><label>ミーム防御力</label>
          <div class="num-wrap">
            <input type="range" min="1" max="30" value="${c.soldierDef||9}"
              oninput="window.EditorApp.syncNum(this,'f_soldierDef')" />
            <input type="number" id="f_soldierDef" value="${c.soldierDef||9}"
              oninput="window.EditorApp.syncRange(this)" /></div></div>
      </div>
    </div>
    <div class="skill-section">
      <div class="form-section-title">✦ 特技 (skillId)</div>
      <div class="form-row"><div class="form-group">
        <label style="color:#c084fc">特技スキル</label>
        <select id="f_skillId">${buildSkillOptions(c.skillId ?? null)}</select>
      </div></div>
      <div class="form-row">
        <div class="form-group w-half"><label>必殺技タイプ (specialType)</label>
          <select id="f_specialType">
            <option value=""        ${!c.specialType              ?'selected':''}>なし</option>
            <option value="char_strike" ${c.specialType==='char_strike'?'selected':''}>char_strike（本体撃）</option>
            <option value="sp_strike"   ${c.specialType==='sp_strike'  ?'selected':''}>sp_strike（SP撃）</option>
          </select></div>
        <div class="form-group w-half"><label>作戦成功率 (strategyRate)</label>
          <div class="num-wrap">
            <input type="range" min="0" max="100" step="1" value="${c.strategyRate??0}"
              oninput="window.EditorApp.syncNum(this,'f_strategyRate')" />
            <input type="number" id="f_strategyRate" value="${c.strategyRate??0}" min="0" max="100"
              oninput="window.EditorApp.syncRange(this)" /></div></div>
      </div>
      <div class="form-row"><div class="form-group"><label>個別会話イベントID (talkEventId)</label>
        <input type="text" id="f_talkEventId" value="${esc(c.talkEventId||'')}" /></div>
      </div>
    </div>
    ${buildBonusSectionHTML(c.battleBonus)}
    <div class="btn-row">
      <button class="btn-duplicate" onclick="window.EditorApp.duplicateChar()">複製</button>
      <button class="btn-danger"    onclick="window.EditorApp.deleteChar()">削除</button>
      <button class="btn-primary"   onclick="window.EditorApp.saveChar()">保存</button>
    </div>`;

  wrap.innerHTML = html;
  return wrap;
}

function buildCharImages(c) {
  const wrap        = document.createElement('div');
  wrap.className    = 'editor-right';
  const iconImgs    = (state.images['characters/icons']    ||[]).filter(i => i.filename.startsWith(c.id));
  const portraitImgs= (state.images['characters/portraits']||[]).filter(i => i.filename.startsWith(c.id));
  const sceneImgs   = (state.images['characters/scenes']   ||[]).filter(i => i.filename.startsWith(c.id));
  wrap.innerHTML = `
    <div class="form-section"><div class="form-section-title">画像</div>
      <div class="img-card"><div class="img-card-title">アイコン</div>
        <div class="img-preview-wrap">
          ${iconImgs.map(img => imgPreviewHTML(img, 'icon')).join('')}
          ${!iconImgs.length ? `<div class="img-placeholder" style="width:72px;height:72px;font-size:10px">未設定</div>` : ''}
        </div>
        <input type="file" id="fileIcon" accept="image/*"
          onchange="window.EditorApp.uploadImage(this,'characters/icons','${c.id}_icon')" />
        <button class="btn-upload" onclick="document.getElementById('fileIcon').click()">＋ アップロード</button>
      </div>
      <div class="img-card"><div class="img-card-title">立ち絵</div>
        <div class="img-preview-wrap">
          ${portraitImgs.map(img => imgPreviewHTML(img, 'portrait')).join('')}
          ${!portraitImgs.length ? `<div class="img-placeholder" style="width:54px;height:72px;font-size:10px">未設定</div>` : ''}
        </div>
        <input type="file" id="filePortrait" accept="image/*"
          onchange="window.EditorApp.uploadImage(this,'characters/portraits','${c.id}_portrait')" />
        <button class="btn-upload" onclick="document.getElementById('filePortrait').click()">＋ アップロード</button>
      </div>
      <div class="img-card"><div class="img-card-title">シーン画像</div>
        <div class="img-preview-wrap">
          ${sceneImgs.map(img => imgPreviewHTML(img, 'scene')).join('')}
          ${!sceneImgs.length ? `<div class="img-placeholder" style="width:110px;height:62px;font-size:10px">未設定</div>` : ''}
        </div>
        <input type="file" id="fileScene" accept="image/*"
          onchange="window.EditorApp.uploadImage(this,'characters/scenes','${c.id}_scene_'+Date.now())" />
        <button class="btn-upload" onclick="document.getElementById('fileScene').click()">＋ 追加</button>
      </div>
    </div>`;
  return wrap;
}

// ----------------------------------------------------------------
// CRUD
// ----------------------------------------------------------------
export function setFilter(f) { state.charFilter = f; window.EditorApp.renderAll(); }

export function addNameVariant() {
  const wrap = document.getElementById('nameVariantsWrap'); if (!wrap) return;
  wrap.insertAdjacentHTML('beforeend', nameVariantRow('', wrap.children.length));
}
export function removeNameVariant(idx) {
  document.getElementById(`nvRow_${idx}`)?.remove();
  document.querySelectorAll('.name-variant-row').forEach((r, i) => {
    r.id = `nvRow_${i}`;
    const btn = r.querySelector('button'); if (btn) btn.setAttribute('onclick', `window.EditorApp.removeNameVariant(${i})`);
  });
}
function getNameVariants() {
  return [...document.querySelectorAll('.nv-input')].map(i => i.value.trim()).filter(Boolean);
}

export function saveChar() {
  const chars = state.data.characters.characters;
  const idx   = chars.findIndex(c => c.id === state.selectedId); if (idx === -1) return;
  const c     = chars[idx];
  const isTemplate = v('f_isTemplate') === 'true';

  c.id = v('f_id'); c.isTemplate = isTemplate; c.status = v('f_status');
  c.kana = v('f_kana') || null;
  c.role = v('f_role'); c.attackType = v('f_attackType'); c.description = v('f_description');
  c.charMaxHp  = n('f_charMaxHp'); c.charHp = c.charMaxHp;
  c.charAttack = n('f_charAttack'); c.attack = c.charAttack;
  c.charDefense = n('f_charDefense');
  c.attackCount  = n('f_attackCount');
  c.charSong   = n('f_charSong');
  c.skillId      = v('f_skillId') || null;
  c.specialType  = v('f_specialType') || null;
  c.strategyRate = n('f_strategyRate');
  c.recoveryRate = v('f_recoveryRate') !== '' ? parseFloat(v('f_recoveryRate')) : null;
  c.talkEventId  = v('f_talkEventId') || null;
  c.soldierName = v('f_soldierName'); c.soldiers = n('f_soldiers'); c.maxSoldiers = n('f_maxSoldiers');
  c.soldierAtk = n('f_soldierAtk'); c.soldierDef = n('f_soldierDef');
  c.factionId  = v('f_factionId') || null;
  c.battleBonus = collectBonusFromForm();

  if (isTemplate) {
    c.displayName = v('f_displayName'); c.nameVariants = getNameVariants();
    c.statVariance = parseFloat(v('f_statVariance')) || 0.15;
    delete c.name;
  } else {
    c.name = v('f_name'); c.isLeader = v('f_isLeader') === 'true';
    c.joinCondition = v('f_joinCondition') || null; c.hireCost = n('f_hireCost');
    delete c.displayName; delete c.nameVariants; delete c.statVariance;
  }
  state.selectedId = c.id;
  saveCharsToServer();
}

export function addChar() {
  const chars = state.data.characters.characters;
  const nums  = chars.map(c => parseInt(c.id.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
  const next  = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  const newId = `char_${String(next).padStart(3, '0')}`;
  const defaultBonus = {
    attack:  { soldierAtk:0, soldierDef:0, charAttack:0, charSong:0 },
    defense: { soldierAtk:0, soldierDef:0, charAttack:0, charSong:0 },
    dungeon: { soldierAtk:0, soldierDef:0, charAttack:0, charSong:0 },
  };
  chars.push({
    id: newId, name: '新規キャラクター', kana: null,
    factionId: state.data.factions.factions[0]?.id ?? 'player',
    status: 'standby', joinCondition: null, isTemplate: false,
    attack: 70, defense: 70, soldiers: 500, maxSoldiers: 1000,
    isLeader: false, usedThisTurn: false, role: 'attacker', attackType: 'melee',
    charHp: 150, charMaxHp: 150, charAttack: 70, charDefense: 0, attackCount: 8, charSong: 20,
    skillId: null, strategyRate: 0, recoveryRate: null,
    soldierName: '一般兵', soldierAtk: 10, soldierDef: 8,
    description: '', hireCost: 0, equipment: { item: null }, battleBonus: defaultBonus,
  });
  state.selectedId  = newId;
  state.charFilter  = 'all';
  saveCharsToServer();
}

export function duplicateChar() {
  const chars = state.data.characters.characters;
  const c     = chars.find(ch => ch.id === state.selectedId); if (!c) return;
  const nums  = chars.map(c => parseInt(c.id.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
  const newId = `char_${String(Math.max(...nums) + 1).padStart(3, '0')}`;
  const clone = { ...JSON.parse(JSON.stringify(c)), id: newId };
  if (clone.name)        clone.name        += '（複製）';
  if (clone.displayName) clone.displayName += '（複製）';
  chars.push(clone);
  state.selectedId = newId;
  saveCharsToServer();
}

export function deleteChar() {
  if (!confirm('削除しますか？')) return;
  const chars = state.data.characters.characters;
  const idx   = chars.findIndex(c => c.id === state.selectedId); if (idx === -1) return;
  chars.splice(idx, 1);
  state.selectedId = null;
  saveCharsToServer();
}

async function saveCharsToServer() {
  try {
    const res  = await fetch('/api/save/characters', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.data.characters),
    });
    const json = await res.json();
    if (json.ok) showToast('保存しました ✓'); else showToast('保存失敗', true);
  } catch (e) { showToast('通信エラー: ' + e.message, true); }
  await reloadImages();
  window.EditorApp.renderAll();
}
