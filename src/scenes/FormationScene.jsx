import React, { useState } from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass, GAME_STATE, ROLES, CHARS } from '../shared/tokens.js';
import { TopBar } from '../shared/SharedUI.jsx';

// 前衛ロール判定
const isFront = (c) => c.role === 'front';
const isSupport = (c) => !isFront(c); // ranged/rear/support = 後衛扱い

function FormationSlot({ slot, char, onRemove, label, color }) {
  const role = char ? (ROLES[char.role] || ROLES.front) : null;
  return (
    <div style={{
      position:'relative',
      width: 110, height: 150,
      borderRadius: 10,
      border: `2px dashed ${char ? color+'88' : 'rgba(255,255,255,.2)'}`,
      background: char ? `${color}12` : 'rgba(255,255,255,.04)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      transition:'all .2s',
      overflow:'hidden',
    }}>
      {/* slot label */}
      <div style={{
        position:'absolute', top:0, left:0, right:0,
        padding:'3px 0', textAlign:'center',
        background: char ? `${color}22` : 'rgba(255,255,255,.06)',
        fontSize:8, fontFamily:'Rajdhani', fontWeight:700, letterSpacing:'.12em',
        color: char ? color : 'rgba(255,255,255,.3)',
      }}>{label}</div>

      {char ? (
        <>
          {/* portrait */}
          <div style={{
            width:72, height:90, overflow:'hidden', borderRadius:6,
            marginTop:14, flexShrink:0,
            border:`1.5px solid ${role.color}55`,
          }}>
            {char.portrait
              ? <img src={char.portrait} alt={char.name}
                  style={{width:'100%', height:'100%', objectFit:'cover', objectPosition:'top center'}}/>
              : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',
                  background:'rgba(0,0,0,.1)', fontSize:22, color:'rgba(255,255,255,.3)'}}>?</div>
            }
          </div>
          <div style={{
            fontSize:9, fontFamily:"'Zen Maru Gothic'", fontWeight:900,
            color:'rgba(255,255,255,.9)', marginTop:5, textAlign:'center',
            maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          }}>{char.name}</div>
          <div style={{
            fontSize:7, padding:'1px 6px', borderRadius:8, marginTop:2,
            background:`${role.color}33`, color:role.color, fontWeight:700,
          }}>{role.label}</div>
          {/* remove button */}
          <button
            onClick={() => onRemove(slot)}
            style={{
              position:'absolute', top:20, right:4,
              width:18, height:18, borderRadius:'50%',
              background:'rgba(0,0,0,.55)', border:'1px solid rgba(255,255,255,.2)',
              color:'rgba(255,255,255,.7)', cursor:'pointer',
              fontSize:10, lineHeight:'18px', textAlign:'center', padding:0,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>✕</button>
        </>
      ) : (
        <div style={{textAlign:'center', opacity:.35}}>
          <div style={{fontSize:28, marginBottom:4}}>＋</div>
          <div style={{fontSize:8, color:'rgba(255,255,255,.5)', fontFamily:'Noto Sans JP'}}>空きスロット</div>
        </div>
      )}
    </div>
  );
}

