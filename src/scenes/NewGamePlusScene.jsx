import React, { useState } from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass, GAME_STATE, ROLES, CHARS } from '../shared/tokens.js';
import { TopBar } from '../shared/SharedUI.jsx';

// ═══════════════════════════════════════════════════════════
//   NewGamePlusScene — 周回プレイ選択
//   props: unlockedFactions [{ id, name, desc, color, leader? }]
//   遷移: → map (決定) → title (キャンセル)
// ═══════════════════════════════════════════════════════════

const DEMO_FACTIONS = [
  { id:'otaru',    name:'小樽勢',     desc:'港町・小樽を拠点とする商人連合。物資調達系のスキルが強い。初期収入 +20%。', color:TEAL,  leader:'c11', char:'函館みなみ' },
  { id:'aizu',     name:'会津勢',     desc:'城下町・会津若松の名門。守備に長ける。前衛キャラの初期防御 +3。',           color:AC2,   leader:'c15', char:'会津あおい' },
  { id:'yamagata', name:'山形勢',     desc:'雪国育ちの強兵。素早い動きが特徴。全キャラ速度 +1。',                         color:'#6a55b0', leader:'c10', char:'山形さくら' },
];

export default function NewGamePlusScene({ unlockedFactions = DEMO_FACTIONS, onNavigate }) {
  const [selected, setSelected] = useState(unlockedFactions[0]?.id || null);
  const sel = unlockedFactions.find(f => f.id === selected);
  const leaderChar = sel?.leader ? CHARS.find(c => c.id === sel.leader) : null;

  return (
    <div className="scene-enter" style={{
      width:'100vw', height:'100vh', position:'relative', overflow:'hidden',
      fontFamily:"'Noto Sans JP'", color:'#fff',
      background:'radial-gradient(ellipse at 50% 40%, #1a1428 0%, #0a0814 60%, #04030a 100%)',
    }}>
      {/* radial glow tinted by selection */}
      <div style={{position:'absolute', inset:0, transition:'background .4s ease',
        background:`radial-gradient(ellipse 60% 40% at 50% 40%, ${(sel?.color||PK)}22 0%, transparent 70%)`}}/>

      {/* eyebrow */}
      <div style={{position:'absolute', top:42, left:'50%', transform:'translateX(-50%)',
        display:'flex', alignItems:'center', gap:18, animation:'fadeIn .4s both'}}>
        <div style={{width:42, height:1, background:AC2}}/>
        <span style={{fontFamily:'Rajdhani', fontSize:11, fontWeight:700, letterSpacing:'.5em', color:AC2}}>
          NEW GAME +
        </span>
        <div style={{width:42, height:1, background:AC2}}/>
      </div>

      {/* Title */}
      <div style={{position:'absolute', top:84, left:0, right:0, textAlign:'center', animation:'fadeUp .5s .1s both'}}>
        <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:'min(6vw, 64px)', fontWeight:900,
          color:'#fff', letterSpacing:'.12em',
          textShadow:`0 0 30px ${AC2}55, 0 4px 12px rgba(0,0,0,.7)`}}>
          周回プレイ
        </div>
        <div style={{marginTop:8, fontSize:13, color:'rgba(255,255,255,.55)', letterSpacing:'.12em'}}>
          解放した勢力から、一つを仲間に加えて始められます
        </div>
      </div>

      {/* Faction grid */}
      <div style={{position:'absolute', top:'30%', left:0, right:0, padding:'0 60px',
        display:'flex', justifyContent:'center', gap:18,
        animation:'fadeUp .5s .25s both'}}>
        {unlockedFactions.map(f => {
          const active = selected === f.id;
          return (
            <button key={f.id} onClick={()=>setSelected(f.id)}
              style={{
                cursor:'pointer', border:'none', fontFamily:'inherit',
                width:240, padding:'24px 20px 20px',
                borderRadius:14, textAlign:'center',
                background: active
                  ? `linear-gradient(180deg, ${f.color}33, rgba(0,0,0,.55))`
                  : 'rgba(0,0,0,.4)',
                borderTop: `3px solid ${active ? f.color : 'rgba(255,255,255,.1)'}`,
                borderLeft:`1px solid ${active ? f.color+'66' : 'rgba(255,255,255,.06)'}`,
                borderRight:`1px solid ${active ? f.color+'66' : 'rgba(255,255,255,.06)'}`,
                borderBottom:`1px solid ${active ? f.color+'66' : 'rgba(255,255,255,.06)'}`,
                boxShadow: active ? `0 8px 30px ${f.color}44, 0 0 0 1px ${f.color}55` : 'none',
                color:'#fff', transition:'all .2s',
                transform: active ? 'translateY(-6px)' : 'translateY(0)',
                display:'flex', flexDirection:'column', alignItems:'center', gap:10,
              }}>
              <div style={{fontFamily:'Rajdhani', fontWeight:700, fontSize:10, letterSpacing:'.32em',
                color: active ? f.color : 'rgba(255,255,255,.4)'}}>
                {f.id.toUpperCase()}
              </div>
              <div style={{
                width:84, height:84, borderRadius:'50%',
                background:`radial-gradient(circle, ${f.color}33 0%, transparent 70%)`,
                border:`2px solid ${active ? f.color : 'rgba(255,255,255,.18)'}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                overflow:'hidden',
              }}>
                <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:30, fontWeight:900,
                  color: active ? f.color : 'rgba(255,255,255,.6)',
                  textShadow:`0 0 12px ${f.color}88`}}>
                  {f.name.charAt(0)}
                </div>
              </div>
              <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:20, fontWeight:900, color:'#fff', letterSpacing:'.08em'}}>
                {f.name}
              </div>
              <div style={{fontSize:11, color:'rgba(255,255,255,.5)', fontFamily:"'Noto Sans JP'"}}>
                を仲間にする
              </div>
            </button>
          );
        })}
      </div>

      {/* Selection detail */}
      {sel && (
        <div key={sel.id} style={{position:'absolute', left:'50%', transform:'translateX(-50%)',
          bottom:130, width:'min(720px, 90vw)',
          padding:'20px 28px', borderRadius:10,
          background:'rgba(0,0,0,.55)', border:`1px solid ${sel.color}44`,
          backdropFilter:'blur(8px)',
          animation:'fadeUp .3s ease both',
        }}>
          <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:10}}>
            <div style={{fontFamily:'Rajdhani', fontSize:10, fontWeight:700, letterSpacing:'.22em', color:sel.color}}>SELECTED FACTION</div>
            <div style={{flex:1, height:1, background:`linear-gradient(90deg, ${sel.color}66, transparent)`}}/>
            {leaderChar && (
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span style={{fontSize:10, color:'rgba(255,255,255,.5)'}}>代表</span>
                <span style={{fontFamily:"'Zen Maru Gothic'", fontSize:13, fontWeight:900, color:'#fff'}}>{sel.char}</span>
              </div>
            )}
          </div>
          <div style={{fontSize:13, color:'rgba(255,255,255,.85)', lineHeight:1.8, letterSpacing:'.04em'}}>
            {sel.desc}
          </div>
        </div>
      )}

      {/* Footer buttons */}
      <div style={{position:'absolute', bottom:40, left:0, right:0, display:'flex',
        justifyContent:'center', gap:14, animation:'fadeUp .4s .4s both'}}>
        <button onClick={()=>onNavigate('title')} style={{
          padding:'13px 30px', borderRadius:8,
          background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.18)',
          color:'rgba(255,255,255,.85)', cursor:'pointer',
          fontFamily:"'Noto Sans JP'", fontSize:12, fontWeight:700, letterSpacing:'.16em',
        }}>キャンセル</button>
        <button onClick={()=>sel && onNavigate('map', { ngpFactionId: sel.id })}
          disabled={!sel}
          style={{
            padding:'13px 42px', borderRadius:8, border:'none',
            cursor: sel ? 'pointer' : 'not-allowed',
            background: sel ? `linear-gradient(135deg, ${sel.color}, ${sel.color}aa)` : 'rgba(255,255,255,.08)',
            color: '#fff',
            fontFamily:"'Noto Sans JP'", fontSize:13, fontWeight:700, letterSpacing:'.18em',
            boxShadow: sel ? `0 4px 20px ${sel.color}66` : 'none',
          }}>決定 →</button>
      </div>
    </div>
  );
}

Object.assign(window, { NewGamePlusScene });
