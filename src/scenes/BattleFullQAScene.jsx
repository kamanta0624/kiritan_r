/**
 * BattleFullQAScene.jsx — 戦闘エンジン全シナリオ QA ページ
 * BattleEngineV3 を直接呼び出して12シナリオを目視確認する。
 */
import { useState, useCallback, useRef } from 'react';
import { BattleEngineV3 } from '../game/systems/BattleEngineV3.js';
import { BattleAI }       from '../game/systems/BattleAI.js';

// ────────────────────────────────────────────────
// インラインテストキャラ
// ────────────────────────────────────────────────
const TEST_CHARS = {
  front_melee: {
    id: 'tc_front_melee', name: '前衛近接', attackType: 'melee',
    soldiers: 200, maxSoldiers: 200, charHp: 100, charMaxHp: 100,
    charAttack: 20, charDefense: 10, attackCount: 8,
    soldierAtk: 10, soldierDef: 8, strategyRate: 30,
  },
  rear_melee: {
    id: 'tc_rear_melee', name: '後衛近接', attackType: 'melee',
    soldiers: 300, maxSoldiers: 300, charHp: 100, charMaxHp: 100,
    charAttack: 20, charDefense: 10, attackCount: 8,
    soldierAtk: 10, soldierDef: 8, strategyRate: 30,
  },
  rear_ranged: {
    id: 'tc_rear_ranged', name: '後衛射撃', attackType: 'ranged',
    soldiers: 150, maxSoldiers: 150, charHp: 80, charMaxHp: 80,
    charAttack: 15, charDefense: 6, attackCount: 10,
    soldierAtk: 12, soldierDef: 6, strategyRate: 40,
  },
  rear_song: {
    id: 'tc_rear_song', name: '後衛歌唱', attackType: 'song',
    soldiers: 100, maxSoldiers: 100, charHp: 60, charMaxHp: 60,
    charAttack: 10, charDefense: 5, attackCount: 5,
    charSong: 80, soldierAtk: 8, soldierDef: 5, strategyRate: 50,
  },
  enemy_front: {
    id: 'tc_enemy_front', name: '敵前衛', attackType: 'melee',
    soldiers: 250, maxSoldiers: 250, charHp: 120, charMaxHp: 120,
    charAttack: 18, charDefense: 10, attackCount: 8,
    soldierAtk: 12, soldierDef: 10, strategyRate: 25,
  },
  enemy_rear: {
    id: 'tc_enemy_rear', name: '敵後衛', attackType: 'melee',
    soldiers: 200, maxSoldiers: 200, charHp: 100, charMaxHp: 100,
    charAttack: 15, charDefense: 8, attackCount: 6,
    soldierAtk: 10, soldierDef: 8, strategyRate: 25,
  },
  tanky: {
    id: 'tc_tanky', name: '超タンク', attackType: 'melee',
    soldiers: 500, maxSoldiers: 500, charHp: 999, charMaxHp: 999,
    charAttack: 1, charDefense: 99, attackCount: 1,
    soldierAtk: 1, soldierDef: 50, strategyRate: 10,
  },
  tanky_enemy: {
    id: 'tc_tanky_enemy', name: '超タンク敵', attackType: 'melee',
    soldiers: 500, maxSoldiers: 500, charHp: 999, charMaxHp: 999,
    charAttack: 1, charDefense: 99, attackCount: 1,
    soldierAtk: 1, soldierDef: 50, strategyRate: 10,
  },
  strat_high: {
    id: 'tc_strat_high', name: '高策略', attackType: 'melee',
    soldiers: 200, maxSoldiers: 200, charHp: 100, charMaxHp: 100,
    charAttack: 20, charDefense: 10, attackCount: 8,
    soldierAtk: 10, soldierDef: 8, strategyRate: 90,
  },
  strat_low: {
    id: 'tc_strat_low', name: '低策略敵', attackType: 'melee',
    soldiers: 200, maxSoldiers: 200, charHp: 100, charMaxHp: 100,
    charAttack: 20, charDefense: 10, attackCount: 8,
    soldierAtk: 10, soldierDef: 8, strategyRate: 0,
  },
};

// ────────────────────────────────────────────────
// ヘルパー
// ────────────────────────────────────────────────

/** ディープクローン＋上書き。IDを付与してキャラを再利用可能にする。 */
function cloneChar(base, idSuffix, overrides = {}) {
  return { ...base, ...overrides, id: `${base.id}__${idSuffix}` };
}

