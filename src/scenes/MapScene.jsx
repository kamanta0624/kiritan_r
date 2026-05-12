import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass, GAME_STATE, ROLES, CHARS } from '../shared/tokens.js';
import { TopBar } from '../shared/SharedUI.jsx';

// ── Map constants ──────────────────────────────────────────
const MAP_W = 2800, MAP_H = 1600, BOUNDARY_X = 1400;

const OWN = {
  player:  {c:TEAL,      fill:'rgba(26,138,150,.18)',  label:'自拠点'},
  enemy:   {c:PK,        fill:'rgba(196,66,122,.18)',  label:'敵拠点'},
  ally:    {c:'#2a9a58', fill:'rgba(42,154,88,.18)',   label:'友軍'},
  neutral: {c:'#8a8e96', fill:'rgba(138,142,150,.18)', label:'中立'},
};

const NODES = [
  {id:'n1', name:'仙台',     px:1900, py:680,  type:'city',    owner:'player', troops:600, income:200, canAttack:false},
  {id:'n2', name:'福島',     px:2060, py:890,  type:'town',    owner:'enemy',  troops:150, income:76,  canAttack:true},
  {id:'n3', name:'郡山',     px:2280, py:620,  type:'town',    owner:'enemy',  troops:200, income:90,  canAttack:true},
  {id:'n4', name:'会津若松', px:1700, py:480,  type:'village', owner:'ally',   troops:100, income:60},
  {id:'n5', name:'白河',     px:2400, py:990,  type:'fort',    owner:'enemy',  troops:180, income:80},
  {id:'n6', name:'いわき',   px:2570, py:660,  type:'fort',    owner:'enemy',  troops:220, income:100},
  {id:'n7', name:'山形',     px:1640, py:340,  type:'village', owner:'ally',   troops:80,  income:70},
  {id:'n8', name:'宇都宮',   px:2500, py:1140, type:'city',    owner:'enemy',  troops:300, income:110},
  {id:'n9',  name:'札幌',   px:680,  py:700,  type:'city',    owner:'enemy',  troops:500, income:180},
  {id:'n10', name:'函館',   px:880,  py:1080, type:'town',    owner:'enemy',  troops:160, income:80},
  {id:'n11', name:'旭川',   px:520,  py:400,  type:'village', owner:'neutral',troops:60,  income:50},
  {id:'n12', name:'帯広',   px:980,  py:580,  type:'fort',    owner:'enemy',  troops:140, income:70},
  {id:'n13', name:'釧路',   px:1180, py:790,  type:'village', owner:'enemy',  troops:100, income:60},
];
const EDGES = [
  ['n1','n2'],['n1','n4'],['n2','n3'],['n2','n5'],['n3','n6'],
  ['n4','n7'],['n5','n8'],['n3','n5'],['n1','n7'],['n1','n3'],
  ['n9','n10'],['n9','n11'],['n9','n12'],['n10','n13'],['n12','n13'],['n11','n12'],
];

