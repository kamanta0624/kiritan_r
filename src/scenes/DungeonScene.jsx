import { useState, useEffect, useRef } from 'react';
import { PK, PK2, AC, AC2, TEAL } from '../shared/tokens.js';
import eventsData from '../game/data/events.json';
import ADVScene, { convertEventScript } from './ADVScene.jsx';

// ═══════════════════════════════════════════════════════════
//   DungeonScene — 迷宮探索
//   phase: select → floor_intro → battle → floor_result
//          → (adv) → next_or_escape / dungeon_cleared
// ═══════════════════════════════════════════════════════════

export default function DungeonScene({
  dungeon,
  progress,
  availableChars,
  dungeonExploredThisTurn,
  battleResult,
  resumeFloor,
  resumeCharId,
  onStartBattle,
  onFloorClear,
  onDefeat,
  onNavigate,
}) {
  const initialPhase = () => {
    if (battleResult === 'win' || battleResult === 'lose') return 'floor_result';
    return 'select';
  };

  const [phase, setPhase]             = useState(initialPhase);
  const [selectedCharId, setSelected] = useState(resumeCharId ?? null);
  const [currentFloor, setFloor]      = useState(resumeFloor ?? (progress.clearedFloors + 1));
  const [currentEventId, setEventId]  = useState(null);
  const [lastRewardItem, setLastRewardItem] = useState(null);
  const clearedCalledRef              = useRef(false);

  // 敗北時: onDefeat を呼んで2秒後にmap
  useEffect(() => {
    if (phase !== 'floor_result' || battleResult !== 'lose') return;
    onDefeat(resumeCharId);
    const t = setTimeout(() => onNavigate('map'), 2000);
    return () => clearTimeout(t);
  }, [phase, battleResult]); // eslint-disable-line

  // 勝利時: onFloorClear → adv or next_or_escape or dungeon_cleared
  useEffect(() => {
    if (phase !== 'floor_result' || battleResult !== 'win') return;
    if (clearedCalledRef.current) return;
    clearedCalledRef.current = true;

    const floorData    = dungeon.floors.find(f => f.floor === currentFloor);
    const isLastFloor  = currentFloor >= dungeon.totalFloors;
    const rewardItemId = floorData?.rewardItemId ?? null;
    const eventId      = floorData?.eventId ?? null;

    const rewardItem = rewardItemId
      ? { instanceId: `${rewardItemId}_${Date.now()}`, itemId: rewardItemId }
      : null;

    setLastRewardItem(rewardItem);

    onFloorClear({
      dungeonId:      dungeon.id,
      clearedFloors:  currentFloor,
      isFullyCleared: isLastFloor,
      rewardItem,
    });

    if (eventId) {
      setEventId(eventId);
      setPhase('adv');
    } else if (isLastFloor) {
      setPhase('dungeon_cleared');
    } else {
      setPhase('next_or_escape');
    }
  }, [phase, battleResult]); // eslint-disable-line

  // ── select フェーズ ──
  if (phase === 'select') {
    const isFullyCleared = progress.isFullyCleared;
    const noChars        = availableChars.length === 0;
    const blocked        = dungeonExploredThisTurn || isFullyCleared || noChars;
    const blockReason    = dungeonExploredThisTurn
      ? '本日探索済み'
      : isFullyCleared
        ? '探索完了済み'
        : noChars
          ? '出撃可能なキャラがいない'
          : null;

    return (
      <DungeonShell dungeon={dungeon} floor={progress.clearedFloors + 1} totalFloors={dungeon.totalFloors}>
        <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:480, margin:'0 auto' }}>
          <SectionTitle>探索者を選択</SectionTitle>

          {blocked && (
            <div style={{ padding:'12px 18px', borderRadius:8,
              background:'rgba(255,80,80,.12)', border:'1px solid rgba(255,80,80,.4)',
              color:'rgba(255,160,160,.9)', fontSize:13, fontFamily:"'Noto Sans JP'" }}>
              {blockReason}
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {availableChars.map(c => (
              <button key={c.id}
                onClick={() => setSelected(c.id)}
                style={{
                  padding:'12px 16px', borderRadius:8, border:'none', cursor:'pointer',
                  textAlign:'left', transition:'all .15s',
                  background: selectedCharId === c.id
                    ? `linear-gradient(135deg, ${AC}33, ${AC}11)`
                    : 'rgba(255,255,255,.05)',
                  borderLeft: `3px solid ${selectedCharId === c.id ? AC : 'rgba(255,255,255,.1)'}`,
                  color:'#fff', fontFamily:"'Noto Sans JP'", fontSize:13,
                }}>
                <span style={{ fontWeight:700 }}>{c.name}</span>
                <span style={{ marginLeft:12, fontSize:11, color:'rgba(255,255,255,.5)',
                  fontFamily:'Rajdhani' }}>
                  HP {c.charHp}/{c.charMaxHp} · SP {c.soldiers}
                </span>
              </button>
            ))}
          </div>

          <div style={{ display:'flex', gap:10, marginTop:8 }}>
            <DungeonBtn label="探索開始" color={TEAL} primary
              disabled={!selectedCharId || blocked}
              onClick={() => setPhase('floor_intro')} />
            <DungeonBtn label="戻る" color="rgba(255,255,255,.3)"
              onClick={() => onNavigate('map')} />
          </div>
        </div>
      </DungeonShell>
    );
  }

  // ── floor_intro フェーズ ──
  if (phase === 'floor_intro') {
    const floorData = dungeon.floors.find(f => f.floor === currentFloor);
    return (
      <DungeonShell dungeon={dungeon} floor={currentFloor} totalFloors={dungeon.totalFloors}>
        <div style={{ display:'flex', flexDirection:'column', gap:20, maxWidth:480, margin:'0 auto' }}>
          <SectionTitle>B{currentFloor} — 探索</SectionTitle>

          <InfoCard>
            <Row label="ダンジョン">{dungeon.name}</Row>
            <Row label="階層">B{currentFloor} / B{dungeon.totalFloors}</Row>
          </InfoCard>

          <InfoCard title="出現する敵">
            <Row label="名前">{floorData?.enemy?.name}</Row>
            <Row label="兵力">{floorData?.enemy?.soldiers}</Row>
          </InfoCard>

          <div style={{ display:'flex', gap:10 }}>
            <DungeonBtn label="戦闘開始" color={PK} primary
              onClick={() => onStartBattle(selectedCharId, currentFloor, floorData)} />
            <DungeonBtn label="退却" color="rgba(255,255,255,.3)"
              onClick={() => onNavigate('map')} />
          </div>
        </div>
      </DungeonShell>
    );
  }

  // ── floor_result フェーズ ──
  if (phase === 'floor_result') {
    if (battleResult === 'lose') {
      const char = availableChars.find(c => c.id === resumeCharId);
      return (
        <DungeonShell dungeon={dungeon} floor={currentFloor} totalFloors={dungeon.totalFloors}>
          <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:480, margin:'0 auto',
            alignItems:'center', textAlign:'center' }}>
            <div style={{ fontSize:28, fontWeight:900, color:PK,
              fontFamily:"'Zen Maru Gothic'", textShadow:`0 0 20px ${PK}88` }}>
              探索失敗
            </div>
            <div style={{ fontSize:16, color:'rgba(255,255,255,.8)',
              fontFamily:"'Noto Sans JP'" }}>
              {char?.name ?? '探索者'} は倒れた
            </div>
            <div style={{ fontSize:13, color:'rgba(255,200,200,.7)',
              fontFamily:"'Noto Sans JP'" }}>
              2ターンの休養が必要です
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.4)',
              fontFamily:'Rajdhani' }}>
              マップへ自動的に戻ります…
            </div>
          </div>
        </DungeonShell>
      );
    }
    // 勝利中は useEffect が処理するので Loading 表示
    return (
      <DungeonShell dungeon={dungeon} floor={currentFloor} totalFloors={dungeon.totalFloors}>
        <div style={{ color:'rgba(255,255,255,.6)', fontFamily:'Rajdhani', letterSpacing:'.2em' }}>
          PROCESSING…
        </div>
      </DungeonShell>
    );
  }

  // ── adv フェーズ ──
  if (phase === 'adv') {
    const eventDef = (eventsData.events ?? eventsData)?.find
      ? (eventsData.events ?? eventsData).find(e => e.id === currentEventId)
      : null;
    const { scenario, cast } = eventDef
      ? convertEventScript(eventDef.script ?? [])
      : { scenario: [{ type:'end' }], cast: [] };

    return (
      <ADVScene
        scenario={scenario}
        cast={cast}
        bg={null}
        transparent={false}
        onExit={() => {
          const isLastFloor = currentFloor >= dungeon.totalFloors;
          setPhase(isLastFloor ? 'dungeon_cleared' : 'next_or_escape');
        }}
      />
    );
  }

  // ── next_or_escape フェーズ ──
  if (phase === 'next_or_escape') {
    return (
      <DungeonShell dungeon={dungeon} floor={currentFloor} totalFloors={dungeon.totalFloors}>
        <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:480, margin:'0 auto',
          alignItems:'center', textAlign:'center' }}>
          <div style={{ fontSize:24, fontWeight:900, color:AC2,
            fontFamily:"'Zen Maru Gothic'", textShadow:`0 0 16px ${AC2}88` }}>
            B{currentFloor} クリア！
          </div>
          {lastRewardItem && (
            <div style={{ fontSize:13, color:'rgba(255,220,100,.8)',
              fontFamily:"'Noto Sans JP'" }}>
              アイテムを入手した
            </div>
          )}
          <div style={{ display:'flex', gap:10, marginTop:8 }}>
            <DungeonBtn label="次の階へ" color={TEAL} primary
              onClick={() => {
                setFloor(f => f + 1);
                clearedCalledRef.current = false;
                setPhase('floor_intro');
              }} />
            <DungeonBtn label="退却する" color="rgba(255,255,255,.3)"
              onClick={() => onNavigate('map')} />
          </div>
        </div>
      </DungeonShell>
    );
  }

  // ── dungeon_cleared フェーズ ──
  if (phase === 'dungeon_cleared') {
    return (
      <DungeonShell dungeon={dungeon} floor={currentFloor} totalFloors={dungeon.totalFloors}>
        <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:480, margin:'0 auto',
          alignItems:'center', textAlign:'center' }}>
          <div style={{ fontSize:28, fontWeight:900, color:AC,
            fontFamily:"'Zen Maru Gothic'", textShadow:`0 0 20px ${AC}88` }}>
            迷宮クリア！
          </div>
          <div style={{ fontSize:15, color:'rgba(255,255,255,.7)',
            fontFamily:"'Noto Sans JP'" }}>
            {dungeon.name} を制覇した
          </div>
          {lastRewardItem && (
            <div style={{ fontSize:13, color:'rgba(255,220,100,.8)',
              fontFamily:"'Noto Sans JP'" }}>
              アイテムを入手した
            </div>
          )}
          <div style={{ marginTop:8 }}>
            <DungeonBtn label="マップへ戻る" color={AC} primary
              onClick={() => onNavigate('map')} />
          </div>
        </div>
      </DungeonShell>
    );
  }

  return null;
}

