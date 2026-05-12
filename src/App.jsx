import { useState } from 'react';
import './App.css';

// シーンコンポーネント
import TitleScene        from './scenes/TitleScene.jsx';
import MapScene          from './scenes/MapScene.jsx';
import BaseMenuScene     from './scenes/BaseMenuScene.jsx';
import FormationScene    from './scenes/FormationScene.jsx';
import BattleScene       from './scenes/BattleScene.jsx';
import EnemyTurnScene    from './scenes/EnemyTurnScene.jsx';
import PartyScene        from './scenes/PartyScene.jsx';
import ItemsScene        from './scenes/ItemsScene.jsx';
import ResearchScene     from './scenes/ResearchScene.jsx';
import SaveScene         from './scenes/SaveScene.jsx';
import GameEndScene      from './scenes/GameEndScene.jsx';
import DungeonScene      from './scenes/DungeonScene.jsx';
import NewGamePlusScene  from './scenes/NewGamePlusScene.jsx';
import ADVScene          from './scenes/ADVScene.jsx';

// デモデータ（ゲームロジック統合前の仮データ）
import { CHARS } from './shared/tokens.js';

const DEMO_NODE_ENEMY = {
  id:'n2', name:'福島', type:'town', owner:'enemy', factionName:'大都市連合',
  troops:150, income:76, note:'敵勢力が支配する街。',
};
const DEMO_NODE_OWN = {
  id:'n1', name:'仙台', type:'city', owner:'player', factionName:'東北家',
  troops:600, income:200, note:'東北家の本拠地。',
};

export default function App() {
  const [scene, setScene]           = useState('title');
  const [sceneParams, setSceneParams] = useState({});

  const navigate = (dest, params = {}) => {
    setSceneParams(params);
    setScene(dest);
  };

  const renderScene = () => {
    switch (scene) {
      case 'title':
        return <TitleScene onNavigate={navigate} hasSaveData={true} hasNewGamePlus={false} />;

      case 'map':
        return <MapScene onNavigate={navigate} onAttackNode={() => navigate('formation')} />;

      case 'base_menu':
        return (
          <div style={{ width:'100vw', height:'100vh', position:'relative', background:'rgba(248,246,244,1)' }}>
            <BaseMenuScene
              node={sceneParams.node ?? DEMO_NODE_OWN}
              isOwned={sceneParams.isOwned ?? true}
              canAttack={sceneParams.canAttack ?? true}
              hasDungeon={sceneParams.hasDungeon ?? true}
              onNavigate={navigate}
              onClose={() => navigate('map')}
            />
          </div>
        );

      case 'formation':
        return (
          <FormationScene
            targetNode={sceneParams.targetNode ?? DEMO_NODE_ENEMY}
            onLaunch={() => navigate('battle')}
            onCancel={() => navigate('map')}
          />
        );

      case 'battle':
        return (
          <BattleScene
            formation={sceneParams.formation ?? { front1: CHARS[0], front2: CHARS[4], rear1: CHARS[3], rear2: CHARS[1] }}
            targetNode={sceneParams.targetNode ?? DEMO_NODE_ENEMY}
            onComplete={() => navigate('map')}
          />
        );

      case 'enemy_turn':
        return <EnemyTurnScene onComplete={() => navigate('map')} />;

      case 'characters':
        return <PartyScene onNavigate={navigate} />;

      case 'items':
        return <ItemsScene onNavigate={navigate} />;

      case 'research':
        return <ResearchScene onNavigate={navigate} />;

      case 'save':
        return (
          <div style={{ width:'100vw', height:'100vh', position:'relative', background:'rgba(248,246,244,1)' }}>
            <SaveScene mode={sceneParams.mode ?? 'save'} onClose={() => navigate('map')} onNavigate={navigate} />
          </div>
        );

      case 'game_end':
        return (
          <GameEndScene
            isVictory={sceneParams.isVictory ?? true}
            clearedCount={sceneParams.clearedCount ?? 0}
            hasNewGamePlus={sceneParams.hasNewGamePlus ?? false}
            onNavigate={navigate}
          />
        );

      case 'dungeon':
        return <DungeonScene onNavigate={navigate} />;

      case 'new_game_plus':
        return <NewGamePlusScene onNavigate={navigate} />;

      case 'adv':
        return (
          <ADVScene
            scenario={sceneParams.scenario ?? null}
            onExit={() => navigate(sceneParams.returnTo ?? 'map')}
          />
        );

      // 空実装（プレースホルダー）
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
