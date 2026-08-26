import React, { useState, useCallback, useMemo } from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass } from '../shared/tokens.js';
import COMMANDS from '../game/data/promotion_commands.json';

// ═══════════════════════════════════════════════════════════
//   PromotionDevScene — ?qa=promotion 隔離開発シーン
//   本体（GameContext / BottomBar）非依存。local state のみ。
//   将来 PromotionScene として本体統合する際は、state 接続層
//   （後述の useDevPromotionState）を GameContext に差し替え。
// ═══════════════════════════════════════════════════════════

// ── 純粋ロジック（将来 reducer に移植可能） ────────────────
const REFILL_TO_MAX = (char) => ({ ...char, soldiers: char.maxSoldiers });
const MAX_UP_DELTA = 50;
const APPLY_MAX_UP = (char) => ({ ...char, maxSoldiers: char.maxSoldiers + MAX_UP_DELTA });
const canRefill = (char) => char.soldiers < char.maxSoldiers;
const getDisplayCommands = (commands, usesMap, unlockedCommands) =>
  commands.filter(c => !c.limited || unlockedCommands.has(c.id));
const APPLY_EFFECTS = (char, effects) =>
  effects.reduce((c, eff) => {
    switch (eff.type) {
      case 'add': return { ...c, [eff.key]: (c[eff.key] ?? 0) + eff.value };
      case 'mul': return { ...c, [eff.key]: (c[eff.key] ?? 0) * eff.value };
      case 'set': return { ...c, [eff.key]: eff.value };
      default: return c;
    }
  }, char);

// ── 初期 state ──────────────────────────────────────────────
const INITIAL_CHARS = [
  { id:'kiritan',  name:'東北きりたん', soldiers:100, maxSoldiers:200, charSong:0 },
  { id:'zundamon', name:'ずんだもん',   soldiers:200, maxSoldiers:200, charSong:0 },
  { id:'tsumugi',  name:'春日部つむぎ', soldiers:50,  maxSoldiers:150, charSong:0 },
];
const INITIAL_AP = 5;

// ── state 接続層（dev: local useState、prod: GameContext 想定） ──
function useDevPromotionState() {
  const [mockChars, setMockChars] = useState(INITIAL_CHARS);
  const [actionPoints, setActionPoints] = useState(INITIAL_AP);
  const [usesMap, setUsesMap] = useState({});
  const [unlockedCommands, setUnlockedCommands] = useState(new Set());

  const applyRefill = useCallback((charId) => {
    setMockChars(cs => cs.map(c => c.id === charId ? REFILL_TO_MAX(c) : c));
  }, []);
  const applyMaxUp = useCallback((charId) => {
    setMockChars(cs => cs.map(c => c.id === charId ? APPLY_MAX_UP(c) : c));
  }, []);
  const applyEffects = useCallback((charId, effects) => {
    setMockChars(cs => cs.map(c => c.id === charId ? APPLY_EFFECTS(c, effects) : c));
  }, []);
  const consumeAP = useCallback(() => setActionPoints(p => Math.max(0, p - 1)), []);
  const consumeUse = useCallback((cmdId) => {
    setUsesMap(m => ({ ...m, [cmdId]: Math.max(0, (m[cmdId] ?? 0) - 1) }));
  }, []);
  const grantUse = useCallback((cmdId, maxUses) => {
    setUsesMap(m => ({ ...m, [cmdId]: Math.min((m[cmdId] ?? 0) + 1, maxUses) }));
    setUnlockedCommands(s => { const n = new Set(s); n.add(cmdId); return n; });
  }, []);
  const reset = useCallback(() => {
    setMockChars(INITIAL_CHARS);
    setActionPoints(INITIAL_AP);
    setUsesMap({});
    setUnlockedCommands(new Set());
  }, []);

  return { mockChars, actionPoints, usesMap, unlockedCommands,
    applyRefill, applyMaxUp, applyEffects, consumeAP, consumeUse, grantUse, reset };
}