// ── 共通レイアウトシェル ──

function DungeonShell({ dungeon, floor, totalFloors, children }) {
  return (
    <div style={{
      width:'100vw', height:'100vh', position:'relative', overflow:'hidden',
      fontFamily:"'Noto Sans JP'", color:'rgba(255,255,255,.92)',
      background:'radial-gradient(ellipse at 50% 80%, #1a1028 0%, #0a060f 60%, #04020a 100%)',
    }}>
      {/* atmospheric grid */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', opacity:.18,
        backgroundImage:[
          'repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0, rgba(255,255,255,.04) 1px, transparent 1px, transparent 56px)',
          'repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0, rgba(255,255,255,.04) 1px, transparent 1px, transparent 56px)',
        ].join(', '),
      }}/>

      {/* top bar */}
      <div style={{ position:'absolute', top:0, left:0, right:0, padding:'16px 24px',
        display:'flex', alignItems:'center', gap:14, zIndex:10,
        background:'linear-gradient(180deg, rgba(0,0,0,.7), transparent)' }}>
        <div style={{ padding:'6px 14px', borderRadius:4,
          background:'rgba(0,0,0,.55)', border:'1px solid rgba(255,255,255,.12)',
          fontFamily:"'Zen Maru Gothic'", fontSize:14, fontWeight:900, color:'#fff', letterSpacing:'.1em' }}>
          ◤ {dungeon.name}
        </div>
        <div style={{ fontFamily:'Rajdhani', fontSize:11, fontWeight:700,
          letterSpacing:'.32em', color:'rgba(255,255,255,.5)' }}>
          DUNGEON · EXPLORATION
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'baseline', gap:8,
          padding:'8px 18px', borderRadius:6,
          background:'rgba(0,0,0,.55)', border:`1px solid ${AC}55`,
          boxShadow:`0 0 18px ${AC}33` }}>
          <span style={{ fontFamily:'Rajdhani', fontSize:10, letterSpacing:'.22em', color:AC2 }}>FLOOR</span>
          <span style={{ fontFamily:'Rajdhani', fontWeight:900, fontSize:26, color:AC2,
            textShadow:`0 0 12px ${AC}aa` }}>B{floor}</span>
          <span style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>/ B{totalFloors}</span>
        </div>
      </div>

      {/* main content */}
      <div style={{ position:'absolute', inset:0, display:'flex',
        alignItems:'center', justifyContent:'center', paddingTop:80 }}>
        {children}
      </div>
    </div>
  );
}

