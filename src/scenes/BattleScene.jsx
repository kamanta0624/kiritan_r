import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass, GAME_STATE, ROLES, CHARS } from '../shared/tokens.js';
import { TopBar } from '../shared/SharedUI.jsx';

// BattleScene-local palette (prefix B_ to avoid collision)
const B_AP = {
  pk:'#c4427a', pk2:'#9e2d5f', pkBg:'rgba(196,66,122,.1)', pkBdr:'rgba(196,66,122,.35)',
  ac:'#b87010', ac2:'#d4a044', acBg:'rgba(192,112,16,.1)', acBdr:'rgba(192,112,16,.35)',
  teal:'#1a8a96', tealBg:'rgba(26,138,150,.1)', tealBdr:'rgba(26,138,150,.35)',
  glass:'rgba(255,253,251,.93)', glassBdr:'rgba(255,255,255,.75)',
  shadow:'0 2px 20px rgba(0,0,0,.13)',
  tx:'#1c1020', txd:'rgba(28,16,32,.55)', txf:'rgba(28,16,32,.28)', br:'rgba(0,0,0,.07)',
};
const bGlass = (x={}) => ({background:B_AP.glass,backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',border:`1px solid ${B_AP.glassBdr}`,boxShadow:B_AP.shadow,...x});
const bFmt = n => n>=1000 ? n.toLocaleString() : String(n);

// Resolve constants
const RPK2='#c4427a', RAC2='#d4a044', RBG2='#0a0816', RTX2='#f0ece4', RTXD2='rgba(240,236,228,.5)';
const RPH2=['intro','battle','collision','resolve','result'];
const RDUR2={intro:1500,battle:950,collision:700,resolve:1800};
const ROUT2={atkTroopDmg:10,atkHPDmg:2,defTroopDmg:120,defHPDmg:3};

function BRoleTag({role}){
  const m={'前衛':{bg:'rgba(196,66,122,.12)',c:B_AP.pk,brd:B_AP.pkBdr},'間接':{bg:'rgba(26,138,150,.1)',c:B_AP.teal,brd:B_AP.tealBdr},'後衛':{bg:'rgba(0,0,0,.06)',c:B_AP.txd,brd:B_AP.br}};
  const s=m[role]||m['後衛'];
  return <span style={{fontSize:7,padding:'1px 4px',borderRadius:2,fontWeight:700,letterSpacing:.3,background:s.bg,color:s.c,border:`1px solid ${s.brd}`,flexShrink:0}}>{role}</span>;
}

function BMemeBar({meme,max,teamMax,ally}){
  const pct=Math.max(0,Math.min(100,(meme/teamMax)*100));
  const low=meme/max<.3;
  return(
    <div style={{height:5,background:'rgba(0,0,0,.1)',borderRadius:4,overflow:'hidden',position:'relative'}}>
      <div style={{position:'absolute',inset:0,width:`${pct}%`,borderRadius:4,
        background:low?'linear-gradient(90deg,#c04040,#e05555)':ally?`linear-gradient(90deg,${B_AP.pk2},${B_AP.pk})`:`linear-gradient(90deg,#8a6010,${B_AP.ac2})`,
        transition:'width .4s ease'}}/>
    </div>
  );
}

function BUnitCard({unit,ally,phase,targetId,onTarget,teamMax}){
  const [hov,setHov]=useState(false);
  const [clicked,setClicked]=useState(false);
  const isActive=unit.status==='active',isDone=unit.status==='done';
  const isTargetable=!ally&&phase==='targeting',isTargeted=targetId===unit.id;
  let brd=B_AP.br;
  if(isActive) brd=B_AP.pk;
  if(isTargeted) brd=B_AP.ac2;
  if(isTargetable&&hov) brd=B_AP.ac2;
  return(
    <div
      className={`${isActive?'active-glow':isTargeted?'target-ring':''}${isTargeted?' targeted-shake':''}`}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onClick={()=>{if(!isTargetable)return;onTarget(unit.id);setClicked(true);setTimeout(()=>setClicked(false),400);}}
      style={{...bGlass(),flex:isActive?2.6:0.85,minHeight:0,position:'relative',borderRadius:8,border:`1.5px solid ${brd}`,display:'flex',overflow:'hidden',opacity:isDone?.62:1,cursor:isTargetable?'crosshair':'default',transition:'flex .28s ease,border-color .18s,opacity .25s',background:isActive?'rgba(255,240,246,.96)':isTargeted?'rgba(255,248,232,.95)':B_AP.glass}}>
      <div style={{width:isActive?80:52,flexShrink:0,overflow:'hidden',position:'relative',transition:'width .28s ease',background:ally?(isActive?'linear-gradient(180deg,rgba(255,210,228,.3),rgba(255,240,248,.15))':'rgba(196,66,122,.06)'):(isActive?'linear-gradient(180deg,rgba(255,240,200,.3),rgba(255,250,225,.15))':'rgba(212,160,68,.08)')}}>
        {unit.portrait?<img src={unit.portrait} alt={unit.name} style={{width:'100%',height:'100%',display:'block',objectFit:'cover',objectPosition:isActive?'center 15%':'center top'}}/>
          :<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ally?'rgba(196,66,122,.3)':'rgba(192,112,16,.3)'} strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>}
        {isDone&&<div style={{position:'absolute',inset:0,background:'rgba(255,255,255,.35)'}}/>}
      </div>
      <div style={{flex:1,padding:isActive?'8px 9px':'5px 8px',display:'flex',flexDirection:'column',gap:isActive?4:2,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          {isActive?<span style={{fontFamily:"'Zen Maru Gothic',sans-serif",fontSize:15,fontWeight:900,color:B_AP.pk,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{unit.name}</span>
            :<span style={{fontSize:11,fontWeight:700,color:B_AP.tx,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{unit.name}</span>}
          <BRoleTag role={unit.role}/>
        </div>
        <div>
          <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:2}}>
            <span style={{fontFamily:'Rajdhani',fontWeight:700,fontSize:isActive?20:13,color:ally?B_AP.pk:B_AP.ac,lineHeight:1}}>{bFmt(unit.meme)}</span>
            <span style={{fontFamily:'Rajdhani',fontSize:10,color:B_AP.txd}}>/ {bFmt(unit.max)}</span>
          </div>
          <BMemeBar meme={unit.meme} max={unit.max} teamMax={teamMax} ally={ally}/>
        </div>
        {isActive&&<div style={{marginTop:'auto',background:'rgba(255,255,255,.75)',border:`1px solid ${B_AP.pkBdr}`,borderRadius:6,padding:'5px 8px',fontSize:11,color:B_AP.tx,fontStyle:'italic',lineHeight:1.5}}>
          「さあ、いくよ！」
        </div>}
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <span style={{fontFamily:'Rajdhani',fontSize:11,color:B_AP.txd}}>攻<b style={{color:B_AP.tx}}>{unit.atk}</b></span>
          <span style={{fontFamily:'Rajdhani',fontSize:11,color:B_AP.txd}}>守<b style={{color:B_AP.tx}}>{unit.def}</b></span>
          {unit.bonus&&<span style={{fontSize:8,color:B_AP.ac,background:B_AP.acBg,borderRadius:2,padding:'1px 4px',border:`1px solid ${B_AP.acBdr}`}}>{unit.bonus}</span>}
        </div>
      </div>
      <div className={isActive?'badge-blink':''} style={{position:'absolute',top:4,right:5,fontSize:8,fontWeight:700,padding:'1px 6px',borderRadius:10,...(isActive?{background:B_AP.pk,color:'#fff',boxShadow:`0 0 8px ${B_AP.pkBdr}`}:isDone?{background:'rgba(0,0,0,.08)',color:B_AP.txd}:{background:'rgba(0,0,0,.05)',color:B_AP.txf,border:`1px solid ${B_AP.br}`})}}>
        {isActive?'行動中':isDone?'完了':'待機'}
      </div>
      {clicked&&<div style={{position:'absolute',inset:0,borderRadius:7,background:'rgba(255,200,60,.55)',pointerEvents:'none',animation:'clickFlash .4s ease forwards'}}/>}
      {isTargetable&&hov&&!isTargeted&&(
        <div style={{position:'absolute',inset:0,borderRadius:7,pointerEvents:'none',background:'rgba(212,160,68,.13)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6}}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={B_AP.ac2} strokeWidth="1.6" style={{filter:'drop-shadow(0 0 6px rgba(212,160,68,.8))',animation:'crosshairSpin 3s linear infinite'}}>
            <circle cx="12" cy="12" r="7"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
          </svg>
          <span style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:'#fff',background:'rgba(180,100,0,.85)',padding:'3px 12px',borderRadius:4}}>TARGET</span>
        </div>
      )}
      {isTargeted&&(
        <div style={{position:'absolute',inset:0,borderRadius:7,pointerEvents:'none',background:'rgba(212,160,68,.1)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={B_AP.ac2} strokeWidth="2" style={{filter:`drop-shadow(0 0 8px ${B_AP.ac2})`}}>
            <circle cx="12" cy="12" r="7"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
            <circle cx="12" cy="12" r="2" fill={B_AP.ac2}/>
          </svg>
        </div>
      )}
    </div>
  );
}

function BActionPanel({active,phase,action,targetId,enemies,onAction,onConfirm,onBack}){
  const tgt=enemies.find(u=>u.id===targetId);
  const btns=[
    {key:'attack',label:'攻撃',color:B_AP.pk,border:B_AP.pkBdr,activeBg:B_AP.pk,idleBg:B_AP.pkBg},
    {key:'defend',label:'防御',color:B_AP.teal,border:B_AP.tealBdr,activeBg:B_AP.teal,idleBg:B_AP.tealBg},
    {key:'retreat',label:'撤退',color:B_AP.txd,border:B_AP.br,activeBg:'rgba(0,0,0,.12)',idleBg:'rgba(0,0,0,.04)'},
  ];
  return(
    <div style={{...bGlass({borderRadius:8,padding:'10px 12px',flexShrink:0})}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
        <span style={{fontSize:11,color:B_AP.txd}}>行動:</span>
        <span style={{fontFamily:"'Zen Maru Gothic',sans-serif",fontSize:15,fontWeight:900,color:B_AP.pk}}>{active?.name}</span>
        <div style={{marginLeft:'auto',display:'flex',gap:4}}>
          {['行動選択','対象選択'].map((s,i)=>{
            const cur=(i===0&&phase==='idle')||(i===1&&phase==='targeting');
            const done=(i===0&&phase==='targeting');
            return(
              <React.Fragment key={s}>
                {i>0&&<span style={{color:B_AP.txf,fontSize:9,alignSelf:'center'}}>›</span>}
                <span style={{fontSize:9,padding:'2px 7px',borderRadius:10,fontWeight:600,background:cur?B_AP.pk:done?B_AP.pkBg:'transparent',color:cur?'#fff':done?B_AP.pk:B_AP.txf,border:`1px solid ${cur?B_AP.pk:done?B_AP.pkBdr:B_AP.br}`}}>{s}</span>
              </React.Fragment>
            );
          })}
        </div>
      </div>
      <div style={{fontSize:11,color:B_AP.txd,padding:'4px 8px',marginBottom:7,background:'rgba(0,0,0,.04)',borderRadius:4,border:`1px solid ${B_AP.br}`,minHeight:26,display:'flex',alignItems:'center'}}>
        {phase==='idle'&&'行動を選択してください'}
        {phase==='targeting'&&!tgt&&'▶ 攻撃する敵ユニットをクリック'}
        {phase==='targeting'&&tgt&&<span>攻撃対象: <b style={{color:B_AP.ac}}>{tgt.name}</b>　—　確定または別の敵を選択</span>}
      </div>
      <div style={{display:'flex',gap:6}}>
        {btns.map(b=>{
          const sel=action===b.key;
          return(
            <button key={b.key} onClick={()=>onAction(b.key)} style={{flex:1,padding:'9px 4px',borderRadius:6,border:`1.5px solid ${sel?b.color:b.border}`,background:sel?b.activeBg:b.idleBg,color:sel?'#fff':b.color,cursor:'pointer',fontFamily:"'Noto Sans JP',sans-serif",fontSize:14,fontWeight:700,boxShadow:sel?`0 2px 14px ${b.border}`:'none',transition:'all .15s ease'}}>
              {b.label}
              {sel&&b.key==='attack'&&tgt&&<div style={{fontSize:9,opacity:.8,fontWeight:400,marginTop:1}}>→ {tgt.name}</div>}
            </button>
          );
        })}
      </div>
      {phase==='targeting'&&tgt&&(
        <div className="confirm-pop" style={{display:'flex',gap:5,marginTop:7}}>
          <button onClick={onBack} style={{padding:'6px 12px',borderRadius:5,border:`1px solid ${B_AP.br}`,background:'rgba(0,0,0,.04)',color:B_AP.txd,cursor:'pointer',fontSize:11,fontFamily:"'Noto Sans JP',sans-serif"}}>← 戻る</button>
          <button onClick={onConfirm} style={{flex:1,padding:'8px',borderRadius:5,background:B_AP.pk,border:'none',color:'#fff',cursor:'pointer',fontFamily:"'Noto Sans JP',sans-serif",fontSize:12,fontWeight:700,letterSpacing:.4,boxShadow:`0 2px 16px rgba(196,66,122,.45)`}}>✓　行動確定</button>
        </div>
      )}
    </div>
  );
}

// ActionScene — uses formation passed in
export default function BActionScene({round, formation, targetNode, onComplete}){
  const enemies = [
    {id:'e1',name:'北海道めろん',role:'前衛',atk:10,def:8,meme:500,max:500,portrait:'assets/portrait_meron.png'},
    {id:'e2',name:'ベルン',role:'後衛',atk:8,def:10,meme:518,max:518,bonus:'兵守+1',portrait:'assets/portrait_bern_fog.png'},
    {id:'e3',name:'沖縄あわも',role:'前衛',atk:10,def:8,meme:500,max:500,portrait:'assets/portrait_awamo.png'},
    {id:'e4',name:'フォーグ',role:'後衛',atk:8,def:9,meme:478,max:478,bonus:'兵守+1',portrait:'assets/portrait_bern_fog.png'},
  ];

  // Build allies from formation
  const buildAllies = () => {
    const slots = ['front1','front2','rear1','rear2'];
    const chars = slots.map(k => formation[k]).filter(Boolean);
    return chars.map((c,i) => ({
      id: c.id, name: c.name,
      role: ROLES[c.role]?.label || c.role,
      atk: c.atk, def: c.def,
      meme: c.meme, max: c.memeMax,
      status: i===0 ? 'active' : 'pending',
      portrait: c.portrait,
    }));
  };

  const [allies, setAllies] = useState(buildAllies);
  const [phase, setPhase] = useState('idle');
  const [action, setAction] = useState(null);
  const [targetId, setTargetId] = useState(null);
  const [log, setLog] = useState([]);
  const [btnReady, setBtnReady] = useState(false);
  const active = allies.find(u=>u.status==='active');
  const allDone = !active;

  useEffect(()=>{
    if(allDone) setTimeout(()=>setBtnReady(true),300);
    else setBtnReady(false);
  },[allDone]);

  const advance = () => setAllies(prev=>{
    const idx = prev.findIndex(u=>u.status==='active');
    const nxt = prev.findIndex((u,i)=>i>idx&&u.status==='pending');
    return prev.map((u,i)=>i===idx?{...u,status:'done'}:i===nxt?{...u,status:'active'}:u);
  });

  const handleAction = key => {
    if(key==='attack'){setAction('attack');setPhase('targeting');}
    else{setLog(p=>[...p,{txt:`${active.name} → ${key==='defend'?'防御態勢':'撤退'}`}]);setPhase('idle');setAction(null);setTargetId(null);advance();}
  };
  const handleConfirm = () => {
    const tgt = enemies.find(u=>u.id===targetId);
    if(tgt) setLog(p=>[...p,{txt:`${active.name} → ${tgt.name}  攻撃`}]);
    setPhase('idle');setAction(null);setTargetId(null);advance();
  };

  const enemyName = targetNode?.name || '敵拠点';

  return(
    <div style={{width:'100%',height:'100%',fontFamily:"'Noto Sans JP',sans-serif",color:B_AP.tx,display:'flex',flexDirection:'column',overflow:'hidden',position:'relative',backgroundImage:'url(assets/bg_battle.jpg)',backgroundSize:'cover',backgroundPosition:'center'}}>
      <div style={{position:'absolute',inset:0,background:'rgba(220,210,200,.12)',pointerEvents:'none'}}/>
      <div style={{...bGlass({borderRadius:0,border:'none',borderBottom:'1px solid rgba(0,0,0,.1)',background:'rgba(255,253,251,.96)'}),display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 14px',height:42,flexShrink:0,zIndex:10,position:'relative'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <img src="assets/logo_tohoku.png" alt="東北家" style={{height:28,objectFit:'contain'}}/>
          <span style={{color:B_AP.txd,fontSize:11}}>→</span>
          <span style={{fontFamily:"'Zen Maru Gothic',sans-serif",fontSize:14,fontWeight:900,color:B_AP.pk}}>{enemyName}</span>
        </div>
        <div style={{textAlign:'center'}}>
          <div style={{fontFamily:'Rajdhani',fontSize:16,fontWeight:700,letterSpacing:2,color:B_AP.tx}}>ROUND {round} / 5</div>
          <div style={{fontSize:9,color:B_AP.txd}}>行動選択フェーズ</div>
        </div>
        <div style={{fontFamily:"'Zen Maru Gothic',sans-serif",fontSize:14,fontWeight:900,color:B_AP.ac}}>{enemyName}</div>
      </div>
      <div style={{flex:1,display:'grid',gridTemplateColumns:'248px 1fr 248px',gap:6,padding:6,minHeight:0,position:'relative',zIndex:1}}>
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          <div style={{fontFamily:'Rajdhani',fontSize:9,fontWeight:700,letterSpacing:2,color:B_AP.pk,paddingLeft:4,marginBottom:-1,textShadow:'0 1px 4px rgba(255,255,255,.8)'}}>東北家 ── 自軍</div>
          {allies.map(u=><BUnitCard key={u.id} unit={u} ally={true} phase={phase} targetId={targetId} onTarget={()=>{}} teamMax={5000}/>)}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          <div style={{flexShrink:0,display:'flex',justifyContent:'center'}}>
            <div style={{...bGlass({padding:'5px 16px',borderRadius:20,border:'1px solid rgba(0,0,0,.1)'}),display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontFamily:"'Zen Maru Gothic',sans-serif",fontWeight:900,fontSize:13,color:B_AP.pk}}>東北家</span>
              <span style={{color:B_AP.txf,fontSize:11}}>vs</span>
              <span style={{fontFamily:"'Zen Maru Gothic',sans-serif",fontWeight:900,fontSize:13,color:B_AP.ac}}>{enemyName}</span>
            </div>
          </div>
          <div style={{...bGlass({borderRadius:6,padding:'6px 10px',flexShrink:0}),minHeight:44}}>
            {log.slice(-2).map((e,i)=>(
              <div key={i} style={{fontSize:10,color:B_AP.txd,lineHeight:1.8,opacity:i===log.slice(-2).length-1?1:.5}}>
                <span style={{color:B_AP.txf,marginRight:5}}>▸</span>{e.txt}
              </div>
            ))}
          </div>
          <div style={{flex:1}}/>
          {allDone&&(
            <div className="confirm-pop" style={{display:'flex',flexDirection:'column',gap:6}}>
              <div style={{...bGlass({borderRadius:7,padding:'8px 16px',border:`1.5px solid ${B_AP.pkBdr}`,background:'rgba(255,240,246,.96)'}),textAlign:'center',color:B_AP.pk,fontWeight:700,fontSize:12}}>全員の行動が完了しました</div>
              <button onClick={onComplete} style={{padding:'13px',borderRadius:7,background:btnReady?B_AP.pk:'rgba(196,66,122,.3)',border:`2px solid ${B_AP.pk}`,color:'#fff',cursor:'pointer',fontFamily:"'Noto Sans JP',sans-serif",fontSize:15,fontWeight:700,letterSpacing:1,boxShadow:btnReady?'0 0 28px rgba(196,66,122,.65),0 4px 20px rgba(196,66,122,.4)':'none',transition:'all .4s ease',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
                <span style={{fontSize:18}}>⚔️</span><span>戦闘解決へ</span><span style={{fontSize:20,opacity:.8}}>→</span>
              </button>
            </div>
          )}
          {!allDone&&<BActionPanel active={active} phase={phase} action={action} targetId={targetId} enemies={enemies} onAction={handleAction} onConfirm={handleConfirm} onBack={()=>{setPhase('idle');setAction(null);setTargetId(null);}}/>}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          <div style={{fontFamily:'Rajdhani',fontSize:9,fontWeight:700,letterSpacing:2,color:B_AP.ac,paddingLeft:4,marginBottom:-1,textShadow:'0 1px 4px rgba(255,255,255,.8)'}}>敵軍</div>
          {enemies.map(u=><BUnitCard key={u.id} unit={u} ally={false} phase={phase} targetId={targetId} onTarget={setTargetId} teamMax={518}/>)}
        </div>
      </div>
      <div style={{...bGlass({borderRadius:0,border:'none',borderTop:'1px solid rgba(0,0,0,.1)',background:'rgba(255,253,251,.96)'}),display:'flex',alignItems:'center',height:34,padding:'0 10px',flexShrink:0,zIndex:10,position:'relative'}}>
        {[{label:'ターン',val:'1',c:B_AP.tx},{label:'ミーム',val:'500',c:B_AP.pk},{label:'収入',val:'+600/T',c:B_AP.ac},{label:'拠点',val:'11/92',c:B_AP.tx}].map((item,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:5,padding:'0 10px',height:'100%',borderRight:`1px solid ${B_AP.br}`,fontSize:11}}>
            <span style={{color:B_AP.txd}}>{item.label}</span>
            <span style={{color:item.c,fontFamily:'Rajdhani',fontWeight:700,fontSize:13}}>{item.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ResolveScene
function BResolveScene({round, formation, targetNode, onComplete}){
  const firstChar = formation && (formation.front1 || formation.front2);
  const RATKER2 = firstChar ? {
    name: firstChar.name,
    portrait: firstChar.portrait || 'assets/portrait_kiritan.png',
    troops:10, maxTroops:10, hp:8, maxHp:10, atk:firstChar.atk,
    color:RPK2, glow:'rgba(196,66,122,.75)',
    lines:{intro:'「全力でいきます！」',battle:'「行くよ！！」',collision:'「くっ…！」',resolve:'「やった…！」',result:'「次も頑張ります！」'},
  } : {
    name:'東北きりたん', portrait:'assets/portrait_kiritan.png',
    troops:10,maxTroops:10,hp:8,maxHp:10,atk:6,
    color:RPK2,glow:'rgba(196,66,122,.75)',
    lines:{intro:'「全力でいきます！」',battle:'「行くよ！！」',collision:'「くっ…！」',resolve:'「やった…！」',result:'「次も頑張ります！」'},
  };
  const RDEFDR2 = {
    name: targetNode?.name || '敵',
    portrait:'assets/portrait_meron.png',
    troops:targetNode?.troops||500, maxTroops:targetNode?.troops||500,
    hp:10, maxHp:10, atk:10,
    color:RAC2, glow:'rgba(212,160,68,.75)',
    lines:{intro:'「やってみろ！」',battle:'「防御陣形！」',collision:'「ぐっ…！」',resolve:'「損害は出たが…」',result:'「まだまだだ」'},
  };

  const [phaseIdx,setPhaseIdx]=useState(0);
  const phase=RPH2[phaseIdx];
  const [atkT,setAtkT]=useState(RATKER2.troops);
  const [defT,setDefT]=useState(RDEFDR2.troops);
  const [atkHP,setAtkHP]=useState(RATKER2.hp);
  const [defHP,setDefHP]=useState(RDEFDR2.hp);
  const [showIntro,setShowIntro]=useState(true);
  const [introFading,setIntroFading]=useState(false);
  const [showBattle,setShowBattle]=useState(false);
  const [showCollision,setShowCollision]=useState(false);
  const [showBurst,setShowBurst]=useState(false);
  const [atkShake,setAtkShake]=useState(false);
  const [defShake,setDefShake]=useState(false);
  const [atkBanner,setAtkBanner]=useState(null);
  const [defBanner,setDefBanner]=useState(null);
  const timers=useRef([]);
  const T=(fn,ms)=>{const t=setTimeout(fn,ms);timers.current.push(t);};
  const clearT=()=>{timers.current.forEach(clearTimeout);timers.current=[];};

  const skipToResult=useCallback(()=>{
    clearT();
    const fA=Math.max(0,RATKER2.troops-ROUT2.atkTroopDmg),fD=Math.max(0,RDEFDR2.troops-ROUT2.defTroopDmg);
    const fAH=Math.max(0,RATKER2.hp-ROUT2.atkHPDmg),fDH=Math.max(0,RDEFDR2.hp-ROUT2.defHPDmg);
    setShowIntro(false);setIntroFading(false);setShowBattle(false);setShowCollision(false);setShowBurst(false);
    setAtkT(fA);setDefT(fD);setAtkHP(fAH);setDefHP(fDH);
    setPhaseIdx(RPH2.indexOf('result'));
    T(()=>{if(fA<=0)setAtkBanner('全滅');if(fDH<=0)setDefBanner('撃破');},300);
  },[]);

  useEffect(()=>{
    if(phase==='intro'){
      T(()=>{setIntroFading(true);T(()=>{setShowIntro(false);setIntroFading(false);setPhaseIdx(RPH2.indexOf('battle'));},380);},RDUR2.intro-380);
    } else if(phase==='battle'){
      setShowBattle(true);
      T(()=>{setShowBattle(false);setPhaseIdx(RPH2.indexOf('collision'));},RDUR2.battle);
    } else if(phase==='collision'){
      setShowCollision(true);T(()=>setShowBurst(true),100);
      T(()=>{setDefShake(true);T(()=>setDefShake(false),450);},150);
      T(()=>{setAtkShake(true);T(()=>setAtkShake(false),450);},250);
      T(()=>{setShowCollision(false);setPhaseIdx(RPH2.indexOf('resolve'));},RDUR2.collision);
    } else if(phase==='resolve'){
      setShowBurst(false);
      const steps=24,atkTF=Math.max(0,RATKER2.troops-ROUT2.atkTroopDmg),defTF=Math.max(0,RDEFDR2.troops-ROUT2.defTroopDmg);
      const atkHF=Math.max(0,RATKER2.hp-ROUT2.atkHPDmg),defHF=Math.max(0,RDEFDR2.hp-ROUT2.defHPDmg);
      Array.from({length:steps}).forEach((_,i)=>{
        T(()=>{const p=(i+1)/steps,lerp=(a,b)=>Math.round(a+(b-a)*p);
          setAtkT(lerp(RATKER2.troops,atkTF));setDefT(lerp(RDEFDR2.troops,defTF));
          setAtkHP(lerp(RATKER2.hp,atkHF));setDefHP(lerp(RDEFDR2.hp,defHF));
        },(i/steps)*RDUR2.resolve);
      });
      T(()=>setPhaseIdx(RPH2.indexOf('result')),RDUR2.resolve);
    } else if(phase==='result'){
      T(()=>{if(atkT<=0)setAtkBanner('全滅');if(defHP<=0)setDefBanner('撃破');},350);
    }
    return ()=>clearT();
  },[phase]);

  const atkLine=RATKER2.lines[phase]||RATKER2.lines.intro;
  const defLine=RDEFDR2.lines[phase]||RDEFDR2.lines.intro;

  return(
    <div onClick={()=>{if(phase!=='result')skipToResult();}}
      style={{width:'100%',height:'100%',background:RBG2,fontFamily:"'Noto Sans JP',sans-serif",color:RTX2,display:'flex',flexDirection:'column',overflow:'hidden',position:'relative',cursor:phase==='result'?'default':'pointer'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px',height:46,background:'rgba(5,5,20,.96)',borderBottom:'1px solid rgba(255,255,255,.07)',flexShrink:0,zIndex:10}}>
        <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12}}>
          <img src="assets/logo_tohoku.png" alt="" style={{height:26,objectFit:'contain'}}/>
          <span style={{color:RPK2,fontWeight:700}}>東北家</span>
          <span style={{color:RTXD2,fontSize:10}}>→</span>
          <span style={{fontWeight:600}}>{RDEFDR2.name}</span>
        </div>
        <div style={{fontFamily:'Rajdhani',fontSize:15,fontWeight:700,letterSpacing:1}}>ROUND {round} / 5 — 戦闘解決</div>
        <div style={{fontFamily:'Rajdhani',fontSize:12,color:RTXD2}}>
          <span style={{color:RAC2,fontWeight:700}}>{RDEFDR2.name}</span>
        </div>
      </div>
      <div style={{flex:1,minHeight:0,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,backgroundImage:'url(assets/bg_battle.jpg)',backgroundSize:'cover',backgroundPosition:'center 40%',filter:'brightness(.5) contrast(1.1)'}}/>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 50%,transparent 25%,rgba(0,0,0,.65) 100%)'}}/>
        {/* troop counters */}
        <div style={{position:'absolute',top:14,left:12}}>
          <div style={{fontFamily:"'Noto Sans JP'",fontSize:10,fontWeight:700,color:RTXD2,letterSpacing:1,textShadow:'0 1px 4px rgba(0,0,0,.9)'}}>部下数.</div>
          {atkBanner
            ?<div style={{fontFamily:"'Zen Maru Gothic'",fontSize:52,fontWeight:900,lineHeight:1,color:'#ff1111',textShadow:'0 0 20px #ff0000',animation:'bannerDrop .55s cubic-bezier(.16,1,.3,1) both'}}>{atkBanner}</div>
            :<div key={atkT} style={{fontFamily:'Rajdhani',fontSize:44,fontWeight:900,lineHeight:1,color:'#7fff00',textShadow:'0 0 16px rgba(80,255,0,.8)',animation:'countDrop .18s ease'}}>{atkT}</div>}
        </div>
        <div style={{position:'absolute',top:14,right:12,textAlign:'right'}}>
          <div style={{fontFamily:"'Noto Sans JP'",fontSize:10,fontWeight:700,color:RTXD2,letterSpacing:1,textShadow:'0 1px 4px rgba(0,0,0,.9)'}}>部下数.</div>
          <div key={defT} style={{fontFamily:'Rajdhani',fontSize:44,fontWeight:900,lineHeight:1,color:'#7fff00',textShadow:'0 0 16px rgba(80,255,0,.8)',animation:'countDrop .18s ease'}}>{defT}</div>
        </div>
        {showBattle&&(
          <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:20}}>
            {Array.from({length:4}).map((_,i)=>(
              <div key={i} style={{position:'absolute',top:`${12+i*18}%`,left:'9%',animation:`chibiFlyR 0.6s ${i*.07}s ease-in both`}}>
                <div style={{width:40,height:40,borderRadius:'50%',overflow:'hidden',border:`2.5px solid ${RPK2}`,boxShadow:`0 0 10px rgba(196,66,122,.75)`}}>
                  <img src={RATKER2.portrait} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top',transform:'scaleX(-1)'}}/>
                </div>
              </div>
            ))}
            {Array.from({length:5}).map((_,i)=>(
              <div key={i} style={{position:'absolute',top:`${10+i*16}%`,right:'9%',animation:`chibiFlyL 0.6s ${i*.07}s ease-in both`}}>
                <div style={{width:40,height:40,borderRadius:'50%',overflow:'hidden',border:`2.5px solid ${RAC2}`,boxShadow:`0 0 10px rgba(212,160,68,.75)`}}>
                  <img src={RDEFDR2.portrait} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top'}}/>
                </div>
              </div>
            ))}
          </div>
        )}
        {showCollision&&(
          <div style={{position:'absolute',left:'50%',top:'45%',transform:'translate(-50%,-50%)',zIndex:35,pointerEvents:'none'}}>
            <div style={{width:90,height:90,borderRadius:'50%',background:'radial-gradient(circle,rgba(255,255,255,.98) 0%,rgba(255,200,50,.85) 35%,transparent 70%)',animation:'blastExpand .55s ease-out forwards'}}/>
          </div>
        )}
        {showBurst&&(
          <div style={{position:'absolute',left:'50%',top:'42%',transform:'translate(-50%,-50%)',zIndex:40,pointerEvents:'none',width:0,height:0}}>
            <div style={{position:'absolute',whiteSpace:'nowrap',animation:'burstRight 1.1s ease forwards'}}>
              <span style={{fontFamily:'Rajdhani',fontSize:50,fontWeight:900,color:'#ff2222',textShadow:'0 0 24px #ff0000,0 2px 0 rgba(0,0,0,.9)'}}>-{ROUT2.defTroopDmg}</span>
            </div>
            <div style={{position:'absolute',whiteSpace:'nowrap',animation:'burstLeft 1.1s ease .1s forwards'}}>
              <span style={{fontFamily:'Rajdhani',fontSize:50,fontWeight:900,color:'#ff5522',textShadow:'0 0 24px #ff3300,0 2px 0 rgba(0,0,0,.9)'}}>-{ROUT2.atkTroopDmg}</span>
            </div>
          </div>
        )}
        {showIntro&&(
          <div style={{position:'absolute',inset:0,display:'flex',zIndex:30,animation:introFading?'fadeOut .4s ease forwards':'fadeIn .4s ease'}}>
            <div style={{flex:1,overflow:'hidden',position:'relative'}}>
              <img src={RATKER2.portrait} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top'}}/>
              <div style={{position:'absolute',inset:0,background:'linear-gradient(90deg,transparent 55%,rgba(0,0,0,.7))'}}/>
              <div style={{position:'absolute',bottom:10,left:10,fontFamily:"'Zen Maru Gothic'",fontSize:14,fontWeight:900,color:RATKER2.color,textShadow:'0 2px 8px rgba(0,0,0,.9)'}}>{RATKER2.name}</div>
            </div>
            <div style={{width:200,flexShrink:0,background:'rgba(0,0,0,.8)',backdropFilter:'blur(10px)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6}}>
              <div style={{fontFamily:"'Zen Maru Gothic'",fontSize:60,fontWeight:900,lineHeight:1,color:'#fff',letterSpacing:4,textShadow:'0 0 24px rgba(255,255,255,.8)',animation:'introZoom .5s cubic-bezier(.16,1,.3,1) .25s both'}}>対決！</div>
              <div style={{color:RTXD2,fontSize:12,letterSpacing:2}}>vs</div>
            </div>
            <div style={{flex:1,overflow:'hidden',position:'relative'}}>
              <img src={RDEFDR2.portrait} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top',transform:'scaleX(-1)'}}/>
              <div style={{position:'absolute',inset:0,background:'linear-gradient(270deg,transparent 55%,rgba(0,0,0,.7))'}}/>
              <div style={{position:'absolute',bottom:10,right:10,fontFamily:"'Zen Maru Gothic'",fontSize:14,fontWeight:900,color:RDEFDR2.color,textShadow:'0 2px 8px rgba(0,0,0,.9)'}}>{RDEFDR2.name}</div>
            </div>
          </div>
        )}
      </div>
      {/* char panel */}
      <div onClick={e=>e.stopPropagation()} style={{height:258,flexShrink:0,display:'flex',gap:10,background:'rgba(4,4,18,.97)',borderTop:'1px solid rgba(255,255,255,.07)',padding:'8px 12px'}}>
        {/* atk card */}
        <div style={{width:215,height:'100%',flexShrink:0,position:'relative',overflow:'hidden',borderRadius:6,border:`2px solid ${RATKER2.color}`,boxShadow:`0 0 22px ${RATKER2.glow}`,background:RBG2,animation:atkShake?'shake .4s ease':undefined}}>
          <img src={RATKER2.portrait} alt={RATKER2.name} style={{width:'100%',height:'82%',objectFit:'cover',objectPosition:'center 12%',display:'block'}}/>
          <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(0deg,rgba(0,0,0,.95),rgba(0,0,0,.7))',borderTop:`2px solid ${RATKER2.color}`,padding:'4px 8px 5px'}}>
            <div style={{fontFamily:"'Zen Maru Gothic'",fontSize:10,fontWeight:900,color:'rgba(255,255,255,.85)',marginBottom:1}}>{RATKER2.name}</div>
            <div style={{display:'flex',alignItems:'baseline',gap:3}}>
              <span style={{fontFamily:"'Noto Sans JP'",fontSize:10,fontWeight:700,color:'rgba(255,255,100,.7)'}}>HP.</span>
              <span style={{fontFamily:'Rajdhani',fontSize:36,fontWeight:900,lineHeight:1,color:'#ffff00',textShadow:'0 0 16px #ffff00,0 2px 0 rgba(0,0,0,1)'}}>{atkHP}</span>
            </div>
          </div>
        </div>
        {/* center */}
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:7,padding:'0 10px'}}>
          <div style={{fontSize:10,color:RTXD2,background:'rgba(255,255,255,.04)',borderRadius:3,padding:'2px 10px',border:'1px solid rgba(255,255,255,.07)',letterSpacing:1}}>
            {phase==='intro'?'戦闘開始':phase==='battle'?'攻撃中…':phase==='collision'?'衝突！':phase==='resolve'?'戦闘解決中…':'戦闘終了'}
          </div>
          <div style={{width:'100%',background:'rgba(196,66,122,.07)',borderRadius:4,padding:'5px 9px',border:'1px solid rgba(196,66,122,.2)'}}>
            <span style={{fontSize:9,color:RPK2,fontWeight:700}}>{RATKER2.name}</span>
            <div style={{fontSize:12,color:RTX2,marginTop:1,lineHeight:1.4}}>{atkLine}</div>
          </div>
          <div style={{width:'100%',background:'rgba(212,160,68,.07)',borderRadius:4,padding:'5px 9px',border:'1px solid rgba(212,160,68,.2)'}}>
            <span style={{fontSize:9,color:RAC2,fontWeight:700}}>{RDEFDR2.name}</span>
            <div style={{fontSize:12,color:RTX2,marginTop:1,lineHeight:1.4}}>{defLine}</div>
          </div>
          {phase==='result'&&(
            <button onClick={e=>{e.stopPropagation();onComplete();}}
              style={{marginTop:4,padding:'10px 32px',borderRadius:6,border:`2px solid ${RPK2}`,background:RPK2,color:'#fff',cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:"'Noto Sans JP',sans-serif",boxShadow:'0 0 24px rgba(196,66,122,.5)',letterSpacing:.5}}>
              マップに戻る →
            </button>
          )}
          {phase!=='result'&&<div style={{fontSize:9,color:RTXD2,marginTop:4,animation:'pulse 1.5s infinite'}}>クリックでスキップ</div>}
        </div>
        {/* def card */}
        <div style={{width:215,height:'100%',flexShrink:0,position:'relative',overflow:'hidden',borderRadius:6,border:`2px solid ${RDEFDR2.color}`,boxShadow:`0 0 22px ${RDEFDR2.glow}`,background:RBG2,animation:defShake?'shake .4s ease':undefined}}>
          <img src={RDEFDR2.portrait} alt={RDEFDR2.name} style={{width:'100%',height:'82%',objectFit:'cover',objectPosition:'center 12%',display:'block',transform:'scaleX(-1)'}}/>
          <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(0deg,rgba(0,0,0,.95),rgba(0,0,0,.7))',borderTop:`2px solid ${RDEFDR2.color}`,padding:'4px 8px 5px'}}>
            <div style={{fontFamily:"'Zen Maru Gothic'",fontSize:10,fontWeight:900,color:'rgba(255,255,255,.85)',marginBottom:1}}>{RDEFDR2.name}</div>
            <div style={{display:'flex',alignItems:'baseline',gap:3}}>
              <span style={{fontFamily:"'Noto Sans JP'",fontSize:10,fontWeight:700,color:'rgba(255,255,100,.7)'}}>HP.</span>
              <span style={{fontFamily:'Rajdhani',fontSize:36,fontWeight:900,lineHeight:1,color:'#ffff00',textShadow:'0 0 16px #ffff00,0 2px 0 rgba(0,0,0,1)'}}>{defHP}</span>
            </div>
          </div>
          {defBanner&&(
            <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.55)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <div style={{fontFamily:"'Zen Maru Gothic'",fontSize:54,fontWeight:900,color:'#ffaa00',letterSpacing:4,textShadow:'0 0 24px #ffa000',animation:'bannerDrop .6s cubic-bezier(.16,1,.3,1) both'}}>{defBanner}</div>
            </div>
          )}
        </div>
      </div>
      <div style={{height:32,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 14px',background:'rgba(5,5,20,.98)',borderTop:'1px solid rgba(255,255,255,.06)',fontSize:10,color:RTXD2}}>
        <span>ターン <b style={{color:RTX2,fontFamily:'Rajdhani',fontSize:12}}>1</b>　ミーム <b style={{color:RPK2,fontFamily:'Rajdhani',fontSize:12}}>500</b></span>
        <span style={{color:phase==='result'?'#7fff00':RTXD2,animation:phase!=='result'?'pulse 1.5s infinite':undefined}}>
          {phase==='result'?'戦闘終了 — 「マップに戻る」を押してください':'戦闘アニメーション再生中…'}
        </span>
        <span style={{opacity:.4,fontSize:9}}>{phase!=='result'?'クリックでスキップ':''}</span>
      </div>
    </div>
  );
}

// Battle Curtain
function BCurtain({stage, label, toResolve}){
  if(stage==='idle') return null;
  const closing=stage==='closing', closed=stage==='closed', opening=stage==='opening';
  return(
    <div style={{
      position:'absolute',inset:0,zIndex:9999,
      background:toResolve?'linear-gradient(150deg,#0a0816,#1a0828)':'linear-gradient(150deg,#fff8f0,#ffe8d0)',
      display:'flex',alignItems:'center',justifyContent:'center',
      animation:closing?'curtainIn .42s cubic-bezier(.4,0,.2,1) forwards':opening?'curtainOut .42s cubic-bezier(.4,0,.2,1) forwards':'none',
      opacity:closed?1:undefined,
    }}>
      {[0,1,2,3].map(i=>(
        <div key={i} style={{position:'absolute',top:`${15+i*22}%`,left:'-5%',right:'-5%',height:'1px',background:`linear-gradient(90deg,transparent,${toResolve?'rgba(196,66,122,.3)':'rgba(184,112,16,.25)'},transparent)`,transform:`rotate(${-2+i*.8}deg)`}}/>
      ))}
      {(closed||opening)&&(
        <div style={{textAlign:'center',animation:closed?'labelPop .5s .05s cubic-bezier(.16,1,.3,1) both':'none'}}>
          <div style={{fontFamily:"'Zen Maru Gothic',sans-serif",fontSize:56,fontWeight:900,letterSpacing:8,color:toResolve?'#fff':'#1c1020',textShadow:toResolve?'0 0 40px rgba(196,66,122,.9),0 0 80px rgba(196,66,122,.4)':'0 0 30px rgba(184,112,16,.5)',lineHeight:1}}>{label}</div>
          <div style={{marginTop:10,fontSize:11,letterSpacing:4,color:toResolve?'rgba(255,255,255,.4)':'rgba(28,16,32,.35)',fontFamily:'Rajdhani',fontWeight:600}}>
            {toResolve?'— BATTLE RESOLUTION —':'— ACTION SELECTION —'}
          </div>
        </div>
      )}
    </div>
  );
}

// BattleFlow — wraps ActionScene + ResolveScene with curtain
function BattleFlow({ formation, targetNode, onComplete }) {
  const [scene, setBScene] = useState('action');
  const [round, setRound] = useState(1);
  const [curtain, setCurtain] = useState('idle');
  const [curtainLabel, setCurtainLabel] = useState('');
  const [toResolve, setToResolve] = useState(true);
  const [actionKey, setActionKey] = useState(0);
  const [resolveKey, setResolveKey] = useState(0);

  const transition = (nextScene, label, isToResolve) => {
    setToResolve(isToResolve);
    setCurtainLabel(label);
    setCurtain('closing');
    setTimeout(()=>{
      setCurtain('closed');
      setBScene(nextScene);
      if(nextScene==='resolve') setResolveKey(k=>k+1);
      else { setRound(r=>Math.min(r+1,5)); setActionKey(k=>k+1); }
      setTimeout(()=>{
        setCurtain('opening');
        setTimeout(()=>setCurtain('idle'),460);
      },640);
    },450);
  };

  return (
    <div className="scene-enter" style={{width:'100%', height:'100%', position:'relative', overflow:'hidden'}}>
      <div style={{position:'absolute',inset:0,opacity:scene==='action'?1:0,pointerEvents:scene==='action'?'all':'none',transition:'opacity .05s'}}>
        <BActionScene key={actionKey} round={round} formation={formation} targetNode={targetNode}
          onComplete={()=>transition('resolve','戦闘解決',true)}/>
      </div>
      <div style={{position:'absolute',inset:0,opacity:scene==='resolve'?1:0,pointerEvents:scene==='resolve'?'all':'none',transition:'opacity .05s'}}>
        <BResolveScene key={resolveKey} round={round} formation={formation} targetNode={targetNode}
          onComplete={onComplete}/>
      </div>
      <BCurtain stage={curtain} label={curtainLabel} toResolve={toResolve}/>
    </div>
  );
}

Object.assign(window, { BattleFlow });