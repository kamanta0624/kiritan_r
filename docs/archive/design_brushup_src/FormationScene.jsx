import React, { useState, useMemo } from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass } from '../shared/tokens.js';

const FONT_DISPLAY = "'Zen Maru Gothic',sans-serif";
const FONT_NUM     = "'Rajdhani',sans-serif";
const FIELD_BATTLE_CAPACITY = 5000;

const ATK_LABEL = { melee:'近接', ranged:'遠距離', song:'歌' };
const ATK_COLOR = { melee:PK, ranged:TEAL, song:AC2 };

/* ── atoms ── */
function Bar({ val, max, color, h=6, label }) {
  const pct = Math.max(0, Math.min(100, (val / max) * 100));
  return (
    <div style={{ width:'100%' }}>
      {label && (
        <div style={{ display:'flex', justifyContent:'space-between', fontFamily:FONT_NUM,
          fontSize:10, color:TXD, marginBottom:2, letterSpacing:'.05em' }}>
          <span>{label}</span>
          <span style={{ color:TX, fontWeight:700 }}>
            {val.toLocaleString()}<span style={{ opacity:.4 }}>/{max.toLocaleString()}</span>
          </span>
        </div>
      )}
      <div style={{ height:h, background:'rgba(28,16,32,.07)', borderRadius:h, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:h,
          transition:'width .35s ease', boxShadow:`0 0 6px ${color}55` }}/>
      </div>
    </div>
  );
}

function Pill({ label, color=PK, filled=false, size='md' }) {
  const fs = size === 'sm' ? 9 : 11;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding: size === 'sm' ? '2px 7px' : '3px 9px',
      borderRadius:99, fontSize:fs, fontWeight:700, letterSpacing:'.08em',
      background: filled ? color : 'transparent',
      color: filled ? '#fff' : color,
      border:`1px solid ${color}${filled ? '00' : '88'}`,
      whiteSpace:'nowrap',
    }}>{label}</span>
  );
}