// ── 小部品 ──

function SectionTitle({ children }) {
  return (
    <div style={{ fontFamily:"'Zen Maru Gothic'", fontSize:18, fontWeight:900,
      color:'rgba(255,255,255,.85)', letterSpacing:'.08em', marginBottom:4 }}>
      {children}
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <div style={{ padding:'14px 18px', borderRadius:8,
      background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)' }}>
      {title && (
        <div style={{ fontFamily:'Rajdhani', fontSize:10, fontWeight:700,
          letterSpacing:'.22em', color:'rgba(255,255,255,.4)', marginBottom:8 }}>
          {title.toUpperCase()}
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
      <span style={{ fontSize:11, color:'rgba(255,255,255,.4)',
        fontFamily:'Rajdhani', fontWeight:700, minWidth:80 }}>
        {label}
      </span>
      <span style={{ fontSize:14, color:'rgba(255,255,255,.85)',
        fontFamily:"'Noto Sans JP'" }}>
        {children}
      </span>
    </div>
  );
}

function DungeonBtn({ label, color, onClick, disabled, primary }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding:'11px 24px', borderRadius:6, border:'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled
          ? 'rgba(255,255,255,.05)'
          : primary
            ? `linear-gradient(135deg, ${color}, ${color}aa)`
            : `${color}22`,
        border: disabled ? '1px solid rgba(255,255,255,.06)' : `1px solid ${color}66`,
        color: disabled ? 'rgba(255,255,255,.25)' : primary ? '#fff' : color,
        fontFamily:"'Noto Sans JP'", fontSize:13, fontWeight:700, letterSpacing:'.08em',
        opacity: disabled ? .5 : 1,
        boxShadow: primary && !disabled ? `0 3px 16px ${color}55` : 'none',
        transition:'all .15s',
      }}>
      {label}
    </button>
  );
}
