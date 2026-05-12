import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass, GAME_STATE, ROLES, CHARS } from '../shared/tokens.js';
import { TopBar } from '../shared/SharedUI.jsx';

function StatBar({label, val, max=10, color}) {
  const pct = Math.min(val/max,1)*100;
  return (
    <div style={{display:'flex', alignItems:'center', gap:8}}>
      <div style={{width:28, fontSize:9, color:TXD, fontFamily:'Noto Sans JP', flexShrink:0}}>{label}</div>
      <div style={{flex:1, height:5, borderRadius:3, background:'rgba(0,0,0,.08)', overflow:'hidden'}}>
        <div style={{width:`${pct}%`, height:'100%', borderRadius:3,
          background:`linear-gradient(90deg,${color}cc,${color})`,
          transition:'width .5s ease'}}/>
      </div>
      <div style={{width:20, textAlign:'right', fontFamily:'Rajdhani', fontWeight:700,
        fontSize:11, color, flexShrink:0}}>{val}</div>
    </div>
  );
}

function MemeBar({val, max, color}) {
  const pct = max>0 ? Math.min(val/max,1)*100 : 0;
  return (
    <div style={{display:'flex', alignItems:'center', gap:8}}>
      <div style={{width:28, fontSize:9, color:TXD, flexShrink:0}}>ミーム</div>
      <div style={{flex:1, height:5, borderRadius:3, background:'rgba(0,0,0,.08)', overflow:'hidden'}}>
        <div style={{width:`${pct}%`, height:'100%', borderRadius:3,
          background:`linear-gradient(90deg,${color}99,${color})`,
          transition:'width .5s ease'}}/>
      </div>
      <div style={{width:44, textAlign:'right', fontFamily:'Rajdhani', fontWeight:700,
        fontSize:10, color:TXD, flexShrink:0}}>{val.toLocaleString()}</div>
    </div>
  );
}

