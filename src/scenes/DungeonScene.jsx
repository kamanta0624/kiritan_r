import { useState, useEffect } from 'react';
import { PK, PK2, AC, AC2, TEAL } from '../shared/tokens.js';
import { requiredMeme } from '../game/data/crowdfundingConfig.js';
import { MainCountToggle } from './FormationScene.jsx';

// ═══════════════════════════════════════════════════════════
//   DungeonScene — クラファン挑戦・浅層探索
//   phase: select → (battle は App.jsx が担当) → wave_result
//          → continue_or_rest ⇄ (進む で次波へ)
//   仕様: docs/DESIGN_CROWDFUNDING.md
// ═══════════════════════════════════════════════════════════

export default function DungeonScene({
  dungeonKind,       // 'crowdfunding' | 'shallow'
  goals,             // クラファンのゴール一覧（dungeons.json の goals）。浅層探索では未使用
  availableChars,
  remainingRounds,
  waveIndex,         // 直近に戦った（これから戦う）波の番号。0 = まだ未着手
  goalAchieved,      // クラファン: 進捗100%（ゴール）達成済みか
  progressPoints,    // クラファン: 累積進捗ポイント
  progressRequired,  // クラファン: 100%到達に必要な進捗ポイント
  battleResult,      // 'win' | 'lose' | null — 直近の波の結果
  sessionEnded,      // true なら結果表示後マップへ自動遷移
  rewardInfo,        // 直近の波で発生した報酬 { kind, delta, charNames } | null
  milestoneHit,      // 直近の波で進捗の100%刻みに新たに到達したか
  onConfirm,         // (charIds, goalId) => void — 挑戦開始／探索開始
  onContinue,        // () => void — 「進む」（次の波へ）
  onRest,            // () => void — 「休む」（HP全回復・ラウンド5消費）
  onEndSession,      // () => void — 「終了する」（クラファンは成果を確定してマップへ）
  onNavigate,
}) {
  const isCF = dungeonKind === 'crowdfunding';
  const progressPercent = isCF && progressRequired > 0
    ? Math.floor((progressPoints / progressRequired) * 100)
    : null;

  const initialPhase = () => {
    if (battleResult === 'win' || battleResult === 'lose') return 'wave_result';
    return waveIndex > 0 ? 'continue_or_rest' : 'select';
  };

  const [phase, setPhase]                     = useState(initialPhase);
  const [selectedCharIds, setSelectedCharIds] = useState([]);
  const [selectedGoalId, setSelectedGoalId]   = useState(null);
  const [mainCount, setMainCount]             = useState(2);

  // wave_result: 結果を一定時間表示してから次へ進む
  useEffect(() => {
    if (phase !== 'wave_result') return;
    const t = setTimeout(() => {
      if (sessionEnded) onNavigate('map');
      else setPhase('continue_or_rest');
    }, 1400);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line

  const dungeonName = isCF ? 'クラファン挑戦' : '浅層探索';

  // ── select フェーズ ──
  if (phase === 'select') {
    const eligibleChars = isCF
      ? availableChars.filter(c => (c.maxSoldiers ?? 0) >= requiredMeme(c.cfChallengeCount ?? 0))
      : availableChars;
    const noChars   = eligibleChars.length === 0;
    const needsGoal = isCF && !selectedGoalId;

    return (
      <DungeonShell name={dungeonName} remainingRounds={remainingRounds} progressPercent={progressPercent}>
        <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:480, margin:'0 auto' }}>

          {isCF && (
            <>
              <SectionTitle>ゴールを選択</SectionTitle>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {(goals ?? []).map(g => (
                  <button key={g.id}
                    onClick={() => setSelectedGoalId(g.id)}
                    style={{
                      padding:'8px 14px', borderRadius:6, cursor:'pointer',
                      background: selectedGoalId === g.id ? `${AC}33` : 'rgba(255,255,255,.05)',
                      border: `1px solid ${selectedGoalId === g.id ? AC : 'rgba(255,255,255,.15)'}`,
                      color:'#fff', fontFamily:"'Noto Sans JP'", fontSize:12,
                    }}>
                    {g.name}
                  </button>
                ))}
              </div>
            </>
          )}

          <SectionTitle>参加キャラを選択（最大4名）</SectionTitle>

          {noChars && (
            <div style={{ padding:'12px 18px', borderRadius:8,
              background:'rgba(255,80,80,.12)', border:'1px solid rgba(255,80,80,.4)',
              color:'rgba(255,160,160,.9)', fontSize:13, fontFamily:"'Noto Sans JP'" }}>
              {isCF ? '必要ミームを満たすキャラがいない' : '出撃可能なキャラがいない'}
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {eligibleChars.map(c => {
              const selected = selectedCharIds.includes(c.id);
              const disallow = !selected && selectedCharIds.length >= 4;
              return (
                <button key={c.id}
                  disabled={disallow}
                  onClick={() => setSelectedCharIds(ids =>
                    ids.includes(c.id) ? ids.filter(id => id !== c.id)
                      : ids.length >= 4 ? ids : [...ids, c.id]
                  )}
                  style={{
                    padding:'12px 16px', borderRadius:8, border:'none',
                    cursor: disallow ? 'not-allowed' : 'pointer',
                    textAlign:'left', transition:'all .15s',
                    opacity: disallow ? .4 : 1,
                    background: selected
                      ? `linear-gradient(135deg, ${AC}33, ${AC}11)`
                      : 'rgba(255,255,255,.05)',
                    borderLeft: `3px solid ${selected ? AC : 'rgba(255,255,255,.1)'}`,
                    color:'#fff', fontFamily:"'Noto Sans JP'", fontSize:13,
                  }}>
                  <span style={{ fontWeight:700 }}>{c.name}</span>
                  <span style={{ marginLeft:12, fontSize:11, color:'rgba(255,255,255,.5)',
                    fontFamily:'Rajdhani' }}>
                    HP {c.charHp}/{c.charMaxHp} · ミーム上限 {c.maxSoldiers}
                    {isCF && ` (必要 ${requiredMeme(c.cfChallengeCount ?? 0)})`}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop:14 }}>
            <MainCountToggle mainCount={mainCount} onChange={setMainCount}/>
          </div>

          <div style={{ display:'flex', gap:10, marginTop:8 }}>
            <DungeonBtn label={isCF ? '挑戦開始' : '探索開始'} color={TEAL} primary
              disabled={selectedCharIds.length === 0 || needsGoal || noChars}
              onClick={() => onConfirm(selectedCharIds, isCF ? selectedGoalId : null, mainCount)} />
            <DungeonBtn label="戻る" color="rgba(255,255,255,.7)"
              onClick={() => onNavigate('map')} />
          </div>
        </div>
      </DungeonShell>
    );
  }

  // ── wave_result フェーズ ──
  if (phase === 'wave_result') {
    const isWin = battleResult === 'win';
    const title = isWin
      ? (isCF ? (milestoneHit ? `達成！ 進捗 ${progressPercent}%` : '撃破！') : '探索成功！')
      : (isCF ? 'クラファン失敗…' : '撤退…');
    const sub = isCF
      ? (milestoneHit
          ? null // reward list が代わりに出る
          : (isWin ? `進捗 ${progressPercent}% まで前進` : 'ミーム上限は必要量まで戻る'))
      : (isWin ? 'ミームと好感度を獲得した' : '');

    return (
      <DungeonShell name={dungeonName} remainingRounds={remainingRounds} progressPercent={progressPercent}>
        <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:480, margin:'0 auto',
          alignItems:'center', textAlign:'center' }}>
          <div style={{ fontSize:28, fontWeight:900, color: isWin ? AC2 : PK,
            fontFamily:"'Zen Maru Gothic'", textShadow:`0 0 20px ${isWin ? AC2 : PK}88` }}>
            {title}
          </div>
          {sub && (
            <div style={{ fontSize:14, color:'rgba(255,255,255,.75)', fontFamily:"'Noto Sans JP'" }}>
              {sub}
            </div>
          )}
          {rewardInfo && <RewardList rewardInfo={rewardInfo} />}
        </div>
      </DungeonShell>
    );
  }

  // ── continue_or_rest フェーズ（進む／休む／終了する） ──
  if (phase === 'continue_or_rest') {
    return (
      <DungeonShell name={dungeonName} remainingRounds={remainingRounds} progressPercent={progressPercent}>
        <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:480, margin:'0 auto',
          alignItems:'center', textAlign:'center' }}>
          <div style={{ fontSize:20, fontWeight:900, color:AC2,
            fontFamily:"'Zen Maru Gothic'", textShadow:`0 0 16px ${AC2}88` }}>
            {isCF && goalAchieved ? 'ストレッチゴール継続中' : '次の行動を選択'}
          </div>
          <div style={{ display:'flex', gap:10, marginTop:8, flexWrap:'wrap', justifyContent:'center' }}>
            <DungeonBtn label="進む" color={TEAL} primary onClick={onContinue} />
            <DungeonBtn label="休む" color={AC2}
              disabled={remainingRounds < 5}
              onClick={onRest} />
            <DungeonBtn label="終了する" color="rgba(255,255,255,.7)"
              onClick={onEndSession} />
          </div>
        </div>
      </DungeonShell>
    );
  }

  return null;
}

