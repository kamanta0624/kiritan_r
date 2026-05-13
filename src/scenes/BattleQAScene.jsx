/**
 * BattleQAScene.jsx — BattleEngineV3 単体テスト環境
 */
import { useState, useCallback } from 'react';
import { BattleEngineV3 } from '../game/systems/BattleEngineV3.js';
import { BattleAI }       from '../game/systems/BattleAI.js';
import testCharsData      from '../game/data/test/test_characters.json';

const CHARS = testCharsData.characters.filter(c => !c.isTemplate);

const SCENARIOS = [
  { id:'b501', label:'V3-01 近接2v2 (normal)', attackerIds:['tc_001','tc_004'], defenderIds:['tc_enemy_001','tc_enemy_002'], battleCapacity:300, battleMode:'normal' },
  { id:'b502', label:'V3-02 前衛後衛判定', attackerIds:['tc_001','tc_002'], defenderIds:['tc_enemy_001','tc_enemy_002'], battleCapacity:300, battleMode:'normal' },
  { id:'b503', label:'V3-03 ラウンド制限(5R)', attackerIds:['tc_004'], defenderIds:['tc_enemy_001'], battleCapacity:300, battleMode:'normal' },
  { id:'b504', label:'V3-04 迷宮(無制限)', attackerIds:['tc_001'], defenderIds:['tc_enemy_001'], battleCapacity:200, battleMode:'dungeon' },
  { id:'b505', label:'V3-05 作戦システム', attackerIds:['tc_001'], defenderIds:['tc_enemy_002'], battleCapacity:300, battleMode:'normal' },
];

const S = {
  root:  { fontFamily:'monospace', fontSize:13, background:'#08060f', color:'#c8c0d8', minHeight:'100vh', padding:16 },
  h1:    { color:'#c4427a', fontSize:20, fontWeight:'bold', marginBottom:16 },
  row:   { display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 },
  card:  { background:'#111020', border:'1px solid #2a1a3a', borderRadius:6, padding:12, minWidth:220 },
  btn:   { padding:'6px 14px', borderRadius:4, cursor:'pointer', border:'1px solid #4a3a6a', background:'#1a1030', color:'#c8c0d8', fontSize:12 },
  btnPk: { padding:'6px 14px', borderRadius:4, cursor:'pointer', border:'1px solid #c4427a', background:'#2a0a14', color:'#c4427a', fontSize:12, fontWeight:'bold' },
  log:   { background:'#06040c', border:'1px solid #1a1030', borderRadius:4, padding:10, height:380, overflowY:'auto', fontSize:11, lineHeight:1.7 },
  unit:  { background:'#0d0b1a', border:'1px solid #2a1a3a', borderRadius:4, padding:'5px 8px', marginBottom:5 },
};

function logColor(l) {
  if (l.startsWith('━━')) return '#3a2a5a';
  if (l.startsWith('  ')) return '#7a6a8a';
  if (l.includes('勝利') || l.includes('作戦成功')) return '#44ffaa';
  if (l.includes('戦闘不能')) return '#ff4444';
  if (l.includes('HP-') || l.includes('HP:')) return '#d4a044';
  return '#9a8aaa';
}

function UnitCard({ unit, engine }) {
  const dead = engine.isDead(unit);
  return (
    <div style={{ ...S.unit, opacity: dead ? 0.4 : 1 }}>
      <span style={{ color: dead ? '#ff4444' : '#f0ece4', fontWeight: 'bold' }}>{unit.char.name}</span>
      <span style={{ color:'#6a5a8a', fontSize:10 }}> [{unit.position}] {unit.char.role} / {unit.char.attackType}</span>
      {dead && <span style={{ color:'#ff4444' }}> ✗</span>}
      <div style={{ fontSize:11, marginTop:2 }}>
        <span style={{ color:'#6a5a8a' }}>HP </span><span style={{ color:'#d4a044' }}>{unit.charHp}/{unit.charMaxHp}</span>
        <span style={{ color:'#6a5a8a', marginLeft:8 }}>SP </span><span style={{ color:'#4a9af0' }}>{unit.soldiers}/{unit.maxSoldiers}</span>
      </div>
    </div>
  );
}