// ── Background SVGs ────────────────────────────────────────
function TohokuBg({w, h}) {
  return (
    <svg width={w} height={h} style={{display:'block'}}>
      <defs>
        <linearGradient id="tBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c4d9c0"/>
          <stop offset="60%" stopColor="#b2c9b8"/>
          <stop offset="100%" stopColor="#a8bfc0"/>
        </linearGradient>
        <radialGradient id="tVig" cx="50%" cy="50%" r="70%">
          <stop offset="20%" stopColor="transparent"/>
          <stop offset="100%" stopColor="rgba(80,110,95,.5)"/>
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill="url(#tBg)"/>
      <ellipse cx={w*.22} cy={h*.38} rx={w*.18} ry={h*.22} fill="rgba(145,180,130,.5)"/>
      <ellipse cx={w*.55} cy={h*.3}  rx={w*.2}  ry={h*.18} fill="rgba(150,185,135,.45)"/>
      <ellipse cx={w*.7}  cy={h*.65} rx={w*.15} ry={h*.2}  fill="rgba(140,175,125,.4)"/>
      <ellipse cx={w*.35} cy={h*.7}  rx={w*.18} ry={h*.16} fill="rgba(148,183,133,.42)"/>
      <ellipse cx={w*.22} cy={h*.38} rx={w*.14} ry={h*.17} fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="1"/>
      <ellipse cx={w*.55} cy={h*.3}  rx={w*.15} ry={h*.13} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="1"/>
      <path d={`M${w*.28},${h*.12} Q${w*.26},${h*.4} ${w*.3},${h*.75}`} fill="none" stroke="rgba(100,155,195,.6)" strokeWidth="2.5"/>
      <path d={`M${w*.58},${h*.35} Q${w*.56},${h*.55} ${w*.6},${h*.72}`} fill="none" stroke="rgba(100,155,195,.45)" strokeWidth="1.8"/>
      {Array.from({length:10}).map((_,i)=>(
        <line key={`gh${i}`} x1={0} y1={(i+1)*h/10} x2={w} y2={(i+1)*h/10} stroke="rgba(255,255,255,.1)" strokeWidth=".5"/>
      ))}
      {Array.from({length:14}).map((_,i)=>(
        <line key={`gv${i}`} x1={(i+1)*w/14} y1={0} x2={(i+1)*w/14} y2={h} stroke="rgba(255,255,255,.1)" strokeWidth=".5"/>
      ))}
      <rect width={w} height={h} fill="url(#tVig)" opacity=".35"/>
    </svg>
  );
}

function HokkaidoBg({w, h}) {
  return (
    <svg width={w} height={h} style={{display:'block'}}>
      <defs>
        <linearGradient id="hBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#cddde8"/>
          <stop offset="60%" stopColor="#bfd0e0"/>
          <stop offset="100%" stopColor="#b8ccd8"/>
        </linearGradient>
        <radialGradient id="hVig" cx="50%" cy="50%" r="70%">
          <stop offset="20%" stopColor="transparent"/>
          <stop offset="100%" stopColor="rgba(70,100,130,.45)"/>
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill="url(#hBg)"/>
      <ellipse cx={w*.3}  cy={h*.4}  rx={w*.2}  ry={h*.24} fill="rgba(200,215,205,.6)"/>
      <ellipse cx={w*.65} cy={h*.35} rx={w*.18} ry={h*.2}  fill="rgba(205,220,210,.55)"/>
      <ellipse cx={w*.5}  cy={h*.72} rx={w*.22} ry={h*.18} fill="rgba(198,214,203,.5)"/>
      <ellipse cx={w*.15} cy={h*.6}  rx={w*.12} ry={h*.16} fill="rgba(202,218,207,.45)"/>
      <ellipse cx={w*.3}  cy={h*.4}  rx={w*.1}  ry={h*.1}  fill="rgba(240,245,240,.3)"/>
      <ellipse cx={w*.65} cy={h*.35} rx={w*.08} ry={h*.09} fill="rgba(240,245,242,.25)"/>
      <path d={`M${w*.42},${h*.1} Q${w*.4},${h*.35} ${w*.38},${h*.65}`} fill="none" stroke="rgba(130,175,210,.65)" strokeWidth="2.5"/>
      <path d={`M${w*.72},${h*.28} Q${w*.7},${h*.5} ${w*.68},${h*.7}`}  fill="none" stroke="rgba(130,175,210,.5)"  strokeWidth="1.8"/>
      <ellipse cx={w*.88} cy={h*.15} rx={w*.15} ry={h*.14} fill="rgba(170,195,218,.35)"/>
      {Array.from({length:10}).map((_,i)=>(
        <line key={`gh${i}`} x1={0} y1={(i+1)*h/10} x2={w} y2={(i+1)*h/10} stroke="rgba(255,255,255,.12)" strokeWidth=".5"/>
      ))}
      {Array.from({length:14}).map((_,i)=>(
        <line key={`gv${i}`} x1={(i+1)*w/14} y1={0} x2={(i+1)*w/14} y2={h} stroke="rgba(255,255,255,.12)" strokeWidth=".5"/>
      ))}
      <rect width={w} height={h} fill="url(#hVig)" opacity=".35"/>
    </svg>
  );
}

