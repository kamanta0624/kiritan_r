import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import './App.css';
import { useGame } from './context/GameContext.jsx';
import secretaryLinesData from './game/data/secretary_lines.json';
import dungeonsData       from './game/data/dungeons.json';

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

export default function App() {
  const game = useGame();
  const [scene, setScene]             = useState('title');
  const [sceneParams, setSceneParams] = useState({});
  // defenseFlow: null | { queue, index, phase: 'defense_prompt'|'formation'|'battle', formation? }
  const [defenseFlow, setDefenseFlow] = useState(null);
  // dungeonFlow: null | { dungeonId, explorerCharId, floor, baseNode }
  const [dungeonFlow, setDungeonFlow] = useState(null);
  const [focusKey, setFocusKey]       = useState(0);
  const dialogSeqRef = useRef(0);

  const navigate = useCallback((dest, params = {}) => {
    setSceneParams(params);
    setScene(dest);
  }, []);

  function buildDungeonEnemy(enemy) {
    return {
      id:           `dungeon_enemy_${Date.now()}`,
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
      strategyRate: 30,
      penaltyTurns: 0,
      usedThisTurn: false,
      skillId:      null,
      battleBonus: {
        attack:  { soldierAtk:0, soldierDef:0, charAttack:0, charSong:0 },
        defense: { soldierAtk:0, soldierDef:0, charAttack:0, charSong:0 },
        dungeon: { soldierAtk:0, soldierDef:0, charAttack:0, charSong:0 },
      },
    };
  }

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
    actionPoints, maxActionPoints,
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
      const fEnemyStrategyRate = fEnemyChars.length > 0
        ? Math.max(...fEnemyChars.map(c => c.strategyRate ?? 0)) : 0;

      return <AttackFormationScene
        targetNode={item.defenderBase}
        availableChars={availableChars}
        isDefense={true}
        battleCapacity={item.defenderBase?.battleCapacity ?? 3500}
        enemyStrategyRate={fEnemyStrategyRate}
        enemyChars={fEnemyChars}
        battleMode={item.retreatRule ?? null}
        onLaunch={(formation) => {
          setDefenseFlow(prev => prev ? { ...prev, phase: 'battle', formation } : null);
        }}
        onCancel={() => {
          setDefenseFlow(prev => prev ? { ...prev, phase: 'adv' } : null);
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
            isDefense={true}
            enemyChars={enemyChars}
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
            if (dest === 'save') { navigate('save', { mode: 'load' }); return; }
            navigate(dest, params);
          }}
          hasSaveData={game.actions.getSaveSlots().some(s => !s.empty)}
          hasNewGamePlus={false}
        />;

      // ── マップ ──
      case 'map':
        return <MapScene
          onNavigate={navigate}
          onAttackNode={(node) => navigate('formation', { targetNode: node })}
          onNodeClick={(node) => navigate('base_menu', {
            node,
            isOwned:    node.factionId === playerFaction?.id,
            canAttack:  node.canAttack ?? false,
            hasDungeon: !!node.dungeonId,
          })}
          gameState={gameState}
          basesData={bases}
          factionsData={factions}
          conqueredThisTurn={game.conqueredThisTurn}
          onNextTurn={handleNextTurn}
          focusBaseId={sceneParams.focusBaseId}
          focusKey={focusKey}
          onReady={sceneParams._onReady}
        />;

      // ── 拠点メニュー ──
      case 'base_menu':
        return (
          <div style={{ width:'100vw', height:'100vh', position:'relative', background:'rgba(248,246,244,1)' }}>
            <BaseMenuScene
              node={sceneParams.node}
              isOwned={sceneParams.isOwned ?? true}
              canAttack={sceneParams.canAttack ?? false}
              hasDungeon={sceneParams.hasDungeon ?? false}
              onNavigate={(dest, params) => {
                if (dest === 'formation') {
                  navigate('formation', { targetNode: sceneParams.node });
                } else if (dest === 'dungeon') {
                  navigate('dungeon', { baseNode: sceneParams.node });
                } else {
                  navigate(dest, params);
                }
              }}
              onClose={() => navigate('map')}
            />
          </div>
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
        const fEnemyStrategyRate = fEnemyChars.length > 0
          ? Math.max(...fEnemyChars.map(c => c.strategyRate ?? 0)) : 0;

        return <AttackFormationScene
          targetNode={fNode}
          availableChars={availableChars}
          isDefense={false}
          battleCapacity={fNode?.battleCapacity ?? 3500}
          enemyStrategyRate={fEnemyStrategyRate}
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
        const _def = sceneParams._dungeonEnemy
          ? { chars: [buildDungeonEnemy(sceneParams._dungeonEnemy)], retreatRule: 'never' }
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
              isDefense={false}
              enemyChars={enemyChars}
              enemyRetreatRule={enemyRetreatRule}
              onBattleStart={() => game.actions.fireTrigger('battle_start', {
                playerCharIds: ['front1','front2','rear1','rear2']
                  .map(k => sceneParams.formation?.[k]?.id).filter(Boolean),
                baseId: targetBase?.id ?? targetBase?.baseId,
              })}
              onComplete={async (result) => {
                // ── ダンジョン戦闘の場合 ──
                if (dungeonFlow) {
                  const { dungeonId, explorerCharId, floor, baseNode } = dungeonFlow;
                  setDungeonFlow(null);

                  const isWin = result?.conquered === true;
                  await game.actions.battleEnd({
                    usedCharIds:     [explorerCharId],
                    deadCharIds:     isWin ? [] : [explorerCharId],
                    deadMobIds:      [],
                    defeatedEnemyCharIds: result?.defeatedEnemyCharIds ?? [],
                    unitResults:     result?.unitResults ?? [],
                    conquered:       false,
                    defenderBaseId:  null,
                    winnerFactionId: null,
                  });

                  navigate('dungeon', {
                    baseNode,
                    _battleResult: isWin ? 'win' : 'lose',
                    _resumeFloor:  floor,
                    _resumeCharId: explorerCharId,
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

      // ── 迷宮 ──
      case 'dungeon': {
        const baseNode  = sceneParams.baseNode;
        const dungeonId = baseNode?.dungeonId;
        const dungeon   = dungeonsData.dungeons.find(d => d.id === dungeonId);
        if (!dungeon) return <div>迷宮データが見つかりません</div>;

        const progress = game.dungeonProgress?.[dungeonId]
          ?? { clearedFloors: 0, isFullyCleared: false };

        return (
          <DungeonScene
            dungeon={dungeon}
            progress={progress}
            availableChars={availableChars}
            dungeonExploredThisTurn={game.dungeonExploredThisTurn}
            battleResult={sceneParams._battleResult ?? null}
            resumeFloor={sceneParams._resumeFloor ?? null}
            resumeCharId={sceneParams._resumeCharId ?? null}
            onStartBattle={(explorerCharId, floor, floorData) => {
              setDungeonFlow({ dungeonId, explorerCharId, floor, baseNode });
              game.actions.dungeonExplored();
              navigate('battle', {
                mode:           'dungeon',
                formation:      { front1: characters.find(c => c.id === explorerCharId) },
                targetNode:     { name: dungeon.name, battleCapacity: 99999 },
                _dungeonEnemy:  floorData.enemy,
                battleCapacity: 99999,
              });
            }}
            onFloorClear={(payload) => game.actions.dungeonFloorClear(payload)}
            onDefeat={(charId)      => game.actions.dungeonDefeat(charId)}
            onNavigate={navigate}
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
        return <ADVScene
          key={sceneParams.dialogId ?? 'adv'}
          script={sceneParams.script ?? []}
          effects={sceneParams.effects ?? null}
          onExit={sceneParams.onExit ?? (() => navigate('map'))}
        />;

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

  return (
    <div id="app-root" style={{ position:'relative', width:'100vw', height:'100vh' }}>
      {renderScene()}
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
