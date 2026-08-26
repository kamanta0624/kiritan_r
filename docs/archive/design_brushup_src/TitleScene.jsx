import React, { useState } from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass, GAME_STATE, ROLES, CHARS } from '../shared/tokens.js';
import { TopBar } from '../shared/SharedUI.jsx';

// ═══════════════════════════════════════════════════════════
//   TitleScene — タイトル画面
//   遷移: → map (はじめから / 続きから)
//         → gallery / settings / credits / new_game_plus
// ═══════════════════════════════════════════════════════════

export default function TitleScene({ onNavigate, hasSaveData = true, hasNewGamePlus = false }) {
  const [hover, setHover] = useState(null);

  const menuItems = [
    { id:'newgame', label:'はじめから', sub:'NEW GAME', dest:'map', primary:true },
    ...(hasSaveData ? [{ id:'continue', label:'続きから', sub:'CONTINUE', dest:'save' }] : []),
    ...(hasNewGamePlus ? [{ id:'ngp', label:'周回プレイ', sub:'NEW GAME +', dest:'new_game_plus', accent:true }] : []),
    { id:'gallery',  label:'ギャラリー', sub:'GALLERY',  dest:'gallery' },
    { id:'settings', label:'設定',       sub:'SETTINGS', dest:'settings' },
    { id:'credits',  label:'クレジット', sub:'CREDITS',  dest:'credits' },
  ];

  return (
    <div className="scene-enter" style={{
      width:'100vw', height:'100vh', position:'relative', overflow:'hidden',
      fontFamily:"'Noto Sans JP'", color:'#fff',
      background:'radial-gradient(ellipse at 30% 40%, #2a1830 0%, #14091e 50%, #08050f 100%)',
    }}>
      {/* BG portrait — soft right side */}
      <div style={{
        position:'absolute', right:'-4%', top:0, bottom:0, width:'58%',
        backgroundImage:`url(assets/portrait_kiritan.png)`,
        backgroundSize:'contain', backgroundPosition:'bottom right', backgroundRepeat:'no-repeat',
        opacity:.55, filter:'drop-shadow(0 12px 40px rgba(0,0,0,.7))',
        animation:'fadeIn .9s ease both',
      }}/>

      {/* tinted overlay */}
      <div style={{position:'absolute', inset:0,
        background:`linear-gradient(105deg, rgba(8,5,15,.9) 0%, rgba(8,5,15,.55) 45%, rgba(8,5,15,.1) 70%, rgba(196,66,122,.2) 100%)`,
      }}/>

      {/* diagonal accent stripes */}
      <div style={{position:'absolute', inset:0, pointerEvents:'none', opacity:.5,
        backgroundImage:`repeating-linear-gradient(115deg, transparent 0, transparent 90px, rgba(196,66,122,.06) 90px, rgba(196,66,122,.06) 92px)`,
      }}/>

      {/* Title block */}
      <div style={{position:'absolute', left:'8%', top:'18%', maxWidth:'62%',
        animation:'fadeUp .7s .15s both'}}>
        <div style={{
          fontFamily:"'Zen Maru Gothic'", fontWeight:900,
          fontSize:'min(9vw, 120px)', lineHeight:.98, letterSpacing:'.04em',
          color:'#fff',
          textShadow:`0 4px 40px rgba(196,66,122,.45), 0 2px 8px rgba(0,0,0,.7)`,
        }}>戦国きりたん（仮）</div>
      </div>

      {/* Menu */}
      <div style={{position:'absolute', right:'7%', bottom:'9%',
        display:'flex', flexDirection:'column', gap:6, zIndex:5,
        animation:'fadeUp .6s .35s both'}}>
        {menuItems.map((item, i) => {
          const isHover = hover === item.id;
          const c = item.primary ? PK : item.accent ? AC2 : 'rgba(255,255,255,.85)';
          return (
            <button key={item.id}
              onMouseEnter={()=>setHover(item.id)}
              onMouseLeave={()=>setHover(null)}
              onClick={()=>onNavigate(item.dest)}
              style={{
                position:'relative', cursor:'pointer', border:'none',
                padding:'14px 28px 14px 26px', minWidth:340,
                background: isHover ? `linear-gradient(90deg, ${c}33, transparent 90%)` : 'transparent',
                color:'#fff', textAlign:'left',
                display:'flex', alignItems:'baseline', gap:18,
                transform: isHover ? 'translateX(-8px)' : 'translateX(0)',
                transition:'all .2s cubic-bezier(.16,1,.3,1)',
                borderRight: `3px solid ${isHover ? c : 'transparent'}`,
                fontFamily:'inherit',
              }}>
              <span style={{
                fontFamily:"'Zen Maru Gothic'", fontSize: item.primary ? 26 : 20, fontWeight:900,
                color: isHover ? c : '#fff', letterSpacing:'.08em',
                textShadow: isHover ? `0 0 14px ${c}66` : '0 2px 6px rgba(0,0,0,.6)',
                transition:'color .15s',
              }}>{item.label}</span>
              <span style={{marginLeft:'auto', fontFamily:'Rajdhani', fontWeight:700,
                fontSize:11, letterSpacing:'.32em',
                color: isHover ? c : 'rgba(255,255,255,.35)',
                transition:'color .15s',
              }}>{item.sub}</span>
            </button>
          );
        })}
      </div>

      {/* version */}
      <div style={{position:'absolute', left:64, bottom:32,
        fontFamily:'Rajdhani', fontSize:10, letterSpacing:'.32em',
        color:'rgba(255,255,255,.3)'}}>
        VER 0.1.0 — PROTOTYPE
      </div>
    </div>
  );
}

Object.assign(window, { TitleScene });
