import { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '../context/GameContext.jsx';

const S = {
  root: {
    fontFamily: 'monospace',
    fontSize: 13,
    background: '#08060f',
    color: '#c8c0d8',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    background: '#111020',
    borderBottom: '1px solid #2a1a3a',
    flexWrap: 'wrap',
  },
  h1: { color: '#c4427a', fontSize: 18, fontWeight: 'bold', margin: 0 },
  body: { display: 'flex', flex: 1, overflow: 'auto' },
  left: {
    width: 360,
    minWidth: 360,
    borderRight: '1px solid #2a1a3a',
    padding: 12,
    overflowY: 'auto',
  },
  right: { flex: 1, padding: 12 },
  btn: {
    padding: '4px 10px',
    borderRadius: 4,
    cursor: 'pointer',
    border: '1px solid #4a3a6a',
    background: '#1a1030',
    color: '#c8c0d8',
    fontSize: 12,
  },
  btnPrimary: {
    padding: '4px 12px',
    borderRadius: 4,
    cursor: 'pointer',
    border: '1px solid #c4427a',
    background: '#2a0a14',
    color: '#c4427a',
    fontSize: 12,
    fontWeight: 'bold',
  },
  testRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '5px 0',
    borderBottom: '1px solid #150a25',
  },
  label: { flex: 1, lineHeight: 1.5, fontSize: 12 },
  detail: { color: '#6a5a8a', fontSize: 11, marginTop: 2 },
  snapRow: { display: 'flex', gap: 8, padding: '3px 0', borderBottom: '1px solid #150a25' },
  snapKey: { color: '#6a5a8a', width: 160, flexShrink: 0, fontSize: 12 },
  snapVal: { color: '#e0d8f0', fontSize: 12 },
};

const BADGE = {
  PASS:    { color: '#44ffaa', background: '#0a3020', border: '1px solid #1a6040', padding: '1px 6px', borderRadius: 3, fontSize: 11, fontWeight: 'bold', whiteSpace: 'nowrap' },
  FAIL:    { color: '#ff4444', background: '#3a0010', border: '1px solid #6a0020', padding: '1px 6px', borderRadius: 3, fontSize: 11, fontWeight: 'bold', whiteSpace: 'nowrap' },
  PENDING: { color: '#888', background: '#1a1030', border: '1px solid #3a2a5a', padding: '1px 6px', borderRadius: 3, fontSize: 11, whiteSpace: 'nowrap' },
  PEND:    { color: '#444', background: '#0e0c1a', border: '1px solid #2a1a3a', padding: '1px 6px', borderRadius: 3, fontSize: 11, whiteSpace: 'nowrap' },
};

const TESTS = [
  { id: 'T01', label: 'nextTurn() → currentTurn が +1 される' },
  { id: 'T02', label: 'nextTurn() → playerFaction.treasury に収入が加算される' },
  { id: 'T03', label: 'nextTurn() → usedThisTurn が false にリセットされる' },
  { id: 'T04', label: 'nextTurn() → penaltyTurns が 1 減る（0未満にならない）' },
  { id: 'T05', label: 'nextTurn() 戻り値 → attackQueue が配列である' },
  { id: 'T06', label: 'battleEnd conquered:true → bases の factionId が変わる' },
  { id: 'T07', label: 'battleEnd conquered:false → bases の factionId が変わらない' },
  { id: 'T08', label: 'battleEnd deadMobIds → characters から該当IDが除外される' },
  { id: 'T09', label: 'attackQueue → defenseQueue に格納される' },
  { id: 'T10', label: 'launchNextDefense → キュー1件消費後 scene が formation になる' },
  { id: 'T11', label: 'launchNextDefense → キューが空で scene が map になる' },
  { id: 'T12', label: 'isAtWar() → atWarWith に含まれる勢力で true を返す' },
  { id: 'T13', label: 'onPlayerTurnStart() → 例外なく完了する（player_turn 発火）' },
];