/** 指定 position でユニットを生成する。BuildUnit は index で position を決めるので上書きする。 */
function buildAt(char, sideType, position) {
  const unit = BattleEngineV3.buildUnit(char, sideType, position === 'rear' ? 2 : 0);
  unit.position = position;
  return unit;
}

/** 前衛・後衛・attackType に基づいてアクション選択肢を算出する。 */
function computeOptions(unit, engine) {
  const isRearMelee = unit.position === 'rear' &&
    unit.char.attackType !== 'ranged' &&
    unit.char.attackType !== 'song';

  if (isRearMelee) {
    const opts = ['defend'];
    if (engine.allowRetreat) opts.push('retreat');
    return opts;
  }

  const atkOpt = unit.char.attackType === 'ranged' ? 'ranged'
               : unit.char.attackType === 'song'   ? 'song'
               : 'attack';
  const opts = [atkOpt, 'defend'];
  if (engine.allowRetreat) opts.push('retreat');
  return opts;
}

/** 近接は前衛限定 pool、遠距離・歌は全体 pool を返す。 */
function computeTargetPool(unit, opponents, engine) {
  const alive = opponents.filter(d => engine._isAlive(d));
  const isRangedOrSong = unit.char.attackType === 'ranged' || unit.char.attackType === 'song';
  if (isRangedOrSong) return alive;
  const frontAlive = alive.filter(d => d.position === 'front');
  return frontAlive.length > 0 ? frontAlive : alive;
}

/** 戦闘終了後に unit の状態を char へ書き戻す。 */
function writeBackUnits(engine) {
  const results = [];
  [...engine.playerSide, ...engine.enemySide].forEach(u => {
    const prevSol   = u.char.soldiers;
    const prevHp    = u.char.charHp;
    const prevPen   = u.char.penaltyTurns;
    u.char.soldiers = u.soldiers;
    u.char.charHp   = u.charHp;
    results.push({
      name:    u.char.name,
      id:      u.char.id,
      soldiers:    { before: prevSol,  after: u.char.soldiers },
      charHp:      { before: prevHp,   after: u.char.charHp },
      penaltyTurns:{ before: prevPen ?? 0, after: u.char.penaltyTurns ?? 0 },
    });
  });
  return results;
}

