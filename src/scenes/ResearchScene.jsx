import React, { useState } from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass, GAME_STATE, ROLES, CHARS } from '../shared/tokens.js';
import { TopBar } from '../shared/SharedUI.jsx';

// ═══════════════════════════════════════════════════════════
//   ResearchScene — 研究
// ═══════════════════════════════════════════════════════════

const DEMO_RESEARCH = [
  { id:'r1', name:'兵糧改革',     cost:300,  desc:'全拠点の収入が +5% 増加する。',                      cat:'economy',  done:true  },
  { id:'r2', name:'ミーム拡散',   cost:600,  desc:'ターンごとに獲得するミームが +10% 増加する。',       cat:'economy',  done:true  },
  { id:'r3', name:'鍛冶発展',     cost:800,  desc:'前衛キャラの攻撃力が +2 される。',                  cat:'military', done:false },
  { id:'r4', name:'軽装術',       cost:700,  desc:'全キャラの速度 +1。回避率がわずかに上昇。',         cat:'military', done:false },
  { id:'r5', name:'兵団編成術',   cost:1200, desc:'攻撃編成の前衛枠が +1（最大3）になる。',            cat:'military', done:false, locked:'r3' },
  { id:'r6', name:'伝令網整備',   cost:500,  desc:'敵勢力の動向が見えるようになる。',                  cat:'recon',    done:false },
  { id:'r7', name:'医療従事',     cost:900,  desc:'戦闘後にHPが自動回復する量が +50。',                cat:'support',  done:false },
  { id:'r8', name:'天文観測',     cost:1500, desc:'作戦成功率が +10%。歌唱効果範囲 +1。',             cat:'support',  done:false },
  { id:'r9', name:'迷宮地図学',   cost:2000, desc:'迷宮探索中、フロア構造が見えるようになる。',         cat:'recon',    done:false, locked:'r6' },
];
const RCAT_LABEL = { economy:'経済', military:'軍事', recon:'諜報', support:'支援' };
const RCAT_COLOR = { economy:AC, military:PK, recon:TEAL, support:'#6a55b0' };

export default function ResearchScene({ onNavigate, completedResearch=[], treasury=0, onResearch }) {
  const [selected, setSelected] = useState('r3');
  const meme = treasury;

  const sel = DEMO_RESEARCH.find(r => r.id === selected);
  const isLocked = sel?.locked && !doneIds.has(sel.locked);
  const canAfford = sel ? meme >= sel.cost && !completedResearch.includes(sel.id) : false;
  const isDone = (id) => completedResearch.includes(id);
  const canResearch = !isDone(sel?.id) && !isLocked && canAfford;

  const handleResearch = () => {
    if(!canResearch || !sel) return;
    if (onResearch) onResearch(sel.id, sel.cost);
    setDoneIds(s => new Set([...s, sel.id]));
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
              <span style={{fontFamily:'Rajdhani', fontWeight:900, fontSize:14, color:TEAL}}>{doneIds.size}/{DEMO_RESEARCH.length}</span>
            </div>
          </div>
        }/>

      <div style={{position:'absolute', top:52, left:0, right:0, bottom:52, display:'flex', minHeight:0}}>
        {/* List */}
        <div style={{flex:1, overflowY:'auto', padding:'16px 18px', minWidth:0,
          borderRight:`1px solid ${BR}`}}>
          <div style={{fontSize:10, fontFamily:'Rajdhani', fontWeight:700, letterSpacing:'.22em', color:TXD, marginBottom:10}}>
            RESEARCH PROJECTS — {DEMO_RESEARCH.length}件
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:10}}>
            {DEMO_RESEARCH.map(r => {
              const done = doneIds.has(r.id);
              const locked = r.locked && !doneIds.has(r.locked);
              const lockedBy = locked ? DEMO_RESEARCH.find(x => x.id === r.locked) : null;
              const affordable = meme >= r.cost;
              const active = selected === r.id;
              const cc = RCAT_COLOR[r.cat];
              return (
                <button key={r.id}
                  onClick={()=>setSelected(r.id)}
                  style={{
                    position:'relative', cursor:'pointer', padding:'14px 14px 12px',
                    borderRadius:10, textAlign:'left', fontFamily:'inherit',
                    background: done ? `${cc}10` : active ? `${cc}18` : 'rgba(255,255,255,.5)',
                    border: active ? `1.5px solid ${cc}` : `1px solid ${BR}`,
                    opacity: locked ? .55 : 1,
                    transition:'all .15s',
                    display:'flex', flexDirection:'column', gap:6,
                  }}>
                  <div style={{display:'flex', alignItems:'center', gap:6}}>
                    <span style={{fontSize:8, padding:'2px 7px', borderRadius:10,
                      background:`${cc}22`, color:cc, fontFamily:"'Noto Sans JP'", fontWeight:700,
                      letterSpacing:'.1em'}}>{RCAT_LABEL[r.cat]}</span>
                    {done && (
                      <span style={{fontSize:9, padding:'2px 8px', borderRadius:10,
                        background:'rgba(42,154,88,.18)', color:'#2a9a58',
                        fontFamily:'Rajdhani', fontWeight:700, letterSpacing:'.16em'}}>✓ DONE</span>
                    )}
                    {locked && (
                      <span style={{fontSize:9, padding:'2px 8px', borderRadius:10,
                        background:'rgba(0,0,0,.08)', color:TXD,
                        fontFamily:"'Noto Sans JP'", fontWeight:700}}>🔒 要 {lockedBy?.name}</span>
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
                  <div style={{fontSize:10, color:TXD, lineHeight:1.6}}>{r.desc}</div>
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
                    background:`${RCAT_COLOR[sel.cat]}22`, color:RCAT_COLOR[sel.cat],
                    fontFamily:"'Noto Sans JP'", fontWeight:700}}>{RCAT_LABEL[sel.cat]}</span>
                </div>
                <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:22, fontWeight:900, color:TX, lineHeight:1.1}}>
                  {sel.name}
                </div>
              </div>

              <div style={{padding:'14px', borderRadius:10,
                background:'rgba(0,0,0,.03)', border:`1px solid ${BR}`,
                fontSize:12, color:TX, lineHeight:1.8}}>{sel.desc}</div>

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

              <div style={{marginTop:'auto'}}>
                {isDone(sel?.id) ? (
                  <div style={{padding:'12px', borderRadius:8,
                    background:'rgba(42,154,88,.12)', border:'1px solid rgba(42,154,88,.3)',
                    color:'#2a9a58', textAlign:'center', fontWeight:700, fontSize:12,
                    fontFamily:"'Noto Sans JP'"}}>✓ 研究済み</div>
                ) : isLocked ? (
                  <div style={{padding:'12px', borderRadius:8,
                    background:'rgba(0,0,0,.04)', border:`1px dashed ${BR}`,
                    color:TXD, textAlign:'center', fontSize:11}}>
                    🔒 先に「{DEMO_RESEARCH.find(x=>x.id===sel.locked)?.name}」を研究してください
                  </div>
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
