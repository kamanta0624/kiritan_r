/**
 * GameContext.jsx — ゲーム状態管理
 *
 * 全シーンからアクセスできるゲームデータと操作APIを提供する。
 * Phaser版のWorldMapSceneに相当する役割。
 */

import { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import { BuildingSystem } from '../game/systems/BuildingSystem.js';
import { ItemSystem }     from '../game/systems/ItemSystem.js';
import { BattleEngineV3 } from '../game/systems/BattleEngineV3.js';

// JSON data
import factionsData   from '../game/data/factions.json';
import basesData      from '../game/data/bases.json';
import charactersData from '../game/data/characters.json';
import itemsData      from '../game/data/items.json';
import skillsData     from '../game/data/skills.json';

// ────────────────────────────────────────────────
// 初期状態
// ────────────────────────────────────────────────

function createInitialState() {
  const characters = charactersData.characters
    .filter(c => c.status === 'active' && !c.isTemplate)
    .map(c => ({ ...c, penaltyTurns: c.penaltyTurns ?? 0, usedThisTurn: false }));

  const factions = factionsData.factions.map(f => ({
    ...f,
    treasury: f.treasury ?? 2000,
  }));

  return {
    currentTurn:       1,
    factions,
    bases:             basesData.bases.map(b => ({ ...b })),
    characters,
    inventory:         [],
    research:          [],
    eventFlags:        {},
    occurredEvents:    {},
    conqueredThisTurn: false,
  };
}

// ────────────────────────────────────────────────
// Reducer
// ────────────────────────────────────────────────

function gameReducer(state, action) {
  switch (action.type) {

    case 'LOAD_SAVE':
      return { ...state, ...action.payload };

    case 'START_NEW_GAME':
      return createInitialState();

    case 'NEXT_TURN': {
      const factions = state.factions.map(f => {
        if (!f.isPlayer) return f;
        const income = state.bases
          .filter(b => b.factionId === f.id)
          .reduce((s, b) => s + (b.income ?? 0), 0);
        return { ...f, treasury: (f.treasury ?? 0) + income };
      });
      const characters = state.characters.map(c => {
        const penalty   = Math.max(0, (c.penaltyTurns ?? 0) - 1);
        const recovering = penalty === 0 && (c.penaltyTurns ?? 0) > 0;
        const maxHp     = c.charMaxHp ?? 200;
        const maxSp     = c.maxSoldiers ?? 1000;
        return {
          ...c,
          penaltyTurns: penalty,
          usedThisTurn: false,
          charHp:   recovering
            ? Math.max(1, Math.floor(maxHp * 0.1))
            : Math.min((c.charHp ?? maxHp) + Math.max(1, Math.floor(maxHp * 0.05)), maxHp),
          soldiers: Math.min((c.soldiers ?? 0) + 50, maxSp),
        };
      });
      return { ...state, currentTurn: state.currentTurn + 1, factions, characters, conqueredThisTurn: false };
    }

    case 'BATTLE_END': {
      const { usedCharIds, deadCharIds, conquered, defenderBaseId, winnerFactionId } = action.payload;
      let characters = state.characters.map(c => ({
        ...c,
        usedThisTurn: usedCharIds.includes(c.id) ? true : c.usedThisTurn,
        penaltyTurns: deadCharIds.includes(c.id) && !(c.penaltyTurns > 0) ? 2 : c.penaltyTurns,
      }));
      const bases = conquered
        ? state.bases.map(b => b.id === defenderBaseId ? { ...b, factionId: winnerFactionId } : b)
        : state.bases;
      return {
        ...state, characters, bases,
        conqueredThisTurn: conquered || state.conqueredThisTurn,
      };
    }

    case 'UPDATE_CHAR':
      return {
        ...state,
        characters: state.characters.map(c =>
          c.id === action.payload.id ? { ...c, ...action.payload } : c
        ),
      };

    case 'SET_FLAG':
      return { ...state, eventFlags: { ...state.eventFlags, [action.payload.key]: action.payload.value } };

    case 'SET_TREASURY':
      return {
        ...state,
        factions: state.factions.map(f =>
          f.id === action.payload.factionId ? { ...f, treasury: action.payload.amount } : f
        ),
      };

    case 'ADD_RESEARCH':
      return { ...state, research: [...new Set([...state.research, action.payload.id])] };

    case 'ADD_ITEM':
      return { ...state, inventory: [...state.inventory, action.payload.item] };

    case 'REMOVE_ITEM':
      return { ...state, inventory: state.inventory.filter(i => i.instanceId !== action.payload.instanceId) };

    case 'CONQUER_BASE':
      return {
        ...state,
        bases: state.bases.map(b =>
          b.id === action.payload.baseId ? { ...b, factionId: action.payload.winnerFactionId } : b
        ),
        conqueredThisTurn: true,
      };

    default:
      return state;
  }
}

// ────────────────────────────────────────────────
// Context
// ────────────────────────────────────────────────

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, null, createInitialState);

  // ゲームシステム（レンダリング非依存なのでrefで持つ）
  const systemsRef = useRef(null);
  if (!systemsRef.current) {
    systemsRef.current = {
      buildingSystem: new BuildingSystem(),
      itemSystem:     new ItemSystem(),
      skills:         Object.fromEntries((skillsData.skills ?? []).map(s => [s.id, s])),
      items:          itemsData.items ?? [],
    };
  }

  // セーブ/ロード
  const save = useCallback((slot) => {
    const data = {
      currentTurn:    state.currentTurn,
      factions:       state.factions,
      bases:          state.bases,
      characters:     state.characters,
      inventory:      state.inventory,
      research:       state.research,
      eventFlags:     state.eventFlags,
      occurredEvents: state.occurredEvents,
      savedAt:        new Date().toISOString(),
    };
    localStorage.setItem(`kiritan_save_${slot}`, JSON.stringify(data));
  }, [state]);

  const load = useCallback((slot) => {
    const raw = localStorage.getItem(`kiritan_save_${slot}`);
    if (!raw) return false;
    try {
      dispatch({ type: 'LOAD_SAVE', payload: JSON.parse(raw) });
      return true;
    } catch { return false; }
  }, []);

  const getSaveSlots = useCallback(() =>
    [1, 2, 3].map(slot => {
      const raw = localStorage.getItem(`kiritan_save_${slot}`);
      if (!raw) return { slot, empty: true };
      try {
        const d = JSON.parse(raw);
        return { slot, empty: false, turn: d.currentTurn, savedAt: d.savedAt };
      } catch { return { slot, empty: true }; }
    }),
  []);

  // 派生値
  const playerFaction = state.factions.find(f => f.isPlayer);
  const playerBases   = state.bases.filter(b => b.factionId === playerFaction?.id);
  const income        = playerBases.reduce((s, b) => s + (b.income ?? 0), 0);

  const value = {
    ...state,
    playerFaction,
    playerBases,
    income,
    systems: systemsRef.current,
    dispatch,
    actions: {
      startNewGame:  ()           => dispatch({ type: 'START_NEW_GAME' }),
      nextTurn:      ()           => dispatch({ type: 'NEXT_TURN' }),
      battleEnd:     (result)     => dispatch({ type: 'BATTLE_END',    payload: result }),
      updateChar:    (char)       => dispatch({ type: 'UPDATE_CHAR',   payload: char }),
      setFlag:       (key, val)   => dispatch({ type: 'SET_FLAG',      payload: { key, value: val } }),
      setTreasury:   (fid, amt)   => dispatch({ type: 'SET_TREASURY',  payload: { factionId: fid, amount: amt } }),
      addResearch:   (id)         => dispatch({ type: 'ADD_RESEARCH',  payload: { id } }),
      addItem:       (item)       => dispatch({ type: 'ADD_ITEM',      payload: { item } }),
      removeItem:    (iid)        => dispatch({ type: 'REMOVE_ITEM',   payload: { instanceId: iid } }),
      conquerBase:   (bid, fid)   => dispatch({ type: 'CONQUER_BASE',  payload: { baseId: bid, winnerFactionId: fid } }),
      save, load, getSaveSlots,
    },
    buildBattleUnit: BattleEngineV3.buildUnit,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
