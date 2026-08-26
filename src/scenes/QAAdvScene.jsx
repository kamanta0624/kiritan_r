import { useState, useEffect, useMemo, useCallback } from 'react';
import { PK, AC, TX, TXD, BR, glass, PANEL_LIGHT } from '../shared/tokens.js';
import ADVScene, {
  DEMO_SCENARIO, DEMO_CAST, usePortraitData, CompositeChar,
} from './ADVScene.jsx';
import {
  getViewBottomCm, setViewBottomCm, getViewTopCm, setViewTopCm,
  computeGroundedFrame, BASE_HEIGHT_CM, ANCHOR_RATIO,
} from '../shared/portraitScale.js';
import characterHeightData from '../game/data/characterHeight.json';
import charactersData from '../game/data/characters.json';

const charNameByKey = new Map(charactersData.characters.map(c => [c.id, c.name]));

function useCharKeyIndex() {
  const [keys, setKeys] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/characters/ymm4/_index.json')
      .then(r => r.ok ? r.json() : [])
      .then(list => { if (!cancelled) setKeys(list.slice().sort()); })
      .catch(() => { if (!cancelled) setKeys([]); });
    return () => { cancelled = true; };
  }, []);
  return keys;
}

function useLocalStorageState(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v != null ? JSON.parse(v) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* noop */ }
  }, [key, state]);
  return [state, setState];
}

// 全カテゴリで「（なし）」を選べる（修正4: 素材によっては顔色・髪等を出さないのが正しい個体がある）
const CATEGORY_DIRS = ['後', '体', '口', '目', '眉', '顔色', '髪', '他'];
const PREVIEW_H = 360;

function Slider({ label, min, max, step, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 10, fontFamily: 'Rajdhani', fontWeight: 700, letterSpacing: '.14em', color: TXD, minWidth: 110 }}>{label}</div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: PK }}
      />
      <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 13, color: AC, minWidth: 40, textAlign: 'right' }}>{value}</div>
    </div>
  );
}