// ── UI 部品（再利用想定） ───────────────────────────────────
function CommandList({ commands, selectedCmdId, onSelect, disabled, usesMap }) {
  return (
    <div style={{display:'flex', flexDirection:'column', gap:8}}>
      <div style={{fontSize:10, fontFamily:'Rajdhani', fontWeight:700,
        letterSpacing:'.2em', color:TXD}}>COMMANDS</div>
      {commands.length === 0 ? (
        <div style={{padding:14, borderRadius:8, border:`1px dashed ${BR}`,
          fontSize:11, color:TXD, textAlign:'center'}}>
          利用可能なコマンドなし
        </div>
      ) : commands.map(cmd => {
        const isSelected = cmd.id === selectedCmdId;
        const uses = usesMap[cmd.id] ?? 0;
        const exhausted = cmd.limited && uses < 1;
        const btnDisabled = disabled || exhausted;
        return (
          <button key={cmd.id}
            onClick={() => !btnDisabled && onSelect(cmd.id)}
            disabled={btnDisabled}
            style={{
              padding:'12px 14px', borderRadius:8,
              background: isSelected ? `${PK}1a` : btnDisabled ? 'rgba(0,0,0,.04)' : 'rgba(255,255,255,.6)',
              border: `1px solid ${isSelected ? PK : BR}`,
              color: btnDisabled ? TXF : TX,
              cursor: btnDisabled ? 'not-allowed' : 'pointer',
              fontFamily:"'Noto Sans JP'", fontSize:13, fontWeight:700,
              display:'flex', alignItems:'center', justifyContent:'space-between',
              opacity: exhausted ? 0.45 : 1,
              transition:'all .12s',
            }}>
            <span style={{display:'flex', alignItems:'center', gap:6}}>
              {isSelected ? '▶ ' : ''}{cmd.name}
              {cmd.limited && (
                <span style={{padding:'1px 6px', borderRadius:8, fontSize:9,
                  fontFamily:'Rajdhani', fontWeight:700, letterSpacing:'.1em',
                  background:`${PK}1a`, color:PK, border:`1px solid ${PK}44`}}>
                  LIMITED
                </span>
              )}
            </span>
            {cmd.limited && (
              <span style={{fontFamily:'Rajdhani', fontSize:11,
                color: exhausted ? TXF : AC}}>
                残 {uses}/{cmd.maxUses}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function CharSelectList({ chars, selectedCharId, onSelect, disabled }) {
  return (
    <div style={{display:'flex', flexDirection:'column', gap:8}}>
      <div style={{fontSize:10, fontFamily:'Rajdhani', fontWeight:700,
        letterSpacing:'.2em', color:TXD}}>対象キャラ</div>
      {chars.map(c => {
        const isSelected = c.id === selectedCharId;
        const ratio = c.maxSoldiers > 0 ? c.soldiers / c.maxSoldiers : 0;
        return (
          <button key={c.id}
            onClick={() => !disabled && onSelect(c.id)}
            disabled={disabled}
            style={{
              padding:'12px 14px', borderRadius:8, textAlign:'left',
              background: isSelected ? `${TEAL}1a` : 'rgba(255,255,255,.6)',
              border: `1px solid ${isSelected ? TEAL : BR}`,
              color: disabled ? TXF : TX,
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontFamily:"'Noto Sans JP'", fontSize:12,
            }}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
              <span style={{fontWeight:700, fontSize:13}}>{c.name}</span>
              <span style={{fontFamily:'Rajdhani', fontWeight:700, fontSize:12, color:TXD}}>
                {c.soldiers.toLocaleString()} / {c.maxSoldiers.toLocaleString()}
              </span>
            </div>
            <div style={{height:4, marginTop:6, borderRadius:2,
              background:'rgba(0,0,0,.08)', overflow:'hidden'}}>
              <div style={{height:'100%', width:`${Math.min(1, ratio)*100}%`,
                background:`linear-gradient(90deg, ${TEAL}aa, ${TEAL})`}}/>
            </div>
            {c.charSong != null && (
              <div style={{fontSize:10, color:TXD, marginTop:4, fontFamily:'Rajdhani', fontWeight:700}}>
                ♪ charSong: {c.charSong}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function EffectModal({ char, cmdName, onRefill, onMaxUp, onCancel }) {
  if (!char) return null;
  const refillDisabled = !canRefill(char);
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position:'fixed', inset:0, zIndex:200,
        background:'rgba(10,8,14,.5)', backdropFilter:'blur(6px)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:"'Noto Sans JP'",
      }}>
      <div style={{
        ...glass({borderRadius:12, padding:'20px 22px',
          border:`1.5px solid ${PK}55`}),
        width:380, maxWidth:'92vw',
      }}>
        <div style={{fontSize:10, fontFamily:'Rajdhani', fontWeight:700,
          letterSpacing:'.22em', color:TXD, marginBottom:4}}>EFFECT</div>
        <div style={{fontSize:15, fontWeight:900, color:TX, marginBottom:4}}>
          {cmdName} → {char.name}
        </div>
        <div style={{fontSize:11, color:TXD, marginBottom:14}}>
          現在 SP: {char.soldiers.toLocaleString()} / {char.maxSoldiers.toLocaleString()}
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          <button
            onClick={() => !refillDisabled && onRefill()}
            disabled={refillDisabled}
            style={{
              padding:'12px', borderRadius:8,
              background: refillDisabled ? 'rgba(0,0,0,.06)' : `linear-gradient(135deg, ${TEAL}, ${TEAL}cc)`,
              border:'none', color: refillDisabled ? TXF : '#fff',
              cursor: refillDisabled ? 'not-allowed' : 'pointer',
              fontFamily:"'Noto Sans JP'", fontSize:13, fontWeight:700,
            }}>
            補充 → 満タン{refillDisabled ? '（既に満タン）' : ''}
          </button>
          <button onClick={onMaxUp}
            style={{
              padding:'12px', borderRadius:8,
              background:`linear-gradient(135deg, ${AC}, ${AC2})`,
              border:'none', color:'#fff', cursor:'pointer',
              fontFamily:"'Noto Sans JP'", fontSize:13, fontWeight:700,
            }}>
            上限増 +{MAX_UP_DELTA}
          </button>
          <button onClick={onCancel}
            style={{
              padding:'10px', borderRadius:8, marginTop:4,
              background:'rgba(0,0,0,.04)', border:`1px solid ${BR}`,
              color:TXD, cursor:'pointer',
              fontFamily:"'Noto Sans JP'", fontSize:12,
            }}>
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}

function DebugBar({ commands, onReset, onGrantUse }) {
  return (
    <div style={{
      display:'flex', flexWrap:'wrap', gap:6, alignItems:'center',
      padding:'8px 12px', borderRadius:8,
      background:'rgba(255,200,0,.08)', border:`1px dashed ${AC2}88`,
      marginBottom:14,
    }}>
      <span style={{fontSize:9, fontFamily:'Rajdhani', fontWeight:700,
        letterSpacing:'.2em', color:AC, marginRight:4}}>DEBUG</span>
      <button onClick={onReset}
        style={{
          padding:'5px 10px', borderRadius:6,
          background:'rgba(0,0,0,.06)', border:`1px solid ${BR}`,
          fontSize:11, fontFamily:"'Noto Sans JP'", cursor:'pointer', color:TX,
        }}>
        リセット
      </button>
      {commands.filter(c => c.limited).map(c => (
        <button key={c.id} onClick={() => onGrantUse(c.id, c.maxUses)}
          style={{
            padding:'5px 10px', borderRadius:6,
            background:`${AC2}22`, border:`1px solid ${AC2}55`,
            fontSize:11, fontFamily:"'Noto Sans JP'", cursor:'pointer', color:AC,
          }}>
          {c.name} uses +1
        </button>
      ))}
    </div>
  );
}

// ── メインシーン ────────────────────────────────────────────
export default function PromotionDevScene({ onBack }) {
  const {
    mockChars, actionPoints, usesMap, unlockedCommands,
    applyRefill, applyMaxUp, applyEffects, consumeAP, consumeUse, grantUse, reset,
  } = useDevPromotionState();

  const [selectedCmdId, setSelectedCmdId] = useState(null);
  const [selectedCharId, setSelectedCharId] = useState(null);

  const displayCommands = useMemo(
    () => getDisplayCommands(COMMANDS, usesMap, unlockedCommands),
    [usesMap, unlockedCommands]
  );
  const canExecute = actionPoints >= 1;
  const selectedCmd = COMMANDS.find(c => c.id === selectedCmdId) ?? null;
  const selectedChar = mockChars.find(c => c.id === selectedCharId) ?? null;

  const handleCmdSelect = useCallback((cmdId) => {
    setSelectedCmdId(cmdId);
    setSelectedCharId(null);
  }, []);

  const handleCharSelect = useCallback((charId) => {
    if (!selectedCmd) return;
    if (selectedCmd.limited) {
      applyEffects(charId, selectedCmd.effects);
      consumeAP();
      consumeUse(selectedCmd.id);
      setSelectedCmdId(null);
      setSelectedCharId(null);
    } else {
      setSelectedCharId(charId);
    }
  }, [selectedCmd, applyEffects, consumeAP, consumeUse]);

  const finishExecution = useCallback(() => {
    consumeAP();
    if (selectedCmd?.limited) consumeUse(selectedCmd.id);
    setSelectedCmdId(null);
    setSelectedCharId(null);
  }, [consumeAP, consumeUse, selectedCmd]);

  const handleRefill = useCallback(() => {
    if (!selectedChar) return;
    applyRefill(selectedChar.id);
    finishExecution();
  }, [selectedChar, applyRefill, finishExecution]);

  const handleMaxUp = useCallback(() => {
    if (!selectedChar) return;
    applyMaxUp(selectedChar.id);
    finishExecution();
  }, [selectedChar, applyMaxUp, finishExecution]);

  const handleResetAll = useCallback(() => {
    reset();
    setSelectedCmdId(null);
    setSelectedCharId(null);
  }, [reset]);

  return (
    <div id="promotion-dev-root" style={{
      position:'fixed', inset:0, padding:'24px 28px',
      background:'linear-gradient(135deg, rgba(248,246,244,1) 0%, rgba(240,234,228,1) 100%)',
      fontFamily:"'Noto Sans JP'", color:TX,
      display:'flex', flexDirection:'column', gap:14,
      overflow:'auto',
    }}>
      {/* Header */}
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <div style={{fontSize:11, fontFamily:'Rajdhani', fontWeight:700,
          letterSpacing:'.24em', color:PK}}>PROMOTION (DEV)</div>
        <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:22, fontWeight:900, color:TX}}>
          プロモーション
        </div>
        <span style={{padding:'3px 9px', borderRadius:10, fontSize:9, fontWeight:700,
          background:`${PK}1a`, color:PK, border:`1px solid ${PK}44`,
          fontFamily:'Rajdhani', letterSpacing:'.16em'}}>?qa=promotion</span>
        <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:10}}>
          <div style={{display:'flex', alignItems:'center', gap:6,
            padding:'6px 12px', borderRadius:18,
            background: canExecute ? `${AC2}22` : 'rgba(0,0,0,.06)',
            border:`1px solid ${canExecute ? AC2 : BR}55`}}>
            <span style={{fontSize:10, color:TXD}}>⚡ 行動力</span>
            <span style={{fontFamily:'Rajdhani', fontWeight:700, fontSize:14,
              color: canExecute ? AC : TXF}}>
              {actionPoints} / {INITIAL_AP}
            </span>
          </div>
          {onBack && (
            <button onClick={onBack}
              style={{
                padding:'7px 14px', borderRadius:18,
                background:'rgba(0,0,0,.04)', border:`1px solid ${BR}`,
                color:TXD, cursor:'pointer', fontSize:12,
              }}>← 戻る</button>
          )}
        </div>
      </div>

      {/* Debug bar */}
      <DebugBar commands={COMMANDS} onReset={handleResetAll} onGrantUse={grantUse}/>

      {/* Main: 2 columns */}
      <div style={{
        display:'grid', gridTemplateColumns:'minmax(240px, 320px) 1fr',
        gap:18, alignItems:'start',
        ...glass({borderRadius:12, padding:18, border:`1px solid ${BR}`}),
      }}>
        <CommandList
          commands={displayCommands}
          selectedCmdId={selectedCmdId}
          onSelect={handleCmdSelect}
          disabled={!canExecute}
          usesMap={usesMap}
        />

        <div>
          {selectedCmd ? (
            <CharSelectList
              chars={mockChars}
              selectedCharId={selectedCharId}
              onSelect={handleCharSelect}
              disabled={!canExecute}
            />
          ) : (
            <div style={{padding:24, borderRadius:8, border:`1px dashed ${BR}`,
              fontSize:12, color:TXD, textAlign:'center'}}>
              ← 左のコマンドを選択
            </div>
          )}
        </div>
      </div>

      {!canExecute && (
        <div style={{padding:'10px 14px', borderRadius:8,
          background:`${PK2}11`, border:`1px solid ${PK2}33`,
          fontSize:11, color:PK2, textAlign:'center'}}>
          行動力が不足。「リセット」で初期化。
        </div>
      )}

      {/* Effect modal */}
      {selectedChar && selectedCmd && !selectedCmd.limited && (
        <EffectModal
          char={selectedChar}
          cmdName={selectedCmd.name}
          onRefill={handleRefill}
          onMaxUp={handleMaxUp}
          onCancel={() => setSelectedCharId(null)}
        />
      )}
    </div>
  );
}