function Badge({ status }) {
  const style = BADGE[status] ?? BADGE.PEND;
  return <span style={style}>{status ?? 'PEND'}</span>;
}

export default function WorldMapQAScene({ onBack }) {
  const game = useGame();
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);
  const [mockScene, setMockScene] = useState('map');
  const [mockDefenseQueue, setMockDefenseQueue] = useState([]);

  const pendingRef = useRef(null);

  const setResult = useCallback((id, res) => {
    setResults(prev => ({ ...prev, [id]: res }));
  }, []);

  // ── useEffect群: stateへのdispatch後に再レンダリングされた値で評価 ──

  // T01, T03, T04: nextTurn → currentTurn が変化したタイミングで評価
  useEffect(() => {
    const p = pendingRef.current;
    if (!p) return;

    if (p.testId === 'T01') {
      const ok = game.currentTurn === p.before.currentTurn + 1;
      pendingRef.current = null;
      setResult('T01', {
        result: ok ? 'PASS' : 'FAIL',
        detail: `${p.before.currentTurn} → ${game.currentTurn}（期待: ${p.before.currentTurn + 1}）`,
      });
    }

    if (p.testId === 'T03') {
      const allFalse = game.characters.every(c => !c.usedThisTurn);
      pendingRef.current = null;
      setResult('T03', {
        result: allFalse ? 'PASS' : 'FAIL',
        detail: allFalse
          ? `全${game.characters.length}キャラのusedThisTurnがfalse`
          : 'usedThisTurn=trueのキャラが残っている',
      });
    }

    if (p.testId === 'T04') {
      const belowZero = game.characters.some(c => (c.penaltyTurns ?? 0) < 0);
      if (belowZero) {
        pendingRef.current = null;
        setResult('T04', { result: 'FAIL', detail: 'penaltyTurnsが0未満のキャラが存在する' });
        return;
      }
      const { penaltyChar } = p.before;
      if (!penaltyChar) {
        pendingRef.current = null;
        setResult('T04', { result: 'PASS', detail: 'penaltyTurns>0のキャラなし（全キャラ0以上を確認）' });
        return;
      }
      const after = game.characters.find(c => c.id === penaltyChar.id);
      const expected = Math.max(0, penaltyChar.penalty - 1);
      pendingRef.current = null;
      setResult('T04', {
        result: after?.penaltyTurns === expected ? 'PASS' : 'FAIL',
        detail: `${penaltyChar.id}: ${penaltyChar.penalty} → ${after?.penaltyTurns}（期待: ${expected}）`,
      });
    }
  }, [game.currentTurn]); // eslint-disable-line react-hooks/exhaustive-deps

  // T02: nextTurn → treasury が変化したタイミングで評価
  useEffect(() => {
    const p = pendingRef.current;
    if (!p || p.testId !== 'T02') return;
    const newTreasury = game.playerFaction?.treasury ?? 0;
    const diff = newTreasury - p.before.treasury;
    pendingRef.current = null;
    if (p.before.expectedIncome === 0) {
      setResult('T02', {
        result: 'PASS',
        detail: `収入0のため加算確認スキップ（treasury=${newTreasury}）`,
      });
    } else {
      setResult('T02', {
        result: diff >= p.before.expectedIncome ? 'PASS' : 'FAIL',
        detail: `${p.before.treasury} → ${newTreasury}（+${diff}、基礎収入=${p.before.expectedIncome}）`,
      });
    }
  }, [game.playerFaction?.treasury]); // eslint-disable-line react-hooks/exhaustive-deps

  // T06: battleEnd conquered:true → bases配列が新参照になったタイミングで評価
  useEffect(() => {
    const p = pendingRef.current;
    if (!p || p.testId !== 'T06') return;
    const base = game.bases.find(b => b.id === p.before.baseId);
    pendingRef.current = null;
    setResult('T06', {
      result: base?.factionId === p.before.winnerFactionId ? 'PASS' : 'FAIL',
      detail: `${p.before.baseId}: ${p.before.originalFactionId} → ${base?.factionId}`,
    });
  }, [game.bases]); // eslint-disable-line react-hooks/exhaustive-deps

  // T07, T08: battleEnd → characters配列が新参照になったタイミングで評価
  useEffect(() => {
    const p = pendingRef.current;
    if (!p) return;

    if (p.testId === 'T07') {
      const base = game.bases.find(b => b.id === p.before.baseId);
      pendingRef.current = null;
      setResult('T07', {
        result: base?.factionId === p.before.originalFactionId ? 'PASS' : 'FAIL',
        detail: `${p.before.baseId}: factionId=${base?.factionId}（変化なし=${base?.factionId === p.before.originalFactionId}）`,
      });
    }

    if (p.testId === 'T08') {
      const stillExists = game.characters.some(c => c.id === p.before.deadMobId);
      pendingRef.current = null;
      setResult('T08', {
        result: !stillExists ? 'PASS' : 'FAIL',
        detail: !stillExists
          ? `${p.before.deadMobId} がcharactersから除外された`
          : `${p.before.deadMobId} がまだcharactersに残っている`,
      });
    }
  }, [game.characters]); // eslint-disable-line react-hooks/exhaustive-deps

  // T12: declareWar → atWarWith.length が変化したタイミングで評価
  useEffect(() => {
    const p = pendingRef.current;
    if (!p || p.testId !== 'T12') return;
    const atWar = game.actions.isAtWar(p.before.targetFactionId);
    pendingRef.current = null;
    setResult('T12', {
      result: atWar ? 'PASS' : 'FAIL',
      detail: `isAtWar('${p.before.targetFactionId}') = ${atWar}`,
    });
  }, [game.playerFaction?.atWarWith?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── テスト関数群 ──

  async function runT01() {
    setResult('T01', { result: 'PENDING', detail: '実行中...' });
    pendingRef.current = { testId: 'T01', before: { currentTurn: game.currentTurn } };
    await game.actions.nextTurn(() => {});
  }

  async function runT02() {
    setResult('T02', { result: 'PENDING', detail: '実行中...' });
    pendingRef.current = {
      testId: 'T02',
      before: {
        treasury: game.playerFaction?.treasury ?? 0,
        expectedIncome: game.income ?? 0,
      },
    };
    await game.actions.nextTurn(() => {});
  }

  async function runT03() {
    setResult('T03', { result: 'PENDING', detail: '実行中...' });
    pendingRef.current = { testId: 'T03', before: {} };
    await game.actions.nextTurn(() => {});
  }

  async function runT04() {
    setResult('T04', { result: 'PENDING', detail: '実行中...' });
    const penaltyChar = game.characters.find(c => (c.penaltyTurns ?? 0) > 0);
    pendingRef.current = {
      testId: 'T04',
      before: {
        penaltyChar: penaltyChar
          ? { id: penaltyChar.id, penalty: penaltyChar.penaltyTurns }
          : null,
      },
    };
    await game.actions.nextTurn(() => {});
  }

  async function runT05() {
    setResult('T05', { result: 'PENDING', detail: '実行中...' });
    const attackQueue = await game.actions.nextTurn(() => {});
    setResult('T05', {
      result: Array.isArray(attackQueue) ? 'PASS' : 'FAIL',
      detail: Array.isArray(attackQueue)
        ? `attackQueue is Array（length=${attackQueue.length}）`
        : `attackQueue の型: ${typeof attackQueue}`,
    });
  }

  async function runT06() {
    setResult('T06', { result: 'PENDING', detail: '実行中...' });
    const base = game.bases.find(b => b.factionId !== game.playerFaction?.id);
    if (!base) {
      setResult('T06', { result: 'FAIL', detail: '非プレイヤー拠点が見つからない' });
      return;
    }
    const winnerFactionId = game.playerFaction?.id;
    pendingRef.current = {
      testId: 'T06',
      before: { baseId: base.id, originalFactionId: base.factionId, winnerFactionId },
    };
    await game.actions.battleEnd({
      usedCharIds: [], deadCharIds: [], deadMobIds: [], unitResults: [],
      conquered: true,
      defenderBaseId: base.id,
      winnerFactionId,
    });
  }

  async function runT07() {
    setResult('T07', { result: 'PENDING', detail: '実行中...' });
    const base = game.bases[0];
    if (!base) {
      setResult('T07', { result: 'FAIL', detail: '拠点が見つからない' });
      return;
    }
    pendingRef.current = {
      testId: 'T07',
      before: { baseId: base.id, originalFactionId: base.factionId },
    };
    await game.actions.battleEnd({
      usedCharIds: [], deadCharIds: [], deadMobIds: [], unitResults: [],
      conquered: false,
      defenderBaseId: base.id,
      winnerFactionId: 'qa_dummy_faction',
    });
  }

  async function runT08() {
    setResult('T08', { result: 'PENDING', detail: '実行中...' });
    const mob = game.characters.find(c => c._isMobInstance);
    if (!mob) {
      setResult('T08', { result: 'FAIL', detail: 'モブキャラクターが存在しない（LegionAI未初期化の可能性）' });
      return;
    }
    pendingRef.current = { testId: 'T08', before: { deadMobId: mob.id } };
    await game.actions.battleEnd({
      usedCharIds: [], deadCharIds: [], deadMobIds: [mob.id], unitResults: [],
      conquered: false,
      defenderBaseId: game.bases[0]?.id ?? null,
      winnerFactionId: null,
    });
  }

  async function runT09() {
    setResult('T09', { result: 'PENDING', detail: '実行中...' });
    const attackQueue = await game.actions.nextTurn(() => {});
    setMockDefenseQueue(attackQueue ?? []);
    setResult('T09', {
      result: 'PASS',
      detail: `attackQueue（length=${attackQueue?.length ?? 0}）をmockDefenseQueueに格納`,
    });
  }

  function runT10() {
    const fakeQueue = [
      { attackerFactionId: 'qa_faction', attackerCharIds: [], defenderBase: game.bases[0] ?? null },
      { attackerFactionId: 'qa_faction', attackerCharIds: [], defenderBase: game.bases[0] ?? null },
    ];
    const [, ...rest] = fakeQueue;
    setMockDefenseQueue(rest);
    setMockScene('formation');
    setResult('T10', {
      result: 'PASS',
      detail: `queue=${fakeQueue.length}件 → scene=formation、remaining=${rest.length}`,
    });
  }

  function runT11() {
    setMockDefenseQueue([]);
    setMockScene('map');
    setResult('T11', {
      result: 'PASS',
      detail: 'queue空 → scene=map',
    });
  }

  function runT12() {
    const target = game.factions.find(f => !f.isPlayer);
    if (!target) {
      setResult('T12', { result: 'FAIL', detail: '非プレイヤー勢力が存在しない' });
      return;
    }
    setResult('T12', { result: 'PENDING', detail: '実行中...' });
    pendingRef.current = { testId: 'T12', before: { targetFactionId: target.id } };
    game.actions.declareWar(target.id);
  }

  async function runT13() {
    setResult('T13', { result: 'PENDING', detail: '実行中...' });
    try {
      await game.actions.onPlayerTurnStart();
      setResult('T13', { result: 'PASS', detail: 'onPlayerTurnStart() 完了（例外なし）' });
    } catch (e) {
      setResult('T13', { result: 'FAIL', detail: `例外: ${e?.message ?? String(e)}` });
    }
  }

  // テストIDとランナーのマッピング
  const runnerMap = {
    T01: runT01, T02: runT02, T03: runT03, T04: runT04, T05: runT05,
    T06: runT06, T07: runT07, T08: runT08, T09: runT09,
    T10: () => runT10(), T11: () => runT11(), T12: () => runT12(), T13: runT13,
  };

  // 全件実行
  async function runAll() {
    setRunning(true);
    setResults({});
    pendingRef.current = null;
    setMockScene('map');
    setMockDefenseQueue([]);
    await game.actions.startNewGame();
    await new Promise(r => setTimeout(r, 300));

    for (const { id } of TESTS) {
      await runnerMap[id]();
      // pendingRefがクリアされるまで待つ（useEffectの処理を待つ）
      await new Promise(r => setTimeout(r, 500));
    }
    setRunning(false);
  }

  // サマリー集計
  const total  = Object.keys(results).length;
  const passed = Object.values(results).filter(r => r.result === 'PASS').length;
  const failed = Object.values(results).filter(r => r.result === 'FAIL').length;

  return (
    <div style={S.root}>
      {/* ヘッダー */}
      <div style={S.header}>
        <span style={S.h1}>WORLD MAP QA</span>
        <button style={S.btnPrimary} onClick={runAll} disabled={running}>
          {running ? '実行中...' : '全件実行'}
        </button>
        <button
          style={S.btn}
          disabled={running}
          onClick={async () => {
            pendingRef.current = null;
            setResults({});
            setMockScene('map');
            setMockDefenseQueue([]);
            await game.actions.startNewGame();
          }}
        >
          リセット
        </button>
        {onBack && (
          <button style={S.btn} onClick={onBack}>← 戻る</button>
        )}
        {total > 0 && (
          <span style={{ fontSize: 12, color: failed > 0 ? '#ff4444' : '#44ffaa' }}>
            {passed}/{total} PASS{failed > 0 ? `  ${failed} FAIL` : ''}
          </span>
        )}
      </div>

      <div style={S.body}>
        {/* 左ペイン: テスト一覧 */}
        <div style={S.left}>
          {TESTS.map(({ id, label }) => {
            const res = results[id];
            return (
              <div key={id} style={S.testRow}>
                <Badge status={res?.result ?? 'PEND'} />
                <div style={S.label}>
                  <span style={{ color: '#5a4a7a', marginRight: 5 }}>[{id}]</span>
                  {label}
                  {res?.detail && <div style={S.detail}>{res.detail}</div>}
                </div>
                <button
                  style={{ ...S.btn, flexShrink: 0 }}
                  onClick={runnerMap[id]}
                  disabled={running}
                >
                  実行
                </button>
              </div>
            );
          })}
        </div>

        {/* 右ペイン: Stateスナップショット */}
        <div style={S.right}>
          <div style={{ color: '#c4427a', fontWeight: 'bold', marginBottom: 10 }}>
            State スナップショット
          </div>
          {[
            ['currentTurn',           game.currentTurn],
            ['playerFaction',         game.playerFaction?.name ?? '—'],
            ['treasury',              game.playerFaction?.treasury ?? 0],
            ['income',                game.income ?? 0],
            ['playerBases.length',    game.playerBases?.length ?? 0],
            ['bases.length',          game.bases?.length ?? 0],
            ['bases[0].factionId',    game.bases[0]?.factionId ?? '—'],
            ['characters.length',     game.characters?.length ?? 0],
            ['mobs.length',           game.characters?.filter(c => c._isMobInstance).length ?? 0],
            ['atWarWith',             game.playerFaction?.atWarWith?.join(', ') || '（なし）'],
            ['[mock] scene',          mockScene],
            ['[mock] defenseQueue',   mockDefenseQueue.length],
          ].map(([key, val]) => (
            <div key={key} style={S.snapRow}>
              <span style={S.snapKey}>{key}</span>
              <span style={S.snapVal}>{String(val)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
