import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BattleEngineV3 } from '../game/systems/BattleEngineV3.js';
import { BattleAI }       from '../game/systems/BattleAI.js';
import skillsData          from '../game/data/skills.json';

const SKILLS = Object.fromEntries((skillsData.skills ?? []).map(s => [s.id, s]));

// ── Design v4 トークン ──────────────────────────────────────
const PK='#c4427a', PK2='#9e2d5f';
const AC='#b87010', AC2='#d4a044';
const TEAL='#1a8a96';
const TX='#1c1020', TXD='rgba(28,16,32,.55)', TXF='rgba(28,16,32,.24)';
const BR='rgba(0,0,0,.08)';
const FONT_DISPLAY="'Zen Maru Gothic',sans-serif";
const FONT_NUM="'Rajdhani',sans-serif";
const glass = (extra={}) => ({
  background:'rgba(255,253,251,.92)',
  backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
  border:'1px solid rgba(255,255,255,.8)',
  boxShadow:'0 2px 18px rgba(0,0,0,.13)',
  ...extra,
});
const ATK_LABEL = { melee:'近接', ranged:'遠距離', song:'歌', attack:'近接', skill:'特技', focus:'集中', special:'必殺技', defend:'防御', retreat:'撤退' };
const ATK_COLOR = { melee:PK, ranged:TEAL, song:AC2, attack:PK };
const POS_LABEL = { front:'前衛', rear:'後衛' };

// M1: エンジンに渡す前にactionキーを変換
const ACTION_MAP = {
  melee:'attack', ranged:'ranged', song:'song',
  defend:'defend', retreat:'retreat', focus:'focus', special:'special', skill:'skill',
};

// ── ユーティリティ ──────────────────────────────────────────
function _calcOptions(unit) {
  const isFront  = unit.position === 'front';
  const aType    = unit.char?.attackType;
  const isRanged = aType === 'ranged';
  const isSong   = aType === 'song';
  if (!isFront && !isRanged && !isSong) return ['defend', 'retreat'];
  const atk = isSong ? 'song' : isRanged ? 'ranged' : 'attack';
  return [atk, 'defend', 'retreat'];
}

function _calcPool(unit, action, isPlayer, eng) {
  const opponents = isPlayer ? eng.enemySide : eng.playerSide;
  const alive = opponents.filter(u => !eng.isDead(u) && !u.retreated);
  if (action === 'ranged' || action === 'song') return alive;
  const front = alive.filter(u => u.position === 'front');
  return front.length ? front : alive;
}

function normalizeChar(c, idx) {
  return {
    id:c.id, name:c.name, position: idx < 2 ? 'front' : 'rear',
    atk:c.charAttack??c.soldierAtk??10, def:c.soldierDef??8,
    meme:c.soldiers??500, max:c.maxSoldiers??c.soldiers??500, memeMax:c.maxSoldiers??c.soldiers??500,
    hp:c.charHp??200, hpMax:c.charMaxHp??200, portrait:c.portrait??null, _raw:c, status:idx===0?'active':'pending',
  };
}
function buildDefaultEnemies(targetNode) {
  const total   = targetNode?.troops ?? targetNode?.battleCapacity ?? 400;
  const troopPer = Math.max(50, Math.round(total / 4));
  const baseName = targetNode?.name ?? '敵';
  return [
    { id:'e1', name:`${baseName}の兵1`, position:'front', atk:10, def:8,  meme:troopPer, max:troopPer, hp:150, hpMax:150, portrait:null },
    { id:'e2', name:`${baseName}の兵2`, position:'rear',  atk:8,  def:10, meme:troopPer, max:troopPer, hp:150, hpMax:150, portrait:null },
    { id:'e3', name:`${baseName}の兵3`, position:'front', atk:9,  def:9,  meme:troopPer, max:troopPer, hp:150, hpMax:150, portrait:null },
    { id:'e4', name:`${baseName}の兵4`, position:'rear',  atk:8,  def:9,  meme:troopPer, max:troopPer, hp:150, hpMax:150, portrait:null },
  ];
}

// ── 汎用UIアトム ─────────────────────────────────────────────
function Bar({ val, max, color, h=6, label }) {
  const pct = Math.max(0, Math.min(100, (val / max) * 100));
  return (
    <div style={{ width:'100%' }}>
      {label && (
        <div style={{ display:'flex', justifyContent:'space-between', fontFamily:FONT_NUM, fontSize:10, color:TXD, marginBottom:2 }}>
          <span>{label}</span>
          <span style={{ color:TX, fontWeight:700 }}>{val.toLocaleString()}<span style={{ opacity:.4 }}>/{max.toLocaleString()}</span></span>
        </div>
      )}
      <div style={{ height:h, background:'rgba(28,16,32,.07)', borderRadius:h, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:h, transition:'width .35s ease', boxShadow:`0 0 6px ${color}55` }}/>
      </div>
    </div>
  );
}

function Pill({ label, color=PK, filled=false, size='md' }) {
  const fs = size==='sm' ? 9 : 11;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center',
      padding:size==='sm'?'2px 7px':'3px 9px',
      borderRadius:99, fontSize:fs, fontWeight:700, letterSpacing:'.08em',
      background:filled ? color : 'transparent',
      color:filled ? '#fff' : color,
      border:`1px solid ${color}${filled?'00':'88'}`,
      whiteSpace:'nowrap',
    }}>{label}</span>
  );
}

// ── R10: 作戦ボーナスバッジ ───────────────────────────────────
function StrategyBadge({ side, bonus }) {
  const color = side==='player' ? TEAL : AC;
  return (
    <div style={{
      padding:'4px 12px', borderRadius:99,
      background:color, color:'#fff',
      fontSize:11, fontWeight:900, fontFamily:FONT_DISPLAY, letterSpacing:'.12em',
      boxShadow:`0 0 10px ${color}66`, whiteSpace:'nowrap',
    }}>⚔ 作戦 +{Math.round(bonus*100)}%</div>
  );
}

// ── R9: 作戦カットイン ────────────────────────────────────────
function StrategyCutin({ winner, onSkip }) {
  const enemy   = winner.side === 'enemy';
  const accent  = enemy ? AC : TEAL;
  const accent2 = enemy ? AC2 : '#26b0bf';
  const line    = winner.char.quotes?.strategy || '作戦は完璧——勝利は約束された';
  return (
    <div onClick={onSkip} style={{
      position:'absolute', inset:0, zIndex:60, cursor:'pointer', overflow:'hidden',
      backgroundColor:'#0a0816',
      backgroundImage:'url(assets/bg_battle.jpg)',
      backgroundSize:'cover', backgroundPosition:'center 40%',
      animation:'cutinFade .3s ease both',
    }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(2,1,8,.78)' }}/>
      <div style={{
        position:'absolute', inset:0,
        background:`repeating-linear-gradient(-18deg, transparent 0 60px, ${accent}22 60px 120px)`,
        animation:'cutinSlide 1.6s linear infinite',
      }}/>
      <div style={{
        position:'absolute', top:0, bottom:0, left:'-20%', width:'140%',
        background:`linear-gradient(180deg, transparent 30%, ${accent}55 50%, transparent 70%)`,
        transform:'skewY(-8deg)',
      }}/>
      <div style={{
        position:'absolute', top:'50%', left:'50%',
        transform:'translate(-50%,-50%)',
        display:'flex', alignItems:'center', gap:60,
        animation:'cutinPortrait .5s cubic-bezier(.18,.9,.32,1.2) both',
        flexDirection: enemy ? 'row-reverse' : 'row',
      }}>
        <div style={{
          width:560, height:780, borderRadius:18, overflow:'hidden',
          border:`6px solid ${accent}`, boxShadow:`0 0 80px ${accent}cc, 0 0 0 14px rgba(0,0,0,.7)`,
          background:'#0a0816', flexShrink:0, position:'relative',
        }}>
          <img src={winner.char.portrait} alt="" style={{
            width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 8%',
            transform: enemy ? 'scaleX(-1)' : 'none',
          }}/>
          <div style={{ position:'absolute', inset:0, background:`linear-gradient(180deg, transparent 55%, ${accent}66)` }}/>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:22, maxWidth:780, alignItems:enemy?'flex-end':'flex-start' }}>
          <div style={{ fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:22, color:accent, letterSpacing:'.52em' }}>
            STRATEGY {enemy ? 'BREACH' : 'SUCCESS'}
          </div>
          <div style={{
            fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:128, lineHeight:1,
            color:'#fff', letterSpacing:'.12em',
            textShadow:`0 0 32px ${accent}cc, 0 6px 0 rgba(0,0,0,.85)`,
            textAlign: enemy ? 'right' : 'left',
          }}>{enemy ? '作戦不利' : '作戦成功'}</div>
          <div style={{ fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:48, color:'#fff', letterSpacing:'.04em', lineHeight:1.3, textShadow:'0 4px 16px rgba(0,0,0,.85)', marginTop:4 }}>
            {winner.char.name}
          </div>
          <div style={{ fontFamily:FONT_DISPLAY, fontWeight:700, fontSize:40, color:'rgba(255,255,255,.95)', lineHeight:1.3, letterSpacing:'.04em', textShadow:'0 3px 12px rgba(0,0,0,.85)', maxWidth:760 }}>
            「{line}」
          </div>
          <div style={{
            marginTop:10, padding:'10px 26px', borderRadius:99,
            background:`linear-gradient(135deg, ${accent}, ${accent2})`, color:'#fff',
            fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:22, letterSpacing:'.16em',
            boxShadow:`0 6px 28px ${accent}aa`,
          }}>SP攻撃 {enemy ? '−' : '+'}{Math.round(winner.bonus*100)}%</div>
        </div>
      </div>
      <div style={{
        position:'absolute', bottom:36, left:'50%', transform:'translateX(-50%)',
        padding:'8px 22px', borderRadius:99,
        background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.4)',
        fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:13, color:'#fff', letterSpacing:'.32em',
        animation:'pulse 1.4s ease-in-out infinite',
      }}>クリックでスキップ</div>
    </div>
  );
}

