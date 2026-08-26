import React, { useState } from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass, GAME_STATE, ROLES, CHARS } from '../shared/tokens.js';
import { TopBar } from '../shared/SharedUI.jsx';

// ═══════════════════════════════════════════════════════════
//   BaseMenuScene — 拠点メニュー (Modal)
//   props: node {name, owner, troops, income, type, imageUrl?}
//          isOwned (=自勢力), canAttack, hasDungeon
//   遷移: → formation (攻撃) → adv (訪問) → dungeon (迷宮) → map (閉じる)
// ═══════════════════════════════════════════════════════════

export default function BaseMenuScene({ node, isOwned, canAttack, hasDungeon, onNavigate, onClose }) {
  if(!node) return null;
  const typeLabel = ({city:'都市', town:'街', village:'村', fort:'砦'})[node.type] || node.type;
  const ownerKey = node.owner || (isOwned ? 'player' : 'enemy');
  const ownerColor = ownerKey === 'player' ? TEAL : ownerKey === 'ally' ? '#2a9a58' : ownerKey === 'neutral' ? '#8a8e96' : PK;
  const ownerLabel = ownerKey === 'player' ? '東北家' : ownerKey === 'ally' ? '友軍' : ownerKey === 'neutral' ? '中立' : node.factionName || '敵勢力';

  // Build commands
  const cmds = [];
  if(isOwned) {
    if(canAttack) cmds.push({ id:'attack', label:'攻撃', sub:'ATTACK', dest:'formation', color:PK, icon:'⚔' });
    cmds.push({ id:'visit', label:'訪問', sub:'VISIT', dest:'adv', color:TEAL, icon:'❀' });
    if(hasDungeon) cmds.push({ id:'dungeon', label:'迷宮', sub:'DUNGEON', dest:'dungeon', color:AC2, icon:'⌬' });
  } else {
    if(canAttack) cmds.push({ id:'attack', label:'攻撃', sub:'ATTACK', dest:'formation', color:PK, icon:'⚔' });
  }

  return (
    <div onClick={(e)=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{
        position:'fixed', inset:0, zIndex:100,
        background:'rgba(10,8,14,.72)', backdropFilter:'blur(10px)',
        display:'flex', alignItems:'center', justifyContent:'center',
        animation:'fadeIn .2s ease both',
        fontFamily:"'Noto Sans JP'",
      }}>
      <div style={{
        ...glass({ borderRadius:14, border:`1.5px solid ${ownerColor}55`,
          boxShadow:`0 0 0 1px ${ownerColor}22, 0 20px 60px rgba(0,0,0,.45)` }),
        width:'min(820px, 92vw)', maxHeight:'88vh',
        display:'flex', overflow:'hidden',
        animation:'detailIn .26s ease both',
      }}>
        {/* Left — base illustration */}
        <div style={{
          flex:'0 0 360px', position:'relative', overflow:'hidden',
          background:`linear-gradient(160deg, ${ownerColor}22 0%, rgba(0,0,0,.05) 60%)`,
          display:'flex', alignItems:'center', justifyContent:'center', minHeight:420,
        }}>
          {node.imageUrl ? (
            <img src={node.imageUrl} alt={node.name}
              style={{width:'100%', height:'100%', objectFit:'cover'}}/>
          ) : (
            <BasePlaceholder type={node.type} color={ownerColor}/>
          )}
          {/* Type badge */}
          <div style={{position:'absolute', top:14, left:14, padding:'4px 12px',
            borderRadius:14, background:'rgba(0,0,0,.55)', color:'#fff',
            fontSize:10, fontFamily:'Rajdhani', fontWeight:700, letterSpacing:'.18em'}}>
            {node.type?.toUpperCase()} · {typeLabel}
          </div>
        </div>

        {/* Right — info & commands */}
        <div style={{flex:1, padding:'28px 28px 24px', display:'flex', flexDirection:'column', gap:18, position:'relative', minWidth:0}}>
          <button onClick={onClose} style={{
            position:'absolute', top:14, right:14, background:'transparent', border:'none',
            color:TXD, cursor:'pointer', fontSize:18, lineHeight:1, padding:4,
          }}>✕</button>

          <div>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
              <div style={{width:6, height:6, borderRadius:'50%', background:ownerColor}}/>
              <span style={{fontSize:10, color:TXD, fontFamily:"'Noto Sans JP'",
                letterSpacing:'.16em'}}>{ownerLabel} · 所領</span>
            </div>
            <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:30, fontWeight:900,
              color:TX, letterSpacing:'.04em', lineHeight:1}}>{node.name}</div>
          </div>

          {/* Stats row */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
            <StatTile label="兵力" value={node.troops?.toLocaleString() ?? '---'} unit="兵" color={ownerColor}/>
            <StatTile label="収入" value={`+${node.income ?? 0}`} unit="/T" color={AC}/>
          </div>

          {/* Notes / flavor */}
          {node.note && (
            <div style={{fontSize:11, color:TXD, fontFamily:"'Noto Sans JP'",
              lineHeight:1.7, borderLeft:`2px solid ${ownerColor}55`, paddingLeft:10}}>
              {node.note}
            </div>
          )}

          {/* Commands */}
          <div style={{display:'flex', flexDirection:'column', gap:7, marginTop:'auto'}}>
            <div style={{fontSize:9, fontFamily:'Rajdhani', fontWeight:700,
              letterSpacing:'.22em', color:TXD, marginBottom:2}}>COMMANDS</div>
            {cmds.length === 0 ? (
              <div style={{padding:'12px', borderRadius:8,
                background:'rgba(0,0,0,.04)', border:`1px dashed ${BR}`,
                fontSize:11, color:TXD, textAlign:'center'}}>
                利用できるコマンドはありません
              </div>
            ) : cmds.map(cmd => (
              <CommandButton key={cmd.id} {...cmd}
                onClick={()=>onNavigate(cmd.dest, { node })}/>
            ))}
            <button onClick={onClose} style={{
              marginTop:6, padding:'10px', borderRadius:8,
              background:'rgba(0,0,0,.04)', border:`1px solid ${BR}`,
              color:TXD, cursor:'pointer', fontFamily:"'Noto Sans JP'", fontSize:12,
            }}>閉じる</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, unit, color }) {
  return (
    <div style={{padding:'12px 14px', borderRadius:8,
      background:`${color}0d`, border:`1px solid ${color}33`}}>
      <div style={{fontSize:9, fontFamily:'Rajdhani', fontWeight:700,
        letterSpacing:'.18em', color:TXD, marginBottom:4}}>{label.toUpperCase()}</div>
      <div style={{display:'flex', alignItems:'baseline', gap:3}}>
        <span style={{fontFamily:'Rajdhani', fontWeight:900, fontSize:24, color, lineHeight:1}}>{value}</span>
        <span style={{fontSize:10, color:TXD, fontFamily:"'Noto Sans JP'"}}>{unit}</span>
      </div>
    </div>
  );
}