// ────────────────────────────────────────────────
// シナリオ定義
// ────────────────────────────────────────────────
const SCENARIOS = [
  {
    id: 'QA-E01',
    label: 'E01 近接2v2 normal',
    expected: '両前衛が殴り合い5R以内に決着。前衛同士の攻撃・反撃ログが出ること。',
    battleMode: 'normal',
    battleCapacity: 300,
    build() {
      const a1 = cloneChar(TEST_CHARS.front_melee, 'a1');
      const a2 = cloneChar(TEST_CHARS.front_melee, 'a2', { name: '前衛近接B' });
      const d1 = cloneChar(TEST_CHARS.enemy_front, 'd1');
      const d2 = cloneChar(TEST_CHARS.enemy_front, 'd2', { name: '敵前衛B' });
      return {
        playerUnits: [buildAt(a1, 'attack', 'front'), buildAt(a2, 'attack', 'front')],
        enemyUnits:  [buildAt(d1, 'defense', 'front'), buildAt(d2, 'defense', 'front')],
      };
    },
  },
  {
    id: 'QA-E02',
    label: 'E02 ranged後衛攻撃確認',
    expected: '後衛射撃が前衛敵を攻撃できること（poolに敵が含まれる）。反撃なし（ranged）。',
    battleMode: 'normal',
    battleCapacity: 300,
    build() {
      const a = cloneChar(TEST_CHARS.rear_ranged, 'a');
      const d = cloneChar(TEST_CHARS.enemy_front, 'd');
      return {
        playerUnits: [buildAt(a, 'attack', 'rear')],
        enemyUnits:  [buildAt(d, 'defense', 'front')],
      };
    },
  },
  {
    id: 'QA-E03',
    label: 'E03 song後衛攻撃確認',
    expected: '後衛歌唱が前衛・後衛両方を攻撃pool対象にできること。反撃なし（song）。',
    battleMode: 'normal',
    battleCapacity: 300,
    build() {
      const a  = cloneChar(TEST_CHARS.rear_song, 'a');
      const d1 = cloneChar(TEST_CHARS.enemy_front, 'd1');
      const d2 = cloneChar(TEST_CHARS.enemy_rear, 'd2');
      return {
        playerUnits: [buildAt(a, 'attack', 'rear')],
        enemyUnits:  [buildAt(d1, 'defense', 'front'), buildAt(d2, 'defense', 'rear')],
      };
    },
  },
  {
    id: 'QA-E04',
    label: 'E04 後衛近接はdeny',
    expected: 'ログ内「[OPTIONS]」行で後衛近接の選択肢が [defend, retreat] のみであること。attack は含まれない。',
    battleMode: 'normal',
    battleCapacity: 300,
    build() {
      const a  = cloneChar(TEST_CHARS.rear_melee, 'a');
      const af = cloneChar(TEST_CHARS.front_melee, 'af');
      const d  = cloneChar(TEST_CHARS.enemy_front, 'd');
      return {
        playerUnits: [buildAt(af, 'attack', 'front'), buildAt(a, 'attack', 'rear')],
        enemyUnits:  [buildAt(d, 'defense', 'front')],
      };
    },
  },
  {
    id: 'QA-E05',
    label: 'E05 前衛限定ターゲット',
    expected: '前衛敵が生存中は近接攻撃のpool=[front敵]のみ。ログ「[POOL]」で確認。',
    battleMode: 'normal',
    battleCapacity: 300,
    build() {
      const a  = cloneChar(TEST_CHARS.front_melee, 'a');
      const d1 = cloneChar(TEST_CHARS.enemy_front, 'd1');
      const d2 = cloneChar(TEST_CHARS.enemy_rear, 'd2');
      return {
        playerUnits: [buildAt(a, 'attack', 'front')],
        enemyUnits:  [buildAt(d1, 'defense', 'front'), buildAt(d2, 'defense', 'rear')],
      };
    },
  },
  {
    id: 'QA-E06',
    label: 'E06 前衛全滅後後衛target',
    expected: '前衛敵を事前撃破済み → 後衛敵がpoolに入ること。ログ「[POOL]」でrear敵が対象になる。',
    battleMode: 'normal',
    battleCapacity: 300,
    build() {
      const a  = cloneChar(TEST_CHARS.front_melee, 'a');
      const d1 = cloneChar(TEST_CHARS.enemy_front, 'd1_dead', { charHp: 0 });
      const d2 = cloneChar(TEST_CHARS.enemy_rear, 'd2');
      const pu = [buildAt(a, 'attack', 'front')];
      const eu = [buildAt(d1, 'defense', 'front'), buildAt(d2, 'defense', 'rear')];
      eu[0].charHp = 0; // 前衛を事前撃破済みに設定
      return { playerUnits: pu, enemyUnits: eu };
    },
  },
  {
    id: 'QA-E07',
    label: 'E07 5R制限 normal',
    expected: '5ラウンド後に「防衛側勝利」で終了すること（超タンク双方で決着しない設定）。',
    battleMode: 'normal',
    battleCapacity: 300,
    build() {
      const a = cloneChar(TEST_CHARS.tanky, 'a');
      const d = cloneChar(TEST_CHARS.tanky_enemy, 'd');
      return {
        playerUnits: [buildAt(a, 'attack', 'front')],
        enemyUnits:  [buildAt(d, 'defense', 'front')],
      };
    },
  },
  {
    id: 'QA-E08',
    label: 'E08 dungeon無制限',
    expected: '5R超えても終了しないこと。maxRounds=∞ かつ gameOver=false が続く。',
    battleMode: 'dungeon',
    battleCapacity: 300,
    build() {
      const a = cloneChar(TEST_CHARS.tanky, 'a');
      const d = cloneChar(TEST_CHARS.tanky_enemy, 'd');
      return {
        playerUnits: [buildAt(a, 'attack', 'front')],
        enemyUnits:  [buildAt(d, 'defense', 'front')],
      };
    },
  },
  {
    id: 'QA-E09',
    label: 'E09 soldiers最小順行動',
    expected: 'ログ「[ORDER]」でSP最小ユニットが先頭に来ること。小隊(SP=10)→大隊(SP=300)の順。',
    battleMode: 'normal',
    battleCapacity: 300,
    build() {
      const a1 = cloneChar(TEST_CHARS.front_melee, 'a1_small', { name: '小隊(SP=10)', soldiers: 10, maxSoldiers: 10 });
      const a2 = cloneChar(TEST_CHARS.front_melee, 'a2_large', { name: '大隊(SP=300)', soldiers: 300, maxSoldiers: 300 });
      const d  = cloneChar(TEST_CHARS.enemy_front, 'd');
      return {
        playerUnits: [buildAt(a1, 'attack', 'front'), buildAt(a2, 'attack', 'front')],
        enemyUnits:  [buildAt(d, 'defense', 'front')],
      };
    },
  },
  {
    id: 'QA-E10',
    label: 'E10 penaltyTurns書き戻し',
    expected: '「書き戻し実行」後、charHp=0のキャラに penaltyTurns=2 が設定されていること。',
    battleMode: 'normal',
    battleCapacity: 300,
    build() {
      const a = cloneChar(TEST_CHARS.front_melee, 'a');
      const d = cloneChar(TEST_CHARS.enemy_front, 'd', { soldierAtk: 50, charAttack: 99 });
      return {
        playerUnits: [buildAt(a, 'attack', 'front')],
        enemyUnits:  [buildAt(d, 'defense', 'front')],
      };
    },
  },
  {
    id: 'QA-E11',
    label: 'E11 char書き戻し',
    expected: '「書き戻し実行」後、char.soldiers / char.charHp が戦闘結果と一致すること。',
    battleMode: 'normal',
    battleCapacity: 300,
    build() {
      const a = cloneChar(TEST_CHARS.front_melee, 'a');
      const d = cloneChar(TEST_CHARS.enemy_front, 'd');
      return {
        playerUnits: [buildAt(a, 'attack', 'front')],
        enemyUnits:  [buildAt(d, 'defense', 'front')],
      };
    },
  },
  {
    id: 'QA-E12',
    label: 'E12 作戦補正',
    expected: 'strategyRate差=90 → 初期化ログに「作戦成功（player）」が出てSPダメ補正が乗ること。',
    battleMode: 'normal',
    battleCapacity: 300,
    build() {
      const a = cloneChar(TEST_CHARS.strat_high, 'a');
      const d = cloneChar(TEST_CHARS.strat_low, 'd');
      return {
        playerUnits: [buildAt(a, 'attack', 'front')],
        enemyUnits:  [buildAt(d, 'defense', 'front')],
      };
    },
  },
  {
    id: 'QA-E13',
    label: 'E13 duel 5R超え継続',
    expected: 'battleMode:duel でタンク同士が5ラウンド超えても戦闘継続すること（maxRounds=Infinity）。',
    battleMode: 'duel',
    battleCapacity: 300,
    build() {
      const a = cloneChar(TEST_CHARS.tanky, 'a');
      const d = cloneChar(TEST_CHARS.tanky_enemy, 'd');
      return {
        playerUnits: [buildAt(a, 'attack', 'front')],
        enemyUnits:  [buildAt(d, 'defense', 'front')],
      };
    },
  },
  {
    id: 'QA-E14',
    label: 'E14 duel 撤退deny',
    expected: 'battleMode:duel で allowRetreat=false → 撤退実行時に「撤退できない」ログが出ること。',
    battleMode: 'duel',
    battleCapacity: 300,
    build() {
      const a = cloneChar(TEST_CHARS.front_melee, 'a');
      const d = cloneChar(TEST_CHARS.enemy_front, 'd');
      return {
        playerUnits: [buildAt(a, 'attack', 'front')],
        enemyUnits:  [buildAt(d, 'defense', 'front')],
      };
    },
  },
  {
    id: 'QA-E15',
    label: 'E15 winnerChar',
    expected: 'strategyRate差=90 → strategyMult.winnerChar に高strategyRateキャラが入ること（console.log確認）。',
    battleMode: 'normal',
    battleCapacity: 300,
    build() {
      const a = cloneChar(TEST_CHARS.strat_high, 'a');
      const d = cloneChar(TEST_CHARS.strat_low, 'd');
      return {
        playerUnits: [buildAt(a, 'attack', 'front')],
        enemyUnits:  [buildAt(d, 'defense', 'front')],
      };
    },
  },
  {
    id: 'QA-E16',
    label: 'E16 async executeAction',
    expected: 'executeAction() が async でも既存ループが正常動作すること（結果: 攻撃側または防衛側勝利）。',
    battleMode: 'normal',
    battleCapacity: 300,
    build() {
      const a = cloneChar(TEST_CHARS.front_melee, 'a');
      const d = cloneChar(TEST_CHARS.enemy_front, 'd');
      return {
        playerUnits: [buildAt(a, 'attack', 'front')],
        enemyUnits:  [buildAt(d, 'defense', 'front')],
      };
    },
  },
];

