import React, { useState } from 'react';
import { PK, AC, TEAL, TX, TXD, TXF, BR, glass } from '../shared/tokens.js';
import { TopBar, NavButton } from '../shared/SharedUI.jsx';

// ═══════════════════════════════════════════════════════════
//   ResearchScene — 研究ツリー（SVG接続線付き）
// ═══════════════════════════════════════════════════════════

// ノードの列・行位置
const LAYOUT = {
  voice_1:      [0, 0],
  terms:        [0, 1],
  public_assets:[0, 2],
  font:         [0, 3],

  voice_plus:   [1, 0],
  vocal_1:      [1, 1],
  studio_1:     [1, 2],
  ink:          [1, 3],

  voice_2:      [2, 0],
  vocal_2:      [2, 1],
  studio_2:     [2, 2],
  vox_dorm:     [2, 3],

  aiv:          [3, 0],
  vocal_nt:     [3, 1],
  studio_ai:    [3, 2],
  hybrid_v:     [3, 3],
  ex_voice_1:   [3, 4],
  ex_voice_2:   [3, 5],
  collab:       [3, 6],

  aiv_2:        [4, 0],
  nu_tori:      [4, 1],
  uta:          [4, 2],
  hybrid_v2:    [4, 3],
  md:           [4, 4],

  peak:         [5, 0],
  crowdfund:    [5, 1],
};

const NODE_W    = 138;
const NODE_H    = 66;
const COL_STRIDE = 182;
const ROW_STRIDE = 96;
const PAD_X     = 18;
const PAD_Y     = 18;

const SVG_W = PAD_X * 2 + 6 * COL_STRIDE;
const SVG_H = PAD_Y * 2 + 7 * ROW_STRIDE;

function nodePos(id) {
  const [col, row] = LAYOUT[id] ?? [0, 0];
  return {
    x:  PAD_X + col * COL_STRIDE,
    y:  PAD_Y + row * ROW_STRIDE,
    cx: PAD_X + col * COL_STRIDE + NODE_W / 2,
    cy: PAD_Y + row * ROW_STRIDE + NODE_H / 2,
  };
}

const CAT_COLOR = { engine: TEAL, produce: AC };

