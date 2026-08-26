import { useState, useEffect, useMemo } from 'react';
import { PK, PK2, AC, TX, TXD, BR, glass, BG_LIGHT, BG_LIGHT2 } from '../shared/tokens.js';
import { usePortraitData, resolvePortraitSelection, CompositeChar } from './ADVScene.jsx';
import {
  getViewBottomCm, setViewBottomCm, getViewTopCm, setViewTopCm,
  computeGroundedFrame, BASE_HEIGHT_CM,
} from '../shared/portraitScale.js';
import characterHeightData from '../game/data/characterHeight.json';
import charactersData from '../game/data/characters.json';

const charNameByKey = new Map(charactersData.characters.map(c => [c.id, c.name]));

// public/characters/ymm4/ 配下の charKey 一覧（vite.config.js の ymm4IndexPlugin が
// dev起動時・build開始時に自動生成する）。Moiky43体を後から追加しても再起動で増える。
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

const CARD_VIEWPORT_H = 300;

function PortraitCard({ charKey, viewBottomCm, viewTopCm }) {
  const portrait = usePortraitData(charKey);
  const heightCm = characterHeightData[charKey];
  const usedHeightCm = heightCm ?? BASE_HEIGHT_CM;

  if (!portrait) {
    return (
      <div style={{ ...glass({ borderRadius: 8, padding: 12 }), border: `1px solid ${BR}` }}>
        <div style={{ height: CARD_VIEWPORT_H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TXD, fontSize: 12 }}>
          読み込み中… {charKey}
        </div>
      </div>
    );
  }

  const selection = resolvePortraitSelection(portrait, undefined, undefined);
  const touchesBottom = portrait.body.touchesBottom;
  const frame = computeGroundedFrame(portrait, usedHeightCm, viewBottomCm, viewTopCm, CARD_VIEWPORT_H);
  const groundY = CARD_VIEWPORT_H + viewBottomCm * frame.pxPerCm; // カード上端からの地面ラインpx

  return (
    <div style={{ ...glass({ borderRadius: 8, padding: 12 }), border: `1px solid ${BR}` }}>
      <div style={{
        position: 'relative', height: CARD_VIEWPORT_H, overflow: 'hidden',
        background: '#20242c', borderRadius: 6,
        border: touchesBottom ? `2px solid ${PK}` : `1px solid ${BR}`,
      }}>
        {groundY >= 0 && groundY <= CARD_VIEWPORT_H && (
          <div style={{
            position: 'absolute', left: 0, right: 0, top: groundY, height: 1,
            background: AC, opacity: .7, zIndex: 2,
          }}/>
        )}
        <div style={{
          position: 'absolute', top: frame.imgTop, left: '50%',
          transform: `translateX(-${frame.bodyCenterXPercent}%)`,
          width: frame.imgW, height: frame.imgH,
        }}>
          <CompositeChar portrait={portrait} charKey={charKey} selection={selection} />
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: TX, lineHeight: 1.6 }}>
        <div style={{ fontWeight: 700 }}>{charKey}</div>
        <div>{charNameByKey.get(charKey) ?? '(characters.json 未登録)'}</div>
        <div style={{ color: TXD }}>
          使用身長: {usedHeightCm}cm（{heightCm != null ? '身長データあり' : `未設定・基準${BASE_HEIGHT_CM}cm代用`}）
        </div>
      </div>
    </div>
  );
}

const COLUMN_OPTIONS = [4, 8, 0]; // 0 = 全部を1行相当のオートフィット（auto-fill）

