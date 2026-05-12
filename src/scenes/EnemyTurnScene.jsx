import React, { useState, useEffect, useRef } from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass, GAME_STATE, ROLES, CHARS } from '../shared/tokens.js';
import { TopBar } from '../shared/SharedUI.jsx';

// 敵派閥定義
const ENEMY_FACTIONS = [
  {
    id:'metro',
    name:'大都会連合',
    motto:'圧倒的物量で蹂躙する',
    portrait:'assets/portrait_meron.png',
    leader:'北海道めろん',
    color:'#d4a044',
    accent:'#8a6010',
    territory:['n8'],
  },
  {
    id:'hokkaido',
    name:'北海道勢',
    motto:'雪原から全土へ',
    portrait:'assets/portrait_bern_fog.png',
    leader:'ベルン & フォーグ',
    color:'#3d8fb0',
    accent:'#1a4a66',
    territory:['n9','n10','n12','n13'],
  },
  {
    id:'south',
    name:'南東北同盟',
    motto:'南方からの侵攻',
    portrait:'assets/portrait_awamo.png',
    leader:'沖縄あわも',
    color:'#b6452f',
    accent:'#6e1f1a',
    territory:['n2','n3','n5','n6'],
  },
];

// Single faction cutin
function FactionCutin({ faction, index, total, phase, onSkip }) {
  // phase: 'in' (entering, ~600ms) | 'hold' (~1500ms) | 'out' (~500ms)
  return (
    <div
      onClick={onSkip}
      style={{
        position:'absolute', inset:0, zIndex:10000,
        background: `linear-gradient(135deg, ${faction.accent} 0%, #0a0610 50%, ${faction.accent} 100%)`,
        display:'flex', alignItems:'stretch', overflow:'hidden',
        cursor:'pointer',
        animation: phase==='out' ? 'cutinOut .5s cubic-bezier(.4,0,.2,1) forwards' : 'cutinIn .5s cubic-bezier(.16,1,.3,1) both',
      }}>

      {/* diagonal accent stripes */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        backgroundImage: `repeating-linear-gradient(135deg, transparent 0, transparent 80px, ${faction.color}15 80px, ${faction.color}15 90px)`,
      }}/>

      {/* speed lines from edges */}
      {[...Array(8)].map((_,i) => (
        <div key={i} style={{
          position:'absolute',
          top: `${i*12}%`, left: 0, right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${faction.color}55, transparent)`,
          transform: `skewY(${-2 + (i%3)}deg)`,
          animation: `streak 1.2s ${i*.05}s ease-out both`,
        }}/>
      ))}

      {/* === LEFT: portrait area === */}
      <div style={{
        flex:1, position:'relative', overflow:'hidden',
        animation:'portraitSlideIn .6s cubic-bezier(.16,1,.3,1) both',
      }}>
        {/* large portrait */}
        <img src={faction.portrait} alt={faction.leader}
          style={{
            position:'absolute', top:'50%', left:'50%',
            transform:'translate(-50%, -50%)',
            height:'130%', width:'auto',
            objectFit:'cover', objectPosition:'top center',
            filter:`drop-shadow(0 20px 40px rgba(0,0,0,.6))`,
          }}/>

        {/* dark gradient overlay on portrait edge */}
        <div style={{
          position:'absolute', inset:0,
          background: `linear-gradient(90deg, rgba(0,0,0,.5) 0%, transparent 30%, transparent 70%, ${faction.accent}cc 100%)`,
        }}/>

        {/* leader name strip */}
        <div style={{
          position:'absolute', bottom:'8%', left:'8%',
          fontFamily:"'Zen Maru Gothic'", fontSize:18, fontWeight:900,
          color: faction.color,
          textShadow:`0 2px 12px rgba(0,0,0,.95), 0 0 24px ${faction.color}`,
          padding:'6px 16px',
          background:'rgba(0,0,0,.55)',
          borderLeft:`4px solid ${faction.color}`,
          animation:'fadeUp .5s .35s both',
        }}>
          {faction.leader}
        </div>
      </div>

      {/* === RIGHT: text/banner area === */}
      <div style={{
        flex:'0 0 52%', position:'relative',
        background: `linear-gradient(110deg, transparent 0%, rgba(0,0,0,.85) 18%, rgba(0,0,0,.92) 100%)`,
        display:'flex', flexDirection:'column', justifyContent:'center',
        padding:'0 6vw 0 4vw',
        gap:18,
      }}>
        {/* phase tag */}
        <div style={{
          display:'flex', alignItems:'center', gap:10,
          animation:'fadeRight .4s .15s both',
        }}>
          <div style={{width:48, height:2, background: faction.color}}/>
          <div style={{
            fontFamily:'Rajdhani', fontSize:14, fontWeight:700, letterSpacing:'.32em',
            color: faction.color,
            textShadow:`0 0 12px ${faction.color}`,
          }}>ENEMY PHASE — {String(index+1).padStart(2,'0')}/{String(total).padStart(2,'0')}</div>
        </div>

        {/* main title */}
        <div style={{
          fontFamily:"'Zen Maru Gothic'", fontWeight:900,
          fontSize:'min(7vw, 110px)', lineHeight:.95,
          color:'#fff', letterSpacing:'.04em',
          textShadow: `0 4px 28px rgba(0,0,0,.9), 0 0 40px ${faction.color}80`,
          animation:'fadeRight .55s .25s both',
        }}>
          {faction.name}
        </div>

        {/* subtitle */}
        <div style={{
          fontFamily:"'Noto Sans JP'", fontWeight:700,
          fontSize:'min(2.8vw, 40px)', lineHeight:1.2,
          color: faction.color,
          textShadow:`0 2px 12px rgba(0,0,0,.8)`,
          animation:'fadeRight .5s .4s both',
        }}>
          「{faction.motto}」
        </div>

        {/* action banner */}
        <div style={{
          marginTop:8,
          display:'inline-flex', alignSelf:'flex-start', alignItems:'center', gap:14,
          padding:'12px 28px',
          background:`linear-gradient(90deg, ${faction.color}, ${faction.accent})`,
          borderLeft:`5px solid #fff`,
          fontFamily:"'Zen Maru Gothic'", fontSize:'min(3.5vw, 50px)', fontWeight:900,
          color:'#fff', letterSpacing:'.16em',
          boxShadow:`0 6px 30px rgba(0,0,0,.5), 0 0 40px ${faction.color}66`,
          animation:'bannerSlide .55s .55s cubic-bezier(.16,1,.3,1) both',
        }}>
          <span style={{fontSize:'.7em', opacity:.9}}>▶</span>
          <span>行動開始</span>
        </div>

        {/* territory count */}
        <div style={{
          marginTop:6, display:'flex', gap:14, alignItems:'center',
          fontFamily:'Rajdhani', fontSize:13, fontWeight:600,
          color:'rgba(255,255,255,.5)', letterSpacing:'.16em',
          animation:'fadeRight .4s .75s both',
        }}>
          <span>支配領 <b style={{color: faction.color, fontSize:18}}>{faction.territory.length}</b></span>
          <span style={{opacity:.4}}>·</span>
          <span style={{opacity:.6}}>クリックでスキップ</span>
        </div>
      </div>

      {/* faction emblem at top-right */}
      <div style={{
        position:'absolute', top:24, right:32,
        fontFamily:'Rajdhani', fontWeight:900, fontSize:11, letterSpacing:'.4em',
        color:'rgba(255,255,255,.3)',
        animation:'fadeIn .4s .2s both',
      }}>
        FACTION · {faction.id.toUpperCase()}
      </div>
    </div>
  );
}

// Phase progress bar (top of screen during enemy turn)
function EnemyTurnProgress({ index, total, faction }) {
  return (
    <div style={{
      position:'absolute', top:0, left:0, right:0, zIndex:9998,
      padding:'10px 24px',
      background:'linear-gradient(180deg, rgba(0,0,0,.85), rgba(0,0,0,.0))',
      pointerEvents:'none',
    }}>
      <div style={{
        display:'flex', alignItems:'center', gap:12,
        animation:'fadeIn .3s ease both',
      }}>
        <div style={{
          fontFamily:'Rajdhani', fontWeight:700, fontSize:11, letterSpacing:'.28em',
          color:'rgba(255,255,255,.55)',
        }}>ENEMY TURN</div>
        <div style={{flex:1, display:'flex', gap:6}}>
          {Array.from({length:total}).map((_,i) => (
            <div key={i} style={{
              flex:1, height:3, borderRadius:2,
              background: i<index ? faction.color
                : i===index ? `linear-gradient(90deg, ${faction.color}, ${faction.color}66)`
                : 'rgba(255,255,255,.12)',
              boxShadow: i===index ? `0 0 8px ${faction.color}` : 'none',
              transition:'all .3s',
            }}/>
          ))}
        </div>
        <div style={{
          fontFamily:'Rajdhani', fontWeight:700, fontSize:13,
          color: faction.color,
        }}>{index+1}/{total}</div>
      </div>
    </div>
  );
}

// Orchestrator — runs each faction cutin in sequence
export default function EnemyTurnSequence({ onComplete }) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('in'); // in | hold | out
  const timers = useRef([]);
  const T = (fn, ms) => { const t=setTimeout(fn,ms); timers.current.push(t); };
  const clearT = () => { timers.current.forEach(clearTimeout); timers.current=[]; };

  useEffect(() => {
    clearT();
    setPhase('in');
    // hold
    T(() => setPhase('hold'), 600);
    // out
    T(() => setPhase('out'), 600 + 1700);
    // advance
    T(() => {
      if (idx < ENEMY_FACTIONS.length - 1) {
        setIdx(i => i + 1);
      } else {
        onComplete();
      }
    }, 600 + 1700 + 500);
    return clearT;
  }, [idx]);

  const handleSkip = () => {
    clearT();
    setPhase('out');
    setTimeout(() => {
      if (idx < ENEMY_FACTIONS.length - 1) setIdx(i => i + 1);
      else onComplete();
    }, 350);
  };

  const faction = ENEMY_FACTIONS[idx];
  return (
    <>
      <EnemyTurnProgress index={idx} total={ENEMY_FACTIONS.length} faction={faction}/>
      <FactionCutin
        key={idx}
        faction={faction}
        index={idx}
        total={ENEMY_FACTIONS.length}
        phase={phase}
        onSkip={handleSkip}
      />
    </>
  );
}