export default function ResearchScene({
  onNavigate,
  buildingSystem,
  buildings = [],
  treasury = 0,
  researchQueue = null,
  onStartResearch,
}) {
  const allDefs         = buildingSystem ? buildingSystem.getAllDefs() : [];
  const upgradeCommands = buildingSystem?.upgradeCommands ?? [];
  const [selected, setSelected] = useState(null);

  const isDone       = (id) => buildings.includes(id);
  const isQueuing    = (id) => researchQueue?.id === id;
  const isResearching = researchQueue !== null;

  const isUnlocked = (def) =>
    !def.prerequisites?.length || def.prerequisites.every(pid => buildings.includes(pid));

  const selDef = allDefs.find(d => d.id === selected) ?? null;
  const selPrereqs = selDef?.prerequisites ?? [];
  const selUnlockCmds = (selDef?.unlocks?.upgradeCommands ?? [])
    .map(cid => upgradeCommands.find(c => c.id === cid)).filter(Boolean);

  const canResearch = selDef &&
    !isDone(selDef.id) &&
    !isQueuing(selDef.id) &&
    isUnlocked(selDef) &&
    treasury >= selDef.cost &&
    !isResearching;

  const disabledReason = !selDef ? null
    : isDone(selDef.id)          ? '研究済み'
    : isQueuing(selDef.id)       ? '研究中'
    : isResearching               ? '他の研究が進行中'
    : !isUnlocked(selDef)         ? '前提研究が未完了'
    : treasury < selDef.cost      ? `ミーム不足 (${(selDef.cost - treasury).toLocaleString()} 不足)`
    : null;

  // SVGエッジ生成（prerequisites → child）
  const edges = [];
  allDefs.forEach(def => {
    (def.prerequisites ?? []).forEach(prereqId => {
      const src = nodePos(prereqId);
      const tgt = nodePos(def.id);
      edges.push({ from: prereqId, to: def.id, src, tgt });
    });
  });

  return (
    <div className="scene-enter" style={{
      width:'100vw', height:'100vh', position:'relative', overflow:'hidden',
      background:'rgba(248,246,244,1)', fontFamily:"'Noto Sans JP'",
    }}>
      <TopBar breadcrumb={['マップ','研究']}
        rightSlot={
          <div style={{display:'flex', gap:10}}>
            <div style={{padding:'4px 12px', borderRadius:20,
              background:'rgba(196,66,122,.1)', border:'1px solid rgba(196,66,122,.25)',
              display:'flex', alignItems:'center', gap:6}}>
              <span style={{fontSize:10, color:TXD}}>所持ミーム</span>
              <span style={{fontFamily:'Rajdhani', fontWeight:900, fontSize:14, color:PK}}>{treasury.toLocaleString()}</span>
            </div>
            <div style={{padding:'4px 12px', borderRadius:20,
              background:'rgba(26,138,150,.1)', border:'1px solid rgba(26,138,150,.25)',
              display:'flex', alignItems:'center', gap:6}}>
              <span style={{fontSize:10, color:TXD}}>完了</span>
              <span style={{fontFamily:'Rajdhani', fontWeight:900, fontSize:14, color:TEAL}}>{buildings.length}/{allDefs.length}</span>
            </div>
          </div>
        }/>

      <div style={{position:'absolute', top:52, left:0, right:0, bottom:52, display:'flex', minHeight:0}}>

        {/* SVGツリー */}
        <div style={{flex:1, overflowX:'auto', overflowY:'auto', padding:'8px 0',
          borderRight:`1px solid ${BR}`}}>

          {/* 研究中バナー */}
          {isResearching && (() => {
            const qDef = allDefs.find(r => r.id === researchQueue.id);
            return (
              <div style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'7px 16px', margin:'0 12px 8px',
                borderRadius:20,
                background:`${TEAL}15`, border:`1px solid ${TEAL}44`,
                fontSize:12, color:TEAL, fontWeight:700,
              }}>
                <span>🔬 研究中: {qDef?.name ?? researchQueue.id}</span>
                <span style={{marginLeft:'auto', fontFamily:'Rajdhani', fontSize:13}}>
                  残り {researchQueue.turnsRemaining} ターン
                </span>
              </div>
            );
          })()}

          <svg width={SVG_W} height={SVG_H} style={{display:'block'}}>
            {/* エッジ */}
            {edges.map(e => {
              const x1 = e.src.x + NODE_W;
              const y1 = e.src.cy;
              const x2 = e.tgt.x;
              const y2 = e.tgt.cy;
              const mx = (x1 + x2) / 2;
              const done1 = isDone(e.from);
              const done2 = isDone(e.to);
              const edgeColor = done1 && done2 ? '#2a9a58' : done1 ? TEAL + '99' : BR;
              return (
                <path key={`${e.from}-${e.to}`}
                  d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                  fill="none" stroke={edgeColor} strokeWidth={done1 && done2 ? 2 : 1.5}
                  strokeDasharray={done1 ? 'none' : '4 3'}/>
              );
            })}

            {/* ノード */}
            {allDefs.map(def => {
              if (!LAYOUT[def.id]) return null;
              const pos      = nodePos(def.id);
              const done     = isDone(def.id);
              const queuing  = isQueuing(def.id);
              const unlocked = isUnlocked(def);
              const active   = selected === def.id;
              const catColor = CAT_COLOR[def.category] ?? TEAL;

              const fillColor = done    ? `${catColor}20`
                              : active  ? `${catColor}16`
                              : 'rgba(255,255,255,.92)';
              const strokeColor = queuing  ? TEAL
                                : active   ? catColor
                                : done     ? `${catColor}77`
                                : BR;
              const strokeWidth = queuing || active ? 2 : 1;

              return (
                <g key={def.id}
                  onClick={() => setSelected(def.id)}
                  style={{cursor:'pointer'}}>
                  <rect x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx={9}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    opacity={(!unlocked && !done) ? 0.45 : 1}/>

                  {/* 研究済みバッジ */}
                  {done && (
                    <text x={pos.x + NODE_W - 10} y={pos.y + 14}
                      fontSize={10} fill="#2a9a58" textAnchor="middle"
                      fontWeight="700">✓</text>
                  )}

                  {/* 研究中インジケーター */}
                  {queuing && (
                    <rect x={pos.x + 1} y={pos.y + NODE_H - 5} width={NODE_W - 2} height={4}
                      rx={2} fill={TEAL} opacity={0.7}/>
                  )}

                  {/* ノード名 */}
                  <text x={pos.x + 9} y={pos.y + 24}
                    fontSize={12} fontWeight="900"
                    fill={unlocked || done ? TX : TXF}
                    fontFamily="'Zen Maru Gothic', sans-serif">
                    {def.name.length > 8 ? def.name.slice(0,7) + '…' : def.name}
                  </text>

                  {/* コスト・ターン */}
                  <text x={pos.x + 9} y={pos.y + 42}
                    fontSize={9} fill={catColor}
                    fontFamily="Rajdhani, monospace" fontWeight="700">
                    {def.cost.toLocaleString()}M · {def.turns}T
                  </text>

                  {/* 研究中残りターン */}
                  {queuing && (
                    <text x={pos.x + 9} y={pos.y + 57}
                      fontSize={9} fill={TEAL}
                      fontFamily="Rajdhani, monospace" fontWeight="700">
                      残 {researchQueue.turnsRemaining} ターン
                    </text>
                  )}

                  {/* カテゴリドット */}
                  <circle cx={pos.x + NODE_W - 12} cy={pos.y + NODE_H - 12} r={3}
                    fill={catColor} opacity={0.6}/>
                </g>
              );
            })}
          </svg>

          {/* 凡例 */}
          <div style={{display:'flex', gap:16, padding:'6px 18px', fontSize:10, color:TXD}}>
            <span style={{display:'flex', alignItems:'center', gap:4}}>
              <span style={{display:'inline-block', width:8, height:8, borderRadius:'50%', background:TEAL}}/>エンジン
            </span>
            <span style={{display:'flex', alignItems:'center', gap:4}}>
              <span style={{display:'inline-block', width:8, height:8, borderRadius:'50%', background:AC}}/>プロデュース
            </span>
            <span style={{display:'flex', alignItems:'center', gap:4}}>
              <span style={{display:'inline-block', width:10, height:2, background:'#ccc', borderStyle:'dashed'}}/>未開通
            </span>
          </div>
        </div>

        {/* 詳細パネル */}
        <div style={{flex:'0 0 320px', padding:'18px 20px', display:'flex',
          flexDirection:'column', gap:12, overflowY:'auto',
          background:'rgba(255,253,251,.5)'}}>
          {selDef ? (
            <>
              {/* ヘッダー */}
              <div>
                <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:6}}>
                  <span style={{fontSize:9, padding:'2px 8px', borderRadius:10, fontWeight:700,
                    background: CAT_COLOR[selDef.category] + '22',
                    color: CAT_COLOR[selDef.category],
                    fontFamily:'Rajdhani', letterSpacing:'.12em'}}>
                    {selDef.category === 'engine' ? 'ENGINE' : 'PRODUCE'}
                  </span>
                  {isDone(selDef.id) && (
                    <span style={{fontSize:9, padding:'2px 8px', borderRadius:10,
                      background:'rgba(42,154,88,.15)', color:'#2a9a58', fontWeight:700}}>✓ 研究済み</span>
                  )}
                </div>
                <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:22, fontWeight:900,
                  color:TX, lineHeight:1.1}}>{selDef.name}</div>
              </div>

              {/* 説明 */}
              <div style={{padding:'12px 14px', borderRadius:10,
                background:'rgba(0,0,0,.03)', border:`1px solid ${BR}`,
                fontSize:12, color:TX, lineHeight:1.8}}>{selDef.description}</div>

              {/* コスト・ターン */}
              <div style={{display:'flex', gap:8}}>
                <div style={{flex:1, padding:'10px 12px', borderRadius:8,
                  background:`${PK}0e`, border:`1px solid ${PK}33`,
                  display:'flex', flexDirection:'column', alignItems:'center', gap:2}}>
                  <span style={{fontSize:9, fontFamily:'Rajdhani', fontWeight:700,
                    letterSpacing:'.15em', color:TXD}}>COST</span>
                  <span style={{fontFamily:'Rajdhani', fontWeight:900, fontSize:22, color:PK}}>
                    {selDef.cost.toLocaleString()}
                  </span>
                  <span style={{fontSize:9, color: treasury >= selDef.cost ? TEAL : PK}}>
                    {treasury >= selDef.cost ? '✓ 支払可' : `不足 ${(selDef.cost - treasury).toLocaleString()}`}
                  </span>
                </div>
                <div style={{flex:1, padding:'10px 12px', borderRadius:8,
                  background:`${TEAL}0e`, border:`1px solid ${TEAL}33`,
                  display:'flex', flexDirection:'column', alignItems:'center', gap:2}}>
                  <span style={{fontSize:9, fontFamily:'Rajdhani', fontWeight:700,
                    letterSpacing:'.15em', color:TXD}}>TURNS</span>
                  <span style={{fontFamily:'Rajdhani', fontWeight:900, fontSize:22, color:TEAL}}>
                    {selDef.turns}
                  </span>
                  <span style={{fontSize:9, color:TXD}}>ターン</span>
                </div>
              </div>

              {/* 前提研究 */}
              {selPrereqs.length > 0 && (
                <div>
                  <div style={{fontSize:9, fontFamily:'Rajdhani', fontWeight:700,
                    letterSpacing:'.15em', color:TXD, marginBottom:6}}>PREREQUISITES</div>
                  <div style={{display:'flex', flexDirection:'column', gap:4}}>
                    {selPrereqs.map(pid => {
                      const pDef = allDefs.find(d => d.id === pid);
                      const done = isDone(pid);
                      return (
                        <div key={pid} style={{
                          display:'flex', alignItems:'center', gap:8,
                          padding:'6px 10px', borderRadius:6,
                          background: done ? 'rgba(42,154,88,.08)' : 'rgba(0,0,0,.04)',
                          border: `1px solid ${done ? 'rgba(42,154,88,.3)' : BR}`,
                          fontSize:11,
                        }}>
                          <span style={{fontSize:12}}>{done ? '✅' : '⬜'}</span>
                          <span style={{color: done ? '#2a9a58' : TXD, fontWeight: done ? 700 : 400}}>
                            {pDef?.name ?? pid}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* アンロックされる強化コマンド */}
              {selUnlockCmds.length > 0 && (
                <div>
                  <div style={{fontSize:9, fontFamily:'Rajdhani', fontWeight:700,
                    letterSpacing:'.15em', color:TXD, marginBottom:6}}>UNLOCKS COMMANDS</div>
                  <div style={{display:'flex', flexDirection:'column', gap:6}}>
                    {selUnlockCmds.map(cmd => (
                      <div key={cmd.id} style={{
                        padding:'8px 12px', borderRadius:8,
                        background:`${AC}0e`, border:`1px solid ${AC}33`,
                        fontSize:11,
                      }}>
                        <div style={{fontWeight:700, color:AC, marginBottom:2}}>{cmd.label}</div>
                        <div style={{fontSize:10, color:TXD}}>{cmd.desc}</div>
                        <div style={{fontSize:10, color:TXD, marginTop:2, fontFamily:'Rajdhani'}}>
                          コスト: {cmd.cost.toLocaleString()} · 最大{cmd.maxPurchase ?? '∞'}回
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 研究ボタン */}
              <div style={{marginTop:'auto'}}>
                {isDone(selDef.id) ? (
                  <div style={{padding:'12px', borderRadius:8,
                    background:'rgba(42,154,88,.1)', border:'1px solid rgba(42,154,88,.3)',
                    color:'#2a9a58', textAlign:'center', fontWeight:700, fontSize:12}}>
                    ✓ 研究済み
                  </div>
                ) : (
                  <button
                    onClick={() => canResearch && onStartResearch?.(selDef.id)}
                    disabled={!canResearch}
                    style={{
                      width:'100%', padding:'13px', borderRadius:8,
                      background: canResearch
                        ? `linear-gradient(135deg, ${TEAL}, ${TEAL}bb)`
                        : 'rgba(0,0,0,.06)',
                      border: canResearch ? 'none' : `1px solid ${BR}`,
                      color: canResearch ? '#fff' : TXF,
                      cursor: canResearch ? 'pointer' : 'not-allowed',
                      fontFamily:"'Noto Sans JP'", fontSize:13, fontWeight:700, letterSpacing:'.08em',
                      boxShadow: canResearch ? `0 3px 18px ${TEAL}55` : 'none',
                    }}>
                    {canResearch ? '研究を開始 →' : (disabledReason ?? 'ミーム不足')}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center',
              flexDirection:'column', gap:8, opacity:.35}}>
              <div style={{fontSize:32}}>🔬</div>
              <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:13, fontWeight:700, color:TX,
                letterSpacing:'.1em'}}>研究を選択</div>
              <div style={{fontSize:10, color:TXD}}>ツリーのノードをクリック</div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div style={{
        ...glass({borderRadius:0, border:'none', borderTop:`1px solid ${BR}`,
          background:'rgba(255,253,251,.97)'}),
        position:'absolute', bottom:0, left:0, right:0, height:52,
        display:'flex', alignItems:'center', padding:'0 16px', gap:10, zIndex:10,
      }}>
        <NavButton label="← マップに戻る" onClick={() => onNavigate('map')}
          activeColor={TEAL} activeBg='rgba(26,138,150,.1)'/>
      </div>
    </div>
  );
}

Object.assign(window, { ResearchScene });