export default function QAAdvScene({ onBack }) {
  const charKeys = useCharKeyIndex();

  const [collapsed, setCollapsed] = useLocalStorageState('kiritan_qa_editor_collapsed', false);
  const [editingCharKey, setEditingCharKey] = useLocalStorageState('kiritan_qa_editor_charkey', 'char_004');
  const [editingPos, setEditingPos] = useLocalStorageState('kiritan_qa_editor_pos', 'center');
  const [selections, setSelections] = useLocalStorageState('kiritan_qa_editor_selections', {});
  const [showJson, setShowJson] = useState(false);

  const [viewBottomCm, setViewBottomCmState] = useState(getViewBottomCm());
  const [viewTopCm, setViewTopCmState] = useState(getViewTopCm());
  const handleBottom = (v) => { setViewBottomCmState(v); setViewBottomCm(v); };
  const handleTop = (v) => { setViewTopCmState(v); setViewTopCm(v); };

  const portrait = usePortraitData(editingCharKey);

  // 編集中キャラの初回選択は portrait.json.default から作る（既にドラフトがあれば触らない＝中断・再開）
  useEffect(() => {
    if (!portrait) return;
    setSelections(prev => {
      if (prev[editingCharKey]) return prev;
      return { ...prev, [editingCharKey]: { ...(portrait.default || {}) } };
    });
  }, [portrait, editingCharKey]);

  const currentSelection = selections[editingCharKey] || {};

  const updateCat = useCallback((cat, file) => {
    setSelections(prev => ({
      ...prev,
      [editingCharKey]: { ...(prev[editingCharKey] || {}), [cat]: file },
    }));
  }, [editingCharKey]);

  const handleReset = () => {
    if (!portrait) return;
    setSelections(prev => ({ ...prev, [editingCharKey]: { ...(portrait.default || {}) } }));
  };

  const charIndex = charKeys ? charKeys.indexOf(editingCharKey) : -1;
  const gotoOffset = (delta) => {
    if (!charKeys || charKeys.length === 0) return;
    const i = charIndex < 0 ? 0 : (charIndex + delta + charKeys.length) % charKeys.length;
    setEditingCharKey(charKeys[i]);
  };

  const pxPerCmAtPreview = useMemo(() => PREVIEW_H / (viewTopCm - viewBottomCm), [viewTopCm, viewBottomCm]);
  const previewHeightCm = characterHeightData[editingCharKey] ?? BASE_HEIGHT_CM;
  const previewFrame = portrait ? computeGroundedFrame(portrait, previewHeightCm, viewBottomCm, viewTopCm, PREVIEW_H) : null;
  const groundYPreview = PREVIEW_H + viewBottomCm * pxPerCmAtPreview;
  const previewAnchorPercent = (ANCHOR_RATIO[editingPos] ?? 0.5) * 100;

  const jsonOutput = useMemo(() => JSON.stringify(selections, null, 2), [selections]);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      {/* ADVScene本体: DEMO_SCENARIO を直接起動（通常フローは進ませない）。
          editingCharKey が cast 内にいれば最前面に出す（修正5） */}
      <ADVScene script={DEMO_SCENARIO} castOverride={DEMO_CAST} onExit={() => {}} highlightCharKey={editingCharKey} />

      {/* 開発用オーバーレイ（折りたたみ可能。白背景・黒文字で可読性を確保。修正3） */}
      <div style={{
        position: 'absolute', top: 0, right: 0, zIndex: 100,
        width: collapsed ? 'auto' : 420, maxHeight: '100vh', overflowY: 'auto',
        ...glass({ padding: collapsed ? '8px 12px' : 16 }),
        background: PANEL_LIGHT, borderLeft: `1px solid ${BR}`, borderBottom: `1px solid ${BR}`,
        fontFamily: "'Noto Sans JP'", color: TX,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            padding: '3px 9px', borderRadius: 10, fontSize: 9, fontWeight: 700,
            background: `${PK}1a`, color: PK, border: `1px solid ${PK}44`,
            fontFamily: 'Rajdhani', letterSpacing: '.16em',
          }}>?qa=adv</span>
          {!collapsed && <div style={{ fontSize: 13, fontWeight: 900 }}>カメラ / デフォルト立ち絵エディタ</div>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={() => setCollapsed(c => !c)} style={navBtnStyle}>
              {collapsed ? '展開 ▸' : '折りたたむ ▾'}
            </button>
            {onBack && !collapsed && (
              <button onClick={onBack} style={navBtnStyle}>← 戻る</button>
            )}
          </div>
        </div>

        {!collapsed && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* カメラ設定 */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 10, fontFamily: 'Rajdhani', fontWeight: 700, letterSpacing: '.2em', color: TXD }}>CAMERA (cm)</div>
              <Slider label="VIEW_BOTTOM_CM" min={0} max={150} step={1} value={viewBottomCm} onChange={handleBottom} />
              <Slider label="VIEW_TOP_CM" min={50} max={220} step={1} value={viewTopCm} onChange={handleTop} />
              <div style={{ fontSize: 11, color: TXD }}>
                帯の高さ: <b style={{ color: TX }}>{(viewTopCm - viewBottomCm).toFixed(0)}cm</b>
                <br/>PX_PER_CM(プレビュー基準): <b style={{ color: TX }}>{pxPerCmAtPreview.toFixed(2)}</b>
              </div>
            </section>

            {/* キャラ切替 */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 10, fontFamily: 'Rajdhani', fontWeight: 700, letterSpacing: '.2em', color: TXD }}>
                CHARACTER（{charIndex >= 0 ? charIndex + 1 : '?'} / {charKeys?.length ?? '?'}）
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => gotoOffset(-1)} style={navBtnStyle}>◂ 前</button>
                <select value={editingCharKey} onChange={(e) => setEditingCharKey(e.target.value)} style={selectStyle}>
                  {(charKeys || []).map(ck => (
                    <option key={ck} value={ck}>{ck} {charNameByKey.get(ck) ? `- ${charNameByKey.get(ck)}` : ''}</option>
                  ))}
                </select>
                <button onClick={() => gotoOffset(1)} style={navBtnStyle}>次 ▸</button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['left', 'center', 'right'].map(p => (
                  <button key={p} onClick={() => setEditingPos(p)}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                      background: editingPos === p ? `${PK}22` : 'rgba(0,0,0,.04)',
                      border: `1px solid ${editingPos === p ? PK : BR}`, color: TX,
                    }}>{p}</button>
                ))}
              </div>
            </section>

            {/* カテゴリドロップダウン */}
            {portrait && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, fontFamily: 'Rajdhani', fontWeight: 700, letterSpacing: '.2em', color: TXD }}>CATEGORIES</div>
                {CATEGORY_DIRS.map(cat => {
                  const files = portrait.categories?.[cat] || [];
                  if (files.length === 0) return null;
                  const cur = currentSelection[cat] ?? '';
                  return (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 40, fontSize: 12, color: TXD }}>{cat}</div>
                      <select value={cur} onChange={(e) => updateCat(cat, e.target.value)} style={selectStyle}>
                        <option value="">（なし）</option>
                        {files.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={handleReset} style={{ ...navBtnStyle, flex: 1 }}>portrait.default に戻す</button>
                </div>
              </section>
            )}

            {/* プレビュー */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 10, fontFamily: 'Rajdhani', fontWeight: 700, letterSpacing: '.2em', color: TXD }}>PREVIEW</div>
              <div style={{
                position: 'relative', height: PREVIEW_H, overflow: 'hidden',
                background: '#20242c', borderRadius: 6, border: `1px solid ${BR}`,
              }}>
                {groundYPreview >= 0 && groundYPreview <= PREVIEW_H && (
                  <div style={{ position: 'absolute', left: 0, right: 0, top: groundYPreview, height: 1, background: AC, opacity: .7 }} />
                )}
                {portrait && previewFrame && (
                  <div style={{
                    position: 'absolute', top: previewFrame.imgTop,
                    left: `${previewAnchorPercent}%`,
                    transform: `translateX(-${previewFrame.bodyCenterXPercent}%)`,
                    width: previewFrame.imgW, height: previewFrame.imgH,
                  }}>
                    <CompositeChar portrait={portrait} charKey={editingCharKey} selection={currentSelection} />
                  </div>
                )}
              </div>
            </section>

            {/* JSON出力 */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={() => setShowJson(s => !s)} style={navBtnStyle}>
                {showJson ? 'JSON出力を閉じる' : 'JSON出力（portraitDefaults.json形式）'}
              </button>
              {showJson && (
                <textarea readOnly value={jsonOutput}
                  style={{
                    width: '100%', height: 200, fontFamily: 'monospace', fontSize: 11,
                    background: '#fff', color: TX, border: `1px solid ${BR}`, borderRadius: 6, padding: 8,
                    resize: 'vertical',
                  }}
                  onFocus={(e) => e.target.select()}
                />
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

const navBtnStyle = {
  padding: '7px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
  background: 'rgba(0,0,0,.05)', border: `1px solid ${BR}`, color: TX,
};
const selectStyle = {
  flex: 1, padding: '6px 8px', borderRadius: 6, background: '#fff', color: TX,
  border: `1px solid ${BR}`, fontSize: 12,
};