/* ── SlotRow ── */
function SlotRow({ slotLabel, color, char, onRemove }) {
  if (!char) {
    return (
      <div style={{
        height:88, borderRadius:8, border:`1.5px dashed ${color}66`,
        background:`${color}0d`,
        display:'flex', alignItems:'center', justifyContent:'center',
        position:'relative',
      }}>
        <div style={{ position:'absolute', top:8, left:12, fontFamily:FONT_DISPLAY,
          fontSize:11, color, letterSpacing:'.18em', fontWeight:900 }}>{slotLabel}</div>
        <div style={{ color:TXF, fontSize:11, letterSpacing:'.16em',
          fontFamily:FONT_DISPLAY, fontWeight:700 }}>EMPTY</div>
      </div>
    );
  }
  const sp = char.soldiers ?? char.troops ?? 0;
  const maxSp = char.maxSoldiers ?? char.soldiers ?? sp;
  const hp = char.charHp ?? char.hp ?? 0;
  const maxHp = char.charMaxHp ?? char.maxHp ?? hp;
  const atkType = char.attackType ?? 'melee';
  return (
    <div className="pop-in" style={{
      height:88, borderRadius:8, border:`1.5px solid ${color}`,
      background:`linear-gradient(90deg, ${color}1c, rgba(255,253,251,.9))`,
      display:'flex', alignItems:'center', overflow:'hidden', position:'relative',
      boxShadow:`0 2px 14px ${color}33`,
    }}>
      <div style={{ position:'absolute', top:8, left:12, fontFamily:FONT_DISPLAY,
        fontSize:11, color, letterSpacing:'.18em', fontWeight:900 }}>{slotLabel}</div>
      <div style={{ width:78, height:'100%', overflow:'hidden', flexShrink:0,
        marginLeft:62, borderRight:`1px solid ${BR}`,
        background:`linear-gradient(180deg, ${color}22, transparent)` }}>
        {char.portrait
          ? <img src={char.portrait} alt={char.name}
              style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 12%' }}/>
          : <div style={{ width:'100%', height:'100%', background:'rgba(28,16,32,.06)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:FONT_DISPLAY, fontSize:22, color:TXF }}>?</div>
        }
      </div>
      <div style={{ flex:1, padding:'8px 14px', display:'flex', flexDirection:'column',
        justifyContent:'center', gap:5 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
          <span style={{ fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:16,
            color:TX, letterSpacing:'.04em' }}>{char.name}</span>
          <Pill label={ATK_LABEL[atkType] ?? atkType} color={ATK_COLOR[atkType] ?? PK} size="sm"/>
        </div>
        <div style={{ display:'flex', gap:10, fontFamily:FONT_NUM, fontSize:11,
          color:TXD, letterSpacing:'.08em' }}>
          <span>SP <b style={{ color:TX, fontWeight:700 }}>{sp.toLocaleString()}</b>
            <span style={{ opacity:.4 }}>/{maxSp.toLocaleString()}</span></span>
          <span>HP <b style={{ color:TX, fontWeight:700 }}>{hp}</b>
            <span style={{ opacity:.4 }}>/{maxHp}</span></span>
        </div>
      </div>
      <button onClick={onRemove} style={{
        width:34, height:34, borderRadius:6, background:'rgba(28,16,32,.06)',
        border:`1px solid ${BR}`, color:TXD, cursor:'pointer',
        marginRight:12, fontSize:14, lineHeight:'1',
      }}>×</button>
    </div>
  );
}

/* ── CharCard ── */
function CharCard({ char, disabled, disLabel, picked, pickIdx, slotColor, battleCapacity, onClick }) {
  const sp = char.soldiers ?? char.troops ?? 0;
  const atkType = char.attackType ?? 'melee';
  const atkColor = ATK_COLOR[atkType] ?? PK;
  const isActive = battleCapacity != null && sp < battleCapacity;
  return (
    <div onClick={onClick} style={{
      borderRadius:8, overflow:'hidden', position:'relative',
      border: picked ? `2px solid ${slotColor}` : `1px solid ${BR}`,
      background:'rgba(255,253,251,.92)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .45 : 1,
      transition:'transform .15s, border-color .15s, box-shadow .15s',
      boxShadow: picked ? `0 4px 18px ${slotColor}44` : '0 2px 8px rgba(28,16,32,.06)',
    }}
    onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-2px)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}>
      <div style={{ height:168, position:'relative', overflow:'hidden',
        background:`linear-gradient(180deg, ${atkColor}22, transparent 70%)` }}>
        {char.portrait
          ? <img src={char.portrait} alt={char.name} style={{
              width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 8%',
              filter: disabled ? 'grayscale(.7)' : 'none',
            }}/>
          : <div style={{ width:'100%', height:'100%', background:'rgba(28,16,32,.06)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:FONT_DISPLAY, fontSize:40, color:TXF }}>?</div>
        }
        <div style={{ position:'absolute', inset:0,
          background:'linear-gradient(180deg,transparent 55%, rgba(0,0,0,.7))' }}/>
        <div style={{ position:'absolute', top:8, left:8, display:'flex', gap:5 }}>
          <Pill label={ATK_LABEL[atkType] ?? atkType} color={atkColor} filled size="sm"/>
          {isActive && <Pill label="参戦" color={PK} filled size="sm"/>}
        </div>
        {picked && (
          <div style={{
            position:'absolute', top:8, right:8,
            width:34, height:34, borderRadius:'50%',
            background:slotColor,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:16, color:'#fff',
            boxShadow:`0 0 12px ${slotColor}99`,
          }}>{['①','②','③','④'][pickIdx]}</div>
        )}
        {disabled && disLabel && (
          <div style={{ position:'absolute', inset:0, display:'flex',
            alignItems:'center', justifyContent:'center' }}>
            <div style={{
              padding:'4px 14px', background:'rgba(255,253,251,.92)',
              border:`1px solid ${PK2}66`,
              fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:13,
              color:PK2, letterSpacing:'.18em',
            }}>{disLabel}</div>
          </div>
        )}
        <div style={{ position:'absolute', bottom:8, left:10, right:10 }}>
          <div style={{ fontSize:9, color:'rgba(255,255,255,.7)', fontFamily:FONT_DISPLAY,
            letterSpacing:'.12em' }}>{char.kana ?? ''}</div>
          <div style={{ fontSize:18, fontFamily:FONT_DISPLAY, fontWeight:900,
            color:'#fff', letterSpacing:'.04em',
            textShadow:'0 2px 8px rgba(0,0,0,.9)' }}>{char.name}</div>
        </div>
      </div>
      <div style={{ padding:'10px 12px 12px' }}>
        <div style={{ marginBottom:8 }}>
          <Bar val={sp} max={char.maxSoldiers ?? sp} color={PK} label="SP"/>
        </div>
        <Bar val={char.charHp ?? char.hp ?? 0} max={char.charMaxHp ?? char.maxHp ?? 1}
          color={AC2} label="HP"/>
      </div>
    </div>
  );
}

/* ── Zone (BattlefieldPreview helper) ── */
function Zone({ label, color, children, highlight=false }) {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', gap:6, padding:'4px 0', borderRadius:6,
      background: highlight ? `${color}14` : 'transparent',
      border: highlight ? `1px dashed ${color}55` : '1px solid transparent',
      position:'relative',
    }}>
      <div style={{ fontFamily:FONT_DISPLAY, fontSize:9, color:'rgba(255,255,255,.85)',
        letterSpacing:'.22em', fontWeight:900,
        textShadow:'0 1px 2px rgba(0,0,0,.6)' }}>{label}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'center' }}>
        {children}
      </div>
    </div>
  );
}