function LeftPanel({char, onConfirm}) {
  const [key, setKey] = useState(0);
  const prevId = useRef(null);
  useEffect(()=>{
    if(char && char.id !== prevId.current){
      prevId.current = char.id;
      setKey(k=>k+1);
    }
  },[char]);

  if(!char) {
    return (
      <div style={{flex:'0 0 42%', display:'flex', alignItems:'center', justifyContent:'center',
        position:'relative', overflow:'hidden'}}>
        <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:.06}} aria-hidden="true">
          <defs><pattern id="dotGrid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="12" cy="12" r="1" fill={TX}/>
          </pattern></defs>
          <rect width="100%" height="100%" fill="url(#dotGrid)"/>
        </svg>
        <div style={{textAlign:'center', opacity:.35, pointerEvents:'none'}}>
          <div style={{fontSize:48, marginBottom:12, opacity:.4}}>⟳</div>
          <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:14, fontWeight:700, color:TX,
            letterSpacing:'.18em'}}>仲間を選択</div>
          <div style={{fontSize:10, color:TXD, marginTop:6, letterSpacing:'.08em'}}>
            右のリストからキャラクターを選んでください
          </div>
        </div>
      </div>
    );
  }

  const role = ROLES[char.role] || ROLES.front;
  return (
    <div key={key} style={{flex:'0 0 42%', display:'flex', flexDirection:'column',
      position:'relative', overflow:'hidden', animation:'fadeIn .18s ease both'}}>
      <div style={{flex:1, position:'relative', overflow:'hidden', minHeight:0,
        display:'flex', alignItems:'flex-end', justifyContent:'center'}}>
        <div style={{position:'absolute', inset:0,
          background:`radial-gradient(ellipse 80% 70% at 50% 100%, ${role.color}22 0%, transparent 70%)`,
          pointerEvents:'none'}}/>
        <div style={{position:'absolute', bottom:-60, left:'50%', transform:'translateX(-50%)',
          width:400, height:400, borderRadius:'50%', border:`1px solid ${role.color}22`, pointerEvents:'none'}}/>
        {char.joined && char.portrait ? (
          <img key={char.id} src={char.portrait} alt={char.name}
            style={{position:'relative', zIndex:2, width:'auto', height:'100%',
              maxHeight:'calc(100vh - 220px)', objectFit:'contain', objectPosition:'bottom center',
              animation:'portraitRise .38s cubic-bezier(.2,.8,.3,1) both',
              display:'block', maxWidth:'100%'}}/>
        ) : (
          <div style={{position:'relative', zIndex:2, width:200, height:'60%', maxHeight:360,
            display:'flex', alignItems:'center', justifyContent:'center',
            background:`repeating-linear-gradient(45deg,rgba(0,0,0,.04) 0px,rgba(0,0,0,.04) 1px,transparent 1px,transparent 12px)`,
            border:`2px dashed rgba(0,0,0,.1)`, borderRadius:12,
            animation:'portraitRise .38s cubic-bezier(.2,.8,.3,1) both'}}>
            <div style={{textAlign:'center', opacity:.4}}>
              <div style={{fontSize:36, marginBottom:8}}>🔒</div>
              <div style={{fontFamily:'Noto Sans JP', fontSize:10, color:TXD}}>未加入</div>
            </div>
          </div>
        )}
      </div>

      <div style={{
        ...glass({borderRadius:'12px 12px 0 0', border:'1px solid rgba(255,255,255,.9)',
          borderBottom:'none', boxShadow:`0 -4px 24px rgba(0,0,0,.1), inset 0 1px 0 rgba(255,255,255,.8)`}),
        padding:'16px 20px 14px', animation:'fadeUp .22s .06s ease both', flexShrink:0,
      }}>
        <div style={{display:'flex', alignItems:'flex-end', gap:10, marginBottom:12}}>
          <div>
            <div style={{fontSize:9, color:TXD, fontFamily:'Noto Sans JP',
              letterSpacing:'.12em', marginBottom:2}}>{char.kana}</div>
            <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:22, fontWeight:900,
              color:TX, lineHeight:1.1, letterSpacing:'.04em'}}>{char.name}</div>
          </div>
          <div style={{marginLeft:'auto', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4}}>
            <span style={{fontSize:9, padding:'3px 9px', borderRadius:20, fontWeight:700,
              fontFamily:'Noto Sans JP', background:role.bg, color:role.color,
              border:`1px solid ${role.color}44`}}>{role.label}</span>
            <span style={{fontSize:9, color:TXD, fontFamily:'Noto Sans JP'}}>{char.origin}</span>
          </div>
        </div>
        {char.joined && char.quote && (
          <div style={{fontFamily:'Noto Sans JP', fontSize:10, color:TXD, fontStyle:'italic',
            borderLeft:`2px solid ${role.color}66`, paddingLeft:8, marginBottom:12, lineHeight:1.5}}>
            「{char.quote}」
          </div>
        )}
        <div style={{display:'flex', flexDirection:'column', gap:6, marginBottom:10}}>
          <StatBar label="攻撃" val={char.atk} max={12} color={PK}/>
          <StatBar label="防御" val={char.def} max={12} color={TEAL}/>
          <StatBar label="速度" val={char.spd} max={12} color={AC}/>
          <MemeBar val={char.meme} max={char.memeMax} color='#6a55b0'/>
        </div>
        {char.joined && (
          <div style={{background:`${role.color}0d`, borderRadius:8, padding:'7px 10px',
            border:`1px solid ${role.color}22`, marginBottom:12}}>
            <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:2}}>
              <span style={{fontSize:8, fontWeight:700, color:role.color,
                fontFamily:'Rajdhani', letterSpacing:'.1em'}}>SKILL</span>
              <span style={{fontFamily:'Noto Sans JP', fontSize:11, fontWeight:700, color:TX}}>
                {char.skill}
              </span>
            </div>
            <div style={{fontSize:9, color:TXD, fontFamily:'Noto Sans JP', lineHeight:1.5}}>
              {char.skillDesc}
            </div>
          </div>
        )}
        {char.joined ? (
          <button onClick={onConfirm} style={{
            width:'100%', padding:'11px', borderRadius:8,
            background:`linear-gradient(135deg,${role.color},${role.color}bb)`,
            border:'none', color:'#fff', cursor:'pointer',
            fontFamily:"'Noto Sans JP'", fontSize:12, fontWeight:700, letterSpacing:'.08em',
            boxShadow:`0 3px 16px ${role.color}55`,
          }}>キャラクター詳細を見る →</button>
        ) : (
          <div style={{width:'100%', padding:'10px', borderRadius:8, textAlign:'center',
            background:'rgba(0,0,0,.04)', border:`1px dashed rgba(0,0,0,.12)`,
            fontSize:11, color:TXD, fontFamily:'Noto Sans JP'}}>
            🔒 まだ仲間になっていません
          </div>
        )}
      </div>
    </div>
  );
}

