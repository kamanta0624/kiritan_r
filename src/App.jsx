import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import './App.css';
import { useGame } from './context/GameContext.jsx';

import TitleScene           from './scenes/TitleScene.jsx';
import MapScene             from './scenes/MapScene.jsx';
import BaseMenuScene        from './scenes/BaseMenuScene.jsx';
import AttackFormationScene from './scenes/FormationScene.jsx';
import BattleScene          from './scenes/BattleScene.jsx';
import EnemyTurnScene       from './scenes/EnemyTurnScene.jsx';
import PartyScene           from './scenes/PartyScene.jsx';
import ItemsScene           from './scenes/ItemsScene.jsx';
import ResearchScene        from './scenes/ResearchScene.jsx';
import SaveScene            from './scenes/SaveScene.jsx';
import GameEndScene         from './scenes/GameEndScene.jsx';
import DungeonScene         from './scenes/DungeonScene.jsx';
import NewGamePlusScene     from './scenes/NewGamePlusScene.jsx';
import ADVScene, { convertEventScript } from './scenes/ADVScene.jsx';
import BattleQAScene        from './scenes/BattleQAScene.jsx';
import BattleFullQAScene    from './scenes/BattleFullQAScene.jsx';
import WorldMapQAScene      from './scenes/WorldMapQAScene.jsx';

