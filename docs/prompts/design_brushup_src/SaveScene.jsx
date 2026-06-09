import React, { useState } from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass, GAME_STATE, ROLES, CHARS } from '../shared/tokens.js';
import { TopBar } from '../shared/SharedUI.jsx';

// ═══════════════════════════════════════════════════════════
//   SaveScene — セーブ / ロード (Modal)
// ═══════════════════════════════════════════════════════════

const DEMO_SLOTS = [
  { id:1, used:true,  date:'2026-05-12 18:42', turn:14, bases:'11/92', meme:2400, location:'仙台', leader:'c1' },
  { id:2, used:true,  date:'2026-05-08 21:15', turn:6,  bases:'4/92',  meme:920,  location:'山形', leader:'c4' },
  { id:3, used:false, date:'', turn:0, bases:'', meme:0, location:'', leader:null },
];

export default function SaveScene({ onNavigate, onClose, mode='save', slots: slotsProp, onSave, onLoad }) {
  // mode: 'save' or 'load'
  const [activeMode, setActiveMode] = useState(mode);
  const [selected, setSelected] = useState(1);
  const slots = slotsProp?.map(s => ({
    id: s.slot,
    label: `スロット ${s.slot}`,
    turn: s.empty ? null : s.turn,
    date: s.empty ? null : (s.savedAt ? new Date(s.savedAt).toLocaleString('ja-JP', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) : null),
    empty: s.empty,
    used: !s.empty,
    meme: s.empty ? 0 : (s.meme ?? 0),
    bases: s.empty ? '' : (s.bases ?? ''),
    location: s.empty ? '' : (s.location ?? ''),
    leader: s.empty ? null : (s.leader ?? null),
  })) ?? DEMO_SLOTS;
  const [_dummy, setDummy] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const sel = slots.find(s => s.id === selected);

  const handleAction = () => {
    if(busy || !sel) return;
    setBusy(true);
    if(activeMode === 'save') {
      if (onSave) onSave(selected);
      setTimeout(() => { setBusy(false); setToast('セーブしました'); setTimeout(()=>setToast(null), 1600); }, 350);
    } else {
      // load
      if (onLoad) onLoad(selected);
      setTimeout(() => { setBusy(false); setToast('ロードしました'); setTimeout(()=>setToast(null), 1600); }, 350);
    }
  };

  return (
    <div onClick={(e)=>{ if(e.target===e.currentTarget) onClose?.(); }}
      style={{
        position:'fixed', inset:0, zIndex:100,
        background:'rgba(10,8,14,.72)', backdropFilter:'blur(10px)',
        display:'flex', alignItems:'center', justifyContent:'center',
        animation:'fadeIn .2s ease both', fontFamily:"'Noto Sans JP'",
      }}>
      <div style={{
        ...glass({borderRadius:14, border:'1.5px solid rgba(255,255,255,.85)',
          boxShadow:`0 20px 60px rgba(0,0,0,.45)`}),
        width:'min(720px, 92vw)', maxHeight:'88vh',
        display:'flex', flexDirection:'column', overflow:'hidden',
        animation:'detailIn .26s ease both',
      }}>
        {/* Header */}
        <div style={{display:'flex', alignItems:'center', padding:'18px 22px 14px', borderBottom:`1px solid ${BR}`, gap:14}}>
          <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:18, fontWeight:900, color:TX}}>
            {activeMode === 'save' ? 'セーブ' : 'ロード'}
          </div>
          <div style={{display:'flex', gap:4, padding:3, borderRadius:18, background:'rgba(0,0,0,.05)', border:`1px solid ${BR}`}}>
            {[['save','SAVE'],['load','LOAD']].map(([k, L]) => (
              <button key={k} onClick={()=>setActiveMode(k)}
                style={{
                  padding:'5px 16px', borderRadius:14, border:'none', cursor:'pointer',
                  background: activeMode===k ? `linear-gradient(135deg, ${PK}, ${PK2})` : 'transparent',
                  color: activeMode===k ? '#fff' : TXD,
                  fontFamily:'Rajdhani', fontWeight:700, fontSize:11, letterSpacing:'.22em',
                }}>{L}</button>
            ))}
          </div>
          <button onClick={onClose} style={{marginLeft:'auto',
            background:'transparent', border:'none', color:TXD, cursor:'pointer',
            fontSize:18, lineHeight:1, padding:4}}>✕</button>
        </div>

        {/* Slots */}
        <div style={{flex:1, overflowY:'auto', padding:'18px 20px', display:'flex', flexDirection:'column', gap:10}}>
          {slots.map(slot => {
            const active = selected === slot.id;
            const leader = slot.leader ? CHARS.find(c => c.id === slot.leader) : null;
            return (
              <button key={slot.id}
                onClick={()=>setSelected(slot.id)}
                disabled={activeMode==='load' && !slot.used}
                style={{
                  cursor: (activeMode==='load' && !slot.used) ? 'not-allowed' : 'pointer',
                  padding:'14px 16px', borderRadius:10, fontFamily:'inherit', textAlign:'left',
                  background: active ? 'rgba(196,66,122,.08)' : 'rgba(255,255,255,.5)',
                  border: active ? `1.5px solid ${PK}66` : `1px solid ${BR}`,
                  display:'flex', alignItems:'center', gap:14, minHeight:84,
                  opacity: (activeMode==='load' && !slot.used) ? .45 : 1,
                  transition:'all .15s',
                }}>
                {/* Slot number */}
                <div style={{flex:'0 0 56px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  borderRight:`1px dashed ${BR}`, paddingRight:14}}>
                  <div style={{fontFamily:'Rajdhani', fontWeight:700, fontSize:9, letterSpacing:'.22em',
                    color: active ? PK : TXD}}>SLOT</div>
                  <div style={{fontFamily:'Rajdhani', fontWeight:900, fontSize:30,
                    color: active ? PK : TX, lineHeight:1}}>{String(slot.id).padStart(2,'0')}</div>
                </div>

                {/* Thumbnail */}
                <div style={{flex:'0 0 56px', height:56, borderRadius:8, overflow:'hidden',
                  border:`1px solid ${BR}`,
                  background:`linear-gradient(135deg, ${TEAL}22, ${PK}22)`,
                  display:'flex', alignItems:'flex-end', justifyContent:'center'}}>
                  {leader?.portrait
                    ? <img src={leader.portrait} alt="" style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'top'}}/>
                    : slot.used
                      ? <div style={{fontSize:22, opacity:.4, padding:8}}>◐</div>
                      : <div style={{fontSize:18, opacity:.3, padding:8, color:TXD}}>─</div>}
                </div>

                {/* Info */}
                <div style={{flex:1, minWidth:0}}>
                  {slot.used ? (
                    <>
                      <div style={{display:'flex', alignItems:'baseline', gap:10, marginBottom:6}}>
                        <span style={{fontFamily:"'Zen Maru Gothic'", fontSize:15, fontWeight:900, color:TX}}>
                          ターン {slot.turn} — {slot.location}
                        </span>
                        <span style={{fontSize:9, color:TXF, fontFamily:'Rajdhani', letterSpacing:'.12em'}}>{slot.date}</span>
                      </div>
                      <div style={{display:'flex', gap:14, fontSize:10, color:TXD}}>
                        <span>拠点 <b style={{color:TEAL, fontFamily:'Rajdhani', fontSize:12}}>{slot.bases}</b></span>
                        <span>ミーム <b style={{color:PK, fontFamily:'Rajdhani', fontSize:12}}>{slot.meme.toLocaleString()}</b></span>
                      </div>
                    </>
                  ) : (
                    <div style={{color:TXF, fontSize:12, fontFamily:"'Noto Sans JP'", fontStyle:'italic'}}>
                      — データなし —
                    </div>
                  )}
                </div>

                {active && (
                  <div style={{flex:'0 0 auto', fontSize:14, color:PK, fontWeight:700}}>→</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{padding:'14px 20px', borderTop:`1px solid ${BR}`, display:'flex', gap:10, alignItems:'center'}}>
          <div style={{fontSize:10, color:TXD, flex:1}}>
            {activeMode === 'save'
              ? (sel?.used ? '⚠ このスロットは上書きされます' : '空きスロットにセーブします')
              : (sel?.used ? 'このスロットからロードします' : '空きスロットはロードできません')}
          </div>
          <button onClick={onClose} style={{
            padding:'10px 18px', borderRadius:8,
            background:'rgba(0,0,0,.04)', border:`1px solid ${BR}`,
            color:TXD, cursor:'pointer', fontFamily:"'Noto Sans JP'", fontSize:12,
          }}>キャンセル</button>
          <button onClick={handleAction}
            disabled={busy || (activeMode==='load' && !sel?.used)}
            style={{
              padding:'10px 22px', borderRadius:8, border:'none',
              cursor: (busy || (activeMode==='load' && !sel?.used)) ? 'not-allowed' : 'pointer',
              background: (activeMode==='load' && !sel?.used)
                ? 'rgba(0,0,0,.08)'
                : `linear-gradient(135deg, ${PK}, ${PK2})`,
              color: (activeMode==='load' && !sel?.used) ? TXF : '#fff',
              fontFamily:"'Noto Sans JP'", fontSize:13, fontWeight:700, letterSpacing:'.08em',
              boxShadow: (activeMode==='load' && !sel?.used) ? 'none' : `0 3px 16px ${PK}55`,
            }}>{busy ? '...' : activeMode === 'save' ? 'セーブ' : 'ロード'}</button>
        </div>

        {toast && (
          <div style={{position:'absolute', left:'50%', bottom:80, transform:'translateX(-50%)',
            padding:'10px 22px', borderRadius:22,
            background:`linear-gradient(135deg, ${TEAL}, ${TEAL}cc)`,
            color:'#fff', fontFamily:"'Noto Sans JP'", fontSize:12, fontWeight:700,
            boxShadow:`0 4px 18px ${TEAL}66`,
            animation:'popIn .2s ease both',
          }}>{toast}</div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { SaveScene });
