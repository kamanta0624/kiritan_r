import React, { useState } from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass, GAME_STATE, ROLES, CHARS } from './tokens.js';

function fmtN(n){ return n >= 1000 ? n.toLocaleString() : String(n); }

// ── Common Top Bar ─────────────────────────────────────────
export function TopBar({ scene, areaName, currentArea, breadcrumb, rightSlot }) {
  return (
    <div style={{
      ...glass({borderRadius:0, border:'none', borderBottom:`1px solid ${BR}`,
        background:'rgba(255,253,251,.97)'}),
      position:'absolute', top:0, left:0, right:0, height:52,
      display:'flex', alignItems:'center', padding:'0 16px', gap:0, zIndex:10,
    }}>
      <img src="assets/logo_tohoku.png" alt="東北家"
        style={{height:28, objectFit:'contain', marginRight:12}}/>
      <div style={{width:1, height:'55%', background:BR, marginRight:12}}/>

      {breadcrumb && (
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          {breadcrumb.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{fontSize:11, color:TXF}}>›</span>}
              <span style={{
                fontSize:11,
                color: i === breadcrumb.length - 1 ? TX : TXD,
                fontFamily:"'Noto Sans JP'",
                fontWeight: i === breadcrumb.length - 1 ? 700 : 400,
              }}>{item}</span>
            </React.Fragment>
          ))}
        </div>
      )}

      {!breadcrumb && (
        <>
          {[
            {label:'ターン', val: String(GAME_STATE.turn), c:TX},
            {label:'ミーム', val: String(GAME_STATE.meme), c:PK},
            {label:'収入',   val:`+${GAME_STATE.income}/T`, c:AC},
            {label:'拠点',   val: GAME_STATE.bases, c:TX},
          ].map((item,i) => (
            <div key={i} style={{display:'flex', alignItems:'center', gap:4,
              padding:'0 11px', borderRight:`1px solid ${BR}`, height:'100%'}}>
              <span style={{fontSize:10, color:TXD, whiteSpace:'nowrap'}}>{item.label}</span>
              <span style={{fontFamily:'Rajdhani', fontWeight:700, fontSize:15,
                color:item.c, whiteSpace:'nowrap'}}>{item.val}</span>
            </div>
          ))}
          <div style={{marginLeft:'auto', paddingLeft:12, fontFamily:'Rajdhani',
            fontSize:15, fontWeight:700, letterSpacing:1, color:TX,
            whiteSpace:'nowrap', flexShrink:0}}>
            ROUND {GAME_STATE.round}
          </div>
        </>
      )}

      {rightSlot && (
        <div style={{marginLeft: breadcrumb ? 'auto' : 16}}>
          {rightSlot}
        </div>
      )}
    </div>
  );
}

// ── Common Bottom Bar ──────────────────────────────────────
export function BottomBar({ scene, onNavigate, extraLeft, extraRight }) {
  const isMap = scene === 'map';
  const isParty = scene === 'party';

  return (
    <div style={{
      ...glass({borderRadius:0, border:'none', borderTop:`1px solid ${BR}`,
        background:'rgba(255,253,251,.97)'}),
      position:'absolute', bottom:0, left:0, right:0, height:52,
      display:'flex', alignItems:'center', padding:'0 16px', gap:10, zIndex:10,
    }}>

      {/* ── Map scene buttons ── */}
      {isMap && (
        <>
          <button style={{display:'flex', alignItems:'center', gap:6, padding:'8px 16px',
            borderRadius:20, background:'rgba(0,0,0,.05)', border:`1px solid ${BR}`,
            color:TXD, cursor:'pointer', fontSize:12, fontFamily:"'Noto Sans JP'",
            whiteSpace:'nowrap'}}>
            ≡ メニュー
          </button>
          {['建設','アイテム'].map(l => (
            <button key={l} style={{padding:'7px 14px', borderRadius:20,
              background:'rgba(0,0,0,.04)', border:`1px solid ${BR}`,
              color:TXD, cursor:'pointer', fontSize:12,
              fontFamily:"'Noto Sans JP'", whiteSpace:'nowrap'}}>
              {l}
            </button>
          ))}
          <NavButton label="仲間" onClick={() => onNavigate('party')}
            activeColor={TEAL} activeBg='rgba(26,138,150,.12)'/>
          <NavButton label="🎬 ADVテスト" onClick={() => onNavigate('adv')}
            activeColor={PK} activeBg='rgba(196,66,122,.12)'/>
          <div style={{flex:1}}/>
          <button
            onClick={() => onNavigate('turnEnd')}
            style={{
              padding:'9px 22px', borderRadius:20,
              background:`linear-gradient(135deg,${PK},${PK2})`,
              border:'none', color:'#fff', cursor:'pointer',
              fontFamily:"'Noto Sans JP'", fontSize:13, fontWeight:700,
              boxShadow:`0 2px 16px rgba(196,66,122,.4)`, whiteSpace:'nowrap',
            }}>ターン終了 →</button>
        </>
      )}

      {/* ── Party scene buttons ── */}
      {isParty && (
        <>
          <NavButton
            label="← マップに戻る"
            onClick={() => onNavigate('map')}
            activeColor={TEAL}
            activeBg='rgba(26,138,150,.1)'
          />
          <div style={{flex:1}}/>
          <div style={{fontSize:10, color:TXF, fontFamily:"'Noto Sans JP'"}}>
            編成済み：{CHARS.filter(c=>c.joined).length} 人
          </div>
        </>
      )}

      {extraLeft}
      {extraRight}
    </div>
  );
}

// ── Nav button helper ──────────────────────────────────────
export function NavButton({ label, onClick, activeColor, activeBg }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding:'7px 14px', borderRadius:20,
        background: hov ? activeBg : 'rgba(0,0,0,.04)',
        border:`1px solid ${hov ? activeColor+'44' : BR}`,
        color: hov ? activeColor : TXD,
        cursor:'pointer', fontSize:12,
        fontFamily:"'Noto Sans JP'", whiteSpace:'nowrap',
        transition:'all .15s',
      }}>
      {label}
    </button>
  );
}

Object.assign(window, { TopBar, BottomBar, NavButton, fmtN });