// Final "your turn" cutin
function PlayerTurnCutin({ onComplete }) {
  const [phase, setPhase] = useState('in');
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 500);
    const t2 = setTimeout(() => setPhase('out'), 500 + 1300);
    const t3 = setTimeout(() => onComplete(), 500 + 1300 + 450);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div onClick={onComplete} style={{
      position:'absolute', inset:0, zIndex:10000,
      background:'linear-gradient(135deg, #1a4a66 0%, #0a1828 50%, #1a8a96 100%)',
      display:'flex', alignItems:'center', justifyContent:'center',
      cursor:'pointer',
      animation: phase==='out' ? 'cutinOut .45s cubic-bezier(.4,0,.2,1) forwards' : 'cutinIn .45s cubic-bezier(.16,1,.3,1) both',
      overflow:'hidden',
    }}>
      {/* light sweeps */}
      {[...Array(6)].map((_,i) => (
        <div key={i} style={{
          position:'absolute',
          top:`${i*18}%`, left:'-30%', right:'-30%', height:1,
          background:'linear-gradient(90deg, transparent, rgba(26,138,150,.5), transparent)',
          transform:`rotate(${-3 + i*1}deg)`,
          animation:`streak 1.2s ${i*.07}s ease-out both`,
        }}/>
      ))}

      <div style={{textAlign:'center', position:'relative', zIndex:1}}>
        <div style={{
          fontFamily:'Rajdhani', fontWeight:700, fontSize:14, letterSpacing:'.5em',
          color:'rgba(120,220,235,.85)',
          textShadow:'0 0 20px rgba(26,138,150,.8)',
          marginBottom:14,
          animation:'fadeUp .4s both',
        }}>YOUR TURN</div>
        <div style={{
          fontFamily:"'Zen Maru Gothic'", fontWeight:900,
          fontSize:'min(11vw, 160px)', lineHeight:1,
          color:'#fff',
          textShadow:'0 0 60px rgba(120,220,235,.7), 0 0 24px rgba(255,255,255,.4)',
          letterSpacing:'.1em',
          animation:'titleZoom .55s cubic-bezier(.16,1,.3,1) both',
        }}>東北家</div>
        <div style={{
          marginTop:10,
          fontFamily:"'Zen Maru Gothic'", fontWeight:700,
          fontSize:'min(4vw, 56px)', lineHeight:1,
          color:'#7fdce5',
          letterSpacing:'.3em',
          textShadow:'0 0 20px rgba(120,220,235,.7)',
          animation:'fadeUp .4s .25s both',
        }}>行動開始</div>
        <div style={{
          marginTop:24, fontSize:11, letterSpacing:'.3em',
          color:'rgba(255,255,255,.4)', fontFamily:'Rajdhani',
          animation:'fadeIn .3s .5s both',
        }}>クリックでスキップ</div>
      </div>
    </div>
  );
}

