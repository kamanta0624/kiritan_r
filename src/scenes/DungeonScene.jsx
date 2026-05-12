import React, { useState } from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass, GAME_STATE, ROLES, CHARS } from '../shared/tokens.js';
import { TopBar } from '../shared/SharedUI.jsx';

// ═══════════════════════════════════════════════════════════
//   DungeonScene — 迷宮探索
//   遷移: → battle_action (戦闘) → adv (フロアイベント) → map (脱出)
// ═══════════════════════════════════════════════════════════

const DUNGEON_FLAVOR = [
  '静寂が漂う。微かな水音だけが響いている…',
  '苔むした石壁が続く。古い気配を感じる。',
  '遠くで何かが動いた気がする。',
  '湿った冷気が肌を撫でる。',
  '足元の砂が乾いた音を立てる。',
  '燭台の蝋がじりじりと音を立てて燃えている。',
];

export default function DungeonScene({ dungeon = { name:'みちのく洞', maxFloor:5 }, party = ['c1','c4','c3'], startFloor = 3, onNavigate }) {
  const [floor, setFloor] = useState(startFloor);
  const [flavor, setFlavor] = useState(()=>DUNGEON_FLAVOR[startFloor % DUNGEON_FLAVOR.length]);
  const [event, setEvent] = useState(null); // 'battle' | 'item' | 'rest' | null
  const [log, setLog] = useState([
    { t:'enter', text:`B${startFloor}に進入。`, floor:startFloor },
  ]);

  const partyChars = party.map(id => CHARS.find(c => c.id === id)).filter(Boolean);

  const triggerStep = (delta) => {
    const nextFloor = Math.max(1, Math.min(dungeon.maxFloor, floor + delta));
    if (nextFloor === floor) return;
    // Random event on advance
    let evt = null;
    if (delta > 0) {
      const r = Math.random();
      if (r < 0.45) evt = 'battle';
      else if (r < 0.6) evt = 'item';
      else if (r < 0.72) evt = 'event';
      else evt = null;
    }
    setFloor(nextFloor);
    setFlavor(DUNGEON_FLAVOR[Math.floor(Math.random()*DUNGEON_FLAVOR.length)]);
    setEvent(evt);
    setLog(l => [{ t:'step', text: delta>0 ? `B${nextFloor}に進んだ。${evt ? '何かが起きた…！' : ''}` : `B${nextFloor}に戻った。`, floor:nextFloor }, ...l].slice(0, 6));
  };

  const handleEvent = () => {
    if (event === 'battle') onNavigate('battle_action', { mode:'dungeon' });
    if (event === 'item')   { setLog(l => [{t:'item', text:'宝箱を見つけた！「ずんだ餅」を入手。', floor}, ...l]); setEvent(null); }
    if (event === 'event')  onNavigate('adv', { dungeon:true });
  };

  return (
    <div className="scene-enter" style={{
      width:'100vw', height:'100vh', position:'relative', overflow:'hidden',
      fontFamily:"'Noto Sans JP'", color:'rgba(255,255,255,.92)',
      background:'radial-gradient(ellipse at 50% 80%, #1a1028 0%, #0a060f 60%, #04020a 100%)',
    }}>
      {/* atmospheric grid */}
      <div style={{position:'absolute', inset:0, pointerEvents:'none', opacity:.18,
        backgroundImage:'repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0, rgba(255,255,255,.04) 1px, transparent 1px, transparent 56px), repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0, rgba(255,255,255,.04) 1px, transparent 1px, transparent 56px)',
      }}/>
      {/* flickering torch glow */}
      <div style={{position:'absolute', inset:0, background:`radial-gradient(ellipse 50% 30% at 50% 20%, ${AC}22 0%, transparent 70%)`, animation:'pulse 4s ease infinite'}}/>

      {/* TOP — dungeon ID + floor */}
      <div style={{position:'absolute', top:0, left:0, right:0, padding:'16px 24px',
        display:'flex', alignItems:'center', gap:14, zIndex:10,
        background:'linear-gradient(180deg, rgba(0,0,0,.7), transparent)'}}>
        <div style={{padding:'6px 14px', borderRadius:4,
          background:'rgba(0,0,0,.55)', border:'1px solid rgba(255,255,255,.12)',
          fontFamily:"'Zen Maru Gothic'", fontSize:14, fontWeight:900, color:'#fff', letterSpacing:'.1em'}}>
          ◤ {dungeon.name}
        </div>
        <div style={{fontFamily:'Rajdhani', fontSize:11, fontWeight:700, letterSpacing:'.32em', color:'rgba(255,255,255,.5)'}}>
          DUNGEON · EXPLORATION
        </div>
        <div style={{marginLeft:'auto', display:'flex', alignItems:'baseline', gap:8,
          padding:'8px 18px', borderRadius:6,
          background:'rgba(0,0,0,.55)', border:`1px solid ${AC}55`,
          boxShadow:`0 0 18px ${AC}33`}}>
          <span style={{fontFamily:'Rajdhani', fontSize:10, letterSpacing:'.22em', color:AC2}}>FLOOR</span>
          <span style={{fontFamily:'Rajdhani', fontWeight:900, fontSize:26, color:AC2,
            textShadow:`0 0 12px ${AC}aa`}}>B{floor}</span>
          <span style={{fontSize:11, color:'rgba(255,255,255,.4)'}}>/ B{dungeon.maxFloor}</span>
        </div>
      </div>

      {/* Center — flavor text */}
      <div style={{position:'absolute', top:'18%', left:'50%', transform:'translateX(-50%)',
        maxWidth:600, textAlign:'center', padding:'0 24px'}}>
        <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:24, fontWeight:700,
          color:'rgba(255,255,255,.78)', lineHeight:1.8, letterSpacing:'.1em',
          textShadow:'0 0 18px rgba(255,255,255,.15)', animation:'fadeIn .4s ease both'}} key={flavor}>
          ── {flavor} ──
        </div>
      </div>

      {/* Event overlay */}
      {event && (
        <div style={{position:'absolute', left:'50%', top:'40%', transform:'translateX(-50%)',
          padding:'18px 28px', borderRadius:10,
          background:`linear-gradient(135deg, ${event==='battle'?PK:event==='item'?AC2:TEAL}33, rgba(0,0,0,.6))`,
          border:`1.5px solid ${event==='battle'?PK:event==='item'?AC2:TEAL}`,
          boxShadow:`0 0 30px ${event==='battle'?PK:event==='item'?AC2:TEAL}55`,
          display:'flex', flexDirection:'column', alignItems:'center', gap:10,
          animation:'popIn .35s ease both',
        }}>
          <div style={{fontFamily:'Rajdhani', fontWeight:700, fontSize:11, letterSpacing:'.32em',
            color:event==='battle'?PK:event==='item'?AC2:TEAL}}>
            {event==='battle'?'⚔ ENCOUNTER':event==='item'?'❖ TREASURE':'❀ EVENT'}
          </div>
          <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:20, fontWeight:900, color:'#fff'}}>
            {event==='battle'?'敵が現れた！':event==='item'?'宝箱を発見！':'何かが起きそうだ…'}
          </div>
          <button onClick={handleEvent} style={{
            padding:'10px 24px', borderRadius:6, border:'none', cursor:'pointer',
            background: `linear-gradient(135deg, ${event==='battle'?PK:event==='item'?AC2:TEAL}, ${event==='battle'?PK2:event==='item'?AC:'#0d6f7a'})`,
            color:'#fff', fontFamily:"'Noto Sans JP'", fontSize:12, fontWeight:700, letterSpacing:'.12em',
          }}>{event==='battle'?'戦う':event==='item'?'開ける':'進める'} →</button>
        </div>
      )}

      {/* Party panel — left bottom */}
      <div style={{position:'absolute', left:24, bottom:90, display:'flex', flexDirection:'column', gap:6, zIndex:5}}>
        <div style={{fontFamily:'Rajdhani', fontSize:9, fontWeight:700, letterSpacing:'.22em', color:'rgba(255,255,255,.45)'}}>
          EXPLORATION PARTY
        </div>
        {partyChars.map(c => {
          const role = ROLES[c.role] || ROLES.front;
          const hp = Math.round((c.def/12)*100);
          const sp = Math.round((c.meme/c.memeMax)*100);
          return (
            <div key={c.id} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'8px 14px 8px 8px', borderRadius:8,
              background:'rgba(0,0,0,.55)', border:`1px solid ${role.color}44`,
              minWidth:240, backdropFilter:'blur(6px)',
            }}>
              <div style={{width:42, height:48, borderRadius:5, overflow:'hidden',
                border:`1.5px solid ${role.color}66`, flexShrink:0}}>
                {c.portrait
                  ? <img src={c.portrait} alt="" style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'top'}}/>
                  : <div style={{width:'100%',height:'100%',background:'rgba(255,255,255,.05)'}}/>}
              </div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{display:'flex', alignItems:'baseline', gap:6, marginBottom:4}}>
                  <span style={{fontFamily:"'Zen Maru Gothic'", fontSize:12, fontWeight:900, color:'#fff'}}>{c.name}</span>
                  <span style={{fontSize:7, padding:'1px 5px', borderRadius:4, background:role.color+'44', color:role.color, fontWeight:700}}>{role.label}</span>
                </div>
                <DungeonBar label="HP" val={hp} color={'#2a9a58'}/>
                <DungeonBar label="SP" val={sp} color={'#6a55b0'}/>
              </div>
            </div>
          );
        })}
      </div>

      {/* Log — right */}
      <div style={{position:'absolute', right:24, top:80, bottom:90, width:280,
        padding:'14px', borderRadius:8,
        background:'rgba(0,0,0,.45)', border:'1px solid rgba(255,255,255,.08)',
        backdropFilter:'blur(8px)',
        display:'flex', flexDirection:'column', gap:8, overflowY:'auto',
      }}>
        <div style={{fontFamily:'Rajdhani', fontSize:9, fontWeight:700, letterSpacing:'.22em', color:'rgba(255,255,255,.4)'}}>
          EXPLORATION LOG
        </div>
        {log.map((e,i)=>(
          <div key={i} style={{padding:'8px 10px', borderRadius:5,
            background:'rgba(255,255,255,.03)',
            borderLeft:`2px solid ${e.t==='item'?AC2:e.t==='step'?TEAL:'rgba(255,255,255,.25)'}`,
            fontSize:11, color:'rgba(255,255,255,.78)', lineHeight:1.5}}>
            <div style={{fontFamily:'Rajdhani', fontSize:8, letterSpacing:'.16em', color:'rgba(255,255,255,.4)', marginBottom:2}}>
              B{e.floor} · {e.t.toUpperCase()}
            </div>
            {e.text}
          </div>
        ))}
      </div>

      {/* Bottom — commands */}
      <div style={{position:'absolute', bottom:0, left:0, right:0, height:60,
        background:'linear-gradient(0deg, rgba(0,0,0,.75), transparent)',
        display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'0 24px',
      }}>
        <DungeonBtn label="戻る" sub="BACK" color="rgba(255,255,255,.15)"
          onClick={()=>triggerStep(-1)} disabled={floor <= 1 || event}/>
        <DungeonBtn label="進む" sub="ADVANCE" color={TEAL} primary
          onClick={()=>triggerStep(1)} disabled={floor >= dungeon.maxFloor || event}/>
        <div style={{width:1, height:32, background:'rgba(255,255,255,.15)', margin:'0 8px'}}/>
        <DungeonBtn label="脱出する" sub="ESCAPE" color={PK}
          onClick={()=>onNavigate('map')}/>
      </div>
    </div>
  );
}