function NameItem({char, isHovered, isSelected, onHover, onLeave, onClick, index}) {
  const role = ROLES[char.role] || ROLES.front;
  const active = isHovered || isSelected;
  return (
    <div onMouseEnter={onHover} onMouseLeave={onLeave} onClick={onClick}
      style={{position:'relative', padding:'10px 14px', borderRadius:8, cursor:'pointer',
        userSelect:'none', transition:'background .15s, transform .12s, box-shadow .15s',
        background:active?(char.joined?`${role.color}14`:'rgba(0,0,0,.05)'):'transparent',
        border:`1px solid ${active&&char.joined?`${role.color}44`:'transparent'}`,
        transform:active?'translateX(3px)':'none',
        animation:`fadeUp .2s ${index*0.025}s ease both`,
        opacity:char.joined?1:.5,
        display:'flex', flexDirection:'column', gap:2}}>
      <div style={{position:'absolute', left:5, top:'50%', transform:'translateY(-50%)',
        width:3, height:active?'70%':'40%', borderRadius:2,
        background:char.joined?role.color:'rgba(0,0,0,.2)', transition:'height .15s'}}/>
      <div style={{display:'flex', alignItems:'center', gap:6, paddingLeft:4}}>
        {char.portrait ? (
          <div style={{width:20, height:20, borderRadius:'50%', flexShrink:0, overflow:'hidden',
            border:`1.5px solid ${active?role.color+'66':'rgba(0,0,0,.1)'}`, transition:'border-color .15s'}}>
            <img src={char.portrait} alt="" style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'top'}}/>
          </div>
        ) : (
          <div style={{width:20, height:20, borderRadius:'50%', flexShrink:0,
            background:'rgba(0,0,0,.06)', border:'1.5px dashed rgba(0,0,0,.15)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:TXD}}>?</div>
        )}
        <span style={{fontFamily:"'Zen Maru Gothic'", fontWeight:900, fontSize:13,
          color:active&&char.joined?role.color:char.joined?TX:TXD,
          transition:'color .15s', letterSpacing:'.02em', lineHeight:1.2}}>{char.name}</span>
      </div>
      <div style={{paddingLeft:30, display:'flex', gap:6, alignItems:'center'}}>
        <span style={{fontSize:8, fontFamily:'Noto Sans JP', fontWeight:700,
          color:char.joined?role.color:TXD, opacity:active?1:.7}}>{role.label}</span>
        <span style={{fontSize:8, color:TXF, fontFamily:'Rajdhani'}}>
          {char.joined?char.origin:'???'}
        </span>
      </div>
    </div>
  );
}