// Inject keyframes for cutin
(function(){
  const id = '__cutin_kf';
  if(document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = `
    @keyframes cutinIn { from{opacity:0;transform:scale(1.04)} to{opacity:1;transform:scale(1)} }
    @keyframes cutinOut { from{opacity:1} to{opacity:0;transform:scale(.98)} }
    @keyframes portraitSlideIn { from{transform:translateX(-80px) scale(1.02);opacity:0} to{transform:translateX(0) scale(1);opacity:1} }
    @keyframes fadeRight { from{opacity:0;transform:translateX(40px)} to{opacity:1;transform:translateX(0)} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    @keyframes bannerSlide { from{opacity:0;transform:translateX(-30px) skewX(-8deg)} to{opacity:1;transform:translateX(0) skewX(0)} }
    @keyframes streak { 0%{transform:translateX(-30%) skewY(0deg);opacity:0} 30%{opacity:1} 100%{transform:translateX(30%);opacity:0} }
    @keyframes titleZoom { 0%{transform:scale(1.6);opacity:0;letter-spacing:.5em} 60%{transform:scale(.96)} 100%{transform:scale(1);opacity:1;letter-spacing:.1em} }
  `;
  document.head.appendChild(s);
})();

Object.assign(window, { EnemyTurnSequence, PlayerTurnCutin });