export default function App() {
  const game = useGame();
  const [scene, setScene]             = useState('title');
  const [sceneParams, setSceneParams] = useState({});
  // defenseFlow: null | { queue, index, phase: 'adv'|'abandon_confirm'|'formation'|'battle', formation? }
  const [defenseFlow, setDefenseFlow] = useState(null);
  const [focusKey, setFocusKey]       = useState(0);

  const navigate = useCallback((dest, params = {}) => {
    setSceneParams(params);
    setScene(dest);
  }, []);

  useEffect(() => {
    game.setStartDialogHandler((script, onComplete) => {
      const { scenario, cast, bg, location } = convertEventScript(script);
      navigate('adv', { scenario, cast, bg, location, returnTo: 'map', _onComplete: onComplete });
    });
  }, []);

  const {
    currentTurn, playerFaction, playerBases, income,
    bases, factions, characters, availableChars,
    gamePhase, systems, legionAI,
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
    setDefenseFlow({ queue: df.queue, index: nextIndex, phase: 'adv' });
  }, [navigate]);

  // ADV の選択肢ハンドラ
  const handleDefenseAdvChoice = useCallback((value) => {
    const df = defenseFlowRef.current;
    if (!df) return;
    const item = df.queue[df.index];

    if (value === 'defend') {
      setDefenseFlow({ ...df, phase: 'formation' });
    } else if (value === 'abandon') {
      setDefenseFlow({ ...df, phase: 'abandon_confirm' });
    } else if (value === 'confirm_abandon') {
      game.actions.battleEnd({
        usedCharIds: [], deadCharIds: [], deadMobIds: [], unitResults: [],
        conquered:      true,
        defenderBaseId: item.defenderBase?.id ?? item.defenderBase?.baseId,
        winnerFactionId: item.attackerFactionId,
      }).then(phase => advanceDefenseQueue(phase ?? null));
    } else if (value === 'back') {
      setDefenseFlow({ ...df, phase: 'adv' });
    }
  }, [game.actions, advanceDefenseQueue]);

  // ADV シナリオ（phase に応じて切り替え）
  const defenseAdvConfig = useMemo(() => {
    if (!defenseFlow) return { scenario: [], cast: [], bg: null, location: '' };
    const item          = defenseFlow.queue[defenseFlow.index];
    const attackerFaction = factions.find(f => f.id === item?.attackerFactionId);
    const defenderBase  = item?.defenderBase;

    if (defenseFlow.phase === 'abandon_confirm') {
      return {
        scenario: [{
          type: 'choice',
          text: `本当に「${defenderBase?.name ?? '拠点'}」を放棄しますか？`,
          choices: [
            { label: 'はい、放棄する', value: 'confirm_abandon' },
            { label: 'いいえ、戻る',   value: 'back' },
          ],
        }],
        cast: [],
        bg: null,
        location: '',
      };
    }

    return {
      scenario: [
        { type: 'narration', text: `${attackerFaction?.name ?? '敵勢力'}が${defenderBase?.name ?? '拠点'}に侵攻してきた。` },
        {
          type: 'choice',
          text: '迎撃するか？',
          choices: [
            { label: '防衛する', value: 'defend' },
            { label: '放棄する', value: 'abandon' },
          ],
        },
        { type: 'end' },
      ],
      cast: [],
      bg: 'assets/bg_battle.jpg',
      location: defenderBase?.name ?? '拠点',
    };
  }, [defenseFlow, factions]);

  // 防衛キュー全体を state machine で駆動し、完了まで待てる Promise を返す
  const startDefenseQueue = useCallback((queue) => {
    return new Promise((resolve) => {
      defenseFlowResolveRef.current = resolve;
      const item = queue[0];
      navigate('map', { focusBaseId: item?.defenderBase?.id });
      setFocusKey(k => k + 1);
      setDefenseFlow({ queue, index: 0, phase: 'adv' });
    });
  }, [navigate]);

  // ── ターン終了 → 勢力ごとに演出→防衛→次勢力 ──────────────────
  const handleNextTurn = useCallback(async () => {
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
        ? characters.filter(c => attackerIds.includes(c.id)).slice(0, 4)
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
        ? characters.filter(c => attackerIds.includes(c.id)).slice(0, 4)
        : characters.filter(c =>
            c.factionId === item.attackerFactionId &&
            !(c.penaltyTurns > 0) && (c.soldiers ?? 0) > 0
          ).slice(0, 4);

      return (
        <div style={{ width:'100vw', height:'100vh', background:'#000' }}>
          <BattleScene
            formation={defenseFlow.formation}
            targetNode={item.defenderBase}
            enemyChars={enemyChars}
            onComplete={async (result) => {
              const phase = await game.actions.battleEnd({
                usedCharIds:    result?.usedCharIds  ?? [],
                deadCharIds:    result?.deadCharIds  ?? [],
                deadMobIds:     result?.deadMobIds   ?? [],
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
        const enemyChars     = enemyFactionId && legionAI
          ? legionAI.getDefenders(enemyFactionId, targetBase, characters).slice(0, 4)
          : [];

        return (
          <div style={{ width:'100vw', height:'100vh', background:'#000' }}>
            <BattleScene
              formation={sceneParams.formation}
              targetNode={targetBase}
              enemyChars={enemyChars}
              onComplete={async (result) => {
                // D-03: 攻撃戦で制圧した場合、battleEnd前に宣戦布告（制圧前のfactionIdを使う）
                if (result?.conquered) {
                  game.actions.declareWar(targetBase?.factionId);
                }
                const phase = await game.actions.battleEnd({
                  usedCharIds:     result?.usedCharIds    ?? [],
                  deadCharIds:     result?.deadCharIds    ?? [],
                  deadMobIds:      result?.deadMobIds     ?? [],
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
        return <PartyScene onNavigate={navigate} characters={characters} />;

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
          onResearch={(id) => game.actions.doResearch(id)}
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
      case 'dungeon':
        return <DungeonScene onNavigate={navigate} baseNode={sceneParams.baseNode} />;

      // ── 周回選択 ──
      case 'new_game_plus':
        return <NewGamePlusScene onNavigate={navigate} />;

      // ── 会話 ──
      case 'adv':
        return <ADVScene
          scenario={sceneParams.scenario ?? []}
          cast={sceneParams.cast ?? []}
          bg={sceneParams.bg ?? null}
          location={sceneParams.location ?? ''}
          transparent={sceneParams.transparent ?? false}
          onExit={() => {
            sceneParams._onComplete?.();
            navigate(sceneParams.returnTo ?? 'map');
          }}
          onChoice={(value) => sceneParams._onChoice?.(value)}
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
      {(defenseFlow?.phase === 'adv' || defenseFlow?.phase === 'abandon_confirm') && scene === 'map' && (
        <div style={{ position:'absolute', inset:0, zIndex:100 }}>
          <ADVScene
            key={`defense-adv-${defenseFlow.phase}`}
            scenario={defenseAdvConfig.scenario}
            cast={defenseAdvConfig.cast}
            bg={defenseAdvConfig.bg}
            location={defenseAdvConfig.location}
            transparent={true}
            onExit={() => {}}
            onChoice={handleDefenseAdvChoice}
          />
        </div>
      )}
    </div>
  );
}