// ────────────────────────────────────────────────
// スタイル（モノクロ QA 専用）
// ────────────────────────────────────────────────
const S = {
  root:    { fontFamily: 'monospace', fontSize: 13, background: '#0b0b0b', color: '#c0c0c0', minHeight: '100vh', padding: 16 },
  h1:      { color: '#e0e0e0', fontSize: 18, fontWeight: 'bold', marginBottom: 4, letterSpacing: 2 },
  badge:   { display: 'inline-block', background: '#1e1e1e', border: '1px solid #333', borderRadius: 3, padding: '2px 8px', fontSize: 11, color: '#888', marginBottom: 12 },
  scRow:   { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  ctrlRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' },
  unitRow: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 },
  card:    { background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, padding: 12, minWidth: 200 },
  cardHL:  { background: '#111', border: '1px solid #555', borderRadius: 6, padding: 12, minWidth: 200 },
  btn:     { padding: '5px 12px', borderRadius: 3, cursor: 'pointer', border: '1px solid #333', background: '#1a1a1a', color: '#b0b0b0', fontSize: 12 },
  btnAct:  { padding: '5px 12px', borderRadius: 3, cursor: 'pointer', border: '1px solid #888', background: '#2a2a2a', color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  btnSel:  { padding: '5px 10px', borderRadius: 3, cursor: 'pointer', border: '1px solid #777', background: '#2e2e2e', color: '#fff', fontSize: 11, fontWeight: 'bold' },
  btnUnsel:{ padding: '5px 10px', borderRadius: 3, cursor: 'pointer', border: '1px solid #2a2a2a', background: '#141414', color: '#666', fontSize: 11 },
  log:     { background: '#080808', border: '1px solid #1e1e1e', borderRadius: 4, padding: 10, height: 380, overflowY: 'auto', fontSize: 11, lineHeight: 1.8 },
  unit:    { background: '#0d0d0d', border: '1px solid #252525', borderRadius: 4, padding: '5px 8px', marginBottom: 5 },
  expect:  { background: '#0f0f0f', border: '1px solid #333', borderRadius: 4, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#999' },
  wbRow:   { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 },
  wbItem:  { background: '#0c0c0c', border: '1px solid #2a2a2a', borderRadius: 4, padding: '6px 10px', fontSize: 11, minWidth: 180 },
  result:  { border: '1px solid #666', borderRadius: 4, padding: '8px 14px', marginBottom: 10, fontSize: 15, fontWeight: 'bold', color: '#e0e0e0' },
};

function logColor(l) {
  if (l.startsWith('━━'))                     return '#303030';
  if (l.startsWith('[ORDER]'))                return '#aaaaff';
  if (l.startsWith('[OPTIONS]'))              return '#ffddaa';
  if (l.startsWith('[POOL]'))                 return '#aaffdd';
  if (l.startsWith('[WARN]'))                 return '#ff8888';
  if (l.includes('勝利') || l.includes('成功')) return '#aaffaa';
  if (l.includes('防衛側勝利'))               return '#ff9966';
  if (l.includes('戦闘不能'))                 return '#ff5555';
  if (l.includes('HP-') || l.includes('HP:')) return '#ccaa55';
  if (l.startsWith('  '))                     return '#666';
  return '#909090';
}

// ────────────────────────────────────────────────
// UnitCard
// ────────────────────────────────────────────────
function UnitCard({ unit, engine }) {
  const dead = engine.isDead(unit);
  return (
    <div style={{ ...S.unit, opacity: dead ? 0.35 : 1 }}>
      <div>
        <span style={{ color: dead ? '#ff5555' : '#e0e0e0', fontWeight: 'bold' }}>
          {unit.char.name}
        </span>
        {dead && <span style={{ color: '#ff5555' }}> [戦闘不能]</span>}
        {unit.retreated && <span style={{ color: '#ffaa55' }}> [撤退]</span>}
      </div>
      <div style={{ fontSize: 10, color: '#555', marginTop: 1 }}>
        [{unit.position}] {unit.char.attackType}
      </div>
      <div style={{ fontSize: 11, marginTop: 3, display: 'flex', gap: 10 }}>
        <span><span style={{ color: '#555' }}>HP </span><span style={{ color: '#ccaa55' }}>{unit.charHp}/{unit.charMaxHp}</span></span>
        <span><span style={{ color: '#555' }}>SP </span><span style={{ color: '#6699cc' }}>{unit.soldiers}/{unit.maxSoldiers}</span></span>
      </div>
      {unit.char.penaltyTurns > 0 && (
        <div style={{ fontSize: 10, color: '#ff5555', marginTop: 2 }}>
          penaltyTurns: {unit.char.penaltyTurns}
        </div>
      )}
      {unit.char.strategyRate !== undefined && (
        <div style={{ fontSize: 10, color: '#666', marginTop: 1 }}>
          策略: {unit.char.strategyRate}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// WriteBackPanel
// ────────────────────────────────────────────────
function WriteBackPanel({ wbResult }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ color: '#aaa', fontSize: 12, marginBottom: 6 }}>書き戻し結果（char へ反映）</div>
      <div style={S.wbRow}>
        {wbResult.map(r => (
          <div key={r.id} style={S.wbItem}>
            <div style={{ color: '#ccc', fontWeight: 'bold', marginBottom: 4 }}>{r.name}</div>
            <div><span style={{ color: '#555' }}>soldiers: </span>
              <span style={{ color: '#888' }}>{r.soldiers.before}</span>
              <span style={{ color: '#555' }}> → </span>
              <span style={{ color: r.soldiers.after !== r.soldiers.before ? '#aaffaa' : '#888' }}>{r.soldiers.after}</span>
            </div>
            <div><span style={{ color: '#555' }}>charHp: </span>
              <span style={{ color: '#888' }}>{r.charHp.before}</span>
              <span style={{ color: '#555' }}> → </span>
              <span style={{ color: r.charHp.after !== r.charHp.before ? '#ccaa55' : '#888' }}>{r.charHp.after}</span>
            </div>
            <div>
              <span style={{ color: '#555' }}>penaltyTurns: </span>
              <span style={{ color: '#888' }}>{r.penaltyTurns.before}</span>
              <span style={{ color: '#555' }}> → </span>
              <span style={{ color: r.penaltyTurns.after > 0 ? '#ff5555' : '#888' }}>{r.penaltyTurns.after}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────
export default function BattleFullQAScene({ onBack }) {
  const [selId, setSelId]       = useState(SCENARIOS[0].id);
  const [log, setLog]           = useState([]);
  const [engine, setEngine]     = useState(null);
  const [result, setResult]     = useState(null);
  const [wbResult, setWbResult] = useState(null);
  const [, forceUpdate]         = useState(0);
  const logRef = useRef([]);

  const scenario = SCENARIOS.find(s => s.id === selId);

  const pushLog = useCallback((msg) => {
    logRef.current.push(msg);
    setLog([...logRef.current]);
  }, []);

  // ── 開始 ──
  const start = useCallback(() => {
    logRef.current = [];
    setLog([]);
    setResult(null);
    setWbResult(null);

    const { playerUnits, enemyUnits } = scenario.build();

    const eng = new BattleEngineV3({
      playerSide:    playerUnits,
      enemySide:     enemyUnits,
      mode:          'attack',
      battleCapacity: scenario.battleCapacity,
      battleMode:    scenario.battleMode,
      onLog:         (msg) => { logRef.current.push(msg); setLog([...logRef.current]); },
      onCardUpdate:  () => {},
      onShake:       () => {},
      onPopup:       () => {},
      delayedCall:   (_ms, fn) => fn(), // QA: 即時実行
    });

    eng._onBattleEnd = (atkWins) => {
      eng.gameOver = true;
      const r = atkWins ? '✔ 攻撃側勝利' : '■ 防衛側勝利';
      setResult(r);
      logRef.current.push(`━━ 戦闘終了: ${r} ━━`);
      setLog([...logRef.current]);
      forceUpdate(n => n + 1);
    };

    setEngine(eng);
    pushLog(`[${scenario.id}] エンジン初期化完了 / mode=${scenario.battleMode} cap=${scenario.battleCapacity}`);
    pushLog(`攻撃側: ${playerUnits.map(u => `${u.char.name}(${u.position})`).join(', ')}`);
    pushLog(`防衛側: ${enemyUnits.map(u => `${u.char.name}(${u.position})`).join(', ')}`);
    pushLog(`allowRetreat=${eng.allowRetreat} maxRounds=${eng.maxRounds === Infinity ? '∞' : eng.maxRounds}`);
    const wc = eng.strategyMult.winnerChar;
    if (wc) { pushLog(`[E15] winnerChar: ${wc.name} (strategyRate=${wc.strategyRate})`); console.log('[E15] winnerChar', wc); }
    else pushLog(`winnerChar: null（互角）`);

    // E14: duel 撤退deny の即時検証
    if (scenario.id === 'QA-E14') {
      const firstUnit = eng.playerSide[0];
      firstUnit.action = 'retreat';
      eng.executeAction(firstUnit, true);
      firstUnit.action = null;
      pushLog('[E14] 撤退deny検証: 上記ログに「撤退できない」が出ていればPASS');
    }
    forceUpdate(n => n + 1);
  }, [scenario, pushLog]);

  // ── 1ラウンド実行 ──
  const runRound = useCallback(() => {
    if (!engine || engine.gameOver) return;

    engine.startRound();

    // 行動順: SP昇順
    const allActors = [
      ...engine.playerSide.map(u => ({ u, isPlayer: true })),
      ...engine.enemySide .map(u => ({ u, isPlayer: false })),
    ].filter(({ u }) => !engine.isDead(u) && !u.retreated);

    allActors.sort((a, b) => a.u.soldiers - b.u.soldiers);

    // 行動順ログ（QA-E09確認用）
    const orderStr = allActors.map(({ u }) => `${u.char.name}(SP=${u.soldiers})`).join(' → ');
    pushLog(`[ORDER] ${orderStr}`);

    allActors.forEach(({ u, isPlayer }) => {
      const opponents = isPlayer ? engine.enemySide : engine.playerSide;

      // 行動選択肢決定（QA-E04確認用）
      const options = computeOptions(u, engine);
      pushLog(`[OPTIONS] ${u.char.name}[${u.position}/${u.char.attackType}]: [${options.join(', ')}]`);

      BattleAI.selectAction(u, options);

      // ターゲット pool 決定（QA-E05/E06確認用）
      if (u.action === 'attack' || u.action === 'ranged' || u.action === 'song') {
        const pool = computeTargetPool(u, opponents, engine);
        if (pool.length === 0) {
          pushLog(`[WARN] ${u.char.name}: 攻撃pool空 → defendに変更`);
          u.action = 'defend';
        } else {
          const poolStr = pool.map(t => `${t.char.name}(${t.position})`).join(', ');
          pushLog(`[POOL] ${u.char.name}: [${poolStr}]`);
          u.targetId = pool[Math.floor(Math.random() * pool.length)].char.id;
          // action を engine が解釈できる 'attack' に正規化
          if (u.action === 'ranged' || u.action === 'song') u.action = 'attack';
        }
      }

      engine.executeAction(u, isPlayer);
      engine.markActed(u);
    });

    // ゲームオーバー即時判定（delayedCall は init 時に同期化済み）
    if (!engine.checkGameOver()) {
      engine.checkRoundLimit();
    }
    forceUpdate(n => n + 1);
  }, [engine, pushLog]);

  // ── 全自動 ──
  const runAll = useCallback(() => {
    if (!engine || engine.gameOver) return;
    let safety = 0;
    const step = () => {
      if (engine.gameOver || safety++ > 30) return;
      runRound();
      if (!engine.gameOver) setTimeout(step, 80);
    };
    step();
  }, [engine, runRound]);

  // ── 書き戻し実行 ──
  const doWriteBack = useCallback(() => {
    if (!engine) return;
    const res = writeBackUnits(engine);
    setWbResult(res);
    pushLog('━━ char へ書き戻し実行 ━━');
    res.forEach(r => {
      pushLog(`  ${r.name}: soldiers ${r.soldiers.before}→${r.soldiers.after} / charHp ${r.charHp.before}→${r.charHp.after} / penaltyTurns ${r.penaltyTurns.before}→${r.penaltyTurns.after}`);
    });
  }, [engine, pushLog]);

  // ── シナリオ切り替え ──
  const selectScenario = (id) => {
    setSelId(id);
    setEngine(null);
    setResult(null);
    setWbResult(null);
    logRef.current = [];
    setLog([]);
  };

  const stratInfo = engine?.strategyMult?.side
    ? `${engine.strategyMult.side} +${(engine.strategyMult.bonus * 100) | 0}%`
    : '互角';

  return (
    <div style={S.root}>
      <div style={S.h1}>BATTLE FULL QA</div>
      <div style={S.badge}>BattleEngineV3 直接呼び出し / 12シナリオ</div>

      {/* シナリオ選択 */}
      <div style={S.scRow}>
        {SCENARIOS.map(s => (
          <button
            key={s.id}
            style={selId === s.id ? S.btnSel : S.btnUnsel}
            onClick={() => selectScenario(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 期待値表示 */}
      {scenario && (
        <div style={S.expect}>
          <span style={{ color: '#555' }}>期待値 / </span>{scenario.expected}
        </div>
      )}

      {/* コントロール */}
      <div style={S.ctrlRow}>
        <button style={S.btnAct} onClick={start}>▶ 開始</button>
        <button
          style={engine && !engine.gameOver ? S.btnAct : S.btn}
          onClick={runRound}
          disabled={!engine || engine.gameOver}
        >
          ⏭ 1R進める {engine ? `(R${engine.round})` : ''}
        </button>
        <button style={S.btn} onClick={runAll} disabled={!engine || engine.gameOver}>
          ⏩ 全自動
        </button>
        <button
          style={engine ? S.btn : { ...S.btn, opacity: 0.4 }}
          onClick={doWriteBack}
          disabled={!engine}
        >
          💾 書き戻し確認
        </button>
        {onBack && <button style={S.btn} onClick={onBack}>← 戻る</button>}
      </div>

      {/* 戦闘結果バナー */}
      {result && (
        <div style={S.result}>{result}</div>
      )}

      {/* ユニットカード + エンジン状態 */}
      {engine && (
        <div style={S.unitRow}>
          <div style={S.card}>
            <div style={{ color: '#ccc', marginBottom: 6, fontWeight: 'bold', fontSize: 11 }}>ATTACKER</div>
            {engine.playerSide.map(u => <UnitCard key={u.char.id} unit={u} engine={engine} />)}
          </div>
          <div style={S.card}>
            <div style={{ color: '#aaa', marginBottom: 6, fontWeight: 'bold', fontSize: 11 }}>DEFENDER</div>
            {engine.enemySide.map(u => <UnitCard key={u.char.id} unit={u} engine={engine} />)}
          </div>
          <div style={{ ...S.card, minWidth: 180 }}>
            <div style={{ color: '#888', marginBottom: 6, fontSize: 11 }}>ENGINE STATE</div>
            <div style={{ fontSize: 11, lineHeight: 2 }}>
              <div>
                <span style={{ color: '#555' }}>Round </span>
                <span style={{ color: '#e0e0e0', fontWeight: 'bold' }}>{engine.round}</span>
                <span style={{ color: '#555' }}> / </span>
                <span style={{ color: '#999' }}>{engine.maxRounds === Infinity ? '∞' : engine.maxRounds}</span>
              </div>
              <div>
                <span style={{ color: '#555' }}>mode </span>
                <span style={{ color: '#bbb' }}>{engine.battleMode}</span>
              </div>
              <div>
                <span style={{ color: '#555' }}>gameOver </span>
                <span style={{ color: engine.gameOver ? '#ff5555' : '#55cc88' }}>{String(engine.gameOver)}</span>
              </div>
              <div>
                <span style={{ color: '#555' }}>retreat </span>
                <span style={{ color: '#bbb' }}>{String(engine.allowRetreat)}</span>
              </div>
              <div>
                <span style={{ color: '#555' }}>strategy </span>
                <span style={{ color: engine.strategyMult?.side ? '#aaffaa' : '#555' }}>{stratInfo}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 書き戻し結果パネル */}
      {wbResult && (
        <div style={{ ...S.card, marginBottom: 12 }}>
          <WriteBackPanel wbResult={wbResult} />
        </div>
      )}

      {/* ログ */}
      <div style={S.log}>
        {log.length === 0 && (
          <div style={{ color: '#333' }}>「開始」を押してエンジンを初期化してください。</div>
        )}
        {log.map((l, i) => (
          <div key={i} style={{ color: logColor(l) }}>{l}</div>
        ))}
      </div>
    </div>
  );
}