// ── Node shape ─────────────────────────────────────────────
function NodeShape({type, color, selected, canAttack}) {
  const shadow = 'rgba(0,0,0,.25)';
  switch(type) {
    case 'city': return (
      <g>
        <filter id="cityGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <path d="M-13,4 L-13,-5 L-9,-5 L-9,-11 L-5,-11 L-5,-5 L-1,-5 L-1,-11 L3,-11 L3,-5 L7,-5 L7,-11 L11,-11 L11,-5 L14,-5 L14,10 L-13,10 Z" fill={shadow} transform="translate(1,2)"/>
        <path d="M-13,4 L-13,-5 L-9,-5 L-9,-11 L-5,-11 L-5,-5 L-1,-5 L-1,-11 L3,-11 L3,-5 L7,-5 L7,-11 L11,-11 L11,-5 L14,-5 L14,10 L-13,10 Z"
          fill="rgba(255,255,255,.9)" stroke={color} strokeWidth={selected?2.5:1.8} filter={canAttack?"url(#cityGlow)":undefined}/>
        <path d="M-13,4 L-13,-5 L-9,-5 L-9,-11 L-5,-11 L-5,-5 L-1,-5 L-1,-11 L3,-11 L3,-5 L7,-5 L7,-11 L11,-11 L11,-5 L14,-5 L14,10 L-13,10 Z" fill={color} opacity=".18"/>
        <rect x={-3} y={3} width={7} height={7} rx={1} fill={color} opacity=".5"/>
        <circle cx={0.5} cy={-1} r={3} fill={color} opacity=".7"/>
      </g>
    );
    case 'town': return (
      <g>
        <path d="M0,-12 L11,0 L11,9 L-11,9 L-11,0 Z" fill={shadow} transform="translate(1,2)"/>
        <path d="M0,-12 L11,0 L11,9 L-11,9 L-11,0 Z" fill="rgba(255,255,255,.9)" stroke={color} strokeWidth={selected?2.5:1.8}/>
        <path d="M0,-12 L11,0 L11,9 L-11,9 L-11,0 Z" fill={color} opacity=".18"/>
        <rect x={-4} y={1} width={4} height={5} rx={1} fill={color} opacity=".5"/>
        <rect x={2}  y={1} width={4} height={5} rx={1} fill={color} opacity=".5"/>
        <line x1={0} y1={-12} x2={0} y2={0} stroke={color} strokeWidth={1} opacity=".5"/>
      </g>
    );
    case 'village': return (
      <g>
        <circle cx={1} cy={2} r={9} fill={shadow}/>
        <circle cx={0} cy={0} r={9} fill="rgba(255,255,255,.9)" stroke={color} strokeWidth={selected?2.5:1.8}/>
        <circle cx={0} cy={0} r={9} fill={color} opacity=".18"/>
        <line x1={0} y1={-5} x2={0} y2={5} stroke={color} strokeWidth={1.5} opacity=".7"/>
        <line x1={-5} y1={0} x2={5} y2={0} stroke={color} strokeWidth={1.5} opacity=".7"/>
      </g>
    );
    case 'fort': return (
      <g>
        <path d="M0,-12 L10,0 L0,12 L-10,0 Z" fill={shadow} transform="translate(1,2)"/>
        <path d="M0,-12 L10,0 L0,12 L-10,0 Z" fill="rgba(255,255,255,.9)" stroke={color} strokeWidth={selected?2.5:1.8}/>
        <path d="M0,-12 L10,0 L0,12 L-10,0 Z" fill={color} opacity=".18"/>
        <path d="M0,-6 L5,0 L0,6 L-5,0 Z" fill={color} opacity=".35"/>
        <circle cx={0} cy={-12} r={2} fill={color} opacity=".6"/>
        <circle cx={10} cy={0} r={2} fill={color} opacity=".6"/>
        <circle cx={0} cy={12} r={2} fill={color} opacity=".6"/>
        <circle cx={-10} cy={0} r={2} fill={color} opacity=".6"/>
      </g>
    );
    default: return <circle r={9} fill={color}/>;
  }
}