// ── 撤退確認オーバーレイ (M2: 確定ボタンはengine.executeAction呼び出し元へ委譲) ──
function RetreatConfirmOverlay({ targetNode, allyDisplay, enemyDisplay, onConfirm, onCancel }) {
  const allyTotal = allyDisplay.reduce((s, u) => s + Math.max(0, u.soldiers), 0);
  const allyMax   = allyDisplay.reduce((s, u) => s + u.maxSoldiers, 0);
  const enemyTotal = enemyDisplay.reduce((s, u) => s + Math.max(0, u.soldiers), 0);
  return (
    <div onClick={onCancel} style={{
      position:'absolute', inset:0, zIndex:80,
      background:'rgba(28,16,32,.72)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:40,
      animation:'fadeIn .2s ease both',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        ...glass({ borderRadius:14 }),
        width:'min(720px, 100%)', padding:'40px 48px 32px',
        display:'flex', flexDirection:'column', alignItems:'center', gap:18,
        position:'relative', animation:'popIn .28s cubic-bezier(.2,.8,.3,1.3) both',
        boxShadow:'0 24px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.4)',
      }}>
        <div style={{
          width:72, height:72, borderRadius:'50%',
          background:`linear-gradient(135deg, ${PK2}, ${PK})`,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:42, color:'#fff',
          boxShadow:`0 4px 24px ${PK2}88`, lineHeight:1,
        }}>!</div>
        <div style={{ fontFamily:FONT_DISPLAY, fontSize:11, color:PK2, letterSpacing:'.42em', fontWeight:900 }}>
          WARNING — 撤退の確認
        </div>
        <div style={{ fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:38, color:TX, letterSpacing:'.12em', textAlign:'center', lineHeight:1.2 }}>
          本当に撤退しますか？
        </div>
        <div style={{ padding:'14px 22px', borderRadius:8, background:`${PK2}11`, border:`1px solid ${PK2}55`, maxWidth:560, textAlign:'center' }}>
          <div style={{ fontFamily:"'Noto Sans JP'", fontSize:14, fontWeight:700, color:PK2, letterSpacing:'.06em', lineHeight:1.6 }}>
            撤退すると<u style={{ textDecorationThickness:2 }}>この戦闘は敗北扱い</u>になります。
          </div>
          <div style={{ fontFamily:"'Noto Sans JP'", fontSize:12, color:TXD, letterSpacing:'.04em', marginTop:6, lineHeight:1.55 }}>
            出撃中の部隊全員が戦線から離脱し、{targetNode?.name ?? '目標'} は敵の手に残ります。
          </div>
        </div>
        <div style={{ display:'flex', gap:14, width:'100%', maxWidth:560, fontFamily:FONT_NUM }}>
          <div style={{ flex:1, padding:'10px 14px', borderRadius:6, border:`1px solid ${PK}55`, background:`${PK}0c` }}>
            <div style={{ fontFamily:FONT_DISPLAY, fontSize:10, color:PK, letterSpacing:'.22em', fontWeight:900, marginBottom:4 }}>自軍 残存</div>
            <div style={{ fontSize:20, fontWeight:700, color:TX }}>
              {allyTotal.toLocaleString()}<span style={{ fontSize:10, color:TXF }}> / {allyMax.toLocaleString()} SP</span>
            </div>
          </div>
          <div style={{ flex:1, padding:'10px 14px', borderRadius:6, border:`1px solid ${AC}55`, background:`${AC}0c` }}>
            <div style={{ fontFamily:FONT_DISPLAY, fontSize:10, color:AC, letterSpacing:'.22em', fontWeight:900, marginBottom:4 }}>敵軍 残存</div>
            <div style={{ fontSize:20, fontWeight:700, color:TX }}>
              {enemyTotal.toLocaleString()}<span style={{ fontSize:10, color:TXF }}> SP</span>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:14, width:'100%', maxWidth:560, marginTop:4 }}>
          <button onClick={onCancel} style={{
            flex:1, padding:'16px 20px', borderRadius:8, border:`1.5px solid ${BR}`,
            background:'rgba(255,253,251,.9)', color:TX, fontFamily:FONT_DISPLAY,
            fontWeight:900, fontSize:15, letterSpacing:'.2em', cursor:'pointer',
          }}>戦闘を続ける</button>
          <button onClick={onConfirm} style={{
            flex:1, padding:'16px 20px', borderRadius:8, border:'none',
            background:`linear-gradient(135deg, ${PK2}, ${PK})`, color:'#fff',
            fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:15, letterSpacing:'.2em',
            cursor:'pointer', boxShadow:`0 4px 24px ${PK2}66`,
          }}>撤退する（敗北）</button>
        </div>
      </div>
    </div>
  );
}

// ── AllyHoverMenu ─────────────────────────────────────────────
function AllyHoverMenu({ unit, isDuel, onAction }) {
  const charged   = !!unit?.charged;
  const skillUsed = !!unit?.skillUsed;
  const focusBtn  = skillUsed ? null
    : charged
      ? { act:'special', label:'必殺技', desc:'充填完了 — 敵を選択', special:true }
      : { act:'focus',   label:'集中',   desc:'必殺技を充填', color:PK };
  return (
    <div style={{
      position:'absolute', inset:0, zIndex:10,
      background:'linear-gradient(135deg, rgba(28,16,32,.86) 0%, rgba(158,45,95,.78) 100%)',
      display:'flex', alignItems:'stretch', justifyContent:'center', gap:8, padding:12,
      animation:'fadeIn .14s ease both', backdropFilter:'blur(2px)',
    }}>
      {focusBtn && (
        <button onClick={e => { e.stopPropagation(); onAction(focusBtn.act); }} style={{
          flex:1, borderRadius:6, border:'none', cursor:'pointer',
          background: focusBtn.special ? `linear-gradient(135deg, ${PK}, #ff2255)` : PK,
          color:'#fff', fontFamily:FONT_DISPLAY, fontWeight:900,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, padding:'8px 6px',
          boxShadow: focusBtn.special ? '0 0 18px #ff225588' : '0 2px 8px rgba(0,0,0,.25)',
        }}>
          <div style={{ fontSize:focusBtn.special?24:18, letterSpacing:'.12em' }}>{focusBtn.label}</div>
          <div style={{ fontSize:9, opacity:.88, letterSpacing:'.04em', fontFamily:"'Noto Sans JP'", fontWeight:500, lineHeight:1.25, textAlign:'center' }}>{focusBtn.desc}</div>
        </button>
      )}
      <button onClick={e => { e.stopPropagation(); onAction('defend'); }} style={{
        flex:1, borderRadius:6, border:'none', cursor:'pointer',
        background:TEAL, color:'#fff', fontFamily:FONT_DISPLAY, fontWeight:900,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, padding:'8px 6px',
        boxShadow:'0 2px 8px rgba(0,0,0,.25)',
      }}>
        <div style={{ fontSize:18, letterSpacing:'.12em' }}>防御</div>
        <div style={{ fontSize:9, opacity:.88, letterSpacing:'.04em', fontFamily:"'Noto Sans JP'", fontWeight:500, lineHeight:1.25 }}>被ダメージを軽減</div>
      </button>
      {/* R13: 決闘モードでは撤退ボタンを非表示 */}
      {!isDuel && (
        <button onClick={e => { e.stopPropagation(); onAction('retreat-request'); }} style={{
          flex:1, borderRadius:6, border:'none', cursor:'pointer',
          background:TXD, color:'#fff', fontFamily:FONT_DISPLAY, fontWeight:900,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, padding:'8px 6px',
          boxShadow:'0 2px 8px rgba(0,0,0,.25)',
        }}>
          <div style={{ fontSize:18, letterSpacing:'.12em' }}>撤退</div>
          <div style={{ fontSize:9, opacity:.88, letterSpacing:'.04em', fontFamily:"'Noto Sans JP'", fontWeight:500, lineHeight:1.25 }}>戦闘から離脱（敗北）</div>
        </button>
      )}
    </div>
  );
}

