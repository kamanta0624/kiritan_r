import React from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass, GAME_STATE, ROLES, CHARS } from '../shared/tokens.js';
import { TopBar } from '../shared/SharedUI.jsx';

// ═══════════════════════════════════════════════════════════
//   GameEndScene — ゲームエンド (勝利 / 敗北)
// ═══════════════════════════════════════════════════════════

export default function GameEndScene({ isVictory = true, clearedCount = 3, onNavigate, hasNewGamePlus = true }) {
  const tone = isVictory
    ? { c1:'#d4a044', c2:AC, label:'VICTORY', jp:'制圧完了', emb:'CONQUEST · COMPLETE',
        text1:'全ての旗印を、東北の名のもとに集めた。',
        text2:'長き戦いの果てに、ミームは束となり、旗は天下に翻った。\n仲間たちの労を、語り継ぐべし。', bg1:'#1f1408', bg2:'#3a2410' }
    : { c1:PK, c2:PK2, label:'DEFEAT', jp:'拠点陥落', emb:'CITADEL · FALLEN',
        text1:'本拠地は陥落し、旗は静かに伏した。',
        text2:'天下は遠かった。\nだが、語り継がれる物語は、ここに残された。', bg1:'#1c0810', bg2:'#2a0a18' };

  return (
    <div className="scene-enter" style={{
      width:'100vw', height:'100vh', position:'relative', overflow:'hidden',
      fontFamily:"'Noto Sans JP'", color:'#fff',
      background:`radial-gradient(ellipse at 50% 30%, ${tone.bg2} 0%, ${tone.bg1} 60%, #050208 100%)`,
    }}>
      {/* radial light */}
      <div style={{position:'absolute', inset:0, background:`radial-gradient(ellipse 60% 40% at 50% 35%, ${tone.c1}22 0%, transparent 70%)`}}/>
      {/* diagonal rays */}
      {isVictory && [...Array(8)].map((_,i)=>(
        <div key={i} style={{
          position:'absolute', top:'50%', left:'50%',
          width:2, height:'180vh', transformOrigin:'top center',
          transform:`translate(-50%, -50%) rotate(${i*45 + 22}deg)`,
          background:`linear-gradient(180deg, ${tone.c1}55, transparent 60%)`,
          animation:`fadeIn 1.2s ${i*.08}s ease both`,
          pointerEvents:'none',
        }}/>
      ))}

      <div style={{position:'absolute', inset:0, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', gap:20, padding:40, textAlign:'center'}}>

        {/* eyebrow */}
        <div style={{display:'flex', alignItems:'center', gap:14,
          animation:'fadeIn .5s .1s both'}}>
          <div style={{width:36, height:1, background:tone.c1}}/>
          <span style={{fontFamily:'Rajdhani', fontSize:11, fontWeight:700, letterSpacing:'.5em',
            color:tone.c1, textShadow:`0 0 14px ${tone.c1}aa`}}>
            {tone.emb}
          </span>
          <div style={{width:36, height:1, background:tone.c1}}/>
        </div>

        {/* big label */}
        <div style={{
          fontFamily:'Rajdhani', fontWeight:900, fontSize:'min(7vw, 90px)',
          letterSpacing:'.32em', color:tone.c1,
          textShadow:`0 0 40px ${tone.c1}88, 0 2px 8px rgba(0,0,0,.6)`,
          animation:'titleZoom .8s .2s cubic-bezier(.16,1,.3,1) both',
        }}>{tone.label}</div>

        {/* JP */}
        <div style={{
          fontFamily:"'Zen Maru Gothic'", fontWeight:900,
          fontSize:'min(8vw, 110px)', lineHeight:1, color:'#fff',
          letterSpacing:'.12em',
          textShadow:`0 0 30px ${tone.c1}55, 0 4px 12px rgba(0,0,0,.7)`,
          animation:'fadeUp .6s .4s both',
        }}>{tone.jp}</div>

        {/* text */}
        <div style={{marginTop:18, maxWidth:680, fontSize:14, lineHeight:2,
          color:'rgba(255,255,255,.72)', letterSpacing:'.12em',
          animation:'fadeUp .5s .65s both'}}>
          {tone.text1}
          <div style={{height:14}}/>
          {tone.text2.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>

        {/* Stats */}
        <div style={{marginTop:24, display:'flex', gap:14,
          animation:'fadeUp .5s .8s both'}}>
          <EndStat label="到達ターン" value={GAME_STATE.turn} unit="T" color={tone.c1}/>
          <EndStat label="制圧拠点" value={GAME_STATE.bases.split('/')[0]} unit={`/${GAME_STATE.bases.split('/')[1]}`} color={TEAL}/>
          {isVictory && <EndStat label="キャラクリ" value={clearedCount} unit="人" color={tone.c1}/>}
        </div>

        {/* buttons */}
        <div style={{marginTop:30, display:'flex', gap:12,
          animation:'fadeUp .5s 1s both'}}>
          <button onClick={()=>onNavigate('title')} style={{
            padding:'14px 28px', borderRadius:8,
            background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.18)',
            color:'#fff', cursor:'pointer',
            fontFamily:"'Noto Sans JP'", fontSize:13, fontWeight:700, letterSpacing:'.16em',
          }}>タイトルへ</button>
          {isVictory && hasNewGamePlus && (
            <button onClick={()=>onNavigate('new_game_plus')} style={{
              padding:'14px 28px', borderRadius:8,
              background:`linear-gradient(135deg, ${tone.c1}, ${tone.c2})`,
              border:'none', color:'#fff', cursor:'pointer',
              fontFamily:"'Noto Sans JP'", fontSize:13, fontWeight:700, letterSpacing:'.16em',
              boxShadow:`0 4px 24px ${tone.c1}66`,
            }}>周回プレイ →</button>
          )}
        </div>
      </div>
    </div>
  );
}

function EndStat({ label, value, unit, color }) {
  return (
    <div style={{
      padding:'12px 22px', borderRadius:8,
      background:'rgba(0,0,0,.35)', border:`1px solid ${color}55`,
      backdropFilter:'blur(6px)',
      display:'flex', flexDirection:'column', alignItems:'center', gap:4,
    }}>
      <div style={{fontFamily:'Rajdhani', fontWeight:700, fontSize:9, letterSpacing:'.22em',
        color:'rgba(255,255,255,.5)'}}>{label}</div>
      <div style={{display:'flex', alignItems:'baseline', gap:3}}>
        <span style={{fontFamily:'Rajdhani', fontWeight:900, fontSize:30, color}}>{value}</span>
        <span style={{fontSize:10, color:'rgba(255,255,255,.5)'}}>{unit}</span>
      </div>
    </div>
  );
}

Object.assign(window, { GameEndScene });