// ── Map SVG ────────────────────────────────────────────────
function MapLayer({selNode, onNodeClick}) {
  return (
    <svg width={MAP_W} height={MAP_H}
      style={{position:'absolute', top:0, left:0, overflow:'visible', display:'block'}}>
      <line x1={BOUNDARY_X} y1={0} x2={BOUNDARY_X} y2={MAP_H}
        stroke="rgba(255,255,255,.2)" strokeWidth="2" strokeDasharray="8 10"/>
      {EDGES.map(([a,b],i)=>{
        const na=NODES.find(n=>n.id===a), nb=NODES.find(n=>n.id===b);
        if(!na||!nb) return null;
        return (
          <g key={i}>
            <line x1={na.px} y1={na.py} x2={nb.px} y2={nb.py} stroke="rgba(255,255,255,.5)" strokeWidth="2.5"/>
            <line x1={na.px} y1={na.py} x2={nb.px} y2={nb.py} stroke="rgba(0,0,0,.1)" strokeWidth="1.2"/>
          </g>
        );
      })}
      {NODES.map(n=>{
        const ow=OWN[n.owner]||OWN.neutral, sel=selNode?.id===n.id;
        return (
          <g key={n.id} transform={`translate(${n.px},${n.py})`}
            style={{cursor:'pointer'}} onClick={()=>onNodeClick(n)}>
            {sel && <circle r={22} fill={ow.fill} stroke={ow.c} strokeWidth="1.5" opacity=".8"/>}
            {n.canAttack && !sel && (
              <circle r={20} fill="none" stroke={PK} strokeWidth="1.5" opacity=".6"
                style={{animation:'pulse 1.3s ease-in-out infinite'}}/>
            )}
            <NodeShape type={n.type} color={ow.c} selected={sel} canAttack={n.canAttack}/>
            <g transform="translate(0,20)">
              <rect x={-30} y={-1} width={60} height={16} rx={4}
                fill="rgba(255,253,251,.9)" stroke={ow.c} strokeWidth=".8"/>
              <text x={0} y={11} textAnchor="middle"
                style={{fontSize:9, fontFamily:'Noto Sans JP',
                  fontWeight:sel||n.canAttack?700:500,
                  fill:n.canAttack?PK:TX}}>
                {n.name}
              </text>
            </g>
            <g transform="translate(16,-16)">
              <rect x={-10} y={-7} width={20} height={12} rx={3} fill={ow.c}/>
              <text x={0} y={2} textAnchor="middle"
                style={{fontSize:7, fontFamily:'Noto Sans JP', fontWeight:700, fill:'#fff'}}>
                {n.type==='city'?'都市':n.type==='town'?'街':n.type==='village'?'村':'砦'}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

// ── Area name overlay ──────────────────────────────────────
function AreaNameOverlay({areaName, triggerKey}) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);
  useEffect(()=>{
    if(!areaName) return;
    setVisible(true);
    if(timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(()=>setVisible(false), 2400);
    return()=>clearTimeout(timerRef.current);
  },[triggerKey]);
  if(!visible || !areaName) return null;
  const isHokkaido = areaName==='北海道';
  return (
    <div style={{position:'absolute', top:24, right:24, pointerEvents:'none', zIndex:30,
      display:'flex', flexDirection:'column', alignItems:'flex-end',
      animation:'areaNameShow 2.4s ease forwards'}}>
      <div style={{width:40, height:1.5, background:isHokkaido?'rgba(180,205,228,.9)':'rgba(160,195,155,.9)', marginBottom:6}}/>
      <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:36, fontWeight:900,
        letterSpacing:'.18em', color:'rgba(255,255,255,.95)',
        textShadow:'0 2px 20px rgba(0,0,0,.5), 0 0 40px rgba(0,0,0,.3)', lineHeight:1}}>
        {areaName}
      </div>
      <div style={{fontFamily:'Rajdhani', fontSize:12, fontWeight:600, letterSpacing:'.28em',
        color:'rgba(255,255,255,.65)', textTransform:'uppercase', marginTop:4}}>
        {isHokkaido?'HOKKAIDO':'TOHOKU'}
      </div>
      <div style={{width:40, height:1.5, background:isHokkaido?'rgba(180,205,228,.9)':'rgba(160,195,155,.9)', marginTop:6}}/>
    </div>
  );
}

// ── Node popup ─────────────────────────────────────────────
function NodePopup({node, onClose, onAttack}) {
  const ow = OWN[node.owner] || OWN.neutral;
  const typeLabel = {city:'都市',town:'街',village:'村',fort:'砦'}[node.type]||node.type;
  return (
    <div className="pop-in" style={{
      ...glass({borderRadius:10, padding:'13px 14px 12px',
        border:`1.5px solid ${ow.c}66`,
        boxShadow:`0 0 0 1px ${ow.c}22, 0 6px 28px rgba(0,0,0,.2)`,
        minWidth:195}),
      position:'relative',
    }}>
      <button onClick={onClose} style={{position:'absolute', top:8, right:8,
        background:'transparent', border:'none', color:TXD, cursor:'pointer', fontSize:14, lineHeight:1}}>✕</button>
      <div style={{display:'flex', alignItems:'center', gap:7, marginBottom:10}}>
        <div style={{width:9, height:9, borderRadius:'50%', background:ow.c, flexShrink:0}}/>
        <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:16, fontWeight:900, color:TX}}>{node.name}</div>
        <span style={{marginLeft:'auto', fontSize:8, padding:'2px 6px', borderRadius:10, fontWeight:700,
          background:`${ow.c}22`, color:ow.c, border:`1px solid ${ow.c}44`}}>{typeLabel}</span>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:5,
        marginBottom:node.canAttack?10:0}}>
        {[
          ['収入', `${node.income} M/T`, AC2],
          ['防御部隊', `${fmtN(node.troops)} 兵`, TXD],
          ['勢力', ow.label, ow.c],
          ['種別', typeLabel, TX],
        ].map(([k,v,c])=>(
          <div key={k} style={{background:'rgba(0,0,0,.04)', borderRadius:6, padding:'5px 7px'}}>
            <div style={{fontSize:8, color:TXD, marginBottom:1}}>{k}</div>
            <div style={{fontFamily:'Rajdhani', fontSize:12, fontWeight:700, color:c||TX}}>{v}</div>
          </div>
        ))}
      </div>
      {node.canAttack && (
        <button
          onClick={() => { onClose(); onAttack(node); }}
          style={{
            width:'100%', padding:'9px', borderRadius:7, marginTop:10,
            background:`linear-gradient(135deg,${PK},${PK2})`,
            border:'none', color:'#fff', cursor:'pointer',
            fontFamily:"'Noto Sans JP'", fontSize:12, fontWeight:700,
            boxShadow:`0 3px 14px rgba(196,66,122,.45)`,
          }}>⚔ 攻撃する</button>
      )}
    </div>
  );
}

