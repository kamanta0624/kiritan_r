/**
 * MapSceneWrapper.jsx
 *
 * MapScene（ClaudeDesign製）にゲームロジックのデータを注入するラッパー。
 * MapScene自体は変更しない。
 *
 * 役割:
 *   - useGame() からbases/factionsを取得
 *   - MapSceneのNODES形式に変換
 *   - ノードクリック → base_menu / formation への遷移
 */

import { useGame } from '../context/GameContext.jsx';
import MapScene from './MapScene.jsx';

// MapSceneのNODESに対応する座標マップ（bases.jsonにpx/pyが追加されるまでの暫定値）
const BASE_COORDS = {
  '仙台':     { px: 1900, py: 680  },
  '福島':     { px: 2060, py: 890  },
  '郡山':     { px: 2280, py: 620  },
  '会津':     { px: 1700, py: 480  },
  '白河':     { px: 2400, py: 990  },
  'いわき':   { px: 2570, py: 660  },
  '山形':     { px: 1640, py: 340  },
  '宇都宮':   { px: 2500, py: 1140 },
  '札幌':     { px: 680,  py: 700  },
  '函館':     { px: 880,  py: 1080 },
  '旭川':     { px: 520,  py: 400  },
  '帯広':     { px: 980,  py: 580  },
  '釧路':     { px: 1180, py: 790  },
  '青森':     { px: 1820, py: 120  },
  '盛岡':     { px: 2020, py: 240  },
  '秋田':     { px: 1500, py: 220  },
  '新潟':     { px: 1400, py: 780  },
  '前橋':     { px: 2350, py: 1200 },
  '小樽':     { px: 760,  py: 760  },
  '熊谷':     { px: 2420, py: 1260 },
};

export default function MapSceneWrapper({ onNavigate }) {
  const { bases, factions, playerFaction } = useGame();

  // bases.json → MapSceneのnode形式に変換
  // MapSceneのNODESは内部ハードコードなので、実際はMapScene側を後で修正する
  // 現在はMapSceneのonAttackNodeからnodeを受け取り、bases.jsonで対応するbaseを探して遷移する

  const handleAttackNode = (node) => {
    // nodeのnameからbases.jsonのbaseを検索
    const base = bases.find(b => b.name === node.name || b.name.startsWith(node.name.slice(0, 2)));
    onNavigate('formation', {
      targetBase: base ?? { id: node.id, name: node.name, factionId: 'unknown', battleCapacity: 400 },
    });
  };

  const handleNavigate = (dest, params) => {
    if (dest === 'base_menu') {
      // ノードクリックから拠点メニューへ
      const base = bases.find(b => b.name === params?.nodeName);
      const isOwned = base?.factionId === playerFaction?.id;
      onNavigate('base_menu', {
        node: {
          id:          base?.id ?? params?.nodeId,
          name:        params?.nodeName ?? '',
          type:        base?.type ?? 'town',
          owner:       isOwned ? 'player' : 'enemy',
          factionName: factions.find(f => f.id === base?.factionId)?.name ?? '不明',
          troops:      base?.soldiers ?? 0,
          income:      base?.income ?? 0,
          note:        base?.description ?? '',
          canAttack:   !isOwned,
        },
        isOwned,
        canAttack:  !isOwned,
        hasDungeon: !!base?.dungeonId,
      });
    } else {
      onNavigate(dest, params);
    }
  };

  return (
    <MapScene
      onNavigate={handleNavigate}
      onAttackNode={handleAttackNode}
    />
  );
}