function CharDetail({char, onClose}) {
  const role = ROLES[char.role] || ROLES.front;
  return (
    <div style={{position:'fixed', inset:0, zIndex:100,
      background:'rgba(10,8,14,.75)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
      display:'flex', alignItems:'center', justifyContent:'center', animation:'fadeIn .18s ease both'}}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{...glass({borderRadius:16, border:`1.5px solid ${role.color}55`,
          boxShadow:`0 0 0 1px ${role.color}22, 0 20px 60px rgba(0,0,0,.45)`}),
        width:'min(800px,92vw)', maxHeight:'90vh', display:'flex', overflow:'hidden',
        animation:'detailIn .24s ease both'}}>
        <div style={{flex:'0 0 320px', position:'relative', overflow:'hidden',
          background:`linear-gradient(160deg,${role.color}18 0%,transparent 60%)`,
          display:'flex', alignItems:'flex-end', justifyContent:'center', minHeight:400}}>
          <div style={{position:'absolute', bottom:-80, left:'50%', transform:'translateX(-50%)',
            width:400, height:400, borderRadius:'50%',
            background:`radial-gradient(circle,${role.color}22 0%,transparent 70%)`, pointerEvents:'none'}}/>
          <img src={char.portrait} alt={char.name}
            style={{position:'relative', zIndex:1, width:'100%', height:'auto',
              maxHeight:'100%', objectFit:'contain', objectPosition:'bottom',
              animation:'portraitRise .4s ease both'}}/>
        </div>
        <div style={{flex:1, padding:'32px 28px', overflowY:'auto',
          display:'flex', flexDirection:'column', gap:16, position:'relative'}}>
          <button onClick={onClose} style={{position:'absolute', top:16, right:16,
            background:'transparent', border:'none', color:TXD, cursor:'pointer', fontSize:18, lineHeight:1, padding:4}}>✕</button>
          <div>
            <div style={{fontSize:10, color:TXD, fontFamily:'Noto Sans JP',
              letterSpacing:'.15em', marginBottom:4}}>{char.kana}</div>
            <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:28, fontWeight:900,
              color:TX, letterSpacing:'.04em', lineHeight:1}}>{char.name}</div>
            <div style={{display:'flex', gap:8, marginTop:8, alignItems:'center'}}>
              <span style={{fontSize:10, padding:'3px 10px', borderRadius:20, fontWeight:700,
                fontFamily:'Noto Sans JP', background:role.bg, color:role.color,
                border:`1px solid ${role.color}44`}}>{role.label}</span>
              <span style={{fontSize:10, color:TXD, fontFamily:'Noto Sans JP'}}>{char.origin}出身</span>
            </div>
          </div>
          {char.quote && (
            <div style={{fontFamily:'Noto Sans JP', fontSize:12, color:TXD, fontStyle:'italic',
              borderLeft:`3px solid ${role.color}88`, paddingLeft:12, lineHeight:1.7}}>
              「{char.quote}」
            </div>
          )}
          <div style={{background:'rgba(0,0,0,.03)', borderRadius:10, padding:'14px 16px', border:`1px solid ${BR}`}}>
            <div style={{fontSize:9, fontFamily:'Rajdhani', fontWeight:700,
              color:TXD, letterSpacing:'.15em', marginBottom:10}}>STATS</div>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              <StatBar label="攻撃" val={char.atk} max={12} color={PK}/>
              <StatBar label="防御" val={char.def} max={12} color={TEAL}/>
              <StatBar label="速度" val={char.spd} max={12} color={AC}/>
              <MemeBar val={char.meme} max={char.memeMax} color='#6a55b0'/>
            </div>
          </div>
          <div style={{background:`${role.color}0d`, borderRadius:10, padding:'14px 16px',
            border:`1px solid ${role.color}28`}}>
            <div style={{fontSize:9, fontFamily:'Rajdhani', fontWeight:700,
              color:role.color, letterSpacing:'.15em', marginBottom:6}}>SKILL</div>
            <div style={{fontFamily:'Noto Sans JP', fontSize:14, fontWeight:700, color:TX, marginBottom:4}}>{char.skill}</div>
            <div style={{fontSize:11, color:TXD, fontFamily:'Noto Sans JP', lineHeight:1.6}}>{char.skillDesc}</div>
          </div>
          <div style={{display:'flex', gap:10, marginTop:'auto', paddingTop:8}}>
            <button onClick={onClose} style={{flex:1, padding:'11px', borderRadius:8,
              background:`linear-gradient(135deg,${role.color},${role.color}cc)`,
              border:'none', color:'#fff', cursor:'pointer',
              fontFamily:"'Noto Sans JP'", fontSize:12, fontWeight:700,
              boxShadow:`0 3px 16px ${role.color}44`}}>編成に追加 +</button>
            <button onClick={onClose} style={{padding:'11px 16px', borderRadius:8,
              background:'rgba(0,0,0,.05)', border:`1px solid ${BR}`,
              color:TXD, cursor:'pointer', fontFamily:"'Noto Sans JP'", fontSize:12}}>戻る</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PartyScene({ onNavigate }) {
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  const activeId = hovered || selected;
  const activeChar = CHARS.find(c=>c.id===activeId) || null;
  const joined = CHARS.filter(c=>c.joined);
  const locked  = CHARS.filter(c=>!c.joined);

  const handleNameClick = useCallback((char)=>{
    if(!char.joined) return;
    if(selected===char.id) setDetail(char);
    else setSelected(char.id);
  },[selected]);

  return (
    <div className="scene-enter" style={{width:'100vw', height:'100vh',
      fontFamily:"'Noto Sans JP',sans-serif", position:'relative', overflow:'hidden',
      background:'rgba(248,246,244,1)'}}>

      {/* TOP BAR */}
      <TopBar scene="party"
        breadcrumb={['マップ','仲間']}
        rightSlot={
          <div style={{padding:'4px 12px', borderRadius:20,
            background:'rgba(26,138,150,.1)', border:'1px solid rgba(26,138,150,.25)',
            display:'flex', alignItems:'center', gap:6}}>
            <div style={{width:6, height:6, borderRadius:'50%', background:TEAL}}/>
            <span style={{fontFamily:"'Zen Maru Gothic'", fontSize:11, fontWeight:900, color:TX}}>
              仲間 {joined.length}/{CHARS.length}
            </span>
          </div>
        }
      />

      {/* MAIN */}
      <div style={{position:'absolute', top:52, left:0, right:0, bottom:52,
        display:'flex', overflow:'hidden'}}>

        <LeftPanel char={activeChar} onConfirm={()=>{ if(activeChar&&activeChar.joined) setDetail(activeChar); }}/>

        <div style={{width:1, background:`linear-gradient(to bottom,transparent,${BR},transparent)`, flexShrink:0}}/>

        <div style={{flex:1, overflowY:'auto', padding:'20px 16px',
          background:`repeating-linear-gradient(0deg,rgba(0,0,0,.012) 0px,rgba(0,0,0,.012) 1px,transparent 1px,transparent 48px)`}}>

          {/* PARTY MEMBERS */}
          <div style={{marginBottom:8}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8, padding:'0 6px'}}>
              <div style={{width:3, height:14, borderRadius:2, background:TEAL}}/>
              <span style={{fontFamily:'Rajdhani', fontWeight:700, fontSize:11, color:TXD, letterSpacing:'.15em'}}>PARTY MEMBERS</span>
              <span style={{fontSize:10, color:TXF, fontFamily:'Noto Sans JP'}}>仲間</span>
              <span style={{marginLeft:'auto', fontSize:9, padding:'2px 8px', borderRadius:10,
                background:'rgba(26,138,150,.1)', color:TEAL, border:'1px solid rgba(26,138,150,.25)',
                fontFamily:'Rajdhani', fontWeight:700}}>{joined.length}</span>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:4}}>
              {joined.map((c,i)=>(
                <NameItem key={c.id} char={c} index={i}
                  isHovered={hovered===c.id} isSelected={selected===c.id}
                  onHover={()=>setHovered(c.id)} onLeave={()=>setHovered(null)}
                  onClick={()=>handleNameClick(c)}/>
              ))}
            </div>
          </div>

          <div style={{height:1, background:BR, margin:'16px 6px'}}/>

          {/* LOCKED */}
          <div>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8, padding:'0 6px'}}>
              <div style={{width:3, height:14, borderRadius:2, background:'rgba(0,0,0,.2)'}}/>
              <span style={{fontFamily:'Rajdhani', fontWeight:700, fontSize:11, color:TXF, letterSpacing:'.15em'}}>LOCKED</span>
              <span style={{fontSize:10, color:TXF, fontFamily:'Noto Sans JP'}}>未加入</span>
              <span style={{marginLeft:'auto', fontSize:9, padding:'2px 8px', borderRadius:10,
                background:'rgba(0,0,0,.05)', color:TXD, border:`1px solid ${BR}`,
                fontFamily:'Rajdhani', fontWeight:700}}>{locked.length}</span>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:4}}>
              {locked.map((c,i)=>(
                <NameItem key={c.id} char={c} index={i}
                  isHovered={hovered===c.id} isSelected={false}
                  onHover={()=>setHovered(c.id)} onLeave={()=>setHovered(null)}
                  onClick={()=>handleNameClick(c)}/>
              ))}
            </div>
          </div>

          <div style={{textAlign:'center', marginTop:24, paddingBottom:8,
            fontSize:9, color:TXF, fontFamily:'Noto Sans JP', letterSpacing:'.08em'}}>
            ホバーで詳細表示　／　クリックで選択　／　もう一度クリックで詳細画面へ
          </div>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <BottomBar scene="party" onNavigate={onNavigate}/>

      {/* Character detail overlay */}
      {detail && detail.joined && (
        <CharDetail char={detail} onClose={()=>setDetail(null)}/>
      )}
    </div>
  );
}

Object.assign(window, { PartyScene });