// ── Mini-map ───────────────────────────────────────────────
function MiniMap({offsetX, offsetY, vpW, vpH}) {
  const mmW=140, mmH=80;
  const scaleX=mmW/MAP_W, scaleY=mmH/MAP_H;
  return (
    <div style={{...glass({borderRadius:8, padding:0, border:'1px solid rgba(255,255,255,.7)',
      overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,.2)'}),
      position:'absolute', bottom:16, right:16, zIndex:20}}>
      <svg width={mmW} height={mmH}>
        <rect x={0}     y={0} width={mmW/2} height={mmH} fill="rgba(190,210,225,.6)"/>
        <rect x={mmW/2} y={0} width={mmW/2} height={mmH} fill="rgba(175,200,170,.6)"/>
        <line x1={mmW/2} y1={0} x2={mmW/2} y2={mmH} stroke="rgba(255,255,255,.4)" strokeWidth="1"/>
        {NODES.map(n=>{
          const ow=OWN[n.owner]||OWN.neutral;
          return <circle key={n.id} cx={n.px*scaleX} cy={n.py*scaleY} r={2.5} fill={ow.c} opacity=".8"/>;
        })}
        <rect x={offsetX*scaleX} y={offsetY*scaleY}
          width={vpW*scaleX} height={vpH*scaleY}
          fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.7)" strokeWidth="1.2" rx={1}/>
      </svg>
      <div style={{position:'absolute', top:4, left:6,
        fontSize:7, fontFamily:'Rajdhani', fontWeight:600, color:'rgba(255,255,255,.8)',
        textShadow:'0 1px 4px rgba(0,0,0,.5)', letterSpacing:'.1em'}}>MINIMAP</div>
    </div>
  );
}