function DungeonBar({ label, val, color }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:6}}>
      <span style={{fontSize:7, color:'rgba(255,255,255,.5)', fontFamily:'Rajdhani', fontWeight:700, letterSpacing:'.1em', width:14}}>{label}</span>
      <div style={{flex:1, height:3, borderRadius:2, background:'rgba(255,255,255,.08)', overflow:'hidden'}}>
        <div style={{width:`${val}%`, height:'100%', background:`linear-gradient(90deg, ${color}aa, ${color})`}}/>
      </div>
      <span style={{fontSize:8, color:'rgba(255,255,255,.55)', fontFamily:'Rajdhani', fontWeight:700, width:24, textAlign:'right'}}>{val}%</span>
    </div>
  );
}

function DungeonBtn({ label, sub, color, onClick, disabled, primary }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        padding:'11px 24px', borderRadius:6, border:'none', cursor:disabled?'not-allowed':'pointer',
        background: disabled
          ? 'rgba(255,255,255,.05)'
          : primary
            ? `linear-gradient(135deg, ${color}, ${color}aa)`
            : hov ? `${color}33` : 'rgba(255,255,255,.06)',
        border: disabled ? `1px solid rgba(255,255,255,.06)` : `1px solid ${color}66`,
        color: disabled ? 'rgba(255,255,255,.25)' : primary ? '#fff' : color,
        fontFamily:"'Noto Sans JP'", fontSize:12, fontWeight:700, letterSpacing:'.12em',
        display:'flex', alignItems:'baseline', gap:8,
        boxShadow: primary && !disabled ? `0 3px 16px ${color}55` : 'none',
        opacity: disabled ? .5 : 1,
        transition:'all .15s',
      }}>
      <span>{label}</span>
      <span style={{fontFamily:'Rajdhani', fontSize:9, letterSpacing:'.22em', opacity:.7}}>{sub}</span>
    </button>
  );
}

Object.assign(window, { DungeonScene });