// ── EnemyHoverMenu ────────────────────────────────────────────
function EnemyHoverMenu({ attackerAtkType, onAttack }) {
  const t = attackerAtkType ?? 'melee';
  const labels = { melee:'近接', ranged:'遠距離', song:'歌', attack:'近接' };
  const descs  = { melee:'前列の敵に直接ダメージ', ranged:'任意の敵1体に貫通', song:'敵1体に歌でダメージ', attack:'前列の敵に直接ダメージ' };
  return (
    <div onClick={onAttack} style={{
      position:'absolute', inset:0, zIndex:10,
      background:`linear-gradient(135deg, ${AC}ee 0%, ${AC2}cc 100%)`,
      display:'flex', alignItems:'center', justifyContent:'center', padding:14,
      cursor:'crosshair', animation:'fadeIn .14s ease both', backdropFilter:'blur(2px)',
    }}>
      <div style={{
        flex:1, alignSelf:'stretch', borderRadius:6, border:'2px solid rgba(255,255,255,.7)',
        background:'rgba(28,16,32,.22)', color:'#fff',
        fontFamily:FONT_DISPLAY, fontWeight:900,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6,
        textShadow:'0 1px 2px rgba(0,0,0,.45)',
      }}>
        <svg width="36" height="36" viewBox="0 0 36 36" style={{ filter:'drop-shadow(0 0 6px rgba(255,255,255,.6))' }}>
          <circle cx="18" cy="18" r="14" stroke="#fff" strokeWidth="1.4" fill="none" opacity=".88"/>
          <circle cx="18" cy="18" r="8"  stroke="#fff" strokeWidth="1.2" fill="none" opacity=".66"/>
          <line x1="18" y1="0"  x2="18" y2="8"  stroke="#fff" strokeWidth="1.6"/>
          <line x1="18" y1="28" x2="18" y2="36" stroke="#fff" strokeWidth="1.6"/>
          <line x1="0"  y1="18" x2="8"  y2="18" stroke="#fff" strokeWidth="1.6"/>
          <line x1="28" y1="18" x2="36" y2="18" stroke="#fff" strokeWidth="1.6"/>
          <circle cx="18" cy="18" r="2.5" fill="#fff"/>
        </svg>
        <div style={{ fontSize:22, letterSpacing:'.14em' }}>{labels[t] ?? '攻撃'}</div>
        <div style={{ fontSize:10, opacity:.94, letterSpacing:'.04em', fontFamily:"'Noto Sans JP'", fontWeight:500, textAlign:'center' }}>
          {descs[t] ?? '攻撃する'}
        </div>
      </div>
    </div>
  );
}

// ── UnitCard (Design v4) ──────────────────────────────────────
function UnitCard({ unit, active, ally, activeUnit, specialPending, onAllyAction, onEnemyAttack, battleCapacity, isDuel }) {
  const color  = ally ? PK : AC;
  const dead   = unit.soldiers <= 0;
  const done   = unit.status === 'done';
  const retreated = unit.action === 'retreat';
  const defended  = unit.action === 'defend';
  const [hover, setHover] = useState(false);

  const attackerCanAttack = activeUnit && (() => {
    const t = activeUnit.attackType;
    return t === 'ranged' || t === 'song' || (t === 'melee' || t === 'attack') && activeUnit.position === 'front';
  })();
  const targetable = !ally && !dead && activeUnit && (attackerCanAttack || specialPending);
  const showAllyMenu   = ally && active && hover && !dead && !done;
  const showAttackMenu = targetable && hover;
  const heightStyle    = active ? { flexGrow:2, flexShrink:0, flexBasis:0, minHeight:208 } : { flexGrow:1, flexShrink:0, flexBasis:0, minHeight:124 };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position:'relative', borderRadius:8, overflow:'hidden',
        border: active ? `2px solid ${PK}` : targetable ? `1.5px solid ${AC}` : `1px solid ${BR}`,
        background: active ? `linear-gradient(135deg, ${PK}14, rgba(255,253,251,.95))` : 'rgba(255,253,251,.94)',
        boxShadow: active ? `0 4px 22px ${PK}44` : targetable && hover ? `0 0 18px ${AC}aa` : '0 2px 8px rgba(28,16,32,.06)',
        cursor: showAttackMenu ? 'crosshair' : (ally && active) ? 'pointer' : 'default',
        opacity: dead ? .42 : done && !active ? .58 : 1,
        transition:'border .22s, background .22s, box-shadow .22s, opacity .22s, min-height .22s',
        ...heightStyle, display:'flex', flexDirection:'column',
      }}>
      {active && (
        <div style={{
          position:'absolute', top:-1, left:-1, zIndex:6,
          padding:'4px 14px', background:`linear-gradient(90deg,${PK},${PK2})`,
          fontFamily:FONT_DISPLAY, fontSize:11, fontWeight:900, color:'#fff',
          letterSpacing:'.22em', borderRadius:'0 0 8px 0',
          animation:'badgeBob 1.6s ease-in-out infinite',
        }}>● 行動中</div>
      )}
      {(retreated || defended || dead) && (
        <div style={{ position:'absolute', top:8, right:8, zIndex:6 }}>
          <Pill label={dead ? '壊滅' : retreated ? '撤退済' : '防御中'} color={dead ? PK2 : retreated ? TXD : TEAL} filled size="sm"/>
        </div>
      )}
      {targetable && !hover && (
        <div style={{ position:'absolute', inset:0, border:`1.5px dashed ${AC}aa`, borderRadius:8, animation:'pulse 1.6s infinite', pointerEvents:'none', zIndex:5 }}/>
      )}
      <div style={{ display:'flex', flex:1, minHeight:0 }}>
        <div style={{
          width:active?120:86, flexShrink:0, position:'relative', overflow:'hidden',
          background:`linear-gradient(180deg, ${color}28, transparent 70%)`, transition:'width .25s',
        }}>
          {unit.portrait ? (
            <img src={unit.portrait} alt={unit.name} style={{
              width:'100%', height:'100%', objectFit:'cover',
              objectPosition: active ? 'center 14%' : 'center top',
              transform: ally ? 'none' : 'scaleX(-1)',
              filter: dead ? 'grayscale(.9) brightness(.6)' : 'none',
            }}/>
          ) : (
            <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={`${color}55`} strokeWidth="1.5">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            </div>
          )}
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,transparent 50%, rgba(0,0,0,.55))' }}/>
        </div>
        <div style={{ flex:1, padding:'10px 12px 12px', display:'flex', flexDirection:'column', gap:active?7:5, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
            <div style={{ fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:active?17:14, color:TX, letterSpacing:'.04em' }}>{unit.name}</div>
            <div style={{ display:'flex', gap:4 }}>
              <Pill label={POS_LABEL[unit.position]} color={unit.position==='front'?PK:TEAL} size="sm"/>
              <Pill label={ATK_LABEL[unit.attackType] ?? unit.attackType} color={ATK_COLOR[unit.attackType] ?? PK} size="sm"/>
            </div>
          </div>
          <Bar val={unit.soldiers} max={unit.maxSoldiers} color={color} label="SP" h={active?8:6}/>
          {/* R11: 参戦中ラベル */}
          {battleCapacity != null && unit.soldiers > 0 && unit.soldiers < battleCapacity && (
            <div style={{ display:'flex', justifyContent:ally?'flex-start':'flex-end', marginTop:-2 }}>
              <span style={{
                padding:'2px 8px', borderRadius:99,
                background:ally?PK:AC, color:'#fff',
                fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:9, letterSpacing:'.14em',
              }}>⚠ 参戦中</span>
            </div>
          )}
          <Bar val={unit.charHp} max={unit.charMaxHp} color={AC2} label="HP" h={active?6:5}/>
          {active && (
            <div style={{ marginTop:'auto', display:'flex', gap:6, alignItems:'center', fontFamily:FONT_DISPLAY, fontSize:10, color:TXD, letterSpacing:'.18em' }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background:PK, boxShadow:`0 0 6px ${PK}`, animation:'pulse 1s infinite' }}/>
              カーソルを乗せる → 行動コマンド
            </div>
          )}
          {targetable && !active && (
            <div style={{ marginTop:'auto', display:'flex', gap:6, alignItems:'center', justifyContent:'flex-end', fontFamily:FONT_DISPLAY, fontSize:10, color:AC, letterSpacing:'.18em' }}>
              カーソル → 攻撃
              <div style={{ width:5, height:5, borderRadius:'50%', background:AC, boxShadow:`0 0 6px ${AC}`, animation:'pulse 1.2s infinite' }}/>
            </div>
          )}
        </div>
      </div>
      {showAllyMenu  && <AllyHoverMenu unit={unit} isDuel={isDuel} onAction={onAllyAction}/>}
      {showAttackMenu && (
        <EnemyHoverMenu
          attackerAtkType={activeUnit?.attackType}
          onAttack={() => onEnemyAttack(unit.id)}
        />
      )}
    </div>
  );
}

// ── ColumnHeader ──────────────────────────────────────────────
function ColumnHeader({ label, sub, color, align='left' }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent: align==='right' ? 'flex-end' : 'space-between',
      gap:10, padding:'4px 8px',
      background:'rgba(255,253,251,.78)', borderRadius:6, border:`1px solid ${BR}`,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, flexDirection:align==='right'?'row-reverse':'row' }}>
        <div style={{ width:7, height:7, borderRadius:'50%', background:color, boxShadow:`0 0 8px ${color}` }}/>
        <div style={{ fontFamily:FONT_DISPLAY, fontSize:11, fontWeight:900, color, letterSpacing:'.28em' }}>{label}</div>
      </div>
      <div style={{ fontFamily:FONT_NUM, fontSize:11, color:TXD, letterSpacing:'.1em' }}>{sub}</div>
    </div>
  );
}

// ── BattleEndPanel ────────────────────────────────────────────
function BattleEndPanel({ winner, onReturn }) {
  return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:24 }}>
      <div>
        <div style={{ fontFamily:FONT_DISPLAY, fontSize:11, color:TXD, letterSpacing:'.28em', marginBottom:6 }}>RESULT</div>
        <div style={{ fontFamily:FONT_DISPLAY, fontSize:28, fontWeight:900, color:winner==='player'?PK:AC, letterSpacing:'.16em' }}>
          {winner === 'player' ? '我が軍の勝利' : '敵軍の勝利'}
        </div>
      </div>
      <button onClick={onReturn} style={{
        height:54, padding:'0 32px', borderRadius:6,
        background:`linear-gradient(135deg,${PK},${PK2})`, border:'none',
        color:'#fff', fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:15, letterSpacing:'.28em',
        cursor:'pointer', boxShadow:`0 4px 22px ${PK}55`,
      }}>マップへ戻る</button>
    </div>
  );
}