export default function AttackFormationScene({ targetNode, onLaunch, onCancel, availableChars }) {
  // formation: { front1, front2, rear1, rear2 } — null or char
  const [formation, setFormation] = useState({ front1:null, front2:null, rear1:null, rear2:null });
  const [hoverId, setHoverId] = useState(null);

  // availableCharsが渡されていれば実データ、なければCHARSデモデータ
  const joinedChars = availableChars ?? CHARS.filter(c => c.joined);
  const selectedIds = Object.values(formation).filter(Boolean).map(c => c.id);

  // ルール判定
  const frontCount = [formation.front1, formation.front2].filter(Boolean).length;
  const rearCount  = [formation.rear1,  formation.rear2 ].filter(Boolean).length;
  const totalCount = frontCount + rearCount;
  const canLaunch  = frontCount >= 1 && totalCount >= 1;

  const handleCharClick = (char) => {
    if(selectedIds.includes(char.id)) {
      // 外す
      setFormation(prev => {
        const next = {...prev};
        Object.keys(next).forEach(k => { if(next[k]?.id === char.id) next[k] = null; });
        return next;
      });
      return;
    }
    // 追加
    if(isFront(char)) {
      setFormation(prev => {
        if(!prev.front1) return {...prev, front1: char};
        if(!prev.front2) return {...prev, front2: char};
        return prev; // 満杯
      });
    } else {
      setFormation(prev => {
        if(!prev.rear1) return {...prev, rear1: char};
        if(!prev.rear2) return {...prev, rear2: char};
        return prev;
      });
    }
  };

  const handleRemove = (slot) => {
    setFormation(prev => ({...prev, [slot]: null}));
  };

  const frontChars  = joinedChars.filter(isFront);
  const rearChars   = joinedChars.filter(c => !isFront(c));

  // 敵情報
  const ow = { c: PK, label: '敵拠点' };
  const typeLabel = targetNode ? ({city:'都市',town:'街',village:'村',fort:'砦'}[targetNode.type]||targetNode.type) : '';

  return (
    <div className="scene-enter" style={{
      width:'100vw', height:'100vh',
      background:'linear-gradient(160deg,#0d0818 0%,#1a1030 60%,#0a1420 100%)',
      fontFamily:"'Noto Sans JP',sans-serif",
      color:'rgba(255,255,255,.9)',
      display:'flex', flexDirection:'column',
      position:'relative', overflow:'hidden',
    }}>
      {/* bg pattern */}
      <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:0,
        backgroundImage:'repeating-linear-gradient(0deg,rgba(255,255,255,.015) 0,rgba(255,255,255,.015) 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,rgba(255,255,255,.015) 0,rgba(255,255,255,.015) 1px,transparent 1px,transparent 40px)'}}/>

      {/* TOP BAR */}
      <div style={{
        position:'relative', zIndex:10, height:52, flexShrink:0,
        display:'flex', alignItems:'center', padding:'0 20px', gap:12,
        background:'rgba(0,0,0,.4)', borderBottom:'1px solid rgba(255,255,255,.08)',
        backdropFilter:'blur(12px)',
      }}>
        <img src="assets/logo_tohoku.png" alt="東北家" style={{height:26, objectFit:'contain'}}/>
        <div style={{width:1, height:'55%', background:'rgba(255,255,255,.15)'}}/>
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          <span style={{fontSize:11, color:'rgba(255,255,255,.4)', fontFamily:'Noto Sans JP'}}>マップ</span>
          <span style={{fontSize:11, color:'rgba(255,255,255,.2)'}}>›</span>
          <span style={{fontSize:11, color:'rgba(255,255,255,.9)', fontFamily:'Noto Sans JP', fontWeight:700}}>攻撃編成</span>
        </div>
        <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:8}}>
          {targetNode && (
            <div style={{
              padding:'4px 12px', borderRadius:20,
              background:'rgba(196,66,122,.15)', border:'1px solid rgba(196,66,122,.35)',
              display:'flex', alignItems:'center', gap:6,
            }}>
              <span style={{fontSize:10, color:'rgba(196,66,122,.8)', fontFamily:'Noto Sans JP'}}>攻撃目標</span>
              <span style={{fontFamily:"'Zen Maru Gothic'", fontSize:13, fontWeight:900, color:PK}}>
                {targetNode.name}
              </span>
              <span style={{fontSize:9, color:'rgba(255,255,255,.4)'}}>({typeLabel} · {targetNode.troops}兵)</span>
            </div>
          )}
        </div>
      </div>

      {/* MAIN */}
      <div style={{flex:1, display:'flex', gap:0, minHeight:0, position:'relative', zIndex:1}}>

        {/* ── LEFT: 編成スロット ── */}
        <div style={{
          flex:'0 0 360px', display:'flex', flexDirection:'column',
          padding:'20px 24px', gap:16,
          borderRight:'1px solid rgba(255,255,255,.07)',
        }}>
          <div style={{fontSize:10, fontFamily:'Rajdhani', fontWeight:700,
            letterSpacing:'.18em', color:'rgba(255,255,255,.4)'}}>FORMATION — 出撃編成</div>

          {/* 前衛ライン */}
          <div>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10}}>
              <div style={{width:3, height:14, borderRadius:2, background:PK}}/>
              <span style={{fontSize:10, fontFamily:'Noto Sans JP', fontWeight:700, color:PK}}>前衛</span>
              <span style={{fontSize:9, color:'rgba(255,255,255,.3)'}}>最大2人 · 攻撃の主力</span>
              <span style={{marginLeft:'auto', fontFamily:'Rajdhani', fontWeight:700,
                fontSize:12, color: frontCount>0 ? PK : 'rgba(255,255,255,.3)'}}>
                {frontCount}/2
              </span>
            </div>
            <div style={{display:'flex', gap:10}}>
              <FormationSlot slot="front1" char={formation.front1} onRemove={handleRemove}
                label="前衛①" color={PK}/>
              <FormationSlot slot="front2" char={formation.front2} onRemove={handleRemove}
                label="前衛②" color={PK}/>
            </div>
          </div>

          {/* 後衛ライン */}
          <div>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10}}>
              <div style={{width:3, height:14, borderRadius:2, background:TEAL}}/>
              <span style={{fontSize:10, fontFamily:'Noto Sans JP', fontWeight:700, color:TEAL}}>後衛</span>
              <span style={{fontSize:9, color:'rgba(255,255,255,.3)'}}>最大2人 · 支援・間接</span>
              <span style={{marginLeft:'auto', fontFamily:'Rajdhani', fontWeight:700,
                fontSize:12, color: rearCount>0 ? TEAL : 'rgba(255,255,255,.3)'}}>
                {rearCount}/2
              </span>
            </div>
            <div style={{display:'flex', gap:10}}>
              <FormationSlot slot="rear1" char={formation.rear1} onRemove={handleRemove}
                label="後衛①" color={TEAL}/>
              <FormationSlot slot="rear2" char={formation.rear2} onRemove={handleRemove}
                label="後衛②" color={TEAL}/>
            </div>
          </div>

          {/* ルール表示 */}
          <div style={{
            padding:'8px 12px', borderRadius:7,
            background: canLaunch ? 'rgba(42,154,88,.12)' : 'rgba(196,66,122,.08)',
            border:`1px solid ${canLaunch ? 'rgba(42,154,88,.3)' : 'rgba(196,66,122,.2)'}`,
            fontSize:10, fontFamily:'Noto Sans JP', lineHeight:1.7,
            color: canLaunch ? 'rgba(100,220,130,.9)' : 'rgba(255,180,180,.8)',
          }}>
            {canLaunch
              ? `✓ 編成完了 — ${totalCount}人で出撃できます`
              : '※ 前衛を最低1人選んでください'}
          </div>

          <div style={{marginTop:'auto', display:'flex', gap:8}}>
            <button
              onClick={onCancel}
              style={{
                flex:'0 0 auto', padding:'11px 18px', borderRadius:8,
                background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.12)',
                color:'rgba(255,255,255,.5)', cursor:'pointer',
                fontFamily:"'Noto Sans JP'", fontSize:12,
                transition:'all .15s',
              }}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.1)';}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.05)';}}
            >← 戻る</button>
            <button
              onClick={() => canLaunch && onLaunch(formation, targetNode)}
              style={{
                flex:1, padding:'11px', borderRadius:8,
                background: canLaunch
                  ? `linear-gradient(135deg,${PK},${PK2})`
                  : 'rgba(196,66,122,.2)',
                border:`1px solid ${canLaunch ? PK : 'rgba(196,66,122,.25)'}`,
                color: canLaunch ? '#fff' : 'rgba(255,255,255,.3)',
                cursor: canLaunch ? 'pointer' : 'not-allowed',
                fontFamily:"'Noto Sans JP'", fontSize:13, fontWeight:700,
                boxShadow: canLaunch ? `0 3px 20px rgba(196,66,122,.5)` : 'none',
                transition:'all .2s',
              }}>
              ⚔ 出撃する！
            </button>
          </div>
        </div>

        {/* ── RIGHT: キャラ選択リスト ── */}
        <div style={{flex:1, display:'flex', flexDirection:'column', padding:'20px 20px', gap:16, overflowY:'auto'}}>
          <div style={{fontSize:10, fontFamily:'Rajdhani', fontWeight:700,
            letterSpacing:'.18em', color:'rgba(255,255,255,.4)'}}>SELECT CHARACTERS</div>

          {/* 前衛キャラ */}
          <div>
            <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:10}}>
              <div style={{width:3, height:12, borderRadius:2, background:PK}}/>
              <span style={{fontSize:9, fontFamily:'Noto Sans JP', fontWeight:700, color:PK}}>前衛キャラクター</span>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:8}}>
              {frontChars.map(c => {
                const isSelected = selectedIds.includes(c.id);
                const isFull = frontCount >= 2 && !isSelected;
                const role = ROLES[c.role];
                return (
                  <div key={c.id}
                    onClick={() => !isFull && handleCharClick(c)}
                    onMouseEnter={() => setHoverId(c.id)}
                    onMouseLeave={() => setHoverId(null)}
                    style={{
                      display:'flex', alignItems:'center', gap:10,
                      padding:'10px 12px', borderRadius:8,
                      background: isSelected ? `${PK}22` : hoverId===c.id && !isFull ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.04)',
                      border:`1.5px solid ${isSelected ? PK+'88' : hoverId===c.id && !isFull ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.08)'}`,
                      cursor: isFull ? 'not-allowed' : 'pointer',
                      opacity: isFull ? 0.4 : 1,
                      transition:'all .15s',
                    }}>
                    <div style={{width:44, height:52, borderRadius:6, overflow:'hidden', flexShrink:0,
                      border:`1.5px solid ${isSelected ? PK+'66' : 'rgba(255,255,255,.1)'}`}}>
                      {c.portrait
                        ? <img src={c.portrait} alt={c.name} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'top'}}/>
                        : <div style={{width:'100%',height:'100%',background:'rgba(255,255,255,.05)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:'rgba(255,255,255,.2)'}}>?</div>
                      }
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:12, fontWeight:900,
                        color: isSelected ? PK : 'rgba(255,255,255,.9)',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{c.name}</div>
                      <div style={{display:'flex', gap:6, marginTop:3, alignItems:'center'}}>
                        <span style={{fontSize:7, padding:'1px 5px', borderRadius:4, fontWeight:700,
                          background:`${role.color}33`, color:role.color}}>{role.label}</span>
                        <span style={{fontSize:9, fontFamily:'Rajdhani', color:'rgba(255,255,255,.4)'}}>
                          攻{c.atk} 守{c.def}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <div style={{width:18, height:18, borderRadius:'50%', background:PK,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:10, color:'#fff', flexShrink:0}}>✓</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{height:1, background:'rgba(255,255,255,.07)'}}/>

          {/* 後衛キャラ */}
          <div>
            <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:10}}>
              <div style={{width:3, height:12, borderRadius:2, background:TEAL}}/>
              <span style={{fontSize:9, fontFamily:'Noto Sans JP', fontWeight:700, color:TEAL}}>後衛キャラクター</span>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:8}}>
              {rearChars.map(c => {
                const isSelected = selectedIds.includes(c.id);
                const isFull = rearCount >= 2 && !isSelected;
                const role = ROLES[c.role];
                return (
                  <div key={c.id}
                    onClick={() => !isFull && handleCharClick(c)}
                    onMouseEnter={() => setHoverId(c.id)}
                    onMouseLeave={() => setHoverId(null)}
                    style={{
                      display:'flex', alignItems:'center', gap:10,
                      padding:'10px 12px', borderRadius:8,
                      background: isSelected ? `${TEAL}22` : hoverId===c.id && !isFull ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.04)',
                      border:`1.5px solid ${isSelected ? TEAL+'88' : hoverId===c.id && !isFull ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.08)'}`,
                      cursor: isFull ? 'not-allowed' : 'pointer',
                      opacity: isFull ? 0.4 : 1,
                      transition:'all .15s',
                    }}>
                    <div style={{width:44, height:52, borderRadius:6, overflow:'hidden', flexShrink:0,
                      border:`1.5px solid ${isSelected ? TEAL+'66' : 'rgba(255,255,255,.1)'}`}}>
                      {c.portrait
                        ? <img src={c.portrait} alt={c.name} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'top'}}/>
                        : <div style={{width:'100%',height:'100%',background:'rgba(255,255,255,.05)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,color:'rgba(255,255,255,.2)'}}>?</div>
                      }
                    </div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:12, fontWeight:900,
                        color: isSelected ? TEAL : 'rgba(255,255,255,.9)',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{c.name}</div>
                      <div style={{display:'flex', gap:6, marginTop:3, alignItems:'center'}}>
                        <span style={{fontSize:7, padding:'1px 5px', borderRadius:4, fontWeight:700,
                          background:`${role.color}33`, color:role.color}}>{role.label}</span>
                        <span style={{fontSize:9, fontFamily:'Rajdhani', color:'rgba(255,255,255,.4)'}}>
                          攻{c.atk} 守{c.def}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <div style={{width:18, height:18, borderRadius:'50%', background:TEAL,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:10, color:'#fff', flexShrink:0}}>✓</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AttackFormationScene });