// ── Legend ─────────────────────────────────────────────────
function Legend() {
  return (
    <div style={{...glass({borderRadius:8, padding:'8px 10px', boxShadow:'0 2px 12px rgba(0,0,0,.15)'}),
      position:'absolute', top:16, left:16, zIndex:20, minWidth:110}}>
      <div style={{fontSize:8, fontFamily:'Rajdhani', fontWeight:700, color:TXD, letterSpacing:'.12em', marginBottom:6}}>LEGEND</div>
      {[{color:TEAL,label:'自拠点'},{color:PK,label:'敵拠点'},{color:'#2a9a58',label:'友軍'},{color:'#8a8e96',label:'中立'}].map(f=>(
        <div key={f.label} style={{display:'flex', alignItems:'center', gap:5, marginBottom:3}}>
          <div style={{width:8, height:8, borderRadius:'50%', background:f.color, flexShrink:0}}/>
          <span style={{fontSize:9, color:TX}}>{f.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Map Scene ──────────────────────────────────────────────
export default function MapScene({ onNavigate, onAttackNode }) {
  const vpRef = useRef(null);
  const [vpSize, setVpSize] = useState({w: window.innerWidth, h: window.innerHeight - 104});
  const initOffsetX = Math.max(0, Math.min(1900 - window.innerWidth/2, MAP_W - window.innerWidth));
  const initOffsetY = Math.max(0, Math.min(680  - (window.innerHeight-104)/2, MAP_H - (window.innerHeight-104)));
  const [offset, setOffset] = useState({x: initOffsetX, y: initOffsetY});
  const dragRef = useRef(null);

  const currentArea = (offset.x + vpSize.w/2) < BOUNDARY_X ? 'hokkaido' : 'tohoku';
  const AREA_NAMES = {hokkaido:'北海道', tohoku:'東北'};
  const [areaNameInfo, setAreaNameInfo] = useState({name:AREA_NAMES[currentArea], key:0});
  const prevAreaRef = useRef(currentArea);

  useEffect(()=>{
    if(prevAreaRef.current !== currentArea){
      prevAreaRef.current = currentArea;
      setAreaNameInfo(p=>({name:AREA_NAMES[currentArea], key:p.key+1}));
    }
  },[currentArea]);

  useEffect(()=>{
    const resize=()=>setVpSize({w:window.innerWidth, h:window.innerHeight-104});
    window.addEventListener('resize', resize);
    return()=>window.removeEventListener('resize', resize);
  },[]);

  const clamp = useCallback((ox,oy)=>({
    x:Math.max(0,Math.min(ox,MAP_W-vpSize.w)),
    y:Math.max(0,Math.min(oy,MAP_H-vpSize.h)),
  }),[vpSize]);

  const onPointerDown = useCallback(e=>{
    e.preventDefault();
    const cx=e.touches?e.touches[0].clientX:e.clientX;
    const cy=e.touches?e.touches[0].clientY:e.clientY;
    dragRef.current={startX:cx, startY:cy, offsetX:offset.x, offsetY:offset.y, moved:false};
  },[offset]);

  const onPointerMove = useCallback(e=>{
    if(!dragRef.current) return;
    const cx=e.touches?e.touches[0].clientX:e.clientX;
    const cy=e.touches?e.touches[0].clientY:e.clientY;
    const dx=cx-dragRef.current.startX, dy=cy-dragRef.current.startY;
    if(Math.abs(dx)>3||Math.abs(dy)>3) dragRef.current.moved=true;
    setOffset(clamp(dragRef.current.offsetX-dx, dragRef.current.offsetY-dy));
  },[clamp]);

  const onPointerUp = useCallback(()=>{ dragRef.current=null; },[]);

  const [selNode, setSelNode] = useState(null);
  const handleNodeClick = useCallback(n=>{
    if(dragRef.current?.moved) return;
    setSelNode(prev=>prev?.id===n.id?null:n);
  },[]);

  const getPopupPos = useCallback((n)=>{
    const sx=n.px-offset.x, sy=n.py-offset.y;
    const popW=210, popH=220;
    let left=sx+24, top=Math.max(8,Math.min(sy-40,vpSize.h-popH-8));
    if(left+popW>vpSize.w-8) left=sx-popW-24;
    return {left, top};
  },[offset, vpSize]);

  const tohokuOpacity  = currentArea==='tohoku'  ? 1 : 0;
  const hokkaidoOpacity = currentArea==='hokkaido' ? 1 : 0;

  return (
    <div className="scene-enter" style={{width:'100vw', height:'100vh',
      fontFamily:"'Noto Sans JP',sans-serif", color:TX,
      position:'relative', overflow:'hidden'}}>

      {/* TOP BAR */}
      <TopBar scene="map" currentArea={currentArea}
        rightSlot={
          <div style={{
            padding:'4px 12px', borderRadius:20,
            background:currentArea==='tohoku'?'rgba(160,195,155,.25)':'rgba(180,205,225,.25)',
            border:`1px solid ${currentArea==='tohoku'?'rgba(145,185,135,.5)':'rgba(160,190,215,.5)'}`,
            display:'flex', alignItems:'center', gap:6,
            transition:'background .6s, border-color .6s',
          }}>
            <div style={{width:6, height:6, borderRadius:'50%',
              background:currentArea==='tohoku'?'#2a9a58':'#4488bb',
              transition:'background .6s'}}/>
            <span style={{fontFamily:"'Zen Maru Gothic'", fontSize:11, fontWeight:900, color:TX}}>
              {AREA_NAMES[currentArea]}
            </span>
          </div>
        }
      />

      {/* MAP VIEWPORT */}
      <div
        ref={vpRef}
        onMouseDown={onPointerDown} onMouseMove={onPointerMove}
        onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
        style={{position:'absolute', top:52, left:0, right:0, bottom:52,
          overflow:'hidden', cursor:'grab', userSelect:'none'}}>

        {/* Backgrounds */}
        <div style={{position:'absolute', inset:0, zIndex:0}}>
          <div style={{position:'absolute', inset:0, opacity:tohokuOpacity, transition:'opacity .9s ease', pointerEvents:'none'}}>
            <TohokuBg w={vpSize.w} h={vpSize.h}/>
          </div>
          <div style={{position:'absolute', inset:0, opacity:hokkaidoOpacity, transition:'opacity .9s ease', pointerEvents:'none'}}>
            <HokkaidoBg w={vpSize.w} h={vpSize.h}/>
          </div>
        </div>

        {/* Draggable map */}
        <div style={{position:'absolute',
          transform:`translate(${-offset.x}px,${-offset.y}px)`,
          width:MAP_W, height:MAP_H, zIndex:1}}>
          <MapLayer selNode={selNode} onNodeClick={handleNodeClick}/>
        </div>

        <AreaNameOverlay areaName={areaNameInfo.name} triggerKey={areaNameInfo.key}/>

        {/* Node popup */}
        {selNode && (()=>{
          const pos = getPopupPos(selNode);
          return (
            <div style={{position:'absolute', zIndex:20, ...pos}}>
              <NodePopup
                node={selNode}
                onClose={()=>setSelNode(null)}
                onAttack={(node)=>{ onAttackNode(node); }}
              />
            </div>
          );
        })()}

        <MiniMap offsetX={offset.x} offsetY={offset.y} vpW={vpSize.w} vpH={vpSize.h}/>
        <Legend/>

        {/* boundary glow */}
        {(()=>{
          const bx = BOUNDARY_X - offset.x;
          if(bx < -40 || bx > vpSize.w + 40) return null;
          return (
            <div style={{position:'absolute', left:bx-20, top:0, bottom:0, width:40,
              background:'linear-gradient(to right,transparent,rgba(255,255,255,.15),transparent)',
              pointerEvents:'none', zIndex:2}}/>
          );
        })()}
      </div>

      {/* BOTTOM BAR */}
      <BottomBar scene="map" onNavigate={onNavigate}/>
    </div>
  );
}

Object.assign(window, { MapScene });