function CommandButton({ label, sub, color, icon, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
      style={{
        display:'flex', alignItems:'center', gap:14, padding:'12px 16px', borderRadius:8,
        background: hov
          ? `linear-gradient(90deg, ${color}, ${color}cc)`
          : `${color}12`,
        border:`1px solid ${hov ? color : color+'44'}`,
        cursor:'pointer', transition:'all .18s',
        color: hov ? '#fff' : color,
        fontFamily:"'Noto Sans JP'", fontSize:13, fontWeight:700, letterSpacing:'.08em',
        boxShadow: hov ? `0 4px 18px ${color}55` : 'none',
        textAlign:'left',
      }}>
      <span style={{fontSize:16, lineHeight:1}}>{icon}</span>
      <span style={{flex:1}}>{label}</span>
      <span style={{fontFamily:'Rajdhani', fontSize:10, fontWeight:700,
        letterSpacing:'.22em', opacity: hov ? .9 : .65}}>{sub}</span>
      <span style={{fontSize:13, opacity: hov ? 1 : .5}}>→</span>
    </button>
  );
}

function BasePlaceholder({ type, color }) {
  // simple geometric placeholder
  const icon = type === 'city' ? '⌂' : type === 'fort' ? '⏚' : type === 'town' ? '⌗' : '✻';
  return (
    <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:14, opacity:.5,
      width:'100%', height:'100%', justifyContent:'center',
      background:`repeating-linear-gradient(45deg, rgba(0,0,0,.04) 0, rgba(0,0,0,.04) 1px, transparent 1px, transparent 14px)`}}>
      <div style={{fontSize:96, color, lineHeight:1}}>{icon}</div>
      <div style={{fontSize:10, color:TXD, fontFamily:'monospace', letterSpacing:'.16em'}}>
        base illustration
      </div>
    </div>
  );
}

Object.assign(window, { BaseMenuScene });