export default function QAPortraitScene({ onBack }) {
  const charKeys = useCharKeyIndex();
  const [viewBottomCm, setViewBottomCmState] = useState(getViewBottomCm());
  const [viewTopCm, setViewTopCmState] = useState(getViewTopCm());
  const [cols, setCols] = useState(4);

  const handleBottom = (v) => { setViewBottomCmState(v); setViewBottomCm(v); };
  const handleTop = (v) => { setViewTopCmState(v); setViewTopCm(v); };

  const pxPerCmAtCard = useMemo(
    () => CARD_VIEWPORT_H / (viewTopCm - viewBottomCm),
    [viewTopCm, viewBottomCm]
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, padding: '24px 28px',
      background: `linear-gradient(135deg, ${BG_LIGHT} 0%, ${BG_LIGHT2} 100%)`, color: TX,
      fontFamily: "'Noto Sans JP'",
      display: 'flex', flexDirection: 'column', gap: 14,
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 11, fontFamily: 'Rajdhani', fontWeight: 700, letterSpacing: '.24em', color: PK }}>PORTRAIT (QA)</div>
        <div style={{ fontFamily: "'Zen Maru Gothic'", fontSize: 22, fontWeight: 900 }}>立ち絵スケール検証</div>
        <span style={{
          padding: '3px 9px', borderRadius: 10, fontSize: 9, fontWeight: 700,
          background: `${PK}1a`, color: PK, border: `1px solid ${PK}44`,
          fontFamily: 'Rajdhani', letterSpacing: '.16em',
        }}>?qa=portrait</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {COLUMN_OPTIONS.map(n => (
            <button key={n} onClick={() => setCols(n)}
              style={{
                padding: '6px 14px', borderRadius: 16,
                background: cols === n ? `${PK}33` : 'rgba(255,255,255,.06)',
                border: `1px solid ${cols === n ? PK : BR}`,
                color: TX, cursor: 'pointer', fontSize: 12,
              }}>{n === 0 ? '全部' : `${n}体`}</button>
          ))}
          {onBack && (
            <button onClick={onBack}
              style={{
                padding: '6px 14px', borderRadius: 16,
                background: 'rgba(255,255,255,.06)', border: `1px solid ${BR}`,
                color: TXD, cursor: 'pointer', fontSize: 12,
              }}>← 戻る</button>
          )}
        </div>
      </div>

      {/* VIEW_BOTTOM_CM / VIEW_TOP_CM sliders */}
      <div style={{ ...glass({ borderRadius: 10, padding: '14px 18px' }), border: `1px solid ${BR}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 11, fontFamily: 'Rajdhani', fontWeight: 700, letterSpacing: '.16em', color: TXD, minWidth: 130 }}>VIEW_BOTTOM_CM</div>
          <input type="range" min={0} max={150} step={1} value={viewBottomCm}
            onChange={(e) => handleBottom(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: PK }}
          />
          <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 14, color: AC, minWidth: 50, textAlign: 'right' }}>{viewBottomCm}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 11, fontFamily: 'Rajdhani', fontWeight: 700, letterSpacing: '.16em', color: TXD, minWidth: 130 }}>VIEW_TOP_CM</div>
          <input type="range" min={50} max={220} step={1} value={viewTopCm}
            onChange={(e) => handleTop(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: PK }}
          />
          <div style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 14, color: AC, minWidth: 50, textAlign: 'right' }}>{viewTopCm}</div>
        </div>
        <div style={{ fontSize: 12, color: TXD }}>
          帯の高さ: <span style={{ color: TX, fontWeight: 700 }}>{(viewTopCm - viewBottomCm).toFixed(0)}cm</span>
          <br/>カード基準(300px)の PX_PER_CM: <span style={{ color: TX, fontWeight: 700 }}>{pxPerCmAtCard.toFixed(2)}</span>
        </div>
      </div>

      {/* Grid */}
      {charKeys == null ? (
        <div style={{ color: TXD, fontSize: 13 }}>読み込み中…</div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: TXD }}>charKey 数: {charKeys.length}</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: cols === 0 ? 'repeat(auto-fill, minmax(180px, 1fr))' : `repeat(${cols}, 1fr)`,
            gap: 14,
          }}>
            {charKeys.map(ck => <PortraitCard key={ck} charKey={ck} viewBottomCm={viewBottomCm} viewTopCm={viewTopCm} />)}
          </div>
        </>
      )}

      <div style={{ fontSize: 10, color: TXD, marginTop: 8 }}>
        赤枠 = <span style={{ color: PK2 }}>body.touchesBottom = true</span>（足切れ疑い。目視確認用）
        <br/>橙線 = 全キャラ共通の地面ライン（カードのビューポート内に地面が入っている場合のみ表示）
      </div>
    </div>
  );
}
