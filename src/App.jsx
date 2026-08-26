import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import './App.css';
import { useGame } from './context/GameContext.jsx';
import secretaryLinesData from './game/data/secretary_lines.json';
import dungeonsData       from './game/data/dungeons.json';
import { allPairs }       from './game/utils/Affinity.js';
import {
  requiredMeme, COMMON_REWARD, GOAL_REWARD, STRETCH_REWARD,
  BOSS_FREQUENCY, BOSS_MULT, SHALLOW_MEME_REWARD, SHALLOW_ENEMY_COUNT_RANGE,
  requiredProgress, drawTieredEnemyDefs,
} from './game/data/crowdfundingConfig.js';

import TitleScene           from './scenes/TitleScene.jsx';
import MapScene             from './scenes/MapScene.jsx';
import BaseMenuScene        from './scenes/BaseMenuScene.jsx';
import AttackFormationScene from './scenes/FormationScene.jsx';
import BattleScene          from './scenes/BattleScene.jsx';
import EnemyTurnScene       from './scenes/EnemyTurnScene.jsx';
import PartyScene           from './scenes/PartyScene.jsx';
import ItemsScene           from './scenes/ItemsScene.jsx';
import ResearchScene        from './scenes/ResearchScene.jsx';
import TheaterScene         from './scenes/TheaterScene.jsx';
import SaveScene            from './scenes/SaveScene.jsx';
import PartnerWidget        from './shared/PartnerWidget.jsx';
import GameEndScene         from './scenes/GameEndScene.jsx';
import DungeonScene         from './scenes/DungeonScene.jsx';
import NewGamePlusScene     from './scenes/NewGamePlusScene.jsx';
import ADVScene             from './scenes/ADVScene.jsx';
import BattleQAScene        from './scenes/BattleQAScene.jsx';
import BattleFullQAScene    from './scenes/BattleFullQAScene.jsx';
import WorldMapQAScene      from './scenes/WorldMapQAScene.jsx';
import PromotionDevScene    from './scenes/PromotionDevScene.jsx';
import QAPortraitScene      from './scenes/QAPortraitScene.jsx';
import QAAdvScene           from './scenes/QAAdvScene.jsx';

// ダンジョン（クラファン挑戦・浅層探索）の初期残ラウンド。DESIGN_CROWDFUNDING.md §2-7
const DUNGEON_ROUND_LIMIT = { crowdfunding: 40, shallow: 20 };
// 「休む」で消費する残ラウンド数。DESIGN_CROWDFUNDING.md §2-7
const DUNGEON_REST_COST = 5;

// ダンジョン（クラファン・浅層探索）の敵プール定義を戦闘用ユニットへ変換。複数体対応（C-3）。
function buildDungeonEnemies(enemyDefs) {
  return enemyDefs.map((enemy, i) => ({
    id:           `dungeon_enemy_${Date.now()}_${i}`,
    name:         enemy.name,
    factionId:    '__dungeon__',
    isLeader:     true,
    role:         'attacker',
    attackType:   'melee',
    charHp:       enemy.charHp,
    charMaxHp:    enemy.charHp,
    charAttack:   enemy.charAttack,
    charSong:     0,
    charDefense:  0,
    soldiers:     enemy.soldiers,
    maxSoldiers:  enemy.soldiers,
    soldierAtk:   enemy.soldierAtk,
    soldierDef:   enemy.soldierDef,
    penaltyTurns: 0,
    usedThisTurn: false,
    skillId:      null,
    tier:          enemy.tier ?? 1,
    progressPoint: enemy.progressPoint ?? 0,
    battleBonus: {
      attack:  { soldierAtk:0, soldierDef:0, charAttack:0, charSong:0 },
      defense: { soldierAtk:0, soldierDef:0, charAttack:0, charSong:0 },
      dungeon: { soldierAtk:0, soldierDef:0, charAttack:0, charSong:0 },
    },
  }));
}

