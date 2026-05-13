import { useState } from 'react';
import './App.css';
import { useGame } from './context/GameContext.jsx';

// シーンコンポーネント
import TitleScene       from './scenes/TitleScene.jsx';
import MapScene         from './scenes/MapScene.jsx';
import BaseMenuScene    from './scenes/BaseMenuScene.jsx';
import AttackFormationScene from './scenes/FormationScene.jsx';
import BattleScene      from './scenes/BattleScene.jsx'; // BActionScene (export default)
import EnemyTurnScene   from './scenes/EnemyTurnScene.jsx';
import PartyScene       from './scenes/PartyScene.jsx';
import ItemsScene       from './scenes/ItemsScene.jsx';
import ResearchScene    from './scenes/ResearchScene.jsx';
import SaveScene        from './scenes/SaveScene.jsx';
import GameEndScene     from './scenes/GameEndScene.jsx';
import DungeonScene     from './scenes/DungeonScene.jsx';
import NewGamePlusScene from './scenes/NewGamePlusScene.jsx';
import ADVScene         from './scenes/ADVScene.jsx';

export default function App() {
  const game = useGame();
  const [scene, setScene]             = useState('title');
  const [sceneParams, setSceneParams] = useState({});

  const navigate = (dest, params = {}) => {
    setSceneParams(params);
    setScene(dest);
  };

  // ── ゲームデータ派生値 ──
  const { currentTurn, playerFaction, playerBases, income, bases, factions, characters } = game;
  const gameState = {
    turn:   currentTurn,
    meme:   playerFaction?.treasury ?? 0,
    income,
    bases:  `${playerBases.length}/${bases.length}`,
  };

  // 自勢力の出撃可能キャラ（ペナルティなし・未使用）
  const availableChars = characters.filter(c =>
    c.factionId === playerFaction?.id &&
    !(c.penaltyTurns > 0) &&
    !c.usedThisTurn
  );

  const renderScene = () => {
    switch (scene) {

      // ── タイトル ──
      case 'title':
        return <TitleScene
          onNavigate={(dest, params) => {
            if (dest === 'map') game.actions.startNewGame();
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
            isOwned:   node.owner === 'player',
            canAttack: node.canAttack ?? node.owner !== 'player',
            hasDungeon: !!node.dungeonId,
          })}
          gameState={gameState}
          basesData={bases}
          factionsData={factions}
          onNextTurn={() => game.actions.nextTurn()}
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
                if (dest === 'formation') navigate('formation', { targetNode: sceneParams.node });
                else if (dest === 'dungeon') navigate('dungeon', { baseNode: sceneParams.node });
                else navigate(dest, params);
              }}
              onClose={() => navigate('map')}
            />
          </div>
        );

      // ── 攻撃編成 ──
      case 'formation':
        return <AttackFormationScene
          targetNode={sceneParams.targetNode}
          availableChars={availableChars}   // 実データ
          onLaunch={(formation) => navigate('battle', {
            formation,
            targetNode: sceneParams.targetNode,
          })}
          onCancel={() => navigate('map')}
        />;

      // ── 戦闘 ──
      case 'battle':
        return (
          <div style={{ width:'100vw', height:'100vh', background:'#000' }}>
            {/* BattleScene UI（BattleEngineV3接続は次フェーズ） */}
            <BattleScene
              round={1}
              formation={sceneParams.formation}
              targetNode={sceneParams.targetNode}
              onComplete={() => {
                game.actions.battleEnd({
                  usedCharIds:    Object.values(sceneParams.formation ?? {}).filter(Boolean).map(c => c.id),
                  deadCharIds:    [],
                  conquered:      false,
                  defenderBaseId: sceneParams.targetNode?.baseId,
                  winnerFactionId: playerFaction?.id,
                });
                navigate('map');
              }}
            />
          </div>
        );

      // ── 敵ターン演出 ──
      case 'enemy_turn':
        return <EnemyTurnScene onComplete={() => navigate('map')} />;

      // ── キャラクター ──
      case 'characters':
        return <PartyScene onNavigate={navigate} characters={characters} />;

      // ── アイテム ──
      case 'items':
        return <ItemsScene onNavigate={navigate} inventory={game.inventory} onRemoveItem={game.actions.removeItem} />;

      // ── 研究 ──
      case 'research':
        return <ResearchScene
          onNavigate={navigate}
          completedResearch={game.research}
          treasury={playerFaction?.treasury ?? 0}
          onResearch={(id, cost) => {
            game.actions.addResearch(id);
            game.actions.setTreasury(playerFaction.id, (playerFaction.treasury ?? 0) - cost);
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
          scenario={sceneParams.scenario ?? null}
          onExit={() => navigate(sceneParams.returnTo ?? 'map')}
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

  return <div id="app-root">{renderScene()}</div>;
}