// ── 共通レイアウトシェル ──

function DungeonShell({ name, remainingRounds, progressPercent, children }) {
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
          ◤ {name}
        </div>
        <div style={{ fontFamily:'Rajdhani', fontSize:11, fontWeight:700,
          letterSpacing:'.32em', color:'rgba(255,255,255,.5)' }}>
          DUNGEON
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
          {progressPercent != null && (
            <div style={{ display:'flex', alignItems:'baseline', gap:8,
              padding:'8px 18px', borderRadius:6,
              background:'rgba(0,0,0,.55)', border:`1px solid ${AC}55`,
              boxShadow:`0 0 18px ${AC}33` }}>
              <span style={{ fontFamily:'Rajdhani', fontSize:10, letterSpacing:'.22em', color:AC2 }}>PROGRESS</span>
              <span style={{ fontFamily:'Rajdhani', fontWeight:900, fontSize:26, color:AC2,
                textShadow:`0 0 12px ${AC}aa` }}>{progressPercent}%</span>
            </div>
          )}
          {remainingRounds != null && (
            <div style={{ display:'flex', alignItems:'baseline', gap:8,
              padding:'8px 18px', borderRadius:6,
              background:'rgba(0,0,0,.55)', border:`1px solid ${PK}55`,
              boxShadow:`0 0 18px ${PK}33` }}>
              <span style={{ fontFamily:'Rajdhani', fontSize:10, letterSpacing:'.22em', color:PK2 }}>ROUNDS</span>
              <span style={{ fontFamily:'Rajdhani', fontWeight:900, fontSize:26, color:PK2,
                textShadow:`0 0 12px ${PK}aa` }}>{Math.max(0, remainingRounds)}</span>
            </div>
          )}
        </div>
      </div>

      {/* main content。キャラ数が多いと縦に長くなるため、固定top barと重ならないよう
          スクロール可能な上詰めレイアウトにする（下詰め中央寄せだと長いリストが top bar に潜り込む）*/}
      <div style={{ position:'absolute', inset:0, display:'flex',
        justifyContent:'center', overflowY:'auto', paddingTop:96, paddingBottom:32 }}>
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

// 増えたパラメータを具体値で一覧表示（DESIGN_CROWDFUNDING.md §4-2）。
// delta は全参加キャラ共通なので、参加者名をまとめて出し内訳は1回だけ表示する。
function RewardList({ rewardInfo }) {
  const { delta, charNames } = rewardInfo;
  const entries = Object.entries(delta ?? {});
  if (!entries.length) return null;
  return (
    <div style={{ padding:'12px 18px', borderRadius:8,
      background:'rgba(255,220,100,.08)', border:'1px solid rgba(255,220,100,.35)',
      display:'flex', flexDirection:'column', gap:6, textAlign:'left' }}>
      <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,220,100,.9)', fontFamily:"'Noto Sans JP'" }}>
        {(charNames ?? []).join('・')}
      </div>
      <div style={{ fontSize:12, color:'rgba(255,255,255,.85)', fontFamily:'Rajdhani', letterSpacing:'.02em' }}>
        {entries.map(([field, amount]) => `${field} +${amount}`).join(' / ')}
      </div>
    </div>
  );
}

function DungeonBtn({ label, color, onClick, disabled, primary }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding:'11px 24px', borderRadius:6,
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