// プールから count 体をランダム抽選（重複あり）
function drawEnemyDefs(pool, count) {
  const picks = [];
  for (let i = 0; i < count; i++) {
    picks.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return picks;
}

// ボス戦演出: 選出数はそのまま、ステータス・進捗ポイントに倍率をかける（DESIGN_CROWDFUNDING.md §1-2・§2-3b）
function scaleEnemyDef(enemy, mult) {
  return {
    ...enemy,
    charHp:        Math.round(enemy.charHp        * mult),
    charAttack:    Math.round(enemy.charAttack    * mult),
    soldiers:      Math.round(enemy.soldiers      * mult),
    soldierAtk:    Math.round(enemy.soldierAtk    * mult),
    soldierDef:    Math.round(enemy.soldierDef    * mult),
    progressPoint: Math.round((enemy.progressPoint ?? 0) * mult),
  };
}

// 浅層探索: 対称化しない・ランダムな人数を抽選（[lo, hi]）
function drawShallowEnemyDefs(pool, [lo, hi]) {
  const count = lo + Math.floor(Math.random() * (hi - lo + 1));
  return drawEnemyDefs(pool, count);
}

export default function App() {
  const game = useGame();
  const [scene, setScene]             = useState('title');
  const [sceneParams, setSceneParams] = useState({});
  // defenseFlow: null | { queue, index, phase: 'defense_prompt'|'formation'|'battle', formation? }
  const [defenseFlow, setDefenseFlow] = useState(null);
  // dungeonSession: null | { dungeonKind, charIds, waveIndex, remainingRounds,
  //   goalId, requiredMemeByChar, goalAchieved }（DESIGN_CROWDFUNDING.md）
  const [dungeonSession, setDungeonSession] = useState(null);
  const [focusKey, setFocusKey]       = useState(0);
  const dialogSeqRef = useRef(0);

  const navigate = useCallback((dest, params = {}) => {
    setSceneParams(params);
    setScene(dest);
  }, []);

  useEffect(() => {
    // 新契約: script + effects を ADV に渡す。effects 適用は ADV 内部。
    // 戻り先（map）と直列化（onComplete=次イベント起動）は onExit に閉じる。
    game.setStartDialogHandler((script, effects, onComplete) => {
      navigate('adv', {
        script,
        effects,
        dialogId: ++dialogSeqRef.current,
        onExit: () => { navigate('map'); onComplete?.(); },
      });
    });
  }, []);

  const {
    currentTurn, playerFaction, playerBases, income,
    bases, factions, characters, availableChars,
    gamePhase, systems, legionAI,
    actionPoints, maxActionPoints, affinity,
  } = game;

  // defenseFlow の最新値を非同期コールバックから参照するための ref
  const defenseFlowRef        = useRef(null);
  const defenseFlowResolveRef = useRef(null);

  useEffect(() => { defenseFlowRef.current = defenseFlow; }, [defenseFlow]);

  const gameState = {
    turn:   currentTurn,
    meme:   playerFaction?.treasury ?? 0,
    income,
    bases:  `${playerBases.length}/${bases.length}`,
    actionPoints,
    maxActionPoints,
  };

  // ── ゲームフェーズ変化 → game_end遷移 ──
  useEffect(() => {
    if (gamePhase === 'victory') {
      navigate('game_end', {
        isVictory:       true,
        clearedCount:    0,
        currentTurn,
        playerBaseCount: playerBases.length,
        totalBaseCount:  bases.length,
      });
    } else if (gamePhase === 'defeat') {
      navigate('game_end', {
        isVictory:       false,
        clearedCount:    0,
        currentTurn,
        playerBaseCount: playerBases.length,
        totalBaseCount:  bases.length,
      });
    }
  }, [gamePhase, navigate]);

  // ── 防衛フロー state machine ──────────────────────────────────────────────

  // キューの1アイテム処理完了後に呼ぶ。次アイテムへ進むか、キューを終了する
  const advanceDefenseQueue = useCallback((resultPhase) => {
    const df = defenseFlowRef.current;
    if (!df) return;

    if (resultPhase === 'defeat' || resultPhase === 'victory') {
      // gamePhase useEffect が game_end 遷移を担保するため、ここでは resolve だけ
      defenseFlowResolveRef.current?.('ended');
      defenseFlowResolveRef.current = null;
      setDefenseFlow(null);
      return;
    }

    const nextIndex = df.index + 1;
    if (nextIndex >= df.queue.length) {
      defenseFlowResolveRef.current?.('ok');
      defenseFlowResolveRef.current = null;
      setDefenseFlow(null);
      return;
    }

    const nextItem = df.queue[nextIndex];
    navigate('map', { focusBaseId: nextItem?.defenderBase?.id });
    setFocusKey(k => k + 1);
    setDefenseFlow({ queue: df.queue, index: nextIndex, phase: 'defense_prompt' });
  }, [navigate]);

  // defensePromptData 計算
  const currentDefenseItem = defenseFlow?.phase === 'defense_prompt'
    ? defenseFlow.queue[defenseFlow.index]
    : null;

  const defensePromptData = useMemo(() => {
    if (!currentDefenseItem) return null;
    const attackerChars = (currentDefenseItem.attackerCharIds ?? [])
      .map(id => characters.find(c => c.id === id))
      .filter(Boolean);
    const enemySoldiers = attackerChars.length > 0
      ? attackerChars.reduce((s, c) => s + (c.soldiers ?? 0), 0)
      : 0;
    return {
      defenderBase:    currentDefenseItem.defenderBase,
      attackerFaction: factions.find(f => f.id === currentDefenseItem.attackerFactionId) ?? null,
      enemySoldiers,
    };
  }, [currentDefenseItem, characters, factions]);

  // 防衛キュー全体を state machine で駆動し、完了まで待てる Promise を返す
  const startDefenseQueue = useCallback(async (queue) => {
    const item = queue[0];
    // base_defense 発火（キュー先頭処理前）。条件 attackerFaction/defenderFaction のため
    // attackerFactionId を必ず渡す（baseId だけでは attackerFaction 条件が無言でfalseになる）。
    await game.actions.fireTrigger('base_defense', {
      attackerFactionId: item?.attackerFactionId,
      baseId:            item?.defenderBase?.id,
    });
    return new Promise((resolve) => {
      defenseFlowResolveRef.current = resolve;
      navigate('map', { focusBaseId: item?.defenderBase?.id });
      setFocusKey(k => k + 1);
      setDefenseFlow({ queue, index: 0, phase: 'defense_prompt' });
    });
  }, [navigate, game.actions]);

  // ── ターン終了 → 勢力ごとに演出→防衛→次勢力 ──────────────────
  const handleNextTurn = useCallback(async () => {
    // 防衛フロー進行中の再入を遮断（二重ガードの片側）。防衛プロンプト中に背後の
    // ターン終了ボタンが押されてもターン処理を再開させない。
    if (defenseFlowRef.current) return;
    const fullQueue    = await game.actions.runEnemyPhase();
    const enemyFactions = factions.filter(f => !f.isPlayer);

    for (const faction of enemyFactions) {
      await game.actions.runEnemyPhaseForFaction(faction.id);

      const factionQueue = (fullQueue ?? []).filter(q => q.attackerFactionId === faction.id);
      if (!factionQueue.length) continue;

      // カットイン演出（Promise は現行維持）
      await new Promise((resolve) => {
        navigate('enemy_turn', {
          faction,
          attackQueue: factionQueue,
          _onComplete: resolve,
        });
      });

      const defResult = await startDefenseQueue(factionQueue);
      if (defResult === 'ended') return;
    }

    // YOUR TURN カットイン
    await new Promise((resolve) => {
      navigate('enemy_turn', {
        playerTurnMode: true,
        _onComplete: resolve,
      });
    });

    await game.actions.startPlayerTurn();
    navigate('map');
  }, [game.actions, factions, navigate, startDefenseQueue]);

  // ── クラファン挑戦・浅層探索（DESIGN_CROWDFUNDING.md） ─────────────────

  // 合算した delta を1回の updateChar で反映（charHp は charMaxHp も同時に伸ばす規約）。
  // battleEnd の dispatch は同一レンダー内では characters に反映されない（stateRef は旧値のまま）ため、
  // charHp の起点は closure の stale 値ではなく戦闘直後の unitResults（hpOverride）を使う。
  function grantCharReward(charId, delta, hpOverride) {
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    const patch = { id: charId };
    Object.entries(delta).forEach(([field, amount]) => {
      if (field === 'charHp') {
        patch.charHp    = (hpOverride ?? char.charHp ?? 0) + amount;
        patch.charMaxHp = (char.charMaxHp ?? 0) + amount;
      } else {
        patch[field] = (char[field] ?? 0) + amount;
      }
    });
    game.actions.updateChar(patch);
  }

  function mergeDeltas(...deltas) {
    const merged = {};
    deltas.forEach(d => Object.entries(d).forEach(([k, v]) => { merged[k] = (merged[k] ?? 0) + v; }));
    return merged;
  }

  function charNamesOf(charIds) {
    return charIds.map(id => characters.find(c => c.id === id)?.name ?? id);
  }

  // ゴール（進捗100%到達）達成時: 共通強化 + ゴール種別固有の強化（レジストリ解決）。
  // delta を返す（戦闘結果画面での具体値表示用。DESIGN_CROWDFUNDING.md §4-2）
  function applyGoalReward(charIds, goalId, hpMap) {
    const goal  = dungeonsData.goals.find(g => g.id === goalId);
    const delta = mergeDeltas(COMMON_REWARD, GOAL_REWARD[goal?.rewardType] ?? {});
    charIds.forEach(id => grantCharReward(id, delta, hpMap?.[id]));
    return { kind: 'goal', delta, charNames: charNamesOf(charIds) };
  }

  // ストレッチゴール（100%刻みの追加達成）ごとの追加報酬
  function applyStretchReward(charIds, hpMap) {
    charIds.forEach(id => grantCharReward(id, STRETCH_REWARD, hpMap?.[id]));
    return { kind: 'stretch', delta: STRETCH_REWARD, charNames: charNamesOf(charIds) };
  }

  // 浅層探索: ミーム報酬 + 好感度+1（同行ペア全部）。soldiers の起点も同様に unitResults 優先。
  function applyShallowReward(charIds, spMap) {
    charIds.forEach(id => {
      const char = characters.find(c => c.id === id);
      if (!char) return;
      const currentSp = spMap?.[id] ?? char.soldiers ?? 0;
      game.actions.updateChar({
        id,
        soldiers: Math.min(currentSp + SHALLOW_MEME_REWARD, char.maxSoldiers ?? 0),
      });
    });
    const affinityIds = charIds.filter(id => !characters.find(c => c.id === id)?._isMobInstance);
    if (affinityIds.length >= 2) {
      game.actions.applyEffects([{ type: 'affinityGain', pairs: allPairs(affinityIds), amount: 1 }]);
    }
    return { kind: 'shallow', delta: { soldiers: SHALLOW_MEME_REWARD }, charNames: charNamesOf(charIds) };
  }

  // クラファン挑戦終了（成功・失敗いずれも）: maxSoldiers/soldiers をその回の必要ミームまで戻し、
  // 挑戦回数を+1、好感度+2（同行ペア全部）
  function endCrowdfundingSession(session) {
    const { charIds, requiredMemeByChar } = session;
    charIds.forEach(id => {
      const char = characters.find(c => c.id === id);
      if (!char) return;
      const req = requiredMemeByChar?.[id] ?? 300;
      game.actions.updateChar({
        id,
        maxSoldiers: req,
        soldiers: req,
        cfChallengeCount: (char.cfChallengeCount ?? 0) + 1,
      });
    });
    const affinityIds = charIds.filter(id => !characters.find(c => c.id === id)?._isMobInstance);
    if (affinityIds.length >= 2) {
      game.actions.applyEffects([{ type: 'affinityGain', pairs: allPairs(affinityIds), amount: 2 }]);
    }
  }

  // プレイヤー側の強さスコア（本体パラメータ合計＋必要ミーム。DESIGN_CROWDFUNDING.md §2-3b）。
  // maxSoldiers はクラファン中0になるため指標に使わない。
  function computeStrengthScore(charIds) {
    return charIds.reduce((total, id) => {
      const c = characters.find(ch => ch.id === id);
      if (!c) return total;
      const statSum = (c.charHp ?? 0) + (c.charAttack ?? 0) + (c.charDefense ?? 0)
        + (c.soldierAtk ?? 0) + (c.soldierDef ?? 0);
      return total + statSum + requiredMeme(c.cfChallengeCount ?? 0);
    }, 0);
  }

  // 波（1戦闘）を開始する。敵はプールから抽選し、クラファンはプレイヤー編成人数と対称化する。
  // 生成した敵ユニット（id付き）はそのまま battle へ渡し、id→progressPoint のマップを
  // dungeonSession に控えて撃破判定（onComplete）で参照する。
  function startDungeonWave(session) {
    const { dungeonKind, charIds, waveIndex } = session;
    const mainCount = Math.min(charIds.length, 2);
    const subCount  = Math.max(0, charIds.length - 2);

    let enemyDefs;
    if (dungeonKind === 'crowdfunding') {
      const strengthScore = computeStrengthScore(charIds);
      enemyDefs = drawTieredEnemyDefs(dungeonsData.crowdfundingPool, mainCount + subCount, strengthScore);
      if (waveIndex % BOSS_FREQUENCY === 0) {
        enemyDefs = enemyDefs.map(e => scaleEnemyDef(e, BOSS_MULT));
      }
    } else {
      enemyDefs = drawShallowEnemyDefs(dungeonsData.shallowPool, SHALLOW_ENEMY_COUNT_RANGE);
    }

    const builtEnemies = buildDungeonEnemies(enemyDefs);
    const waveEnemyPointMap = Object.fromEntries(builtEnemies.map(e => [e.id, e.progressPoint ?? 0]));

    const formationKeys = ['front1', 'front2', 'rear1', 'rear2'];
    setDungeonSession(s => s ? { ...s, waveEnemyPointMap } : s);
    navigate('battle', {
      mode: 'dungeon',
      formation: Object.fromEntries(
        charIds
          .map((id, i) => [formationKeys[i], characters.find(c => c.id === id)])
          .filter(([, c]) => c)
      ),
      targetNode:     { name: dungeonKind === 'crowdfunding' ? 'クラファン挑戦' : '浅層探索', battleCapacity: 99999 },
      _dungeonEnemies: builtEnemies,
      battleCapacity: 99999,
    });
  }

  // ── QAモード ──
  const qaParam = new URLSearchParams(window.location.search).get('qa');
  if (qaParam === 'battle') {
    return <div id="app-root"><BattleQAScene onBack={() => window.history.back()} /></div>;
  }
  if (qaParam === 'battlefull') {
    return <div id="app-root"><BattleFullQAScene onBack={() => window.history.back()} /></div>;
  }
  if (qaParam === 'worldmap') {
    return <div id="app-root"><WorldMapQAScene onBack={() => window.history.back()} /></div>;
  }
  if (qaParam === 'promotion') {
    return <div id="app-root"><PromotionDevScene onBack={() => window.history.back()} /></div>;
  }
  if (qaParam === 'portrait') {
    return <div id="app-root"><QAPortraitScene onBack={() => window.history.back()} /></div>;
  }
  if (qaParam === 'adv') {
    return <div id="app-root"><QAAdvScene onBack={() => window.history.back()} /></div>;
  }

  // ── シーンレンダリング ──
  const renderScene = () => {

    // 防衛フロー: formation / battle フェーズはシーン描画を上書き
    if (defenseFlow?.phase === 'formation') {
      const item        = defenseFlow.queue[defenseFlow.index];
      const attackerIds = item.attackerCharIds ?? [];
      const fEnemyChars = attackerIds.length > 0
        ? characters.filter(c => attackerIds.includes(c.id) && !(c.penaltyTurns > 0) && (c.soldiers ?? 0) > 0).slice(0, 4)
        : characters.filter(c =>
            (c.factionId === item.attackerFactionId || c._legionId === item.legionId) &&
            !(c.penaltyTurns > 0) && (c.soldiers ?? 0) > 0
          ).slice(0, 4);
      return <AttackFormationScene
        targetNode={item.defenderBase}
        availableChars={availableChars}
        isDefense={true}
        battleCapacity={item.defenderBase?.battleCapacity ?? 3500}
        enemyChars={fEnemyChars}
        battleMode={item.retreatRule ?? null}
        onLaunch={(formation, _tNode, opts) => {
          setDefenseFlow(prev => prev ? { ...prev, phase: 'battle', formation, battleCapacity: opts?.battleCapacity } : null);
        }}
        onCancel={() => {
          setDefenseFlow(prev => prev ? { ...prev, phase: 'defense_prompt' } : null);
        }}
      />;
    }

    if (defenseFlow?.phase === 'battle') {
      const item        = defenseFlow.queue[defenseFlow.index];
      const attackerIds = item.attackerCharIds ?? [];
      const enemyChars  = attackerIds.length > 0
        ? characters.filter(c => attackerIds.includes(c.id) && !(c.penaltyTurns > 0) && (c.soldiers ?? 0) > 0).slice(0, 4)
        : characters.filter(c =>
            c.factionId === item.attackerFactionId &&
            !(c.penaltyTurns > 0) && (c.soldiers ?? 0) > 0
          ).slice(0, 4);

      return (
        <div style={{ width:'100vw', height:'100vh', background:'#000' }}>
          <BattleScene
            formation={defenseFlow.formation}
            targetNode={item.defenderBase}
            battleCapacity={defenseFlow.battleCapacity}
            isDefense={true}
            enemyChars={enemyChars}
            affinity={affinity}
            enemyRetreatRule={item.retreatRule ?? 'char_dead'}
            onBattleStart={() => game.actions.fireTrigger('battle_start', {
              playerCharIds: ['front1','front2','rear1','rear2']
                .map(k => defenseFlow.formation?.[k]?.id).filter(Boolean),
              baseId: item.defenderBase?.id ?? item.defenderBase?.baseId,
            })}
            onComplete={async (result) => {
              const phase = await game.actions.battleEnd({
                usedCharIds:    result?.usedCharIds  ?? [],
                deadCharIds:    result?.deadCharIds  ?? [],
                deadMobIds:     result?.deadMobIds   ?? [],
                defeatedEnemyCharIds: result?.defeatedEnemyCharIds ?? [],
                unitResults:    result?.unitResults  ?? [],
                conquered:      !(result?.conquered  ?? false),
                defenderBaseId: item.defenderBase?.id ?? item.defenderBase?.baseId,
                winnerFactionId: !(result?.conquered ?? false)
                  ? item.attackerFactionId
                  : playerFaction?.id,
              });
              advanceDefenseQueue(phase ?? null);
            }}
          />
        </div>
      );
    }

    switch (scene) {

      // ── タイトル ──
      case 'title':
        return <TitleScene
          onNavigate={async (dest, params) => {
            if (dest === 'map') {
              await game.actions.startNewGame();
              navigate('map');
              return;
            }
            if (dest === 'save') { navigate('save', { mode: 'load', returnTo: 'title' }); return; }
            navigate(dest, params);
          }}
          hasSaveData={game.actions.getSaveSlots().some(s => !s.empty)}
          hasNewGamePlus={false}
        />;

      // ── マップ ──
      case 'map':
        return null;

      // ── 拠点メニュー ──
      case 'base_menu':
        return (
          <BaseMenuScene
            node={sceneParams.node}
            isOwned={sceneParams.isOwned ?? true}
            canAttack={sceneParams.canAttack ?? false}
            onNavigate={(dest, params) => {
              if (dest === 'formation') {
                navigate('formation', { targetNode: sceneParams.node });
              } else {
                navigate(dest, params);
              }
            }}
            onClose={() => navigate('map', { focusBaseId: sceneParams.focusBaseId })}
          />
        );

      // ── 攻撃編成（防衛は defenseFlow state machine が処理）──
      case 'formation': {
        const fNode           = sceneParams.targetNode;
        const fEnemyFactionId = fNode?.factionId;
        const fEnemyChars     = fEnemyFactionId && legionAI
          ? legionAI.getDefenders(fEnemyFactionId, fNode, characters).slice(0, 4)
          : characters.filter(c =>
              c.factionId === fEnemyFactionId &&
              !(c.penaltyTurns > 0) && (c.soldiers ?? 0) > 0
            ).slice(0, 4);
        return <AttackFormationScene
          targetNode={fNode}
          availableChars={availableChars}
          isDefense={false}
          battleCapacity={fNode?.battleCapacity ?? 3500}
          enemyChars={fEnemyChars}
          battleMode={null}
          onLaunch={async (formation, _tNode, opts) => {
            // 攻撃出撃 = 行動力1消費（旧kiritan正仕様）。行動力0なら出撃不可。
            // 防衛フロー（defenseFlow の formation→battle）では減算しない（共通の BATTLE_END に
            // 入れると防衛側でも減るため、攻撃の出撃確定点でのみ消費する）。
            if (game.actionPoints < 1) return;
            game.actions.setActionPoints(game.actionPoints - 1);
            await game.actions.beforeAttack(fNode?.baseId, playerFaction?.id);
            navigate('battle', {
              mode:           'attack',
              formation,
              targetNode:     fNode,
              battleCapacity: opts?.battleCapacity ?? fNode?.battleCapacity ?? 3500,
            });
          }}
          onCancel={() => navigate('map')}
        />;
      }

      // ── 攻撃戦闘（防衛は defenseFlow state machine が処理）──
      case 'battle': {
        const targetBase     = sceneParams.targetNode;
        const enemyFactionId = targetBase?.factionId;
        // P2: 攻撃戦では AI が守備側 → mode='defense'（onDefend ルール）。撤退ルールも併せて取得。
        const _def = sceneParams._dungeonEnemies
          ? { chars: sceneParams._dungeonEnemies, retreatRule: 'never' }
          : (enemyFactionId && legionAI
              ? legionAI.getDefendersWithRule(enemyFactionId, targetBase, characters, 'defense')
              : { chars: [], retreatRule: 'char_dead' });
        const enemyChars       = _def.chars.slice(0, 4);
        const enemyRetreatRule = _def.retreatRule;

        return (
          <div style={{ width:'100vw', height:'100vh', background:'#000' }}>
            <BattleScene
              formation={sceneParams.formation}
              targetNode={targetBase}
              battleCapacity={sceneParams.battleCapacity}
              isDefense={false}
              enemyChars={enemyChars}
              affinity={affinity}
              enemyRetreatRule={enemyRetreatRule}
              onBattleStart={() => game.actions.fireTrigger('battle_start', {
                playerCharIds: ['front1','front2','rear1','rear2']
                  .map(k => sceneParams.formation?.[k]?.id).filter(Boolean),
                baseId: targetBase?.id ?? targetBase?.baseId,
              })}
              onComplete={async (result) => {
                // ── ダンジョン戦闘の場合（クラファン挑戦・浅層探索） ──
                if (dungeonSession) {
                  const { charIds, dungeonKind, goalId, progressPoints, progressRequired, waveEnemyPointMap } = dungeonSession;
                  const isWin           = result?.conquered === true;
                  const remainingRounds = dungeonSession.remainingRounds - (result?.round ?? 0);

                  await game.actions.battleEnd({
                    usedCharIds:     charIds,
                    deadCharIds:     isWin ? [] : (result?.deadCharIds ?? []),
                    deadMobIds:      result?.deadMobIds ?? [],
                    defeatedEnemyCharIds: result?.defeatedEnemyCharIds ?? [],
                    unitResults:     result?.unitResults ?? [],
                    conquered:       false,
                    defenderBaseId:  null,
                    winnerFactionId: null,
                    isDungeon:       true,
                  });

                  // battleEnd の dispatch はこの時点ではまだ characters に反映されない。
                  // charHp/soldiers の起点は unitResults（戦闘直後の実値）から取る。
                  const hpMap = Object.fromEntries((result?.unitResults ?? []).map(u => [u.id, u.charHp]));
                  const spMap = Object.fromEntries((result?.unitResults ?? []).map(u => [u.id, u.soldiers]));

                  let goalAchieved = dungeonSession.goalAchieved;
                  let sessionEnded = false;
                  let rewardInfo   = null;
                  const nextSession = { ...dungeonSession, remainingRounds };

                  if (dungeonKind === 'crowdfunding') {
                    // 敵を1体撃破するごとに progressPoint を加算（DESIGN_CROWDFUNDING.md §2-3）。
                    // 撃破していれば、その波が敗北でも進捗には乗る。
                    const gained = (result?.defeatedEnemyCharIds ?? [])
                      .reduce((s, id) => s + (waveEnemyPointMap?.[id] ?? 0), 0);
                    const newProgress = progressPoints + gained;
                    const oldMilestones = Math.floor(progressPoints / progressRequired);
                    const newMilestones = Math.floor(newProgress / progressRequired);
                    let milestonesCrossed = newMilestones - oldMilestones;

                    const rewards = [];
                    if (!goalAchieved && milestonesCrossed >= 1) {
                      rewards.push(applyGoalReward(charIds, goalId, hpMap));
                      goalAchieved = true;
                      milestonesCrossed -= 1;
                    }
                    for (let i = 0; i < milestonesCrossed; i++) {
                      rewards.push(applyStretchReward(charIds, hpMap));
                    }
                    if (rewards.length) {
                      rewardInfo = {
                        kind:      rewards[0].kind,
                        delta:     mergeDeltas(...rewards.map(r => r.delta)),
                        charNames: rewards[0].charNames,
                      };
                    }

                    nextSession.progressPoints = newProgress;

                    // 成功・失敗を問わず、負けた時点 or 残ラウンド切れで挑戦終了
                    if (!isWin || remainingRounds <= 0) {
                      endCrowdfundingSession(nextSession);
                      sessionEnded = true;
                    }
                  } else {
                    if (isWin) rewardInfo = applyShallowReward(charIds, spMap);
                    if (remainingRounds <= 0) sessionEnded = true;
                  }

                  nextSession.goalAchieved = goalAchieved;
                  setDungeonSession(nextSession);

                  navigate('dungeon', {
                    _battleResult:  isWin ? 'win' : 'lose',
                    _sessionEnded:  sessionEnded,
                    _rewardInfo:    rewardInfo,
                    _milestoneHit:  dungeonKind === 'crowdfunding' && rewardInfo != null,
                  });
                  return;
                }

                // ── 通常戦闘ロジック ──
                // D-03: 攻撃戦で制圧した場合、battleEnd前に宣戦布告（制圧前のfactionIdを使う）
                if (result?.conquered) {
                  game.actions.declareWar(targetBase?.factionId);
                }
                const phase = await game.actions.battleEnd({
                  usedCharIds:     result?.usedCharIds    ?? [],
                  deadCharIds:     result?.deadCharIds    ?? [],
                  deadMobIds:      result?.deadMobIds     ?? [],
                  defeatedEnemyCharIds: result?.defeatedEnemyCharIds ?? [],
                  unitResults:     result?.unitResults    ?? [],
                  conquered:       result?.conquered      ?? false,
                  defenderBaseId:  targetBase?.id ?? targetBase?.baseId,
                  winnerFactionId: result?.conquered
                    ? playerFaction?.id
                    : (targetBase?.factionId),
                });

                if (phase === 'defeat' || phase === 'victory') {
                  navigate('game_end', {
                    isVictory:       phase === 'victory',
                    clearedCount:    0,
                    currentTurn,
                    playerBaseCount: playerBases.length,
                    totalBaseCount:  bases.length,
                  });
                  return;
                }

                navigate('map');
              }}
            />
          </div>
        );
      }

      // ── 敵ターン演出 ──
      case 'enemy_turn':
        return (
          <div style={{ width:'100vw', height:'100vh', position:'relative', background:'#0a0610' }}>
            <EnemyTurnScene
              faction={sceneParams.faction ?? null}
              attackQueue={sceneParams.attackQueue ?? []}
              playerFactionName={playerFaction?.name}
              playerTurnMode={sceneParams.playerTurnMode ?? false}
              onComplete={() => sceneParams._onComplete?.()}
            />
          </div>
        );

      // ── キャラクター ──
      case 'characters':
        return <PartyScene
          onNavigate={navigate}
          characters={characters.filter(c => c.factionId === playerFaction?.id)}
          treasury={playerFaction?.treasury ?? 0}
          upgradeUnlocks={game.upgradeUnlocks}
          actionPoints={game.actionPoints}
          maxActionPoints={game.maxActionPoints}
          secretaryId={game.secretaryId}
          buildings={game.buildings}
          buildingSystem={systems?.buildingSystem}
          onUpgrade={(charId, commandId) => {
            const UPGRADE_COSTS = { sp_refill: 100, sp_max_up: 200 };
            const baseCost = UPGRADE_COSTS[commandId] ?? 0;
            const char = characters.find(c => c.id === charId);
            const mult = commandId === 'sp_max_up' ? (char?._spMaxUpCostMult ?? 1.0) : 1.0;
            const cost = Math.floor(baseCost * Math.max(0.2, mult));
            const pf = playerFaction;
            if (!pf || pf.treasury < cost) return;
            game.actions.setTreasury(pf.id, pf.treasury - cost);
            game.actions.setActionPoints(game.actionPoints - 1);
            if (!char) return;
            if (commandId === 'sp_refill') {
              game.actions.updateChar({
                ...char,
                soldiers: Math.min(
                  char.soldiers + Math.floor((char.maxSoldiers ?? 1000) * 0.5),
                  char.maxSoldiers ?? 1000
                ),
              });
            } else if (commandId === 'sp_max_up') {
              game.actions.updateChar({ ...char, maxSoldiers: (char.maxSoldiers ?? 1000) + 200 });
            }
          }}
          onSetSecretary={(charId) => game.actions.setSecretary(charId)}
          onPurchaseUpgrade={(charId, cmdId) => game.actions.purchaseUpgrade(charId, cmdId)}
        />;

      // ── アイテム ──
      case 'items':
        return <ItemsScene
          onNavigate={navigate}
          inventory={game.inventory}
          systems={systems}
          characters={characters}
          onRemoveItem={game.actions.removeItem}
        />;

      // ── 研究 ──
      case 'research':
        return <ResearchScene
          onNavigate={navigate}
          buildingSystem={systems?.buildingSystem}
          buildings={game.buildings}
          treasury={playerFaction?.treasury ?? 0}
          researchQueue={game.researchQueue}
          onResearch={(id) => game.actions.doResearch(id)}
          onStartResearch={(id) => game.actions.startResearch(id)}
        />;

      // ── 劇場 ──
      // 候補取得は getTheaterEvents（getAvailableTheaterEvents）に一本化。
      // 起動は ev.script/ev.effects を直接 ADV に渡し、戻り先（theater）を onExit に閉じる（Phase 2 方針）。
      case 'theater':
        return <TheaterScene
          onNavigate={navigate}
          theaterEvents={game.actions.getTheaterEvents()}
          actionPoints={game.actionPoints}
          onStartTheater={(eventId) => {
            if (game.actionPoints < 1) return;
            const ev = game.actions.runTheaterEvent(eventId);
            if (!ev) return;
            game.actions.setActionPoints(game.actionPoints - (ev.cost?.actionPoints ?? 1));
            // script に meta.location（イベント名）を付与（ADV は script.meta から location を読む）
            const script = Array.isArray(ev.script) ? [...ev.script] : [{ type: 'end' }];
            script.meta = { location: ev.title ?? ev.name };
            navigate('adv', {
              script,
              effects: ev.effects ?? null,
              dialogId: ++dialogSeqRef.current,
              onExit: () => navigate('theater'),
            });
          }}
        />;

      // ── セーブ/ロード ──
      case 'save':
        return (
          <div style={{ width:'100vw', height:'100vh', position:'relative', background:'rgba(248,246,244,1)' }}>
            <SaveScene
              mode={sceneParams.mode ?? 'save'}
              slots={game.actions.getSaveSlots()}
              onSave={(slot) => { game.actions.save(slot); navigate('map'); }}
              onLoad={(slot) => { if (game.actions.load(slot)) navigate('map'); }}
              onClose={() => navigate(sceneParams.returnTo ?? 'map')}
              onNavigate={navigate}
            />
          </div>
        );

      // ── ゲームエンド ──
      case 'game_end':
        return <GameEndScene
          isVictory={sceneParams.isVictory ?? true}
          clearedCount={sceneParams.clearedCount ?? 0}
          currentTurn={sceneParams.currentTurn ?? 1}
          playerBaseCount={sceneParams.playerBaseCount ?? 0}
          totalBaseCount={sceneParams.totalBaseCount ?? 92}
          hasNewGamePlus={false}
          onNavigate={navigate}
        />;

      // ── ダンジョン種別選択（クラファン挑戦 / 浅層探索） ──
      case 'dungeon_select':
        return (
          <div style={{ width:'100vw', height:'100vh', display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center', background:'rgba(248,246,244,1)', gap:16 }}>
            <div style={{ fontSize:24, color:'#1c1020', fontFamily:"'Noto Sans JP'" }}>ダンジョン</div>
            <div style={{ display:'flex', gap:16 }}>
              <button onClick={() => {
                setDungeonSession({
                  dungeonKind: 'crowdfunding', charIds: [], waveIndex: 0,
                  remainingRounds: DUNGEON_ROUND_LIMIT.crowdfunding,
                  goalId: null, requiredMemeByChar: {}, goalAchieved: false,
                  progressPoints: 0, progressRequired: 0, waveEnemyPointMap: {},
                });
                navigate('dungeon');
              }} style={{ padding:'12px 28px', background:'#c4427a', color:'#fff',
                border:'none', borderRadius:8, cursor:'pointer', fontSize:14 }}>
                クラファン挑戦
              </button>
              <button onClick={() => {
                setDungeonSession({
                  dungeonKind: 'shallow', charIds: [], waveIndex: 0,
                  remainingRounds: DUNGEON_ROUND_LIMIT.shallow,
                  goalId: null, requiredMemeByChar: {}, goalAchieved: false,
                  progressPoints: 0, progressRequired: 0, waveEnemyPointMap: {},
                });
                navigate('dungeon');
              }} style={{ padding:'12px 28px', background:'#1a8a96', color:'#fff',
                border:'none', borderRadius:8, cursor:'pointer', fontSize:14 }}>
                浅層探索
              </button>
            </div>
            <button onClick={() => navigate('map')}
              style={{ padding:'8px 24px', background:'transparent', color:'#1c1020',
                border:'1px solid #ccc', borderRadius:8, cursor:'pointer', fontSize:13 }}>
              戻る
            </button>
          </div>
        );

      // ── ダンジョン（クラファン挑戦・浅層探索） ──
      case 'dungeon': {
        if (!dungeonSession) return <div>探索データが見つかりません</div>;

        return (
          <DungeonScene
            dungeonKind={dungeonSession.dungeonKind}
            goals={dungeonsData.goals}
            availableChars={availableChars}
            remainingRounds={dungeonSession.remainingRounds}
            waveIndex={dungeonSession.waveIndex}
            goalAchieved={dungeonSession.goalAchieved}
            progressPoints={dungeonSession.progressPoints}
            progressRequired={dungeonSession.progressRequired}
            battleResult={sceneParams._battleResult ?? null}
            sessionEnded={sceneParams._sessionEnded ?? false}
            rewardInfo={sceneParams._rewardInfo ?? null}
            milestoneHit={sceneParams._milestoneHit ?? false}
            onConfirm={(charIds, goalId) => {
              const requiredMemeByChar = {};
              let progressRequired = 0;
              if (dungeonSession.dungeonKind === 'crowdfunding') {
                charIds.forEach(id => {
                  const c = characters.find(ch => ch.id === id);
                  requiredMemeByChar[id] = requiredMeme(c?.cfChallengeCount ?? 0);
                  game.actions.updateChar({ id, maxSoldiers: 0, soldiers: 0 });
                });
                progressRequired = requiredProgress(
                  Object.values(requiredMemeByChar).reduce((s, v) => s + v, 0)
                );
              }
              const next = {
                ...dungeonSession, charIds, goalId, requiredMemeByChar, waveIndex: 1,
                progressPoints: 0, progressRequired,
              };
              setDungeonSession(next);
              startDungeonWave(next);
            }}
            onContinue={() => {
              const next = { ...dungeonSession, waveIndex: dungeonSession.waveIndex + 1 };
              setDungeonSession(next);
              startDungeonWave(next);
            }}
            onRest={() => {
              dungeonSession.charIds.forEach(id => {
                const c = characters.find(ch => ch.id === id);
                if (c) game.actions.updateChar({ id: c.id, charHp: c.charMaxHp });
              });
              setDungeonSession(s => s ? { ...s, remainingRounds: s.remainingRounds - DUNGEON_REST_COST } : s);
            }}
            onEndSession={() => {
              if (dungeonSession.dungeonKind === 'crowdfunding') {
                endCrowdfundingSession(dungeonSession);
              }
              setDungeonSession(null);
              navigate('map');
            }}
            onNavigate={(dest, params) => {
              if (dest === 'map') setDungeonSession(null);
              navigate(dest, params);
            }}
          />
        );
      }

      // ── 周回選択 ──
      case 'new_game_plus':
        return <NewGamePlusScene onNavigate={navigate} />;

      // ── 会話 ──
      // 契約: { script, effects, onExit }。戻り先は呼び出し元が onExit に閉じる
      // （未指定時のみ map へ戻る）。effects 適用・choice 分岐は ADV 内部。
      case 'adv':
        return (
          <div style={{ position:'relative', width:'100vw', height:'100vh' }}>
            <ADVScene
              key={sceneParams.dialogId ?? 'adv'}
              script={sceneParams.script ?? []}
              effects={sceneParams.effects ?? null}
              transparent={sceneParams.transparent ?? true}
              onExit={sceneParams.onExit ?? (() => navigate('map'))}
            />
          </div>
        );

      // ── 空実装 ──
      case 'gallery':
      case 'settings':
      case 'credits':
        return (
          <div style={{ width:'100vw', height:'100vh', display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center', background:'rgba(248,246,244,1)', gap:16 }}>
            <div style={{ fontSize:24, color:'#1c1020', fontFamily:"'Noto Sans JP'" }}>
              {scene}（未実装）
            </div>
            <button onClick={() => navigate('title')}
              style={{ padding:'8px 24px', background:'#c4427a', color:'#fff',
                border:'none', borderRadius:8, cursor:'pointer', fontSize:14 }}>
              タイトルへ戻る
            </button>
          </div>
        );

      default:
        return <div style={{ color:'#fff', padding:20 }}>Unknown scene: {scene}</div>;
    }
  };

  // MapScene 表示条件: scene ∈ {map, base_menu, adv} かつ防衛フローの formation/battle でない
  const showMapLayer =
    ['map', 'base_menu', 'adv'].includes(scene) &&
    (!defenseFlow || defenseFlow.phase === 'defense_prompt');

  const isInteractiveMap = scene === 'map' && (!defenseFlow || defenseFlow.phase === 'defense_prompt');
  const mapLayerHandlers = isInteractiveMap ? {
    onNavigate:   navigate,
    onAttackNode: (node) => navigate('formation', { targetNode: node }),
    onNodeClick:  (node) => {
      setFocusKey(k => k + 1);
      navigate('base_menu', {
        node,
        isOwned:     node.factionId === playerFaction?.id,
        canAttack:   node.canAttack ?? false,
        focusBaseId: node.id,
      });
    },
    onNextTurn:   handleNextTurn,
    onReady:      sceneParams._onReady,
  } : {
    onNavigate:   () => {},
    onAttackNode: () => {},
    onNodeClick:  () => {},
    onNextTurn:   () => {},
    onReady:      undefined,   // 背景用途では onReady 渡さない（KNOWLEDGE.md §8-2b 準拠）
  };

  const sceneEl = renderScene();

  return (
    <div id="app-root" style={{ position:'relative', width:'100vw', height:'100vh' }}>
      {/* MapScene 常時レイヤ: scene 切替で unmount させない */}
      {showMapLayer && (
        <div style={{
          position: 'absolute', inset: 0,
          pointerEvents: isInteractiveMap ? 'auto' : 'none',
          zIndex: 0,
        }}>
          <MapScene
            {...mapLayerHandlers}
            gameState={gameState}
            basesData={bases}
            factionsData={factions}
            conqueredThisTurn={game.conqueredThisTurn}
            focusBaseId={sceneParams.focusBaseId}
            focusKey={focusKey}
          />
        </div>
      )}

      {/* シーン描画（MapScene の上）。
          sceneEl が null のときはラッパ自体を描画しない
          （空全画面 div が pointerEvents:auto で MapScene 操作を全遮断するのを防ぐ）。 */}
      {sceneEl != null && (
        <div style={{ position:'relative', zIndex:1, width:'100%', height:'100%' }}>
          {sceneEl}
        </div>
      )}

      {/* 防衛プロンプト表示中は背後マップへのクリック貫通を物理遮断（二重ガードの片側）。
          PartnerWidget の防衛モーダル（zIndex:200）より下、マップより上に置く。
          背景は透明（直書きカラー回避）でも pointer-events で遮断は成立する。 */}
      {defenseFlow?.phase === 'defense_prompt' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 150,
          pointerEvents: 'auto', background: 'transparent',
        }} />
      )}
      <PartnerWidget
        secretaryId={game.secretaryId}
        characters={characters}
        secretaryLines={secretaryLinesData}
        defensePrompt={defensePromptData}
        onDefend={() => {
          const df = defenseFlowRef.current;
          if (df) setDefenseFlow({ ...df, phase: 'formation' });
        }}
        onAbandon={() => {
          const df = defenseFlowRef.current;
          if (!df) return;
          const item = df.queue[df.index];
          game.actions.battleEnd({
            usedCharIds: [], deadCharIds: [], deadMobIds: [], unitResults: [],
            conquered:      true,
            defenderBaseId: item.defenderBase?.id ?? item.defenderBase?.baseId,
            winnerFactionId: item.attackerFactionId,
          }).then(phase => advanceDefenseQueue(phase ?? null));
        }}
      />
    </div>
  );
}
