import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PK, PK2, AC, AC2, TX, TXD, TXF, BR, glass } from '../shared/tokens.js';
import { TopBar, BottomBar } from '../shared/SharedUI.jsx';

// ── Map constants ──────────────────────────────────────────
const MAP_W = 4200, MAP_H = 3200, BOUNDARY_X = 2400;

const AREA_META = {
  tohoku:     { name:'東北',   en:'TOHOKU' },
  hokkaido:   { name:'北海道', en:'HOKKAIDO' },
  kanto:      { name:'関東',   en:'KANTO' },
  koshinetsu: { name:'甲信越', en:'KOSHINETSU' },
  kansai:     { name:'関西',   en:'KANSAI' },
  chushikoku: { name:'中四国', en:'CHUSHIKOKU' },
  kyushu:     { name:'九州',   en:'KYUSHU' },
  okinawa:    { name:'沖縄',   en:'OKINAWA' },
};

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function fmtN(n){ return n >= 1000 ? n.toLocaleString() : String(n); }

function deriveType(b) {
  if (b.isCapital) return 'city';
  if (b.income >= 80) return 'town';
  if (b.battleCapacity >= 600) return 'fort';
  return 'village';
}

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
function MapLayer({selNode, onNodeClick, nodes=[], edges=[]}) {
  return (
    <svg width={MAP_W} height={MAP_H}
      style={{position:'absolute', top:0, left:0, overflow:'visible', display:'block'}}>
      <line x1={BOUNDARY_X} y1={0} x2={BOUNDARY_X} y2={MAP_H}
        stroke="rgba(255,255,255,.2)" strokeWidth="2" strokeDasharray="8 10"/>
      {edges.map(([a,b],i)=>{
        const na=nodes.find(n=>n.id===a), nb=nodes.find(n=>n.id===b);
        if(!na||!nb) return null;
        return (
          <g key={i}>
            <line x1={na.px} y1={na.py} x2={nb.px} y2={nb.py} stroke="rgba(255,255,255,.5)" strokeWidth="2.5"/>
            <line x1={na.px} y1={na.py} x2={nb.px} y2={nb.py} stroke="rgba(0,0,0,.1)" strokeWidth="1.2"/>
          </g>
        );
      })}
      {nodes.map(n=>{
        const fc=n.factionColor, sel=selNode?.id===n.id;
        const fillColor=hexToRgba(fc, 0.18);
        return (
          <g key={n.id} transform={`translate(${n.px},${n.py})`}
            style={{cursor:'pointer'}} onClick={()=>onNodeClick(n)}>
            {sel && <circle r={22} fill={fillColor} stroke={fc} strokeWidth="1.5" opacity=".8"/>}
            {n.canAttack && !sel && (
              <circle r={20} fill="none" stroke={fc} strokeWidth="1.5" opacity=".6"
                style={{animation:'pulse 1.3s ease-in-out infinite'}}/>
            )}
            <NodeShape type={n.type} color={fc} selected={sel} canAttack={n.canAttack}/>
            <g transform="translate(0,20)">
              <rect x={-30} y={-1} width={60} height={16} rx={4}
                fill="rgba(255,253,251,.9)" stroke={fc} strokeWidth=".8"/>
              <text x={0} y={11} textAnchor="middle"
                style={{fontSize:9, fontFamily:'Noto Sans JP',
                  fontWeight:sel||n.canAttack?700:500,
                  fill:n.canAttack?fc:TX}}>
                {n.name}
              </text>
            </g>
            <g transform="translate(16,-16)">
              <rect x={-10} y={-7} width={20} height={12} rx={3} fill={fc}/>
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
function AreaNameOverlay({areaName, areaEn, triggerKey}) {
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
  return (
    <div style={{position:'absolute', top:24, right:24, pointerEvents:'none', zIndex:30,
      display:'flex', flexDirection:'column', alignItems:'flex-end',
      animation:'areaNameShow 2.4s ease forwards'}}>
      <div style={{width:40, height:1.5, background:'rgba(160,195,155,.9)', marginBottom:6}}/>
      <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:36, fontWeight:900,
        letterSpacing:'.18em', color:'rgba(255,255,255,.95)',
        textShadow:'0 2px 20px rgba(0,0,0,.5), 0 0 40px rgba(0,0,0,.3)', lineHeight:1}}>
        {areaName}
      </div>
      <div style={{fontFamily:'Rajdhani', fontSize:12, fontWeight:600, letterSpacing:'.28em',
        color:'rgba(255,255,255,.65)', textTransform:'uppercase', marginTop:4}}>
        {areaEn}
      </div>
      <div style={{width:40, height:1.5, background:'rgba(160,195,155,.9)', marginTop:6}}/>
    </div>
  );
}

// ── Node popup ─────────────────────────────────────────────
function NodePopup({node, onClose, onAttack}) {
  const fc = node.factionColor;
  const typeLabel = {city:'都市',town:'街',village:'村',fort:'砦'}[node.type]||node.type;
  return (
    <div className="pop-in" style={{
      ...glass({borderRadius:10, padding:'13px 14px 12px',
        border:`1.5px solid ${fc}66`,
        boxShadow:`0 0 0 1px ${fc}22, 0 6px 28px rgba(0,0,0,.2)`,
        minWidth:195}),
      position:'relative',
    }}>
      <button onClick={onClose} style={{position:'absolute', top:8, right:8,
        background:'transparent', border:'none', color:TXD, cursor:'pointer', fontSize:14, lineHeight:1}}>✕</button>
      <div style={{display:'flex', alignItems:'center', gap:7, marginBottom:10}}>
        <div style={{width:9, height:9, borderRadius:'50%', background:fc, flexShrink:0}}/>
        <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:16, fontWeight:900, color:TX}}>{node.name}</div>
        <span style={{marginLeft:'auto', fontSize:8, padding:'2px 6px', borderRadius:10, fontWeight:700,
          background:`${fc}22`, color:fc, border:`1px solid ${fc}44`}}>{typeLabel}</span>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:5,
        marginBottom:node.canAttack?10:0}}>
        {[
          ['収入', `${node.income} M/T`, AC2],
          ['防御部隊', `${fmtN(node.troops)} 兵`, TXD],
          ['勢力', node.factionName, fc],
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
function MiniMap({offsetX, offsetY, vpW, vpH, nodes=[]}) {
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
        {nodes.map(n=>(
          <circle key={n.id} cx={n.px*scaleX} cy={n.py*scaleY} r={2.5} fill={n.factionColor} opacity=".8"/>
        ))}
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
function Legend({ factionsData }) {
  return (
    <div style={{...glass({borderRadius:8, padding:'8px 10px', boxShadow:'0 2px 12px rgba(0,0,0,.15)'}),
      position:'absolute', top:16, left:16, zIndex:20, minWidth:110}}>
      <div style={{fontSize:8, fontFamily:'Rajdhani', fontWeight:700, color:TXD, letterSpacing:'.12em', marginBottom:6}}>LEGEND</div>
      {(factionsData ?? []).map(f=>(
        <div key={f.id} style={{display:'flex', alignItems:'center', gap:5, marginBottom:3}}>
          <div style={{width:8, height:8, borderRadius:'50%', background:f.color, flexShrink:0}}/>
          <span style={{fontSize:9, color:TX}}>{f.name}</span>
        </div>
      ))}
    </div>
  );
}

// ── Map Scene ──────────────────────────────────────────────
export default function MapScene({ onNavigate, onAttackNode, onNodeClick, gameState, basesData, factionsData, conqueredThisTurn, onNextTurn, focusBaseId, focusKey, onReady }) {
  // bases.json 実データから NODES を動的生成
  const liveNodes = React.useMemo(() => {
    if (!basesData || !factionsData) return [];
    const factionMap      = Object.fromEntries(factionsData.map(f => [f.id, f]));
    const playerFaction   = factionsData.find(f => f.isPlayer);
    const playerFactionId = playerFaction?.id;

    // プレイヤー拠点IDセット
    const playerBaseIds = new Set(
      basesData.filter(b => b.factionId === playerFactionId).map(b => b.id)
    );
    // プレイヤー隣接の敵拠点ID（攻撃可能）
    const attackableIds = new Set();
    basesData.forEach(b => {
      if (playerBaseIds.has(b.id)) {
        (b.adjacentBases ?? []).forEach(adjId => {
          if (!playerBaseIds.has(adjId)) attackableIds.add(adjId);
        });
      }
    });

    return basesData.map(b => {
      const faction = factionMap[b.factionId];
      const isPlayer = faction?.isPlayer ?? false;
      const isAtWar  = !isPlayer && (
        (playerFaction?.atWarWith ?? []).includes(faction?.id) ||
        (faction?.atWarWith ?? []).includes(playerFactionId)
      );
      const factionColor = faction?.color ?? '#8a8e96';
      const factionName  = faction?.name  ?? '不明';
      return {
        id:          b.id,
        name:        b.name,
        px:          b.x,
        py:          b.y,
        type:        deriveType(b),
        factionId:   b.factionId,
        factionColor,
        factionName,
        troops:      b.soldiers ?? b.battleCapacity ?? 400,
        income:      b.income ?? 0,
        canAttack:   !isPlayer && isAtWar && attackableIds.has(b.id) && !conqueredThisTurn,
        baseId:      b.id,
        dungeonId:   b.dungeonId ?? null,
        isCapital:   b.isCapital ?? false,
        area:        b.area ?? 'tohoku',
      };
    });
  }, [basesData, factionsData, conqueredThisTurn]);

  // adjacentBases から EDGES を動的生成（重複除去）
  const liveEdges = React.useMemo(() => {
    if (!basesData) return [];
    const seen = new Set();
    const edges = [];
    basesData.forEach(b => {
      (b.adjacentBases ?? []).forEach(adjId => {
        const key = [b.id, adjId].sort().join('|');
        if (!seen.has(key)) { seen.add(key); edges.push([b.id, adjId]); }
      });
    });
    return edges;
  }, [basesData]);

  const vpRef = useRef(null);
  const [vpSize, setVpSize] = useState({w: window.innerWidth, h: window.innerHeight - 104});
  // 仙台（x:3256, y:1019）を初期表示中央に
  const initOffsetX = Math.max(0, Math.min(3256 - window.innerWidth/2, MAP_W - window.innerWidth));
  const initOffsetY = Math.max(0, Math.min(1019 - (window.innerHeight-104)/2, MAP_H - (window.innerHeight-104)));
  const [offset, setOffset] = useState({x: initOffsetX, y: initOffsetY});
  const dragRef = useRef(null);

  // focusBaseId が指定されたらその拠点を中央にカメラ移動し、500ms後に onReady を呼ぶ
  const onReadyCalledRef = useRef(false);

  useEffect(() => {
    onReadyCalledRef.current = false;
  }, [focusBaseId, focusKey]);

  useEffect(() => {
    if (!focusBaseId || !liveNodes.length) return;
    const target = liveNodes.find(n => n.id === focusBaseId || n.baseId === focusBaseId);
    if (!target) {
      if (!onReadyCalledRef.current) { onReadyCalledRef.current = true; onReady?.(); }
      return;
    }
    const tx = Math.max(0, Math.min(target.px - vpSize.w / 2, MAP_W - vpSize.w));
    const ty = Math.max(0, Math.min(target.py - vpSize.h / 2, MAP_H - vpSize.h));
    setOffset({ x: tx, y: ty });
    const t = setTimeout(() => {
      if (!onReadyCalledRef.current) { onReadyCalledRef.current = true; onReady?.(); }
    }, 500);
    return () => clearTimeout(t);
  }, [focusBaseId, focusKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentArea = React.useMemo(() => {
    if (!liveNodes.length) return 'tohoku';
    const cx = offset.x + vpSize.w / 2;
    const cy = offset.y + vpSize.h / 2;
    let nearest = liveNodes[0];
    let minDist = Infinity;
    liveNodes.forEach(n => {
      const d = Math.hypot(n.px - cx, n.py - cy);
      if (d < minDist) { minDist = d; nearest = n; }
    });
    return nearest.area ?? 'tohoku';
  }, [liveNodes, offset, vpSize]);

  const [areaNameInfo, setAreaNameInfo] = useState({
    name: AREA_META[currentArea]?.name ?? '東北',
    en:   AREA_META[currentArea]?.en   ?? 'TOHOKU',
    key:  0,
  });
  const prevAreaRef = useRef(currentArea);

  useEffect(()=>{
    if(prevAreaRef.current !== currentArea){
      prevAreaRef.current = currentArea;
      setAreaNameInfo(p=>({
        name: AREA_META[currentArea]?.name ?? currentArea,
        en:   AREA_META[currentArea]?.en   ?? '',
        key:  p.key + 1,
      }));
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

  const bgType = currentArea === 'hokkaido' ? 'hokkaido' : 'tohoku';
  const tohokuOpacity   = bgType === 'tohoku'   ? 1 : 0;
  const hokkaidoOpacity = bgType === 'hokkaido' ? 1 : 0;

  return (
    <div className="scene-enter" style={{width:'100vw', height:'100vh',
      fontFamily:"'Noto Sans JP',sans-serif", color:TX,
      position:'relative', overflow:'hidden'}}>

      {/* TOP BAR */}
      <TopBar scene="map" currentArea={currentArea}
        turn={gameState?.turn}
        meme={gameState?.meme}
        income={gameState?.income}
        bases={gameState?.bases}
        rightSlot={
          <div style={{
            padding:'4px 12px', borderRadius:20,
            background:'rgba(160,195,155,.25)',
            border:'1px solid rgba(145,185,135,.5)',
            display:'flex', alignItems:'center', gap:6,
          }}>
            <div style={{width:6, height:6, borderRadius:'50%', background:'#2a9a58'}}/>
            <span style={{fontFamily:"'Zen Maru Gothic'", fontSize:11, fontWeight:900, color:TX}}>
              {AREA_META[currentArea]?.name ?? currentArea}
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
          <MapLayer selNode={selNode} onNodeClick={handleNodeClick} nodes={liveNodes} edges={liveEdges}/>
        </div>

        <AreaNameOverlay areaName={areaNameInfo.name} areaEn={areaNameInfo.en} triggerKey={areaNameInfo.key}/>

        {/* Node popup */}
        {selNode && (()=>{
          const pos = getPopupPos(selNode);
          return (
            <div style={{position:'absolute', zIndex:20, ...pos}}>
              <NodePopup
                node={selNode}
                onClose={()=>setSelNode(null)}
                onAttack={(node)=>{ onAttackNode(node); }} onNodeInfo={(node)=>{ if(onNodeClick) onNodeClick(node); }}
              />
            </div>
          );
        })()}

        <MiniMap offsetX={offset.x} offsetY={offset.y} vpW={vpSize.w} vpH={vpSize.h} nodes={liveNodes} />
        <Legend factionsData={factionsData ?? []} />

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
      <BottomBar scene="map" onNavigate={onNavigate} onNextTurn={onNextTurn}/>
    </div>
  );
}

Object.assign(window, { MapScene });