// ── SoldierCountHeader ─────────────────────────────────────────
function SoldierCountHeader({ side, color, value, max }) {
  const flip = side === 'right';
  return (
    <div style={{
      position:'absolute', top:14,
      [flip ? 'right' : 'left']: 36,
      display:'flex', flexDirection:'column', alignItems: flip ? 'flex-end' : 'flex-start',
      zIndex:5, pointerEvents:'none',
    }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
        <span style={{ fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:14, color:'rgba(255,255,200,.9)', letterSpacing:'.32em', textShadow:'0 2px 6px rgba(0,0,0,.85)' }}>部下数</span>
        <span style={{ fontFamily:FONT_NUM, fontWeight:900, fontSize:56, lineHeight:1, color:'#fff', textShadow:`0 0 18px ${color}cc, 0 3px 0 rgba(0,0,0,.85)`, letterSpacing:'.04em' }}>
          {value.toLocaleString()}
        </span>
        <span style={{ fontFamily:FONT_NUM, fontWeight:500, fontSize:14, color:'rgba(255,255,255,.45)' }}>/ {max.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ── SPPlaceholder ─────────────────────────────────────────────
function SPPlaceholder({ side, name, portrait, color }) {
  const flip = side === 'right';
  return (
    <div style={{
      position:'absolute', bottom:30,
      [flip ? 'right' : 'left']: '13%',
      width:240, height:340, pointerEvents:'none',
    }}>
      <div style={{
        position:'absolute', inset:-10,
        background:`radial-gradient(ellipse at center, ${color}55 0%, transparent 70%)`,
        filter:'blur(8px)', animation:'pulse 2.6s ease-in-out infinite',
      }}/>
      <div style={{
        position:'absolute', inset:0, borderRadius:12,
        border:`2px dashed ${color}aa`,
        background:`linear-gradient(180deg, ${color}33, rgba(0,0,0,.4))`,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        gap:10, padding:'14px 12px',
      }}>
        <div style={{ width:160, height:200, borderRadius:8, overflow:'hidden', opacity:.62, filter:`drop-shadow(0 0 18px ${color}cc)`, border:`1px solid ${color}77` }}>
          {portrait ? (
            <img src={portrait} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 10%', transform: flip ? 'scaleX(-1)' : 'none', mixBlendMode:'screen' }}/>
          ) : (
            <div style={{ width:'100%', height:'100%', background:`${color}22` }}/>
          )}
        </div>
        <div style={{ fontFamily:FONT_DISPLAY, fontSize:10, color:'rgba(255,255,255,.55)', letterSpacing:'.32em', fontWeight:900 }}>SP IMAGE</div>
        <div style={{ fontFamily:FONT_DISPLAY, fontSize:14, fontWeight:900, color:'#fff', letterSpacing:'.08em', textAlign:'center', lineHeight:1.2, textShadow:'0 2px 6px rgba(0,0,0,.7)' }}>{name}</div>
      </div>
    </div>
  );
}

// ── DamageBurst ───────────────────────────────────────────────
function DamageBurst({ x, y, value, label }) {
  return (
    <div style={{
      position:'absolute',
      left:`${(x/1920)*100}%`, top:`${(y/1080)*100}%`,
      transform:'translate(-50%,-50%)',
      zIndex:30, pointerEvents:'none',
      display:'flex', flexDirection:'column', alignItems:'center', gap:2,
      animation:'dmgPop2 .35s cubic-bezier(.2,.8,.3,1.3) both',
    }}>
      <div style={{ fontFamily:FONT_DISPLAY, fontSize:13, color:'rgba(255,255,255,.85)', letterSpacing:'.42em', fontWeight:900, textShadow:'0 1px 6px rgba(0,0,0,.8)' }}>{label} DAMAGE</div>
      <div style={{ fontFamily:FONT_NUM, fontWeight:900, fontSize:96, lineHeight:1, color:'#ff2244', textShadow:'0 0 32px rgba(255,30,60,.95), 0 4px 0 rgba(0,0,0,.85)', letterSpacing:'.04em' }}>−{value}</div>
    </div>
  );
}

// ── BottomPortrait ────────────────────────────────────────────
function BottomPortrait({ unit, hp, maxHP, color, side, hpDmg, showDamage, defeated }) {
  const flip    = side === 'right';
  const hpPct   = Math.max(0, Math.min(100, (hp / maxHP) * 100));
  const name    = unit?.char?.name    ?? unit?.name    ?? '—';
  const portrait = unit?.char?.portrait ?? unit?.portrait ?? null;
  return (
    <div style={{
      position:'relative', display:'flex', flexDirection:'column',
      borderRadius:8, overflow:'hidden',
      border:`2px solid ${defeated ? '#5a4250' : color}`,
      boxShadow: defeated ? '0 0 22px rgba(0,0,0,.6)' : `0 0 22px ${color}55`,
      background:'rgba(21,16,30,.42)', backdropFilter:'blur(4px)',
      animation: showDamage && hpDmg > 0 && !defeated ? 'hitShake .48s ease' : undefined,
      filter: defeated ? 'saturate(.25) brightness(.55)' : undefined,
      transition:'filter .35s ease, border-color .35s ease',
    }}>
      <div style={{ flex:1, position:'relative', overflow:'hidden', minHeight:0 }}>
        {portrait ? (
          <img src={portrait} alt={name} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 8%', transform: flip ? 'scaleX(-1)' : 'none' }}/>
        ) : (
          <div style={{ width:'100%', height:'100%', background:`${color}22` }}/>
        )}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, transparent 50%, rgba(0,0,0,.6))' }}/>
        <div style={{ position:'absolute', bottom:8, [flip ? 'right' : 'left']:10, fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:18, color:'#fff', letterSpacing:'.06em', textShadow:'0 2px 8px rgba(0,0,0,.85)' }}>{name}</div>
        {showDamage && hpDmg > 0 && !defeated && (
          <>
            <div style={{ position:'absolute', inset:0, background:'rgba(255,40,60,.3)' }}/>
            <div style={{ position:'absolute', inset:0, zIndex:10, pointerEvents:'none', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, animation:'dmgPop2 .35s cubic-bezier(.2,.8,.3,1.3) both' }}>
              <div style={{ fontFamily:FONT_DISPLAY, fontSize:11, color:'rgba(255,255,255,.85)', letterSpacing:'.42em', fontWeight:900, textShadow:'0 1px 6px rgba(0,0,0,.8)' }}>本体 DAMAGE</div>
              <div style={{ fontFamily:FONT_NUM, fontWeight:900, fontSize:82, lineHeight:1, color:'#ff2244', textShadow:'0 0 28px rgba(255,30,60,.95), 0 3px 0 rgba(0,0,0,.8)', letterSpacing:'.04em' }}>−{hpDmg}</div>
            </div>
          </>
        )}
        {defeated && (
          <div style={{ position:'absolute', inset:0, zIndex:11, pointerEvents:'none', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(8,4,12,.4)' }}>
            <div style={{ padding:'12px 36px', border:'4px double #ff2244', borderRadius:6, background:'rgba(20,4,8,.78)', color:'#ff5566', fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:64, lineHeight:1, letterSpacing:'.32em', textShadow:'0 0 20px rgba(255,40,80,.85), 0 3px 0 rgba(0,0,0,.85)', transform:'rotate(-6deg)', animation:'defeatStamp .5s cubic-bezier(.18,.9,.32,1.25) both' }}>撃破</div>
          </div>
        )}
      </div>
      <div style={{ flexShrink:0, padding:'10px 14px 12px', background:'rgba(0,0,0,.55)', borderTop:`1px solid ${color}77` }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:5 }}>
          <span style={{ fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:13, color:'rgba(255,255,100,.9)', letterSpacing:'.22em' }}>HP</span>
          <span style={{ fontFamily:FONT_NUM, fontWeight:900, fontSize:34, lineHeight:1, color:'#ffff00', textShadow:'0 0 14px rgba(255,255,0,.6), 0 2px 0 rgba(0,0,0,.85)', letterSpacing:'.04em' }}>{hp}</span>
          <span style={{ fontFamily:FONT_NUM, fontWeight:500, fontSize:12, color:'rgba(255,255,255,.45)' }}>/ {maxHP}</span>
        </div>
        <div style={{ height:5, borderRadius:3, background:'rgba(255,255,255,.1)', overflow:'hidden' }}>
          <div style={{ width:`${hpPct}%`, height:'100%', background:'linear-gradient(90deg, #ffd000, #ffff00)', transition:'width .4s ease', boxShadow:'0 0 8px rgba(255,255,0,.7)' }}/>
        </div>
      </div>
    </div>
  );
}

// ── MessageWindow ─────────────────────────────────────────────
function MessageWindow({ speaker, line }) {
  const name = speaker?.char?.name ?? speaker?.name ?? '—';
  const key  = (speaker?.char?.id ?? speaker?.id ?? '') + line;
  return (
    <div key={key} style={{
      display:'flex', flexDirection:'column', borderRadius:10, padding:'18px 24px 22px',
      background:'linear-gradient(180deg, rgba(8,6,18,.78), rgba(8,6,18,.92))',
      backdropFilter:'blur(6px)', border:'2px solid rgba(255,255,255,.22)',
      boxShadow:'0 0 24px rgba(0,0,0,.5), inset 0 0 0 1px rgba(255,255,255,.06)',
      animation:'fadeIn .25s ease both', justifyContent:'center',
    }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:14, marginBottom:14 }}>
        <span style={{ fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:30, color:'#fff', letterSpacing:'.08em', textShadow:'0 0 12px rgba(255,255,255,.18)' }}>{name}</span>
        <span style={{ fontFamily:FONT_DISPLAY, fontSize:11, color:'rgba(255,255,255,.42)', letterSpacing:'.36em', fontWeight:900 }}>SPEAKING</span>
      </div>
      <div style={{ fontFamily:FONT_DISPLAY, fontWeight:700, fontSize:36, lineHeight:1.35, color:'rgba(255,255,255,.96)', letterSpacing:'.04em', textShadow:'0 2px 8px rgba(0,0,0,.65)' }}>「{line}」</div>
    </div>
  );
}

// ── R15: BattleAnimOverlay (V3.2対応 — animStateから実値を参照) ──
function BattleAnimOverlay({ anim, onContinue }) {
  const { attacker, defender, atkMem, atkChr, defMem, defChr, N, Nr, actionLabel, attackType='melee', attackerSide='player' } = anim;
  const isSpecial   = actionLabel === '必殺技';
  const atkColor    = attackerSide === 'player' ? PK : AC;

  const allyIsAttacker = attackerSide === 'player';
  const allyUnit  = allyIsAttacker ? attacker : defender;
  const enemyUnit = allyIsAttacker ? defender : attacker;
  const allySPdmg  = allyIsAttacker ? (defMem ?? 0) : (atkMem ?? 0);
  const allyHPdmg  = allyIsAttacker ? (defChr ?? 0) : (atkChr ?? 0);
  const enemySPdmg = allyIsAttacker ? (atkMem ?? 0) : (defMem ?? 0);
  const enemyHPdmg = allyIsAttacker ? (atkChr ?? 0) : (defChr ?? 0);

  const [allySP, setAllySP]   = useState(attacker.soldiers);
  const [allyHP, setAllyHP]   = useState(attacker.charHp);
  const [enemySP, setEnemySP] = useState(defender.soldiers);
  const [enemyHP, setEnemyHP] = useState(defender.charHp);
  const [phase, setPhase] = useState(isSpecial ? 'cutin' : 'counts');
  const [moved, setMoved] = useState(false);

  const attackLine = useMemo(() => {
    if (isSpecial) {
      const arr = attacker.char?.quotes?.special ?? attacker.char?.name ? [`${attacker.char.name}、必殺！`] : ['……いくぞ'];
      return arr[Math.floor(Math.random() * arr.length)];
    }
    const arr = attacker.char?.quotes?.attack ?? ['……'];
    return arr[Math.floor(Math.random() * arr.length)];
  }, []);

  useEffect(() => {
    if (phase === 'counts') {
      const t = setTimeout(() => setMoved(true), 60);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const POS = {
    allySP:       { x: 470, y: 370 },
    enemySP:      { x:1450, y: 370 },
    allyPortrait: { x: 230, y: 850 },
    enemyPortrait:{ x:1690, y: 850 },
  };

  // 飛行バッジ用ストリーム (SP→SP / SP→本体)
  const streams = useMemo(() => {
    const arr = [];
    const atkN    = N    ?? 0;
    const defN    = Nr   ?? 0;
    const atkChr_ = atkChr ?? 0;
    const defChr_ = defChr ?? 0;
    if (atkN > 0) {
      arr.push({ src: POS[allyIsAttacker ? 'allySP' : 'enemySP'], dst: POS[allyIsAttacker ? 'enemySP' : 'allySP'], count: atkN, color:'#7fff00', textColor:'#0a0816', isSP: true });
    }
    if (atkChr_ > 0) {
      arr.push({ src: POS[allyIsAttacker ? 'allySP' : 'enemySP'], dst: POS[allyIsAttacker ? 'enemyPortrait' : 'allyPortrait'], count: atkChr_, color:'#ff2244', textColor:'#fff', isSP: false });
    }
    if (defN > 0) {
      arr.push({ src: POS[allyIsAttacker ? 'enemySP' : 'allySP'], dst: POS[allyIsAttacker ? 'allySP' : 'enemySP'], count: defN, color:'#ff4455', textColor:'#fff', isSP: true });
    }
    if (defChr_ > 0) {
      arr.push({ src: POS[allyIsAttacker ? 'enemySP' : 'allySP'], dst: POS[allyIsAttacker ? 'allyPortrait' : 'enemyPortrait'], count: defChr_, color:'#ff4455', textColor:'#fff', isSP: false });
    }
    return arr;
  }, []);

  const allyWillDie   = (allyUnit.charHp  - allyHPdmg)  <= 0;
  const enemyWillDie  = (enemyUnit.charHp - enemyHPdmg) <= 0;
  const anyoneDies    = allyWillDie || enemyWillDie;
  const defenderWillDie = allyIsAttacker ? enemyWillDie : allyWillDie;

  let speaker, line;
  if (phase === 'defeat') {
    speaker = defenderWillDie
      ? (allyIsAttacker ? enemyUnit : allyUnit)
      : (allyIsAttacker ? allyUnit  : enemyUnit);
    line = speaker.char?.quotes?.defeat ?? 'うぅ……';
  } else {
    speaker = attacker;
    line    = attackLine;
  }

  function handleClick() {
    if (phase === 'cutin') {
      setPhase('counts');
    } else if (phase === 'counts') {
      if (allyIsAttacker) {
        setEnemySP(v => Math.max(0, v - enemySPdmg));
        setEnemyHP(v => Math.max(0, v - enemyHPdmg));
        setAllySP(v  => Math.max(0, v  - allySPdmg));
        setAllyHP(v  => Math.max(0, v  - allyHPdmg));
      } else {
        setAllySP(v  => Math.max(0, v  - allySPdmg));
        setAllyHP(v  => Math.max(0, v  - allyHPdmg));
        setEnemySP(v => Math.max(0, v - enemySPdmg));
        setEnemyHP(v => Math.max(0, v - enemyHPdmg));
      }
      setPhase('damages');
    } else if (phase === 'damages' && anyoneDies) {
      setPhase('defeat');
    } else {
      onContinue();
    }
  }

  const ctaLabel =
    phase === 'cutin'                      ? 'クリックで発動' :
    phase === 'counts'                     ? 'クリックでダメージ解決' :
    phase === 'damages' && anyoneDies      ? 'クリックでつづく' :
    phase === 'defeat'                     ? 'クリックで戦闘終了' :
                                             'クリックで戦闘終了';

  return (
    <div onClick={handleClick} style={{
      position:'absolute', inset:0, zIndex:55, cursor:'pointer',
      backgroundColor:'#0a0816',
      backgroundImage:'url(assets/bg_battle.jpg)',
      backgroundSize:'cover', backgroundPosition:'center 40%',
      display:'flex', flexDirection:'column', overflow:'hidden',
    }}>
      <div style={{ position:'absolute', inset:0, pointerEvents:'none',
        background:'linear-gradient(180deg, rgba(10,8,22,.55) 0%, rgba(10,8,22,.35) 38%, rgba(4,4,18,.82) 70%, rgba(4,4,18,.95) 100%)',
      }}/>
      {/* TOP BAR */}
      <div style={{
        position:'relative', zIndex:2, flexShrink:0, height:48, padding:'0 28px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        background:'rgba(5,5,18,.75)', backdropFilter:'blur(8px)',
        borderBottom:'1px solid rgba(255,255,255,.08)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <span style={{ fontFamily:FONT_DISPLAY, fontSize:11, color:'rgba(255,255,255,.5)', letterSpacing:'.42em', fontWeight:900 }}>BATTLE</span>
          <span style={{
            padding:'5px 16px', borderRadius:99,
            background:`linear-gradient(135deg, ${atkColor}, ${attackerSide==='player'?PK2:AC2})`, color:'#fff',
            fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:13, letterSpacing:'.22em',
            boxShadow:`0 0 14px ${atkColor}88`,
          }}>{actionLabel}</span>
        </div>
        <div style={{
          padding:'6px 16px', borderRadius:99,
          background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.28)',
          fontFamily:FONT_DISPLAY, fontSize:11, fontWeight:900,
          color:'rgba(255,255,255,.88)', letterSpacing:'.28em',
          animation:'pulse 1.4s ease-in-out infinite',
        }}>{ctaLabel}</div>
      </div>

      {/* TOP — 600px固定高さ、SoldierCountHeader + SPPlaceholder + DamageBurst */}
      <div style={{ position:'relative', zIndex:2, flex:'0 0 600px', overflow:'hidden', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
        <div style={{ position:'absolute', top:30, bottom:30, left:'50%', width:1, background:'linear-gradient(180deg, transparent, rgba(255,255,255,.45), transparent)' }}/>
        <SoldierCountHeader side="left"  color={PK} value={allySP}  max={allyUnit.maxSoldiers  ?? allyUnit.char?.maxSoldiers  ?? 500}/>
        <SoldierCountHeader side="right" color={AC} value={enemySP} max={enemyUnit.maxSoldiers ?? enemyUnit.char?.maxSoldiers ?? 500}/>
        <SPPlaceholder side="left"  name={allyUnit.char?.name}  portrait={allyUnit.char?.portrait}  color={PK}/>
        <SPPlaceholder side="right" name={enemyUnit.char?.name} portrait={enemyUnit.char?.portrait} color={AC}/>
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:54, color:'#fff', letterSpacing:'.2em', textShadow:'0 4px 18px rgba(0,0,0,.85)', pointerEvents:'none', zIndex:1, opacity:.32 }}>VS</div>
        {phase === 'damages' && allySPdmg  > 0 && <DamageBurst x={POS.allySP.x}  y={POS.allySP.y}  value={allySPdmg}  label="SP"/>}
        {phase === 'damages' && enemySPdmg > 0 && <DamageBurst x={POS.enemySP.x} y={POS.enemySP.y} value={enemySPdmg} label="SP"/>}
      </div>

      {/* BOTTOM — 3列グリッド */}
      <div style={{
        position:'relative', zIndex:2, flex:1, minHeight:0,
        display:'grid', gridTemplateColumns:'400px 1fr 400px', gap:14,
        padding:'14px 28px 22px',
        background:'linear-gradient(180deg, rgba(4,4,18,0) 0%, rgba(4,4,18,.45) 60%, rgba(4,4,18,.7) 100%)',
        borderTop:'1px solid rgba(255,255,255,.06)',
      }}>
        <BottomPortrait
          unit={allyUnit} hp={allyHP} maxHP={allyUnit.charMaxHp ?? allyUnit.char?.charMaxHp ?? 200}
          color={PK} side="left"
          hpDmg={allyHPdmg} showDamage={phase === 'damages' || phase === 'defeat'}
          defeated={phase === 'defeat' && allyWillDie}
        />
        <MessageWindow speaker={speaker} line={line}/>
        <BottomPortrait
          unit={enemyUnit} hp={enemyHP} maxHP={enemyUnit.charMaxHp ?? enemyUnit.char?.charMaxHp ?? 200}
          color={AC} side="right"
          hpDmg={enemyHPdmg} showDamage={phase === 'damages' || phase === 'defeat'}
          defeated={phase === 'defeat' && enemyWillDie}
        />
      </div>

      {/* 飛行する攻撃回数バッジ */}
      {phase === 'counts' && streams.map((s, i) => {
        const x = moved ? s.dst.x : s.src.x;
        const y = moved ? s.dst.y : s.src.y;
        return (
          <div key={i} style={{
            position:'absolute',
            left:`${(x/1920)*100}%`, top:`${(y/1080)*100}%`,
            transform:'translate(-50%,-50%)',
            transition:'left .85s cubic-bezier(.32,.7,.45,1), top .85s cubic-bezier(.32,.7,.45,1)',
            pointerEvents:'none', zIndex:40,
            padding: s.isSP ? '7px 18px' : '5px 13px',
            borderRadius: s.isSP ? 99 : 6,
            background:s.color, color:s.textColor,
            fontFamily:FONT_NUM, fontWeight:900,
            fontSize: s.isSP ? 32 : 22, lineHeight:1, letterSpacing:'.04em',
            boxShadow:`0 0 22px ${s.color}, 0 0 6px rgba(0,0,0,.5)`,
            border: s.isSP ? '2px solid rgba(255,255,255,.55)' : '2px dashed rgba(255,255,255,.55)',
            whiteSpace:'nowrap',
          }}>
            {s.isSP ? (
              <>
                <span style={{ fontSize:12, opacity:.85, fontWeight:700, letterSpacing:'.16em', marginRight:6 }}>SP</span>
                ×{s.count}
              </>
            ) : (
              <>
                <span style={{ fontSize:10, opacity:.85, fontWeight:700, letterSpacing:'.16em', marginRight:4 }}>本体</span>
                −{s.count}
              </>
            )}
          </div>
        );
      })}

      {/* 必殺技カットイン */}
      {phase === 'cutin' && (
        <div style={{ position:'absolute', inset:0, zIndex:80, pointerEvents:'none', overflow:'hidden', animation:'cutinFade .3s ease both' }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(2,1,8,.92)' }}/>
          <div style={{ position:'absolute', inset:0, background:`repeating-linear-gradient(-18deg, transparent 0 60px, ${atkColor}22 60px 120px)`, animation:'cutinSlide 1.6s linear infinite' }}/>
          <div style={{
            position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
            display:'flex', alignItems:'center', gap:60, animation:'cutinPortrait .5s cubic-bezier(.18,.9,.32,1.2) both',
          }}>
            <div style={{ width:560, height:780, borderRadius:18, overflow:'hidden', border:`6px solid ${atkColor}`, boxShadow:`0 0 80px ${atkColor}cc`, background:'#0a0816', flexShrink:0 }}>
              {attacker.char?.portrait && <img src={attacker.char.portrait} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 8%' }}/>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:24, maxWidth:760 }}>
              <div style={{ fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:22, color:atkColor, letterSpacing:'.52em' }}>SPECIAL MOVE</div>
              <div style={{ fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:128, lineHeight:1, color:'#fff', letterSpacing:'.12em', textShadow:`0 0 32px ${atkColor}cc, 0 6px 0 rgba(0,0,0,.85)` }}>{actionLabel}</div>
              <div style={{ fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:48, color:'#fff', letterSpacing:'.04em', lineHeight:1.3 }}>{attacker.char?.name}</div>
              <div style={{ fontFamily:FONT_DISPLAY, fontWeight:700, fontSize:40, color:'rgba(255,255,255,.95)', lineHeight:1.3, letterSpacing:'.04em' }}>「{attackLine}」</div>
            </div>
          </div>
          <div style={{ position:'absolute', bottom:36, left:'50%', transform:'translateX(-50%)', padding:'8px 22px', borderRadius:99, background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.4)', fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:13, color:'#fff', letterSpacing:'.32em', animation:'pulse 1.4s ease-in-out infinite' }}>クリックで発動</div>
        </div>
      )}
    </div>
  );
}

// ── BActionScene (Design v4 ベース) ──────────────────────────
function BActionScene({
  round, maxRounds, targetNode, isDuel,
  allyDisplay, enemyDisplay, activeUnitId, specialPending,
  unitStates, log, winner, phase,
  strategyBonus, battleCapacity,
  animState,
  onAllyAction, onEnemyAttack,
  onReturn,
}) {
  const active      = allyDisplay.find(u => u.id === activeUnitId) ?? null;
  const aliveAllies = allyDisplay.filter(u => u.status !== 'done').length;
  const aliveEnemies = enemyDisplay.filter(u => u.status !== 'done').length;
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  return (
    <div className="fade-in" style={{
      width:'100%', height:'100%', display:'flex', flexDirection:'column',
      color:TX, position:'relative',
      backgroundImage:'url(assets/bg_battle.jpg)',
      backgroundSize:'cover', backgroundPosition:'center 40%',
    }}>
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(251,247,239,.7) 0%, rgba(245,237,224,.18) 45%, rgba(245,237,224,.18) 65%, rgba(251,247,239,.78) 100%)' }}/>

      {/* TOP BAR */}
      <div style={{
        position:'relative', zIndex:5,
        height:72, display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 28px', background:'rgba(255,253,251,.9)', borderBottom:`1px solid ${BR}`,
        backdropFilter:'blur(10px)', flexShrink:0,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <img src="assets/logo_tohoku.png" alt="東北家" style={{ height:30, objectFit:'contain' }}/>
          <span style={{ color:PK, fontWeight:900, fontFamily:FONT_DISPLAY, letterSpacing:'.16em', fontSize:14 }}>東北家</span>
        </div>
        <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
          <div style={{ fontFamily:FONT_DISPLAY, fontSize:11, color:TXD, letterSpacing:'.32em' }}>BATTLEFIELD</div>
          <div style={{ fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:28, color:TX, letterSpacing:'.16em' }}>{targetNode?.name ?? '—'}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ color:AC, fontWeight:900, fontFamily:FONT_DISPLAY, letterSpacing:'.08em', fontSize:14 }}>敵軍</span>
        </div>
      </div>

      {/* MAIN 3-COL */}
      <div style={{ flex:1, position:'relative', zIndex:5, display:'flex', minHeight:0, padding:'18px 18px 16px', gap:14 }}>
        {/* LEFT: ally column */}
        <div style={{ width:344, display:'flex', flexDirection:'column', gap:10, minHeight:0, transform: (animState && phase !== 'battleend') ? 'translateX(-120%)' : 'translateX(0)', transition:'transform .35s cubic-bezier(.5,0,.3,1)' }}>
          <ColumnHeader label="OUR UNITS" sub={`${aliveAllies} / ${allyDisplay.length}`} color={PK}/>
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10, minHeight:0, overflowY:'auto' }} className="thin-scroll">
            {allyDisplay.map(u => (
              <UnitCard key={u.id} unit={u}
                active={u.id === activeUnitId}
                ally={true}
                activeUnit={active}
                specialPending={specialPending}
                battleCapacity={battleCapacity}
                isDuel={isDuel}
                onAllyAction={onAllyAction}
                onEnemyAttack={onEnemyAttack}/>
            ))}
            {Array.from({ length: Math.max(0, 4 - allyDisplay.length) }).map((_, i) => (
              <div key={`ph-${i}`} style={{ flex:1, minHeight:124, visibility:'hidden', flexShrink:0 }}/>
            ))}
          </div>
        </div>

        {/* CENTER */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:12, minWidth:0, minHeight:0 }}>
          {/* ラウンドパネル */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14, padding:'10px 18px', flexShrink:0 }}>
            {strategyBonus?.side === 'player' && <StrategyBadge side="player" bonus={strategyBonus.bonus}/>}
            <Pill label={phase==='battleend' ? '戦闘終了' : specialPending ? '必殺技ターゲット選択' : '行動選択中'}
              color={phase==='battleend'?TXD:specialPending?'#ff2255':PK} filled/>
            {/* R13: 決闘 vs 通常でラウンド表示切り替え */}
            {isDuel ? (
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ padding:'4px 12px', borderRadius:99, background:PK, color:'#fff', fontFamily:FONT_DISPLAY, fontWeight:900, fontSize:11, letterSpacing:'.18em', boxShadow:`0 0 12px ${PK}66` }}>⚔ 決闘</span>
                <span style={{ fontFamily:FONT_NUM, fontSize:20, fontWeight:700, color:TX, letterSpacing:'.05em', lineHeight:1 }}>ROUND {round}</span>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontFamily:FONT_DISPLAY, fontSize:11, color:TXD, letterSpacing:'.32em' }}>ROUND</span>
                <div style={{ display:'flex', gap:7, alignItems:'center' }}>
                  {Array.from({ length: maxRounds }).map((_, i) => (
                    <div key={i} style={{
                      width: i+1===round ? 24 : 14, height:10, borderRadius:5,
                      background: i+1 <= round ? PK : 'rgba(28,16,32,.16)',
                      transition:'all .25s',
                      boxShadow: i+1===round ? `0 0 10px ${PK}cc` : 'none',
                    }}/>
                  ))}
                </div>
                <span style={{ fontFamily:FONT_NUM, fontSize:20, fontWeight:700, color:TX, letterSpacing:'.05em', lineHeight:1 }}>
                  {round}<span style={{ color:TXF, fontSize:13, fontWeight:500 }}> / {maxRounds}</span>
                </span>
              </div>
            )}
            {strategyBonus?.side === 'enemy' && <StrategyBadge side="enemy" bonus={strategyBonus.bonus}/>}
          </div>

          {/* 戦闘終了パネル or スペーサー */}
          <div style={{ flex:1, minHeight:0, pointerEvents:'none' }}/>

          {/* LOG */}
          <div style={{ ...glass({ borderRadius:10, background:'rgba(255,253,251,.94)' }), height:170, display:'flex', flexDirection:'column', padding:'10px 14px 12px', flexShrink:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <div style={{ fontFamily:FONT_DISPLAY, fontSize:12, color:TXD, letterSpacing:'.22em' }}>ACTION LOG</div>
              <div style={{ fontFamily:FONT_NUM, fontSize:10, color:TXF, letterSpacing:'.16em' }}>{log.length} entries</div>
            </div>
            <div ref={logRef} className="thin-scroll" style={{ flex:1, overflowY:'auto', fontFamily:FONT_NUM, fontSize:13, color:TX, letterSpacing:'.04em', lineHeight:1.65, paddingRight:6 }}>
              {log.slice(-30).map((entry, i) => {
                const isHeader = entry.txt?.startsWith('──');
                return (
                  <div key={i} className="log-in" style={{
                    color: isHeader ? AC : TX,
                    fontFamily: isHeader ? FONT_DISPLAY : FONT_NUM,
                    fontWeight: isHeader ? 900 : 500,
                    letterSpacing: isHeader ? '.18em' : '.04em',
                    padding: isHeader ? '4px 0 3px' : '1px 0',
                  }}>{entry.txt}</div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: enemy column */}
        <div style={{ width:344, display:'flex', flexDirection:'column', gap:10, minHeight:0, transform: (animState && phase !== 'battleend') ? 'translateX(120%)' : 'translateX(0)', transition:'transform .35s cubic-bezier(.5,0,.3,1)' }}>
          <ColumnHeader label="ENEMY UNITS" sub={`${aliveEnemies} / ${enemyDisplay.length}`} color={AC} align="right"/>
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10, minHeight:0, overflowY:'auto' }} className="thin-scroll">
            {enemyDisplay.map(u => (
              <UnitCard key={u.id} unit={u}
                active={false}
                ally={false}
                activeUnit={active}
                specialPending={specialPending}
                battleCapacity={battleCapacity}
                isDuel={isDuel}
                onAllyAction={() => {}}
                onEnemyAttack={onEnemyAttack}/>
            ))}
            {Array.from({ length: Math.max(0, 4 - enemyDisplay.length) }).map((_, i) => (
              <div key={`eph-${i}`} style={{ flex:1, minHeight:124, visibility:'hidden', flexShrink:0 }}/>
            ))}
          </div>
        </div>
      </div>

      {/* 戦闘終了バナー — クリックでマップ復帰 */}
      {phase === 'battleend' && (
        <div onClick={onReturn} style={{
          position:'absolute', inset:0, zIndex:50,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24,
          background:'radial-gradient(ellipse at center, rgba(251,247,239,.5), rgba(245,237,224,.86))',
          cursor:'pointer',
        }}>
          <div style={{
            fontFamily:FONT_DISPLAY, fontWeight:900,
            fontSize:132, letterSpacing:'.2em',
            color: winner === 'player' ? PK : AC,
            textShadow:`0 4px 32px ${winner==='player'?PK:AC}66, 0 2px 0 rgba(255,255,255,.6)`,
            animation:'bannerIn .55s cubic-bezier(.2,.8,.3,1.3) both',
          }}>{winner === 'player' ? '勝利' : '敗北'}</div>
          <div style={{
            fontFamily:FONT_DISPLAY, fontSize:13, color:TXD, letterSpacing:'.28em',
            animation:'fadeIn .8s .6s both',
          }}>クリックでマップへ戻る</div>
        </div>
      )}
    </div>
  );
}

// ── BattleFlow (メインコンポーネント) ──────────────────────────
export default function BattleFlow({ formation, targetNode, onComplete, enemyChars = [], battleMode = 'normal' }) {
  const BATTLE_CAP  = targetNode?.battleCapacity ?? 400;
  const slots       = ['front1','front2','rear1','rear2'];
  const rawAllies   = useRef(slots.map(k => formation?.[k]).filter(Boolean)).current;
  const isDuel      = battleMode === 'duel';
  const maxRounds   = isDuel ? Infinity : 5;
  const engineRef      = useRef(null);
  const animResolveRef = useRef(null);

  // ── 表示用 state ──
  const [allyDisplay,  setAllyDisplay]  = useState([]);
  const [enemyDisplay, setEnemyDisplay] = useState([]);
  const [unitStates,   setUnitStates]   = useState({});
  const [log,          setLog]          = useState([]);
  const [roundNum,     setRoundNum]     = useState(0);
  const [winner,       setWinner]       = useState(null);
  const [phase,        setPhase]        = useState('action');

  // ── プレイヤー入力 state ──
  const [activeUnitId,       setActiveUnitId]       = useState(null);
  const [specialPending,     setSpecialPending]     = useState(false);
  const [showRetreatConfirm, setShowRetreatConfirm] = useState(false);

  // ── オーバーレイ state ──
  const [animState,     setAnimState]     = useState(null);
  const animStateRef = useRef(null);
  const [cutinVisible,  setCutinVisible]  = useState(false);
  const [strategyWinner, setStrategyWinner] = useState(null);
  const [strategyBonus,  setStrategyBonus]  = useState(null);

  // ── display 同期 ──
  const syncDisplay = useCallback((activeId) => {
    const eng = engineRef.current;
    if (!eng) return;
    const make = (units) => {
      const alive = units.filter(u => u.charHp > 0 && !u.retreated);
      const fronts = alive.filter(u => u.position === 'front');
      const rears  = alive.filter(u => u.position === 'rear');
      const reordered = fronts.length > 0 ? [...fronts, ...rears] : [...rears];
      return reordered.map((u, i) => ({
        id:          u.char.id,
        name:        u.char.name,
        position:    i < 2 ? 'front' : 'rear',
        soldiers:    u.soldiers,
        maxSoldiers: u.maxSoldiers,
        charHp:      u.charHp,
        charMaxHp:   u.charMaxHp ?? 200,
        portrait:    u.char.portrait ?? null,
        attackType:  u.char.attackType ?? 'melee',
        charged:     u.charged ?? false,
        skillUsed:   u.skillUsed ?? false,
        action:      u.action,
        retreated:   u.retreated,
        status: u.char.id === activeId ? 'active' : u._actedThisRound ? 'done' : 'pending',
      }));
    };
    setAllyDisplay(make(eng.playerSide));
    setEnemyDisplay(make(eng.enemySide));
    const ns = {};
    eng.playerSide.forEach(u => {
      ns[u.char.id] = { skillUsed: u.skillUsed ?? false, charged: u.charged ?? false };
    });
    setUnitStates(ns);
  }, []);

  // ── コアループ ──
  const processNextRef = useRef(null);

  // M1: action mapping — doAction 内でエンジンに渡す前に変換
  const doAction = useCallback(async (unit, isPlayer) => {
    const eng = engineRef.current;
    unit.action = ACTION_MAP[unit.action] ?? unit.action;
    await eng.executeAction(unit, isPlayer);
    // アニメーション表示中は待機
    if (animResolveRef.current === null && animStateRef.current) {
      await new Promise(resolve => { animResolveRef.current = resolve; });
    }
    eng.markActed(unit);
    syncDisplay(null);
    if (eng.checkGameOver()) return;
    setTimeout(() => processNextRef.current?.(), 300);
  }, [syncDisplay]);

  const onRoundEnd = useCallback(() => {
    const eng = engineRef.current;
    eng.applyRetreatRule('loss_50', eng.enemySide);
    if (eng.checkGameOver()) return;
    if (eng.checkRoundLimit()) return;
    eng.startRound();
    setRoundNum(eng.round);
    syncDisplay(null);
    setLog([]);
    setTimeout(() => processNextRef.current?.(), 300);
  }, [syncDisplay]);

  const processNext = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || eng.gameOver) return;
    const entry = eng.nextActor();
    if (!entry) { onRoundEnd(); return; }
    const { u: unit, isPlayer } = entry;
    if (isPlayer) {
      setActiveUnitId(unit.char.id);
      setSpecialPending(false);
      syncDisplay(unit.char.id);
    } else {
      const opts = _calcOptions(unit);
      BattleAI.selectAction(unit, opts);
      if (['attack','ranged','song','special'].includes(unit.action)) {
        BattleAI.selectTarget(unit, _calcPool(unit, unit.action, false, eng));
      }
      syncDisplay(null);
      setTimeout(() => doAction(unit, false), 300);
    }
  }, [onRoundEnd, doAction, syncDisplay]);

  useEffect(() => { processNextRef.current = processNext; }, [processNext]);

  // ── エンジン初期化（一度だけ） ──
  useEffect(() => {
    const playerUnits = rawAllies.map((c, i) => BattleEngineV3.buildUnit(c, 'attack', i));
    const initEnemies = enemyChars.length > 0
      ? enemyChars.map((c, i) => normalizeChar(c, i))
      : buildDefaultEnemies(targetNode);
    const enemyUnits = initEnemies.map((e, i) => ({
      char: {
        id: e.id, name: e.name, soldiers: e.meme, maxSoldiers: e.max,
        charHp: 10, charMaxHp: 10, charAttack: e.atk, soldierAtk: e.atk,
        soldierDef: e.def, charDefense: e.def, attackType: 'melee', factionId: 'enemy',
      },
      sideType:'defense', bonus:{ soldierAtk:0, soldierDef:0, charAttack:0, charSong:0 },
      position: i < 2 ? 'front' : 'rear',
      soldiers: e.meme, maxSoldiers: e.max, charHp: 10, charMaxHp: 10,
      action: null, retreated: false, charged: false, skillUsed: false,
      attackCount: 8, charDefense: e.def, level: 0, targetId: null, _actedThisRound: false,
    }));

    const eng = new BattleEngineV3({
      playerSide: playerUnits, enemySide: enemyUnits,
      mode: 'attack', battleCapacity: BATTLE_CAP, battleMode,
      // M2: 撤退含む全終了をここに一本化
      onBattleEnd: (wins) => {
        const e = engineRef.current;

        const usedIds    = rawAllies.map(c => c.id);
        const deadIds    = (e?.playerSide ?? []).filter(u => u.charHp <= 0).map(u => u.char.id);
        const deadMobIds = [...(e?.playerSide ?? []), ...(e?.enemySide ?? [])]
          .filter(u => u.charHp <= 0 && u.char._isMobInstance).map(u => u.char.id);
        const unitResults = [...(e?.playerSide ?? []), ...(e?.enemySide ?? [])].map(u => ({
          id:       u.char.id,
          soldiers: Math.max(0, u.char.soldiers),
          charHp:   Math.max(0, u.char.charHp),
        }));

        const playerWins = wins;  // mode:'attack'固定なのでそのまま
        battleResultRef.current = {
          conquered:   wins,
          usedCharIds: usedIds,
          deadCharIds: deadIds,
          deadMobIds,
          unitResults,
        };
        setWinner(playerWins ? 'player' : 'enemy');
        setPhase('battleend');
      },
      // V3.2: アニメーション用コールバック (E17)
      onExchangeResult: (atk, def, result) => {
        const isPlayerUnit = playerUnits.some(u => u.char.id === atk.char.id);
        const state = {
          attacker:    atk,
          defender:    def,
          atkMem:      result.atkMem,
          atkChr:      result.atkChr,
          defMem:      result.defMem,
          defChr:      result.defChr,
          N:           result.N,
          Nr:          result.Nr,
          actionLabel: ATK_LABEL[atk.action] ?? atk.action,
          attackType:  atk.char.attackType,
          attackerSide: isPlayerUnit ? 'player' : 'enemy',
        };
        animStateRef.current = state;
        setAnimState(state);
      },
      onLog:       (txt) => setLog(p => [...p, { txt }]),
      onCardUpdate: () => {},
      onShake:      () => {},
      onPopup:      () => {},
      delayedCall:  (ms, fn) => setTimeout(fn, ms),
    });

    engineRef.current = eng;

    // strategyWinner / strategyBonus を engine から生成
    const { side, bonus, winnerChar } = eng.strategyMult;
    if (winnerChar) {
      setStrategyWinner({ char: winnerChar, bonus, side });
      setCutinVisible(true);
    }
    if (side) {
      setStrategyBonus({ side, bonus });
    }

    eng.startRound();
    setRoundNum(eng.round);
    syncDisplay(null);
    setTimeout(() => processNextRef.current?.(), 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 作戦カットイン自動消去
  useEffect(() => {
    if (!cutinVisible) return;
    const t = setTimeout(() => setCutinVisible(false), 2800);
    return () => clearTimeout(t);
  }, [cutinVisible]);

  // ── プレイヤー入力ハンドラ ──

  // AllyHoverMenu からのアクション
  const handleAllyAction = useCallback((action) => {
    const eng = engineRef.current;
    const unit = eng?.playerSide.find(u => u.char.id === activeUnitId);
    if (!unit) return;

    if (action === 'retreat-request') {
      setShowRetreatConfirm(true);
      return;
    }
    if (action === 'special') {
      setSpecialPending(true);
      return;
    }
    // focus / defend はターゲット不要
    unit.action = action;
    unit.targetId = null;
    setLog(p => [...p, { txt: `${unit.char.name} → ${ATK_LABEL[action] ?? action}` }]);
    setActiveUnitId(null);
    doAction(unit, true);
  }, [activeUnitId, doAction]);

  // 敵カードクリック (通常攻撃 or 必殺技ターゲット選択)
  const handleEnemyAttack = useCallback((enemyId) => {
    const eng = engineRef.current;
    const unit = eng?.playerSide.find(u => u.char.id === activeUnitId);
    if (!unit) return;

    if (specialPending) {
      unit.action   = 'special';
      unit.targetId = enemyId;
      setSpecialPending(false);
    } else {
      // M1: attackType ('melee'/'ranged'/'song') をそのままセット → doAction内でマップ
      unit.action   = unit.char.attackType ?? 'melee';
      unit.targetId = enemyId;
    }
    const tgt = eng.enemySide.find(u => u.char.id === enemyId);
    setLog(p => [...p, { txt: `${unit.char.name} → ${tgt?.char.name ?? '?'} (${ATK_LABEL[unit.action] ?? unit.action})` }]);
    setActiveUnitId(null);
    doAction(unit, true);
  }, [activeUnitId, specialPending, doAction]);

  // M2: 撤退確定 — unit.action='retreat' → engine.executeAction() (エンジンが_finish()を呼ぶ)
  const handleRetreatConfirm = useCallback(() => {
    const eng = engineRef.current;
    const unit = eng?.playerSide.find(u => u.char.id === activeUnitId);
    setShowRetreatConfirm(false);
    if (!unit) return;
    unit.action   = 'retreat';
    unit.targetId = null;
    setLog(p => [...p, { txt: '── 撤退 — 戦闘から離脱した ──' }]);
    setActiveUnitId(null);
    doAction(unit, true);
  }, [activeUnitId, doAction]);

  const battleResultRef = useRef(null);

  // onReturn: BattleEndPanel からのマップ復帰
  const handleReturn = useCallback(() => {
    if (battleResultRef.current) onComplete(battleResultRef.current);
  }, [onComplete]);

  return (
    <div className="scene-enter" style={{ width:'100%', height:'100%', position:'relative', overflow:'hidden' }}>
      <BActionScene
        round={roundNum}
        maxRounds={isDuel ? roundNum + 1 : 5}
        targetNode={targetNode}
        isDuel={isDuel}
        allyDisplay={allyDisplay}
        enemyDisplay={enemyDisplay}
        activeUnitId={activeUnitId}
        specialPending={specialPending}
        unitStates={unitStates}
        log={log}
        winner={winner}
        phase={phase}
        strategyBonus={strategyBonus}
        battleCapacity={BATTLE_CAP}
        animState={animState}
        onAllyAction={handleAllyAction}
        onEnemyAttack={handleEnemyAttack}
        onReturn={handleReturn}
      />

      {/* R9: 作戦カットイン */}
      {cutinVisible && strategyWinner && (
        <StrategyCutin winner={strategyWinner} onSkip={() => setCutinVisible(false)}/>
      )}

      {/* R15: 戦闘アニメーションオーバーレイ */}
      {animState && (
        <BattleAnimOverlay anim={animState} onContinue={() => {
          animStateRef.current = null;
          setAnimState(null);
          if (animResolveRef.current) { animResolveRef.current(); animResolveRef.current = null; }
        }}/>
      )}

      {/* M2: 撤退確認オーバーレイ */}
      {showRetreatConfirm && (
        <RetreatConfirmOverlay
          targetNode={targetNode}
          allyDisplay={allyDisplay}
          enemyDisplay={enemyDisplay}
          onConfirm={handleRetreatConfirm}
          onCancel={() => setShowRetreatConfirm(false)}
        />
      )}
    </div>
  );
}

Object.assign(window, { BattleFlow });
