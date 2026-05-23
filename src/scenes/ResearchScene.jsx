import React, { useState } from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass, GAME_STATE, ROLES, CHARS } from '../shared/tokens.js';
import { TopBar, NavButton } from '../shared/SharedUI.jsx';

// ═══════════════════════════════════════════════════════════
//   ResearchScene — 研究（BuildingSystem実データ接続済み）
// ═══════════════════════════════════════════════════════════

const EFFECT_LABEL = {
  income:           def => `収入 +${def.effect.value} ミーム/T`,
  recruitment:      ()  => 'キャラ雇用が可能になる',
  maxSoldiersBonus: def => `全キャラ ミーム上限 +${def.effect.value}`,
  charSongBonus:    def => `全キャラ 歌パラ +${def.effect.value}`,
};
const RCAT_COLOR = { economy:AC, military:PK, recon:TEAL, support:'#6a55b0' };

export default function ResearchScene({
  onNavigate,
  buildingSystem,
  buildings = [],
  treasury = 0,
  onResearch,
  researchQueue = null,
  onStartResearch,
}) {
  // BuildingSystem実データ。渡されない場合は空リスト表示
  const allDefs   = buildingSystem ? buildingSystem.getAllDefs() : [];
  const completed = buildings;
  const [selected, setSelected] = useState(allDefs[0]?.id ?? null);
  const meme = treasury;

  const sel          = allDefs.find(r => r.id === selected) ?? null;
  const isDone       = (id) => completed.includes(id);
  const isResearching = researchQueue !== null;
  const canAfford    = sel ? meme >= sel.cost && !isDone(sel.id) : false;
  const canResearch  = sel && !isDone(sel.id) && canAfford && !isResearching;

  const handleResearch = () => {
    if (!canResearch || !sel) return;
    if (onStartResearch) onStartResearch(sel.id);
  };

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
              <span style={{fontFamily:'Rajdhani', fontWeight:900, fontSize:14, color:PK}}>{meme.toLocaleString()}</span>
            </div>
            <div style={{padding:'4px 12px', borderRadius:20,
              background:'rgba(26,138,150,.1)', border:'1px solid rgba(26,138,150,.25)',
              display:'flex', alignItems:'center', gap:6}}>
              <span style={{fontSize:10, color:TXD}}>完了</span>
              <span style={{fontFamily:'Rajdhani', fontWeight:900, fontSize:14, color:TEAL}}>{completed.length}/{allDefs.length}</span>
            </div>
          </div>
        }/>

      <div style={{position:'absolute', top:52, left:0, right:0, bottom:52, display:'flex', minHeight:0}}>
        {/* List */}
        <div style={{flex:1, overflowY:'auto', padding:'16px 18px', minWidth:0,
          borderRight:`1px solid ${BR}`}}>
          {isResearching && (() => {
            const qDef = allDefs.find(r => r.id === researchQueue.id);
            return (
              <div style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'8px 14px', borderRadius:20, marginBottom:12,
                background:`${TEAL}15`, border:`1px solid ${TEAL}44`,
                fontSize:12, color:TEAL, fontWeight:700,
                fontFamily:"'Noto Sans JP'",
              }}>
                <span>🔬 研究中: {qDef?.name ?? researchQueue.id}</span>
                <span style={{marginLeft:'auto', fontFamily:'Rajdhani', fontSize:13}}>
                  残り {researchQueue.turnsRemaining} ターン
                </span>
              </div>
            );
          })()}
          <div style={{fontSize:10, fontFamily:'Rajdhani', fontWeight:700, letterSpacing:'.22em', color:TXD, marginBottom:10}}>
            RESEARCH PROJECTS — {allDefs.length}件
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:10}}>
            {allDefs.map(r => {
              const done = isDone(r.id);
              const locked = false; // BuildingSystemに前提条件なし
              const affordable = meme >= r.cost;
              const active = selected === r.id;
              const cc = PK;
              const dimmedByQueue = isResearching && !done;
              return (
                <button key={r.id}
                  onClick={()=>setSelected(r.id)}
                  style={{
                    position:'relative', cursor:'pointer', padding:'14px 14px 12px',
                    borderRadius:10, textAlign:'left', fontFamily:'inherit',
                    background: done ? `${cc}10` : active ? `${cc}18` : 'rgba(255,255,255,.5)',
                    border: active ? `1.5px solid ${cc}` : `1px solid ${BR}`,
                    opacity: locked || dimmedByQueue ? .5 : 1,
                    transition:'all .15s',
                    display:'flex', flexDirection:'column', gap:6,
                  }}>
                  <div style={{display:'flex', alignItems:'center', gap:6}}>
                    {done && (
                      <span style={{fontSize:9, padding:'2px 8px', borderRadius:10,
                        background:'rgba(42,154,88,.18)', color:'#2a9a58',
                        fontFamily:'Rajdhani', fontWeight:700, letterSpacing:'.16em'}}>✓ DONE</span>
                    )}
                    <div style={{marginLeft:'auto', display:'flex', alignItems:'baseline', gap:3}}>
                      <span style={{fontFamily:'Rajdhani', fontWeight:900, fontSize:15,
                        color: done ? TXD : !affordable && !locked ? PK : TX}}>{r.cost.toLocaleString()}</span>
                      <span style={{fontSize:9, color:TXD}}>ミーム</span>
                    </div>
                  </div>
                  <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:15, fontWeight:900, color:TX, lineHeight:1.2}}>
                    {r.name}
                  </div>
                  <div style={{fontSize:10, color:TXD, lineHeight:1.6}}>{r.description}</div>
                  <div style={{fontSize:9, color:cc, fontWeight:700}}>{(EFFECT_LABEL[r.effect?.type] ?? (() => ''))(r)}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        <div style={{flex:'0 0 340px', padding:'18px 20px', display:'flex', flexDirection:'column', gap:14, overflowY:'auto',
          background:'rgba(255,253,251,.5)'}}>
          {sel && (
            <>
              <div>
                <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:6}}>
                  <span style={{fontSize:9, padding:'2px 8px', borderRadius:10,
                    background:`${PK}22`, color:PK,
                    fontFamily:"'Noto Sans JP'", fontWeight:700}}>研究</span>
                </div>
                <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:22, fontWeight:900, color:TX, lineHeight:1.1}}>
                {sel.name}
                </div>
                </div>

                <div style={{padding:'14px', borderRadius:10,
                background:'rgba(0,0,0,.03)', border:`1px solid ${BR}`,
                fontSize:12, color:TX, lineHeight:1.8}}>{sel.description}</div>
              <div style={{fontSize:11, color:PK, fontWeight:700, padding:'6px 14px',
                background:`${PK}10`, borderRadius:6, border:`1px solid ${PK}33`}}>
                {(EFFECT_LABEL[sel.effect?.type] ?? (() => '効果未設定'))(sel)}
              </div>

              <div style={{display:'flex', alignItems:'center', gap:10,
                padding:'10px 14px', borderRadius:8,
                background:`${PK}10`, border:`1px solid ${PK}33`}}>
                <span style={{fontSize:9, fontFamily:'Rajdhani', fontWeight:700,
                  letterSpacing:'.18em', color:TXD}}>COST</span>
                <span style={{fontFamily:'Rajdhani', fontWeight:900, fontSize:24, color:PK}}>{sel.cost.toLocaleString()}</span>
                <span style={{fontSize:10, color:TXD}}>ミーム</span>
                <span style={{marginLeft:'auto', fontSize:10, color: canAfford ? TEAL : PK}}>
                  {canAfford ? `✓ 支払可` : `不足 ${(sel.cost - meme).toLocaleString()}`}
                </span>
              </div>

              {sel.turns != null && (
                <div style={{display:'flex', alignItems:'center', gap:6,
                  padding:'6px 14px', borderRadius:8,
                  background:`${TEAL}10`, border:`1px solid ${TEAL}33`,
                  fontSize:11, color:TEAL}}>
                  <span>🕐 研究期間: <strong>{sel.turns}</strong> ターン</span>
                </div>
              )}

              <div style={{marginTop:'auto'}}>
                {isDone(sel?.id) ? (
                  <div style={{padding:'12px', borderRadius:8,
                    background:'rgba(42,154,88,.12)', border:'1px solid rgba(42,154,88,.3)',
                    color:'#2a9a58', textAlign:'center', fontWeight:700, fontSize:12,
                    fontFamily:"'Noto Sans JP'"}}>✓ 研究済み</div>
                ) : isResearching ? (
                  <div style={{padding:'12px', borderRadius:8,
                    background:'rgba(0,0,0,.05)', border:`1px solid ${BR}`,
                    color:TXF, textAlign:'center', fontWeight:700, fontSize:12,
                    fontFamily:"'Noto Sans JP'"}}>研究中は新規開始不可</div>
                ) : (
                  <button onClick={handleResearch} disabled={!canAfford}
                    style={{
                      width:'100%', padding:'13px', borderRadius:8,
                      background: canAfford ? `linear-gradient(135deg, ${PK}, ${PK2})` : 'rgba(0,0,0,.06)',
                      border: canAfford ? 'none' : `1px solid ${BR}`,
                      color: canAfford ? '#fff' : TXF, cursor: canAfford ? 'pointer' : 'not-allowed',
                      fontFamily:"'Noto Sans JP'", fontSize:13, fontWeight:700, letterSpacing:'.08em',
                      boxShadow: canAfford ? `0 3px 18px ${PK}55` : 'none',
                    }}>{canAfford ? '研究する →' : 'ミーム不足'}</button>
                )}
              </div>
            </>
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
        <NavButton label="← マップに戻る" onClick={()=>onNavigate('map')}
          activeColor={TEAL} activeBg='rgba(26,138,150,.1)'/>
      </div>
    </div>
  );
}

Object.assign(window, { ResearchScene });