export default function BattleQAScene({ onBack }) {
  const [selId, setSelId]   = useState(SCENARIOS[0].id);
  const [log, setLog]       = useState([]);
  const [engine, setEngine] = useState(null);
  const [result, setResult] = useState(null);
  const [, forceUpdate]     = useState(0);

  const scenario = SCENARIOS.find(s => s.id === selId);

  const start = () => {
    setLog([]);
    setResult(null);
    const logBuf = [];
    const pushLog = msg => { logBuf.push(msg); setLog([...logBuf]); };

    const buildUnit = (id, sideType, idx) => {
      const c = CHARS.find(c => c.id === id);
      if (!c) throw new Error(`char not found: ${id}`);
      return BattleEngineV3.buildUnit(c, sideType, idx);
    };

    const playerUnits = scenario.attackerIds.map((id, i) => buildUnit(id, 'attack', i));
    const enemyUnits  = scenario.defenderIds.map((id, i) => buildUnit(id, 'defense', i));

    const eng = new BattleEngineV3({
      playerSide: playerUnits, enemySide: enemyUnits,
      mode: 'attack', battleCapacity: scenario.battleCapacity, battleMode: scenario.battleMode,
      onLog: pushLog, onCardUpdate: () => {}, onShake: () => {}, onPopup: () => {},
      delayedCall: (ms, fn) => setTimeout(fn, ms),
    });
    eng._onBattleEnd = (wins) => {
      eng.gameOver = true;
      const r = wins ? '✅ 攻撃側勝利' : '🛡 防衛側勝利';
      setResult(r);
      pushLog(`━━ 戦闘終了: ${r} ━━`);
      forceUpdate(n => n + 1);
    };
    setEngine(eng);
    pushLog('エンジン初期化完了。「1R進める」を押してください。');
    forceUpdate(n => n + 1);
  };

  const runRound = useCallback(() => {
    if (!engine || engine.gameOver) return;
    engine.startRound();

    const allActors = [
      ...engine.playerSide.map(u => ({ u, isPlayer: true })),
      ...engine.enemySide.map(u => ({ u, isPlayer: false })),
    ].filter(({ u }) => !engine.isDead(u) && !u.retreated);

    allActors.sort((a, b) => a.u.soldiers - b.u.soldiers);

    allActors.forEach(({ u, isPlayer }) => {
      const opponents = isPlayer ? engine.enemySide : engine.playerSide;
      const alive = opponents.filter(d => engine._isAlive(d));

      // 行動選択（集中/必殺あり）
      const options = ['attack', 'defend'];
      BattleAI.selectAction(u, options);

      // ターゲット: 近接は前衛のみ、ranged/songは全体
      if (u.action === 'attack' && alive.length > 0) {
        const isRanged = u.char.attackType === 'ranged' || u.char.attackType === 'song';
        const pool = isRanged ? alive : (alive.filter(d => d.position === 'front').length > 0
          ? alive.filter(d => d.position === 'front') : alive);
        u.targetId = pool[Math.floor(Math.random() * pool.length)].char.id;
      }

      engine.executeAction(u, isPlayer);
      engine.markActed(u);
    });

    // ゲームオーバーチェック（QAでは同期で判定）
    // delayedCallを一時的に同期化して即時判定
    const origDelay = engine._delayedCall;
    engine._delayedCall = (ms, fn) => fn(); // QA用: 即時実行
    if (!engine.checkGameOver()) {
      engine.checkRoundLimit();
    }
    engine._delayedCall = origDelay; // 元に戻す
    forceUpdate(n => n + 1);
  }, [engine]);

  const runAll = useCallback(() => {
    if (!engine || engine.gameOver) return;
    let count = 0;
    const step = () => {
      if (engine.gameOver || count++ > 20) return;
      runRound();
      if (!engine.gameOver) setTimeout(step, 150);
    };
    step();
  }, [engine, runRound]);

  return (
    <div style={S.root}>
      <div style={S.h1}>⚔ BattleEngineV3 QA</div>

      <div style={S.row}>
        {SCENARIOS.map(s => (
          <button key={s.id} style={selId === s.id ? S.btnPk : S.btn}
            onClick={() => { setSelId(s.id); setEngine(null); setLog([]); setResult(null); }}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={S.row}>
        <button style={S.btnPk} onClick={start}>▶ 開始</button>
        <button style={engine && !engine.gameOver ? S.btnPk : S.btn}
          onClick={runRound} disabled={!engine || engine.gameOver}>
          ⏭ 1R進める {engine ? `(Round ${engine.round})` : ''}
        </button>
        <button style={S.btn} onClick={runAll} disabled={!engine || engine.gameOver}>
          ⏩ 全自動
        </button>
        {onBack && <button style={S.btn} onClick={onBack}>← 戻る</button>}
      </div>

      {result && (
        <div style={{ ...S.card, border:'1px solid #44ffaa', color:'#44ffaa', marginBottom:12, fontSize:16, fontWeight:'bold' }}>
          {result}
        </div>
      )}

      {engine && (
        <div style={S.row}>
          <div style={S.card}>
            <div style={{ color:'#c4427a', marginBottom:8, fontWeight:'bold' }}>攻撃側</div>
            {engine.playerSide.map(u => <UnitCard key={u.char.id} unit={u} engine={engine} />)}
          </div>
          <div style={S.card}>
            <div style={{ color:'#d4a044', marginBottom:8, fontWeight:'bold' }}>防衛側</div>
            {engine.enemySide.map(u => <UnitCard key={u.char.id} unit={u} engine={engine} />)}
          </div>
          <div style={S.card}>
            <div style={{ color:'#6a5a8a', marginBottom:8 }}>エンジン状態</div>
            <div style={{ fontSize:11, lineHeight:1.8 }}>
              <div><span style={{ color:'#6a5a8a' }}>ラウンド </span><span style={{ color:'#f0ece4', fontWeight:'bold' }}>{engine.round} / {engine.maxRounds === Infinity ? '∞' : engine.maxRounds}</span></div>
              <div><span style={{ color:'#6a5a8a' }}>gameOver </span><span style={{ color: engine.gameOver ? '#ff4444' : '#44ffaa' }}>{String(engine.gameOver)}</span></div>
              <div><span style={{ color:'#6a5a8a' }}>battleMode </span><span style={{ color:'#f0ece4' }}>{engine.battleMode}</span></div>
              <div><span style={{ color:'#6a5a8a' }}>allowRetreat </span><span style={{ color:'#f0ece4' }}>{String(engine.allowRetreat)}</span></div>
              <div><span style={{ color:'#6a5a8a' }}>strategyMult </span>
                <span style={{ color: engine.strategyMult?.side ? '#44ffaa' : '#6a5a8a' }}>
                  {engine.strategyMult?.side ? `${engine.strategyMult.side} +${(engine.strategyMult.bonus*100)|0}%` : '互角'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={S.log}>
        {log.map((l, i) => <div key={i} style={{ color: logColor(l) }}>{l}</div>)}
      </div>
    </div>
  );
}