/* ── BattlefieldPreview ── */
function BattlefieldPreview({ formation, enemies, battleCapacity, battleMode=null, attackForm=null }) {
  const playerFront = [formation.front1, formation.front2];
  const playerRear  = [formation.rear1,  formation.rear2];
  const enemyFront = enemies.filter((_, i) => i < 2);
  const enemyRear  = enemies.filter((_, i) => i >= 2);

  const Slot = ({ char, color, flip=false }) => (
    <div style={{
      width:54, height:54, borderRadius:'50%',
      border: char ? `2px solid ${color}` : `1.5px dashed ${color}66`,
      background: char ? `${color}1c` : 'rgba(255,253,251,.5)',
      overflow:'hidden', position:'relative', flexShrink:0,
      boxShadow: char ? `0 0 12px ${color}55` : 'none',
      transition:'all .2s',
    }}>
      {char ? (
        <img src={char.portrait} alt="" style={{
          width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 10%',
          transform: flip ? 'scaleX(-1)' : 'none',
        }}/>
      ) : (
        <div style={{
          position:'absolute', inset:0, display:'flex', alignItems:'center',
          justifyContent:'center', fontFamily:FONT_DISPLAY, fontSize:9,
          color:`${color}99`, letterSpacing:'.12em', fontWeight:900,
        }}>—</div>
      )}
    </div>
  );

  return (
    <div style={{
      height:170, borderRadius:8, border:`1px solid ${BR}`,
      position:'relative', overflow:'hidden',
      backgroundImage:'url(assets/bg_battle.jpg)',
      backgroundSize:'cover', backgroundPosition:'center 50%',
      background:'linear-gradient(135deg,#1a1030,#0a1420)',
    }}>
      <div style={{
        position:'absolute', inset:0,
        background:'linear-gradient(90deg, rgba(28,16,32,.55) 0%, rgba(28,16,32,.35) 50%, rgba(184,112,16,.5) 100%)',
      }}/>
      <div style={{
        position:'absolute', top:'14%', bottom:'14%', left:'50%', width:1,
        background:'linear-gradient(180deg, transparent, rgba(255,255,255,.6), transparent)',
      }}/>
      <div style={{
        position:'absolute', top:0, left:0, right:0,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'6px 12px',
        background:'linear-gradient(180deg, rgba(0,0,0,.45), transparent)',
        zIndex:2,
      }}>
        <div style={{ fontFamily:FONT_DISPLAY, fontSize:10, color:'rgba(255,255,255,.9)',
          letterSpacing:'.32em', fontWeight:900 }}>BATTLEFIELD</div>
        <div style={{ display:'flex', gap:8, alignItems:'center', fontFamily:FONT_DISPLAY,
          fontSize:10, letterSpacing:'.22em', fontWeight:900 }}>
          <span style={{ color:PK }}>自軍</span>
          <span style={{ color:'rgba(255,255,255,.5)', fontSize:9 }}>VS</span>
          <span style={{ color:AC2 }}>敵軍</span>
        </div>
      </div>
      <div style={{
        position:'absolute', bottom:0, left:0, right:0,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'5px 12px 6px',
        background:'linear-gradient(0deg, rgba(0,0,0,.55), transparent)',
        zIndex:3, fontFamily:FONT_DISPLAY, fontSize:10, letterSpacing:'.22em', fontWeight:900,
      }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', color:'rgba(255,255,255,.92)' }}>
          <span style={{ color:'rgba(255,255,255,.6)', letterSpacing:'.28em' }}>戦闘域</span>
          <span style={{ fontFamily:FONT_NUM, fontSize:15, color:'#fff', letterSpacing:'.04em',
            textShadow:'0 1px 2px rgba(0,0,0,.7)' }}>{battleCapacity.toLocaleString()}</span>
          {battleMode && (
            <span style={{ padding:'2px 8px', borderRadius:99,
              background: battleMode === 'field' ? AC : TEAL, color:'#fff',
              fontSize:9, letterSpacing:'.14em',
            }}>{battleMode === 'field' ? '野戦' : '籠城'}</span>
          )}
        </div>
        {attackForm && (
          <div style={{ display:'flex', alignItems:'center', gap:6, color:'rgba(255,255,255,.85)' }}>
            <span style={{ color:'rgba(255,255,255,.6)', letterSpacing:'.28em' }}>攻撃形態</span>
            <span style={{ padding:'2px 8px', borderRadius:99,
              background: attackForm === '市街戦' ? PK : AC, color:'#fff',
              fontSize:9, letterSpacing:'.14em',
            }}>{attackForm}</span>
          </div>
        )}
      </div>
      <div style={{
        position:'absolute', top:30, bottom:24, left:10, right:10,
        display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:6, zIndex:1,
      }}>
        <Zone label="後衛" color={TEAL}>
          {playerRear.map((c, i) => <Slot key={`pr${i}`} char={c} color={TEAL}/>)}
        </Zone>
        <Zone label="前衛" color={PK} highlight>
          {playerFront.map((c, i) => <Slot key={`pf${i}`} char={c} color={PK}/>)}
        </Zone>
        <Zone label="敵前衛" color={AC} highlight>
          {enemyFront.map((c, i) => <Slot key={`ef${i}`} char={c} color={AC} flip/>)}
        </Zone>
        <Zone label="敵後衛" color={AC2}>
          {enemyRear.map((c, i) => <Slot key={`er${i}`} char={c} color={AC2} flip/>)}
        </Zone>
      </div>
      <div style={{
        position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        zIndex:3, pointerEvents:'none',
        fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:18, color:'#fff',
        textShadow:'0 2px 8px rgba(0,0,0,.7)',
      }}>⚔</div>
    </div>
  );
}

/* ── BattleModeToggle ── */
function BattleModeToggle({ mode, onChange, siegeCapacity, fieldCapacity }) {
  const opts = [
    { key:'field', label:'野戦で迎撃', sub:`戦闘域 ${fieldCapacity.toLocaleString()}（固定）`, color:AC },
    { key:'siege', label:'籠城して守る', sub:`戦闘域 ${siegeCapacity.toLocaleString()}（都市ボーナス）`, color:TEAL },
  ];
  return (
    <div style={{ display:'flex', gap:8 }}>
      {opts.map(o => {
        const sel = mode === o.key;
        return (
          <button key={o.key} onClick={() => onChange(o.key)} style={{
            flex:1, padding:'8px 12px', borderRadius:6,
            border: sel ? `1.5px solid ${o.color}` : `1px solid ${BR}`,
            background: sel ? o.color : 'rgba(255,253,251,.8)',
            color: sel ? '#fff' : TX,
            cursor:'pointer', textAlign:'left',
            boxShadow: sel ? `0 2px 12px ${o.color}55` : 'none',
            transition:'all .15s',
          }}>
            <div style={{ fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:13,
              letterSpacing:'.14em' }}>{o.label}</div>
            <div style={{ fontFamily:FONT_NUM, fontSize:10, marginTop:2,
              color: sel ? 'rgba(255,255,255,.85)' : TXD,
              letterSpacing:'.06em' }}>{o.sub}</div>
          </button>
        );
      })}
    </div>
  );
}

/* ── UnitMiniRow (LaunchConfirmOverlay helper) ── */
function UnitMiniRow({ char, color, ally, battleCapacity }) {
  const sp = char.soldiers ?? char.troops ?? 0;
  const isActive = battleCapacity != null && sp < battleCapacity;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:16 }}>
      <div style={{
        width:72, height:72, borderRadius:'50%', overflow:'hidden', flexShrink:0,
        border:`2px solid ${color}77`, boxShadow:`0 0 12px ${color}33`,
      }}>
        {char.portrait
          ? <img src={char.portrait} alt="" style={{
              width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 10%',
              transform: ally ? 'none' : 'scaleX(-1)',
            }}/>
          : <div style={{ width:'100%', height:'100%', background:'rgba(28,16,32,.06)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:FONT_DISPLAY, fontSize:28, color:TXF }}>?</div>
        }
      </div>
      <div style={{ flex:1, minWidth:0, fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:22,
        color:TX, letterSpacing:'.04em',
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{char.name}</div>
      {isActive && (
        <span style={{
          padding:'5px 14px', borderRadius:99,
          background: ally ? PK : AC, color:'#fff',
          fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:13, letterSpacing:'.18em',
        }}>{ally ? '参戦' : '戦闘域内'}</span>
      )}
      <span style={{ fontFamily:FONT_NUM, fontWeight:700, fontSize:24, color:TX,
        letterSpacing:'.04em', minWidth:110, textAlign:'right' }}>
        {sp.toLocaleString()}<span style={{ fontSize:13, color:TXF, fontWeight:500, marginLeft:4 }}>SP</span>
      </span>
    </div>
  );
}

/* ── LaunchConfirmOverlay ── */
function LaunchConfirmOverlay({ formation, picks, enemies, targetNode, isDefense, battleMode,
  battleCapacity, playerStrategyRate, enemyStrategyRate, onLaunch, onCancel }) {
  const allyTotal  = picks.reduce((s, c) => s + (c.soldiers ?? c.troops ?? 0), 0);
  const enemyTotal = enemies.reduce((s, e) => s + (e.maxSoldiers ?? e.soldiers ?? 0), 0);
  const sideLabel  = isDefense ? '防衛' : '攻撃';
  const sideColor  = isDefense ? TEAL : PK;

  const diff = Math.abs(playerStrategyRate - enemyStrategyRate);
  const bonus = diff > 50 ? 50 : 10;
  const isPlayerAdv = playerStrategyRate > enemyStrategyRate;
  let stratLabel, stratColor;
  if (diff === 0)       { stratLabel = '作戦 互角'; stratColor = TXD; }
  else if (isPlayerAdv) { stratLabel = `作戦成功率 ${diff}%（+${bonus}%）`; stratColor = TEAL; }
  else                  { stratLabel = `作戦不利 ${diff}%（敵 +${bonus}%）`; stratColor = AC; }

  const attackForm = !isDefense ? (targetNode?.attackForm ?? null) : null;

  return (
    <div style={{
      position:'absolute', inset:0, zIndex:100,
      background:'rgba(28,16,32,.55)', backdropFilter:'blur(10px)',
      display:'flex', alignItems:'stretch', justifyContent:'stretch',
      animation:'fadeIn .2s ease both',
    }}>
      <div style={{
        width:'100%', height:'100%',
        display:'flex', flexDirection:'column', overflow:'hidden',
        background:'rgba(251,247,239,.97)',
      }}>
        {/* 上部: 拠点名 + 背景 */}
        <div style={{
          position:'relative', height:180, overflow:'hidden', flexShrink:0,
          background:'linear-gradient(135deg,#1a1030,#0a1420)',
        }}>
          {targetNode?.image && (
            <img src={targetNode.image} alt="" style={{
              position:'absolute', inset:0, width:'100%', height:'100%',
              objectFit:'cover', objectPosition:'center 35%', opacity:.5,
            }}/>
          )}
          <div style={{ position:'absolute', inset:0,
            background:'linear-gradient(180deg, rgba(28,16,32,.3) 0%, rgba(28,16,32,.78) 100%)' }}/>
          <div style={{ position:'absolute', top:28, left:48, display:'flex', gap:12 }}>
            <span style={{
              padding:'6px 18px', borderRadius:99, background:sideColor, color:'#fff',
              fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:13, letterSpacing:'.26em',
              boxShadow:`0 0 18px ${sideColor}aa`,
            }}>{sideLabel}戦</span>
            {attackForm && (
              <span style={{
                padding:'6px 18px', borderRadius:99,
                background:'rgba(255,255,255,.18)', color:'#fff',
                border:'1.5px solid rgba(255,255,255,.55)',
                fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:12, letterSpacing:'.22em',
              }}>{attackForm}</span>
            )}
            {isDefense && battleMode && (
              <span style={{
                padding:'6px 18px', borderRadius:99,
                background: battleMode === 'field' ? AC : TEAL, color:'#fff',
                fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:12, letterSpacing:'.22em',
              }}>{battleMode === 'field' ? '野戦で迎撃' : '籠城して守る'}</span>
            )}
          </div>
          <div style={{ position:'absolute', bottom:28, left:48, right:48 }}>
            <div style={{ fontFamily:FONT_DISPLAY, fontSize:12, color:'rgba(255,255,255,.65)',
              letterSpacing:'.42em', marginBottom:8 }}>BATTLEFIELD</div>
            <div style={{ fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:52, color:'#fff',
              letterSpacing:'.16em', textShadow:'0 4px 24px rgba(0,0,0,.7)',
              lineHeight:1 }}>{targetNode?.name ?? '—'}</div>
          </div>
        </div>

        {/* 中段: 自軍 vs 敵軍 */}
        <div style={{
          flex:1, overflow:'hidden', padding:'16px 48px',
          display:'flex', flexDirection:'column', gap:14,
        }}>
          <div style={{ display:'flex', gap:16, alignItems:'stretch', flex:1, minHeight:0 }}>
            {/* 自軍 */}
            <div style={{
              flex:1, padding:'14px 18px', borderRadius:12,
              border:`2px solid ${PK}66`, background:`${PK}0d`,
              display:'flex', flexDirection:'column', gap:10,
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                <span style={{ fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:14,
                  color:PK, letterSpacing:'.28em' }}>自軍</span>
                <span style={{ fontFamily:FONT_NUM, fontWeight:700, fontSize:24, color:TX,
                  letterSpacing:'.04em', lineHeight:1 }}>
                  {allyTotal.toLocaleString()}
                  <span style={{ fontSize:12, color:TXF, fontWeight:500, marginLeft:4 }}>SP</span>
                </span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {picks.map(c => (
                  <UnitMiniRow key={c.id} char={c} color={PK} ally battleCapacity={battleCapacity}/>
                ))}
              </div>
            </div>
            {/* VS */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:28, color:TXF,
              letterSpacing:'.18em', flexShrink:0, width:52 }}>VS</div>
            {/* 敵軍 */}
            <div style={{
              flex:1, padding:'14px 18px', borderRadius:12,
              border:`2px solid ${AC}66`, background:`${AC}0d`,
              display:'flex', flexDirection:'column', gap:10,
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                <span style={{ fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:14,
                  color:AC, letterSpacing:'.28em' }}>敵軍</span>
                <span style={{ fontFamily:FONT_NUM, fontWeight:700, fontSize:24, color:TX,
                  letterSpacing:'.04em', lineHeight:1 }}>
                  {enemyTotal.toLocaleString()}
                  <span style={{ fontSize:12, color:TXF, fontWeight:500, marginLeft:4 }}>SP</span>
                </span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {enemies.map(e => (
                  <UnitMiniRow key={e.id} char={e} color={AC} ally={false} battleCapacity={battleCapacity}/>
                ))}
              </div>
            </div>
          </div>

          {/* 作戦成功率 + 戦闘域 */}
          <div style={{ display:'flex', gap:14, flexShrink:0 }}>
            <div style={{
              flex:1, padding:'10px 16px', borderRadius:10,
              border:`1.5px solid ${stratColor}55`, background:`${stratColor}10`,
              display:'flex', alignItems:'center', gap:12,
            }}>
              <span style={{ fontFamily:FONT_DISPLAY, fontSize:10, color:TXD,
                letterSpacing:'.32em', flexShrink:0 }}>STRATEGY</span>
              <span style={{ fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:14,
                color:stratColor, letterSpacing:'.14em' }}>{stratLabel}</span>
            </div>
            <div style={{
              flex:1, padding:'10px 16px', borderRadius:10,
              border:`1.5px solid ${BR}`, background:'rgba(255,253,251,.6)',
              display:'flex', alignItems:'center', gap:12,
            }}>
              <span style={{ fontFamily:FONT_DISPLAY, fontSize:10, color:TXD,
                letterSpacing:'.32em', flexShrink:0 }}>戦闘域</span>
              <span style={{ fontFamily:FONT_NUM, fontWeight:700, fontSize:22, color:TX,
                letterSpacing:'.04em', lineHeight:1 }}>
                {battleCapacity.toLocaleString()}
              </span>
              {isDefense && battleMode && (
                <span style={{
                  marginLeft:'auto', padding:'4px 10px', borderRadius:99,
                  background: battleMode === 'field' ? AC : TEAL, color:'#fff',
                  fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:11, letterSpacing:'.2em',
                }}>{battleMode === 'field' ? '野戦' : '籠城'}</span>
              )}
            </div>
          </div>
        </div>

        {/* 下部: ボタン */}
        <div style={{
          padding:'14px 48px 18px', borderTop:`1px solid ${BR}`,
          display:'flex', alignItems:'stretch', justifyContent:'center', gap:16,
          background:'rgba(255,253,251,.6)', flexShrink:0,
        }}>
          <button onClick={onCancel} style={{
            flex:1, maxWidth:240, padding:'14px 20px', borderRadius:10,
            border:`1.5px solid ${BR}`, background:'rgba(255,253,251,.92)',
            color:TX, fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:15,
            letterSpacing:'.32em', cursor:'pointer',
            boxShadow:'0 2px 12px rgba(0,0,0,.08)', transition:'transform .14s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}>
            ← 戻る
          </button>
          <button onClick={onLaunch} style={{
            flex:2, maxWidth:460, padding:'14px 40px', borderRadius:10, border:'none',
            background:`linear-gradient(135deg, ${PK}, ${PK2})`, color:'#fff',
            fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:20, letterSpacing:'.4em',
            cursor:'pointer',
            boxShadow:`0 8px 36px ${PK}88, 0 0 0 1px rgba(255,255,255,.3) inset`,
            transition:'transform .14s, filter .14s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.filter = 'brightness(1.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.filter = 'none'; }}>
            出撃 !
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main: AttackFormationScene ── */
export default function AttackFormationScene({
  targetNode,
  onLaunch,
  onCancel,
  availableChars,
  isDefense       = false,
  battleCapacity  = 3500,
  enemyStrategyRate = 0,
  enemyChars      = [],
}) {
  const [picks, setPicks] = useState([]);
  const [battleMode, setBattleMode] = useState('siege');
  const [showConfirm, setShowConfirm] = useState(false);

  const chars = availableChars ?? [];

  const effectiveBattleCapacity = isDefense && battleMode === 'field'
    ? FIELD_BATTLE_CAPACITY
    : (battleCapacity ?? targetNode?.battleCapacity ?? 3500);

  const formation = useMemo(() => ({
    front1: picks[0] ? chars.find(c => c.id === picks[0]) ?? null : null,
    front2: picks[1] ? chars.find(c => c.id === picks[1]) ?? null : null,
    rear1:  picks[2] ? chars.find(c => c.id === picks[2]) ?? null : null,
    rear2:  picks[3] ? chars.find(c => c.id === picks[3]) ?? null : null,
  }), [picks, chars]);

  const playerStrategyRate = useMemo(() => {
    const sel = picks.map(id => chars.find(c => c.id === id)).filter(Boolean);
    if (sel.length === 0) return 0;
    return Math.max(...sel.map(c => c.strategyRate ?? 0));
  }, [picks, chars]);

  const diff      = Math.abs(playerStrategyRate - enemyStrategyRate);
  const bonus     = diff > 50 ? 50 : 10;
  const isPlayerAdv = playerStrategyRate > enemyStrategyRate;
  let stratLabel, stratColor, stratBg, stratBorder;
  if (diff === 0) {
    stratLabel = '作戦 互角'; stratColor = TXD;
    stratBg = 'rgba(28,16,32,.04)'; stratBorder = BR;
  } else if (isPlayerAdv) {
    stratLabel = `作戦成功率 ${diff}%（+${bonus}% ボーナス）`; stratColor = TEAL;
    stratBg = `${TEAL}11`; stratBorder = `${TEAL}55`;
  } else {
    stratLabel = `作戦不利 ${diff}%（敵 +${bonus}%）`; stratColor = AC;
    stratBg = `${AC}11`; stratBorder = `${AC}55`;
  }

  const totalSelected = picks.length;
  const fullSlots = totalSelected >= 4;

  function togglePick(id) {
    if (picks.includes(id)) {
      setPicks(picks.filter(p => p !== id));
    } else if (!fullSlots) {
      const c = chars.find(x => x.id === id);
      if (!c) return;
      const sp = c.soldiers ?? c.troops ?? 1;
      if (c.usedThisTurn || sp <= 0 || c.penaltyTurns > 0) return;
      setPicks([...picks, id]);
    }
  }

  function removeAt(idx) { setPicks(picks.filter((_, i) => i !== idx)); }

  const enemyTotal = enemyChars.reduce((s, e) => s + (e.maxSoldiers ?? e.soldiers ?? 0), 0);

  return (
    <div style={{
      width:'100%', height:'100%', display:'flex', flexDirection:'column',
      color:TX, background:'linear-gradient(180deg,#fbf7ef 0%, #f5ede0 100%)',
      position:'relative', overflow:'hidden',
    }}>
      {/* TOP BAR */}
      <div style={{
        height:72, display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 32px', borderBottom:`1px solid ${BR}`,
        background:'rgba(255,253,251,.85)', backdropFilter:'blur(8px)', flexShrink:0,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:22, color:TX,
            letterSpacing:'.14em' }}>{isDefense ? '防衛編成' : '攻撃編成'}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          {/* 作戦成功率 */}
          <div style={{
            display:'flex', alignItems:'center', gap:6,
            padding:'6px 12px', borderRadius:6,
            border:`1px solid ${stratBorder}`, background:stratBg,
            fontFamily:FONT_DISPLAY, fontSize:11, letterSpacing:'.16em',
            color:stratColor, fontWeight:900,
          }}>
            <span style={{ fontSize:13, lineHeight:1 }}>⚔</span>
            <span>{stratLabel}</span>
          </div>
          <div style={{ fontFamily:FONT_DISPLAY, fontSize:11, color:TXD,
            letterSpacing:'.22em' }}>{isDefense ? '侵攻者' : '攻撃目標'}</div>
          <div style={{
            display:'flex', alignItems:'baseline', gap:10,
            padding:'8px 18px', border:`1.5px solid ${AC2}`,
            borderRadius:6, background:`${AC2}11`,
          }}>
            <span style={{ fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:22,
              color:AC, letterSpacing:'.08em' }}>{targetNode?.name ?? '—'}</span>
            {enemyTotal > 0 && (
              <Pill label={`敵 SP ${enemyTotal.toLocaleString()}`} color={AC} size="sm"/>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex:1, display:'flex', minHeight:0 }}>
        {/* LEFT: SLOTS */}
        <div style={{
          width:500, padding:'26px 26px 22px', display:'flex', flexDirection:'column',
          borderRight:`1px solid ${BR}`, position:'relative', overflow:'hidden',
        }}>
          <div style={{
            position:'absolute', inset:0,
            background:'linear-gradient(180deg, rgba(251,247,239,.78) 0%, rgba(251,247,239,.55) 40%, rgba(251,247,239,.78) 100%)',
            zIndex:0,
          }}/>
          <div style={{ position:'relative', zIndex:1, display:'flex',
            flexDirection:'column', flex:1, minHeight:0 }}>
            <div style={{ fontFamily:FONT_DISPLAY, fontSize:13, color:TXD,
              letterSpacing:'.22em', marginBottom:14 }}>EDITING — 編成スロット</div>

            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <SlotRow slotLabel="① 前衛" color={PK}   char={formation.front1} onRemove={() => removeAt(0)}/>
              <SlotRow slotLabel="② 前衛" color={PK}   char={formation.front2} onRemove={() => removeAt(1)}/>
              <SlotRow slotLabel="③ 後衛" color={TEAL} char={formation.rear1}  onRemove={() => removeAt(2)}/>
              <SlotRow slotLabel="④ 後衛" color={TEAL} char={formation.rear2}  onRemove={() => removeAt(3)}/>
            </div>

            <div style={{ marginTop:'auto', display:'flex', flexDirection:'column', gap:10, paddingTop:14 }}>
              <BattlefieldPreview
                formation={formation}
                enemies={enemyChars}
                battleCapacity={effectiveBattleCapacity}
                battleMode={isDefense ? battleMode : null}
                attackForm={!isDefense ? (targetNode?.attackForm ?? null) : null}
              />

              {isDefense && (
                <BattleModeToggle
                  mode={battleMode}
                  onChange={setBattleMode}
                  siegeCapacity={battleCapacity ?? targetNode?.battleCapacity ?? 3500}
                  fieldCapacity={FIELD_BATTLE_CAPACITY}
                />
              )}

              <div style={{ display:'flex', gap:10 }}>
                {isDefense ? (
                  <button
                    onClick={onCancel}
                    style={{
                      flex:1, height:52, borderRadius:6, border:`1px solid ${BR}`,
                      background:'rgba(255,253,251,.7)', color:TX,
                      fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:13, letterSpacing:'.2em',
                      cursor:'pointer',
                    }}
                  >戻る</button>
                ) : (
                  <button onClick={onCancel} style={{
                    flex:1, height:52, borderRadius:6, border:`1px solid ${BR}`,
                    background:'rgba(255,253,251,.7)', color:TX,
                    fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:13, letterSpacing:'.2em',
                    cursor:'pointer',
                  }}>戻る</button>
                )}
                <button
                  onClick={() => totalSelected >= 1 && setShowConfirm(true)}
                  disabled={totalSelected < 1}
                  style={{
                    flex:2, height:52, borderRadius:6, border:'none',
                    background: totalSelected < 1 ? 'rgba(28,16,32,.08)'
                      : `linear-gradient(135deg,${PK},${PK2})`,
                    color: totalSelected < 1 ? TXF : '#fff',
                    fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:15, letterSpacing:'.28em',
                    cursor: totalSelected < 1 ? 'not-allowed' : 'pointer',
                    boxShadow: totalSelected < 1 ? 'none' : `0 4px 22px ${PK}55`,
                    transition:'all .15s',
                  }}>
                  {totalSelected < 1 ? '— キャラを選択 —' : '出撃 !'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: CHAR LIST */}
        <div style={{ flex:1, padding:'26px 30px', display:'flex',
          flexDirection:'column', minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between',
            marginBottom:14 }}>
            <div style={{ fontFamily:FONT_DISPLAY, fontSize:13, color:TXD,
              letterSpacing:'.22em' }}>ROSTER — 出撃可能なキャラ</div>
            <div style={{ fontFamily:FONT_NUM, fontSize:11, color:TXF,
              letterSpacing:'.18em' }}>CLICK TO {fullSlots ? 'REPLACE' : 'ASSIGN'}</div>
          </div>

          <div style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))',
            gap:14, alignContent:'start', overflowY:'auto', paddingRight:4,
          }}>
            {chars.map(c => {
              const sp = c.soldiers ?? c.troops ?? 1;
              const pickIdx = picks.indexOf(c.id);
              const isPicked = pickIdx >= 0;
              const slotColor = pickIdx < 2 ? PK : TEAL;
              const isUsed = !!c.usedThisTurn;
              const isWipedOut = sp <= 0;
              const isPenalty = c.penaltyTurns > 0;
              const disabled = isUsed || isWipedOut || isPenalty || (fullSlots && !isPicked);
              const disLabel = isUsed ? '出撃済み'
                : isWipedOut ? '壊滅'
                : isPenalty ? `負傷 ${c.penaltyTurns}t`
                : null;
              return (
                <CharCard
                  key={c.id}
                  char={c}
                  disabled={disabled}
                  disLabel={disLabel}
                  picked={isPicked}
                  pickIdx={pickIdx}
                  slotColor={slotColor}
                  battleCapacity={effectiveBattleCapacity}
                  onClick={() => !disabled && togglePick(c.id)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* 出撃前確認オーバーレイ */}
      {showConfirm && (
        <LaunchConfirmOverlay
          formation={formation}
          picks={picks.map(id => chars.find(c => c.id === id)).filter(Boolean)}
          enemies={enemyChars}
          targetNode={targetNode}
          isDefense={isDefense}
          battleMode={isDefense ? battleMode : null}
          battleCapacity={effectiveBattleCapacity}
          playerStrategyRate={playerStrategyRate}
          enemyStrategyRate={enemyStrategyRate}
          onLaunch={() => {
            setShowConfirm(false);
            onLaunch(formation, targetNode, {
              isDefense,
              battleMode,
              battleCapacity: effectiveBattleCapacity,
            });
          }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
