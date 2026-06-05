/**
 * GameContext.jsx — ゲーム状態管理
 *
 * kiritan（Phaser版）WorldMapSceneの全機能をReact useReducerで再実装。
 *
 * 対応機能:
 *   - LegionAI（敵軍団・モブ補充・攻撃キュー）
 *   - EventEngine（game_start / player_turn / enemy_turn / base_attack / base_conquered）
 *   - BuildingSystem（研究・収入ボーナス・maxSoldiers/charSong即時適用）
 *   - SaveSystem（v7互換 legions/eventFlags/occurredEvents/flagTimestamps）
 *   - 勝敗条件チェック（全敵首都制圧 / 自首都陥落）
 *   - 宣戦布告（declareWar）
 *   - 戦闘結果の完全書き戻し（charHp / soldiers）
 *   - ターン処理完全版（LegionAI.runDomestic / EventEngine / penaltyTurns / 回復）
 */

import { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { BuildingSystem } from '../game/systems/BuildingSystem.js';
import { ItemSystem }     from '../game/systems/ItemSystem.js';
import { LegionAI }       from '../game/systems/LegionAI.js';
import { EventEngine }    from '../game/systems/EventEngine.js';
import { BattleEngineV3 } from '../game/systems/BattleEngineV3.js';

import factionsData   from '../game/data/factions.json';
import basesData      from '../game/data/bases.json';
import charactersData from '../game/data/characters.json';
import itemsData      from '../game/data/items.json';
import skillsData     from '../game/data/skills.json';
import legionsData    from '../game/data/legions.json';
import researchData   from '../game/data/facilities.json';
import dungeonsData   from '../game/data/dungeons.json';

// ─────────────────────────────────────────────────────────────
// 初期状態生成
// ─────────────────────────────────────────────────────────────

function createInitialState() {
  // status 廃止: 加入判定は factionId に一元化。全非テンプレキャラを state に投入し、
  // factionId===null の在野キャラも charJoin で加入できるようにする（表示は factionId でゲート）。
  const characters = charactersData.characters
    .filter(c => !c.isTemplate)
    .map(c => ({
      ...c,
      penaltyTurns: c.penaltyTurns ?? 0,
      usedThisTurn: false,
      purchasedUpgrades: c.purchasedUpgrades ?? [],
    }));

  const factions = factionsData.factions.map(f => ({
    ...f,
    treasury:  f.treasury  ?? 2000,
    atWarWith: f.atWarWith ?? [],
    warFlags:  f.warFlags  ?? {},
  }));

  return {
    currentTurn:       1,
    factions,
    bases:             basesData.bases.map(b => ({ ...b, _originalFactionId: b.factionId })),
    characters,
    inventory:         (() => {
      const sys = new ItemSystem();
      const inv = [];
      itemsData.items
        .filter(item => item.startWithPlayer === true)
        .forEach(item => sys.addToInventory(inv, item.id));
      return inv;
    })(),
    buildings:         [],          // 研究済みID配列（kiritan: worldScene.buildings）
    dungeonProgress:   Object.fromEntries(
      dungeonsData.dungeons.map(d => [d.id, { clearedFloors: 0, isFullyCleared: false }])
    ),
    dungeonExploredThisTurn: false,
    eventFlags:        {},
    occurredEvents:    {},
    flagTimestamps:    {},
    conqueredThisTurn: false,
    hireCooldownUntil: 0,
    gamePhase:         'playing',   // 'playing' | 'victory' | 'defeat'
    actionPoints:      5,
    maxActionPoints:   5,
    researchQueue:     null,        // null | { id: string, turnsRemaining: number }
    upgradeUnlocks:    ['sp_refill', 'sp_max_up'],
    secretaryId:       null,        // null | charId string
  };
}

// ─────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────

function gameReducer(state, action) {
  switch (action.type) {

    case 'LOAD_SAVE':
      return { ...createInitialState(), ...action.payload };

    case 'START_NEW_GAME':
      return createInitialState();

    // ターン経過（収入・回復・penaltyTurns）
    // LegionAI.runDomestic / EventEngine はGameProviderの非同期処理で別途実行
    case 'NEXT_TURN': {
      const { incomeBonus, mobAdditions } = action.payload ?? {};

      const factions = state.factions.map(f => {
        if (!f.isPlayer) return f;
        const baseIncome = state.bases
          .filter(b => b.factionId === f.id)
          .reduce((s, b) => s + (b.income ?? 0), 0);
        return { ...f, treasury: (f.treasury ?? 0) + baseIncome + (incomeBonus ?? 0) };
      });

      // キャラ回復・ペナルティカウントダウン
      let characters = state.characters.map(c => {
        const penalty    = Math.max(0, (c.penaltyTurns ?? 0) - 1);
        const recovering = penalty === 0 && (c.penaltyTurns ?? 0) > 0;
        const maxHp      = c.charMaxHp ?? 200;
        const maxSp      = c.maxSoldiers ?? 1000;
        return {
          ...c,
          penaltyTurns: penalty,
          usedThisTurn: false,
          charHp: recovering
            ? Math.max(1, Math.floor(maxHp * 0.1))
            : Math.min((c.charHp ?? maxHp) + Math.max(1, Math.floor(
                c.recoveryRate !== undefined
                  ? maxHp * c.recoveryRate
                  : maxHp * 0.05
              )), maxHp),
          soldiers: Math.min(
            (c.soldiers ?? 0) + (c.recoveryRate !== undefined
              ? Math.floor((c.maxSoldiers ?? 1000) * c.recoveryRate)
              : 50),
            maxSp
          ),
        };
      });

      // LegionAIが生成した新規モブをcharactersに追加
      if (mobAdditions?.length) {
        characters = [...characters, ...mobAdditions];
      }

      // 行動力全回復
      const actionPoints = state.maxActionPoints ?? 5;

      // 研究キュー消化
      let researchQueue  = state.researchQueue  ?? null;
      let upgradeUnlocks = [...(state.upgradeUnlocks ?? [])];
      let eventFlags     = { ...(state.eventFlags ?? {}) };
      let buildings      = [...(state.buildings ?? [])];

      if (researchQueue !== null) {
        const remaining = researchQueue.turnsRemaining - 1;
        if (remaining <= 0) {
          const researchDef = researchData.research.find(r => r.id === researchQueue.id);
          if (researchDef?.unlocks?.upgradeCommands) {
            upgradeUnlocks = [...new Set([...upgradeUnlocks, ...researchDef.unlocks.upgradeCommands])];
          }
          if (researchDef?.unlocks?.flags) {
            researchDef.unlocks.flags.forEach(f => { eventFlags[f] = true; });
          }
          eventFlags[`${researchQueue.id}_done`] = true;
          buildings = [...buildings, researchQueue.id];
          researchQueue = null;
        } else {
          researchQueue = { ...researchQueue, turnsRemaining: remaining };
        }
      }

      return {
        ...state,
        currentTurn:       state.currentTurn + 1,
        factions,
        characters,
        conqueredThisTurn: false,
        dungeonExploredThisTurn: false,
        actionPoints,
        researchQueue,
        upgradeUnlocks,
        eventFlags,
        buildings,
      };
    }

    // 戦闘結果の完全書き戻し
    case 'BATTLE_END': {
      const {
        usedCharIds, deadCharIds, conquered,
        defenderBaseId, winnerFactionId,
        unitResults,   // [{ id, soldiers, charHp }] — 実際の戦闘後ステータス
        deadMobIds,
      } = action.payload;

      // unitResultsがあれば実値で上書き、なければpenaltyのみ
      const charMap = {};
      if (unitResults?.length) {
        unitResults.forEach(u => { charMap[u.id] = u; });
      }

      const characters = state.characters
        .filter(c => !(deadMobIds ?? []).includes(c.id))
        .map(c => {
          const result = charMap[c.id];
          return {
            ...c,
            usedThisTurn: usedCharIds.includes(c.id) ? true : c.usedThisTurn,
            soldiers:     result ? Math.max(0, result.soldiers) : c.soldiers,
            charHp:       result ? Math.max(0, result.charHp)   : c.charHp,
            penaltyTurns: (deadCharIds ?? []).includes(c.id) && !(c.penaltyTurns > 0)
              ? 2 : c.penaltyTurns,
          };
        });

      const bases = conquered
        ? state.bases.map(b =>
            b.id === defenderBaseId ? { ...b, factionId: winnerFactionId } : b
          )
        : state.bases;

      return {
        ...state,
        characters,
        bases,
        conqueredThisTurn: conquered || state.conqueredThisTurn,
      };
    }

    // イベントエフェクトのバルク適用（EventEngine経由）
    case 'APPLY_EFFECTS': {
      const { effects } = action.payload;
      let s = { ...state };
      effects.forEach(eff => { s = applyEffectToState(s, eff); });
      return s;
    }

    // 宣戦布告
    case 'DECLARE_WAR': {
      const { targetFactionId } = action.payload;
      const playerFaction = state.factions.find(f => f.isPlayer);
      if (!playerFaction) return state;
      const factions = state.factions.map(f => {
        if (f.id === playerFaction.id) {
          const atWarWith = f.atWarWith?.includes(targetFactionId)
            ? f.atWarWith
            : [...(f.atWarWith ?? []), targetFactionId];
          return { ...f, atWarWith };
        }
        if (f.id === targetFactionId) {
          const atWarWith = f.atWarWith?.includes(playerFaction.id)
            ? f.atWarWith
            : [...(f.atWarWith ?? []), playerFaction.id];
          return { ...f, atWarWith };
        }
        return f;
      });
      return { ...state, factions };
    }

    case 'UPDATE_CHAR':
      return {
        ...state,
        characters: state.characters.map(c =>
          c.id === action.payload.id ? { ...c, ...action.payload } : c
        ),
      };

    case 'SET_FLAG': {
      const { key, value } = action.payload;
      return {
        ...state,
        eventFlags: { ...state.eventFlags, [key]: value },
        ...(action.payload.withTimestamp
          ? { flagTimestamps: { ...state.flagTimestamps, [key]: state.currentTurn } }
          : {}),
      };
    }

    case 'CLEAR_FLAG': {
      const flags = { ...state.eventFlags };
      delete flags[action.payload.key];
      return { ...state, eventFlags: flags };
    }

    case 'INCREMENT_EVENT': {
      const { eventId } = action.payload;
      return {
        ...state,
        occurredEvents: {
          ...state.occurredEvents,
          [eventId]: (state.occurredEvents[eventId] ?? 0) + 1,
        },
      };
    }

    case 'SET_TREASURY':
      return {
        ...state,
        factions: state.factions.map(f =>
          f.id === action.payload.factionId
            ? { ...f, treasury: Math.max(0, action.payload.amount) }
            : f
        ),
      };

    case 'ADD_RESEARCH': {
      const { id, characterEffects } = action.payload;
      const research = [...new Set([...state.buildings, id])];
      // maxSoldiersBonus / charSongBonus の即時適用
      const characters = characterEffects?.length
        ? state.characters.map(c => {
            let updated = { ...c };
            characterEffects.forEach(eff => {
              if (eff.field in updated) {
                updated[eff.field] = (updated[eff.field] ?? 0) + eff.delta;
              }
            });
            return updated;
          })
        : state.characters;
      return { ...state, buildings: research, characters };
    }

    case 'ADD_MOB_CHARS': {
      // LegionAIが生成したモブをキャラ配列に追加
      const newIds = new Set(state.characters.map(c => c.id));
      const toAdd  = action.payload.mobs.filter(m => !newIds.has(m.id));
      return { ...state, characters: [...state.characters, ...toAdd] };
    }

    case 'ADD_ITEM':
      return { ...state, inventory: [...state.inventory, action.payload.item] };

    case 'REMOVE_ITEM':
      return {
        ...state,
        inventory: state.inventory.filter(i => i.id !== action.payload.instanceId),
      };

    case 'CONQUER_BASE':
      return {
        ...state,
        bases: state.bases.map(b =>
          b.id === action.payload.baseId
            ? { ...b, factionId: action.payload.winnerFactionId }
            : b
        ),
        conqueredThisTurn: true,
      };

    case 'SET_GAME_PHASE':
      return { ...state, gamePhase: action.payload.phase };

    case 'SET_RESEARCH_QUEUE':
      return { ...state, researchQueue: action.payload };

    case 'SET_ACTION_POINTS':
      return { ...state, actionPoints: Math.max(0, action.payload) };

    case 'SET_SECRETARY':
      return { ...state, secretaryId: action.payload };

    case 'LOAD_SAVE_MOBS': {
      // セーブロード後のモブスロット復元でcharactersを更新
      const savedMobs = action.payload.mobs;
      const baseChars = state.characters.filter(c => !c._isMobInstance);
      return { ...state, characters: [...baseChars, ...savedMobs] };
    }

    case 'DUNGEON_FLOOR_CLEAR': {
      const { dungeonId, clearedFloors, isFullyCleared, rewardItem } = action.payload;
      return {
        ...state,
        dungeonProgress: {
          ...state.dungeonProgress,
          [dungeonId]: { clearedFloors, isFullyCleared },
        },
        inventory: rewardItem ? [...state.inventory, rewardItem] : state.inventory,
      };
    }

    case 'DUNGEON_EXPLORED':
      return { ...state, dungeonExploredThisTurn: true };

    case 'DUNGEON_DEFEAT': {
      const { charId } = action.payload;
      return {
        ...state,
        characters: state.characters.map(c =>
          c.id !== charId ? c : {
            ...c,
            charHp:       1,
            soldiers:     0,
            penaltyTurns: 2,
            usedThisTurn: true,
          }
        ),
      };
    }

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────
// イベントエフェクトをstateに適用（純粋関数版）
// EventEngine._applyEffect の純粋関数移植
// ─────────────────────────────────────────────────────────────

// applyEffectToState が純粋に畳み込める（=APPLY_EFFECTS に載せられる）エフェクト種別。
// ここに無い種別（itemGain / legion系）は applyEffects オーケストレータが副作用として個別処理する。
const PURE_EFFECT_TYPES = new Set([
  'treasury', 'charJoin', 'charLeave', 'charParam', 'baseIncome', 'battleCap',
  'baseTransfer', 'warFlag', 'attackUnlock', 'setFlag', 'setFlagWithTurn', 'clearFlag',
  'actionPointsBonus', 'dungeonUnlock', 'charUsedThisTurn', 'baseTransferSingle', 'itemLose',
]);

function applyEffectToState(state, eff) {
  const playerFaction = state.factions.find(f => f.isPlayer);
  switch (eff.type) {
    case 'treasury': {
      const fid = eff.factionId ?? playerFaction?.id;
      return {
        ...state,
        factions: state.factions.map(f =>
          f.id === fid ? { ...f, treasury: Math.max(0, (f.treasury ?? 0) + eff.delta) } : f
        ),
      };
    }
    case 'charJoin': {
      return {
        ...state,
        characters: state.characters.map(c =>
          c.id === eff.charId
            ? { ...c, factionId: eff.factionId ?? playerFaction?.id }
            : c
        ),
      };
    }
    case 'charLeave': {
      return {
        ...state,
        characters: state.characters.map(c =>
          c.id === eff.charId ? { ...c, factionId: null } : c
        ),
      };
    }
    case 'charParam': {
      return {
        ...state,
        characters: state.characters.map(c => {
          if (c.id !== eff.charId) return c;
          let val = (c[eff.field] ?? 0) + eff.delta;
          if (eff.min !== undefined) val = Math.max(eff.min, val);
          if (eff.field === 'charHp') val = Math.min(val, c.charMaxHp ?? 200);
          return { ...c, [eff.field]: val };
        }),
      };
    }
    case 'baseIncome': {
      return {
        ...state,
        bases: state.bases.map(b =>
          b.id === eff.baseId ? { ...b, income: Math.max(0, b.income + eff.delta) } : b
        ),
      };
    }
    case 'battleCap': {
      return {
        ...state,
        bases: state.bases.map(b =>
          b.id === eff.baseId
            ? { ...b, battleCapacity: Math.max(100, b.battleCapacity + eff.delta) }
            : b
        ),
      };
    }
    case 'baseTransfer': {
      const to = eff.toFactionId ?? playerFaction?.id;
      return {
        ...state,
        bases: state.bases.map(b =>
          b.factionId === eff.fromFactionId ? { ...b, factionId: to } : b
        ),
      };
    }
    case 'warFlag': {
      if (!playerFaction) return state;
      if (eff.atWar) {
        return gameReducer(state, { type: 'DECLARE_WAR', payload: { targetFactionId: eff.factionId } });
      }
      return {
        ...state,
        factions: state.factions.map(f => {
          if (f.id === playerFaction.id) {
            return { ...f, atWarWith: (f.atWarWith ?? []).filter(id => id !== eff.factionId) };
          }
          if (f.id === eff.factionId) {
            return { ...f, atWarWith: (f.atWarWith ?? []).filter(id => id !== playerFaction.id) };
          }
          return f;
        }),
      };
    }
    case 'attackUnlock':
      return gameReducer(state, { type: 'DECLARE_WAR', payload: { targetFactionId: eff.factionId } });
    case 'setFlag':
      return { ...state, eventFlags: { ...state.eventFlags, [eff.flag]: true } };
    case 'setFlagWithTurn':
      return {
        ...state,
        eventFlags:     { ...state.eventFlags, [eff.flag]: true },
        flagTimestamps: { ...state.flagTimestamps, [eff.flag]: state.currentTurn },
      };
    case 'clearFlag': {
      const flags = { ...state.eventFlags };
      delete flags[eff.flag];
      return { ...state, eventFlags: flags };
    }
    case 'actionPointsBonus': {
      return {
        ...state,
        maxActionPoints: (state.maxActionPoints ?? 5) + (eff.delta ?? 1),
      };
    }
    // ── EventEngine._applyEffect からの純粋移植（Phase 1）──
    case 'dungeonUnlock': {
      return {
        ...state,
        bases: state.bases.map(b =>
          b.id === eff.baseId ? { ...b, dungeonUnlocked: true } : b
        ),
      };
    }
    case 'charUsedThisTurn': {
      return {
        ...state,
        characters: state.characters.map(c =>
          c.id === eff.charId ? { ...c, usedThisTurn: true } : c
        ),
      };
    }
    case 'baseTransferSingle': {
      return {
        ...state,
        bases: state.bases.map(b =>
          b.id === eff.baseId ? { ...b, factionId: eff.toFactionId } : b
        ),
      };
    }
    // itemId指定で先頭1件を除去（EventEngine版と同セマンティクス）。
    // reduce畳み込みのため、同一バッチ内の複数itemLoseも順次正しく解決される。
    case 'itemLose': {
      const idx = state.inventory.findIndex(i => i.itemId === eff.itemId);
      if (idx === -1) return state;
      return {
        ...state,
        inventory: [...state.inventory.slice(0, idx), ...state.inventory.slice(idx + 1)],
      };
    }
    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────
// セーブ・シリアライズ（SaveSystem v7互換）
// ─────────────────────────────────────────────────────────────

const SAVE_VERSION  = 9;
const STORAGE_KEY   = slot => `kiritan_save_${slot}`;

function serializeState(state, legionAI) {
  return {
    version:           SAVE_VERSION,
    savedAt:           new Date().toISOString(),
    currentTurn:       state.currentTurn,
    hireCooldownUntil: state.hireCooldownUntil ?? 0,
    conqueredThisTurn: state.conqueredThisTurn,
    factions: state.factions.map(f => ({
      id:        f.id,
      treasury:  f.treasury,
      isPlayer:  f.isPlayer,
      atWarWith: f.atWarWith ?? [],
      warFlags:  f.warFlags  ?? {},
    })),
    bases: state.bases.map(b => ({
      id: b.id, factionId: b.factionId, income: b.income,
    })),
    buildings:  [...(state.buildings ?? [])],
    characters: state.characters.map(c => {
      const base = {
        id:                c.id,
        factionId:         c.factionId,
        soldiers:          c.soldiers,
        maxSoldiers:       c.maxSoldiers,
        usedThisTurn:      c.usedThisTurn,
        charHp:            c.charHp,
        charMaxHp:         c.charMaxHp,
        penaltyTurns:      c.penaltyTurns ?? 0,
        equipment:         { item: c.equipment?.item ?? null },
        purchasedUpgrades: c.purchasedUpgrades ?? [],
        charSong:          c.charSong,
        _spMaxUpCostMult:  c._spMaxUpCostMult,
      };
      if (c._isMobInstance) {
        return {
          ...base,
          _isMobInstance: true,
          _legionId:    c._legionId   ?? null,
          _slotId:      c._slotId     ?? null,
          name:         c.name,
          displayName:  c.displayName ?? c.name,
          role:         c.role,
          attackType:   c.attackType,
          isLeader:     c.isLeader    ?? false,
          charAttack:   c.charAttack,
          charDefense:  c.charDefense ?? 0,
          soldierAtk:   c.soldierAtk,
          soldierDef:   c.soldierDef,
          recoveryRate: c.recoveryRate ?? 0.05,
          description:  c.description  ?? '',
          battleBonus:  c.battleBonus  ?? null,
        };
      }
      return base;
    }),
    actionPoints:    state.actionPoints    ?? 5,
    maxActionPoints: state.maxActionPoints ?? 5,
    researchQueue:   state.researchQueue   ?? null,
    upgradeUnlocks:  state.upgradeUnlocks  ?? ['sp_refill', 'sp_max_up'],
    secretaryId:     state.secretaryId     ?? null,
    inventory:      (state.inventory ?? []).map(i => ({ id: i.id, itemId: i.itemId })),
    legions:        legionAI ? legionAI.serializeMobSlots() : [],
    dungeonProgress: state.dungeonProgress ?? {},
    eventFlags:     { ...(state.eventFlags     ?? {}) },
    occurredEvents: { ...(state.occurredEvents ?? {}) },
    flagTimestamps: { ...(state.flagTimestamps ?? {}) },
  };
}

function deserializeToState(data, itemSystem) {
  const allDefs = charactersData.characters;
  const restoredChars = [];

  data.characters?.forEach(saved => {
    if (saved._isMobInstance) {
      restoredChars.push({
        ...saved,
        usedThisTurn: saved.usedThisTurn ?? false,
        charDefense:  saved.charDefense  ?? 0,
        recoveryRate: saved.recoveryRate ?? 0.05,
        penaltyTurns: saved.penaltyTurns ?? 0,
        equipment:    { item: saved.equipment?.item ?? null },
        battleBonus:  saved.battleBonus ?? null,
      });
      return;
    }
    const def = allDefs.find(c => c.id === saved.id);
    if (!def) return;
    restoredChars.push({
      ...JSON.parse(JSON.stringify(def)),
      factionId:         saved.factionId,
      soldiers:          saved.soldiers,
      maxSoldiers:       saved.maxSoldiers,
      usedThisTurn:      saved.usedThisTurn      ?? false,
      charHp:            saved.charHp            ?? def.charMaxHp,
      charMaxHp:         saved.charMaxHp         ?? def.charMaxHp,
      penaltyTurns:      saved.penaltyTurns      ?? 0,
      equipment:         { item: saved.equipment?.item ?? null },
      purchasedUpgrades: saved.purchasedUpgrades ?? [],
      charSong:          saved.charSong          ?? def.charSong,
      _spMaxUpCostMult:  saved._spMaxUpCostMult,
    });
  });

  const factions = factionsData.factions.map(f => {
    const saved = data.factions?.find(sf => sf.id === f.id);
    if (!saved) return { ...f, atWarWith: [], warFlags: {} };
    return { ...f, treasury: saved.treasury, atWarWith: saved.atWarWith ?? [], warFlags: saved.warFlags ?? {} };
  });

  const bases = basesData.bases.map(b => {
    const saved = data.bases?.find(sb => sb.id === b.id);
    return saved ? { ...b, factionId: saved.factionId, income: saved.income } : { ...b };
  }).map(b => ({ ...b, _originalFactionId: b._originalFactionId ?? b.factionId }));

  const inventory = itemSystem
    ? itemSystem.deserializeInventory(data.inventory ?? [])
    : (data.inventory ?? []);

  return {
    currentTurn:       data.currentTurn       ?? 1,
    hireCooldownUntil: data.hireCooldownUntil ?? 0,
    conqueredThisTurn: data.conqueredThisTurn ?? false,
    actionPoints:    data.actionPoints    ?? 5,
    maxActionPoints: data.maxActionPoints ?? 5,
    researchQueue:   data.researchQueue   ?? null,
    upgradeUnlocks:  data.upgradeUnlocks  ?? ['sp_refill', 'sp_max_up'],
    secretaryId:     data.secretaryId     ?? null,
    factions,
    bases,
    characters:     restoredChars,
    inventory,
    buildings:      data.buildings      ?? [],
    dungeonProgress: data.dungeonProgress ?? Object.fromEntries(
      dungeonsData.dungeons.map(d => [d.id, { clearedFloors: 0, isFullyCleared: false }])
    ),
    dungeonExploredThisTurn: false,
    eventFlags:     data.eventFlags     ?? {},
    occurredEvents: data.occurredEvents ?? {},
    flagTimestamps: data.flagTimestamps ?? {},
    gamePhase:      'playing',
  };
}

// ─────────────────────────────────────────────────────────────
// 勝敗条件チェック（純粋関数）
// ─────────────────────────────────────────────────────────────

function checkVictoryCondition(state) {
  const playerFaction = state.factions.find(f => f.isPlayer);
  if (!playerFaction) return null;

  // 自首都陥落 → 敗北
  const playerCapitalLost = state.bases.some(
    b => b.isCapital
      && b._originalFactionId === playerFaction.id
      && b.factionId !== playerFaction.id
  );
  if (playerCapitalLost) return 'defeat';

  // シナリオ勝利条件: ボーカル界制圧フラグ
  if (state.eventFlags?.flag_vocalo_conquered) return 'victory';

  // 全敵首都制圧 → 勝利
  const enemyCapitals = state.bases.filter(
    b => b.isCapital && b._originalFactionId !== playerFaction.id
  );
  if (enemyCapitals.length > 0 && enemyCapitals.every(b => b.factionId === playerFaction.id)) {
    return 'victory';
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, null, createInitialState);

  // ゲームシステム（レンダリング非依存・refで保持）
  const systemsRef = useRef(null);
  if (!systemsRef.current) {
    systemsRef.current = {
      buildingSystem: new BuildingSystem(),
      itemSystem:     new ItemSystem(),
      skills:         Object.fromEntries((skillsData.skills ?? []).map(s => [s.id, s])),
      items:          itemsData.items ?? [],
    };
  }

  // LegionAI（stateのcharactersへの参照を保持するため都度再構築が必要）
  // stateのcharacters配列をlegionAIに渡す疑似参照用
  const legionAIRef = useRef(null);
  const stateRef    = useRef(state);
  stateRef.current  = state;

  // LegionAI初期化（初回のみ）
  useEffect(() => {
    if (legionAIRef.current) return;
    const charsMutable = [...stateRef.current.characters];
    legionAIRef.current = new LegionAI(
      stateRef.current.factions,
      stateRef.current.bases,
      charsMutable,
      JSON.parse(JSON.stringify(legionsData.legions))
    );
    // 初回モブ生成をstateに反映
    const newMobs = charsMutable.filter(
      c => c._isMobInstance && !stateRef.current.characters.some(sc => sc.id === c.id)
    );
    if (newMobs.length) {
      dispatch({ type: 'ADD_MOB_CHARS', payload: { mobs: newMobs } });
    }
  }, []);

  // startDialog ハンドラ（App.jsx が setStartDialogHandler で登録する）
  const startDialogRef = useRef(null);
  const setStartDialogHandler = useCallback((fn) => {
    startDialogRef.current = fn;
  }, []);

  // applyEffects はこの後方で宣言されるため、buildWsAdapter から直接参照するとTDZになる。
  // startDialogRef と同じref経由で配線し、useEffectで .current を同期する。
  const applyEffectsRef = useRef(null);

  // LegionAIの参照データを常に最新stateで同期
  // （LegionAIはcharacters配列への参照を内部で保持するため更新が必要）
  const syncLegionAI = useCallback(() => {
    const ai = legionAIRef.current;
    if (!ai) return;
    ai.factions   = stateRef.current.factions;
    ai.bases      = stateRef.current.bases;
    ai.characters = stateRef.current.characters;
  }, []);

  // EventEngine用のworldSceneアダプタ（GameContextのAPIをWorldMapScene互換に変換）
  const buildWsAdapter = useCallback(() => {
    const s   = stateRef.current;
    const pf  = s.factions.find(f => f.isPlayer);
    return {
      currentTurn:    s.currentTurn,
      factions:       s.factions,
      bases:          s.bases,
      characters:     s.characters,
      inventory:      s.inventory,
      buildings:      s.buildings,
      eventFlags:     s.eventFlags,
      occurredEvents: s.occurredEvents,
      flagTimestamps: s.flagTimestamps,
      legionAI:       legionAIRef.current,
      // EventEngine が委譲するエフェクト適用（Phase 4）。GameContext.applyEffects 経由で
      // 純粋分=APPLY_EFFECTS dispatch、itemGain/legion系=副作用処理に正規ルーティングされる。
      applyEffects: (effects) => applyEffectsRef.current?.(effects),
      declareWar: (factionId) => {
        dispatch({ type: 'DECLARE_WAR', payload: { targetFactionId: factionId } });
      },
      // 新契約: { script, effects } を渡す。effects 適用は ADV 内部（applyEffects）に一本化。
      // 直列化のため、ダイアログが閉じる（onExit）まで解決しない Promise を返す。
      startDialog: ({ script, effects } = {}) => new Promise(resolve => {
        if (startDialogRef.current) {
          startDialogRef.current(script, effects, resolve);
        } else {
          resolve();
        }
      }),
      // scene/refreshMap は旧Phaser名残。委譲後はGameContext applyEffects がReact再レンダを
      // 起こすため不要だが、wsアダプタ互換のため null のまま残置。
      scene:       null,
      refreshMap:  null,
      itemSystem:  systemsRef.current.itemSystem,
    };
  }, []);

  // ─────────────────────────────────────
  // ターン処理（非同期・完全版）
  // ─────────────────────────────────────

  // フェーズA: 敵ターン全体準備（runDomestic + enemy_turn イベント + attackQueue構築）
  // before_faction_turn は runEnemyPhaseForFaction で勢力ごとに発火する
  const runEnemyPhase = useCallback(async () => {
    syncLegionAI();
    const ai = legionAIRef.current;
    const s  = stateRef.current;
    const pf = s.factions.find(f => f.isPlayer);

    if (ai) ai.runDomestic();

    const wsAdapter = buildWsAdapter();
    await EventEngine.processTrigger(wsAdapter, 'enemy_turn', {});

    const attackQueue = ai ? ai.buildAttackQueue(pf?.id) : [];
    return attackQueue;
  }, [syncLegionAI, buildWsAdapter]);

  // 指定勢力の before_faction_turn イベント発火（攻撃キューは buildAttackQueue 済みの全体から App.jsx でフィルタ）
  const runEnemyPhaseForFaction = useCallback(async (factionId) => {
    const wsAdapter = buildWsAdapter();
    await EventEngine.processTrigger(wsAdapter, 'before_faction_turn', { factionId });
  }, [buildWsAdapter]);

  // フェーズB: プレイヤーターン開始（NEXT_TURN dispatch + 収入・回復）
  // 全防衛キュー完了後に呼ぶ
  const startPlayerTurn = useCallback(async () => {
    syncLegionAI();
    const ai = legionAIRef.current;
    const bs = systemsRef.current.buildingSystem;
    const s  = stateRef.current;

    const incomeBonus = bs.getIncomeBonus(s.buildings);

    const existingIds  = new Set(s.characters.map(c => c.id));
    const mobAdditions = ai
      ? ai.characters.filter(c => c._isMobInstance && !existingIds.has(c.id))
      : [];

    // flushSync で NEXT_TURN を同期反映してから wsAdapter を構築する。
    // stateRef.current はレンダ本体で同期されるため、flushSync なしだと dispatch 直後の
    // buildWsAdapter() は currentTurn 反映前（表示ターン−1）の値で player_turn 条件を評価し、
    // turn 条件イベントが1ターン遅延する。flushSync で再レンダを強制し stateRef を確定させる。
    flushSync(() => dispatch({ type: 'NEXT_TURN', payload: { incomeBonus, mobAdditions } }));

    const wsAdapter = buildWsAdapter();
    await EventEngine.processTrigger(wsAdapter, 'player_turn', {});
  }, [syncLegionAI, buildWsAdapter]);

  // ─────────────────────────────────────
  // ゲーム開始時イベント
  // ─────────────────────────────────────

  const startNewGame = useCallback(async () => {
    // flushSync で START_NEW_GAME を同期反映し、game_start 発火前に stateRef を確定させる。
    // startPlayerTurn と同型の欠陥（dispatch 直後の buildWsAdapter が反映前 state を読む）を
    // game_start 側にも残さない（条件付き game_start を追加した際の遅延を未然に防ぐ）。
    flushSync(() => dispatch({ type: 'START_NEW_GAME' }));
    // LegionAI再初期化
    legionAIRef.current = null;
    // useEffectで再初期化されるが、即時反映のため
    const charsMutable = createInitialState().characters;
    legionAIRef.current = new LegionAI(
      factionsData.factions,
      basesData.bases,
      charsMutable,
      JSON.parse(JSON.stringify(legionsData.legions))
    );
    const newMobs = charsMutable.filter(c => c._isMobInstance);
    if (newMobs.length) {
      flushSync(() => dispatch({ type: 'ADD_MOB_CHARS', payload: { mobs: newMobs } }));
    }
    // game_startイベント発火（dispatch後に呼ぶこと）
    const ws = buildWsAdapter();
    await EventEngine.processTrigger(ws, 'game_start', {});
  }, [buildWsAdapter]);

  // ─────────────────────────────────────
  // 戦闘終了処理
  // ─────────────────────────────────────

  const battleEnd = useCallback(async (result) => {
    syncLegionAI();
    const ai = legionAIRef.current;

    // モブ死亡通知
    if (result.deadMobIds?.length && ai) {
      result.deadMobIds.forEach(id => ai.onMobDeath(id));
    }

    dispatch({ type: 'BATTLE_END', payload: result });

    // EventEngine 発火用 ws。制圧フラグを先付けし、base_conquered/battle_end 双方から参照可能にする。
    const ws = buildWsAdapter();
    if (result.conquered) {
      ws.eventFlags = {
        ...ws.eventFlags,
        [`conquered_${result.defenderBaseId}`]: true,
      };
    }

    // 制圧時: EventEngine base_conquered
    if (result.conquered) {
      await EventEngine.processTrigger(ws, 'base_conquered', {
        baseId:             result.defenderBaseId,
        conquerorFactionId: result.winnerFactionId,
      });
      dispatch({ type: 'SET_FLAG', payload: { key: `conquered_${result.defenderBaseId}`, value: true } });
    }

    // battle_end（制圧有無に関わらず発火）
    await EventEngine.processTrigger(ws, 'battle_end', {
      conquered:       result.conquered ?? false,
      defenderBaseId:  result.defenderBaseId,
      winnerFactionId: result.winnerFactionId,
    });

    // char_defeated（撃破された非モブ敵キャラごとに直列発火）。
    // ctxキー defeatedCharId は _evalCondition の defeatedChar 判定と厳密一致。
    for (const defeatedCharId of (result.defeatedEnemyCharIds ?? [])) {
      await EventEngine.processTrigger(ws, 'char_defeated', { defeatedCharId });
    }

    // 勝敗チェック
    const nextState = {
      ...stateRef.current,
      conqueredThisTurn: result.conquered || stateRef.current.conqueredThisTurn,
      bases: result.conquered
        ? stateRef.current.bases.map(b =>
            b.id === result.defenderBaseId ? { ...b, factionId: result.winnerFactionId } : b
          )
        : stateRef.current.bases,
    };
    const phase = checkVictoryCondition(nextState);
    if (phase) {
      dispatch({ type: 'SET_GAME_PHASE', payload: { phase } });
    }

    return phase;
  }, [syncLegionAI, buildWsAdapter]);

  // ─────────────────────────────────────
  // 攻撃開始前イベント
  // ─────────────────────────────────────

  const beforeAttack = useCallback(async (defenderBaseId, attackerFactionId) => {
    const ws = buildWsAdapter();
    await EventEngine.processTrigger(ws, 'base_attack', { baseId: defenderBaseId });
  }, [buildWsAdapter]);

  // ─────────────────────────────────────
  // 汎用trigger発火口（Phase 3）
  // App.jsx 等の非公開buildWsAdapterに触れない呼び出し元のための共通口。
  // 既存5系統と同じ buildWsAdapter 経由（applyEffects委譲済のため副作用も正規経路）。
  // ─────────────────────────────────────
  const fireTrigger = useCallback(async (trigger, ctx = {}) => {
    const ws = buildWsAdapter();
    await EventEngine.processTrigger(ws, trigger, ctx);
  }, [buildWsAdapter]);

  // ─────────────────────────────────────
  // theater イベント（Phase 5）
  // buildWsAdapter は非公開のまま、ws 取得を GameContext 内に閉じる。
  // ─────────────────────────────────────

  // 発生可能な theater イベント（条件・出現上限を満たす EventDef 配列、優先度順）を返す。
  const getTheaterEvents = useCallback(() => {
    const ws = buildWsAdapter();
    return EventEngine.getAvailableTheaterEvents(ws);
  }, [buildWsAdapter]);

  // theater イベントを起動可能な状態にする。出現回数を記録し、起動対象 EventDef を返す。
  // ADV 起動・戻り先制御は呼び出し元（App）が onExit に閉じる（Phase 2 方針）。
  const runTheaterEvent = useCallback((eventId) => {
    const ws = buildWsAdapter();
    const ev = EventEngine.getAvailableTheaterEvents(ws).find(e => e.id === eventId);
    if (!ev) return null;
    // maxOccurrences 判定のため出現回数を加算（_runEvent 相当）
    dispatch({ type: 'INCREMENT_EVENT', payload: { eventId: ev.id } });
    return ev;
  }, [buildWsAdapter]);

  // ─────────────────────────────────────
  // 研究実行
  // ─────────────────────────────────────

  const doResearch = useCallback((researchId) => {
    const bs  = systemsRef.current.buildingSystem;
    const s   = stateRef.current;
    const pf  = s.factions.find(f => f.isPlayer);
    const def = bs.getDef(researchId);
    if (!def || !pf || pf.treasury < def.cost) return false;
    if (s.buildings.includes(researchId)) return false;

    dispatch({ type: 'SET_TREASURY', payload: { factionId: pf.id, amount: pf.treasury - def.cost } });
    dispatch({ type: 'ADD_RESEARCH', payload: { id: researchId, characterEffects: [] } });
    return true;
  }, []);

  const purchaseUpgrade = useCallback((charId, cmdId) => {
    const bs  = systemsRef.current.buildingSystem;
    const cmd = bs.upgradeCommands?.find(c => c.id === cmdId);
    if (!cmd) return false;
    const s  = stateRef.current;
    const pf = s.factions.find(f => f.isPlayer);
    if (!pf || pf.treasury < cmd.cost) return false;
    const char = s.characters.find(c => c.id === charId);
    if (!char) return false;

    const purchased = (char.purchasedUpgrades ?? []).filter(id => id === cmdId).length;
    if (cmd.maxPurchase != null && purchased >= cmd.maxPurchase) return false;

    dispatch({ type: 'SET_TREASURY', payload: { factionId: pf.id, amount: pf.treasury - cmd.cost } });

    const updatedChar = {
      ...char,
      purchasedUpgrades: [...(char.purchasedUpgrades ?? []), cmdId],
    };
    cmd.effects.forEach(eff => {
      if (eff.type === 'charSong')        updatedChar.charSong        = (updatedChar.charSong ?? 0) + eff.delta;
      if (eff.type === 'maxSoldiers')     updatedChar.maxSoldiers     = (updatedChar.maxSoldiers ?? 1000) + eff.delta;
      if (eff.type === 'spMaxUpCostMult') updatedChar._spMaxUpCostMult = ((updatedChar._spMaxUpCostMult ?? 1.0) + eff.delta);
    });
    dispatch({ type: 'UPDATE_CHAR', payload: updatedChar });
    return true;
  }, []);

  // ─────────────────────────────────────
  // セーブ・ロード
  // ─────────────────────────────────────

  const save = useCallback((slot) => {
    try {
      const data = serializeState(stateRef.current, legionAIRef.current);
      localStorage.setItem(STORAGE_KEY(slot), JSON.stringify(data));
      return true;
    } catch (e) { console.error('[GameContext] save failed:', e); return false; }
  }, []);

  const load = useCallback((slot) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(slot));
      if (!raw) return false;
      const data    = JSON.parse(raw);
      const newState = deserializeToState(data, systemsRef.current.itemSystem);
      dispatch({ type: 'LOAD_SAVE', payload: newState });

      // LegionAI再初期化
      const charsMutable = [...newState.characters];
      legionAIRef.current = new LegionAI(
        newState.factions,
        newState.bases,
        charsMutable,
        JSON.parse(JSON.stringify(legionsData.legions))
      );
      // モブスロット復元
      if (data.legions?.length) {
        legionAIRef.current.deserializeMobSlots(data.legions);
      }
      // 復元後のモブcharをstateに反映
      const baseIds = new Set(newState.characters.map(c => c.id));
      const restoredMobs = charsMutable.filter(c => c._isMobInstance && !baseIds.has(c.id));
      if (restoredMobs.length) {
        dispatch({ type: 'ADD_MOB_CHARS', payload: { mobs: restoredMobs } });
      }
      return true;
    } catch (e) { console.error('[GameContext] load failed:', e); return false; }
  }, []);

  const getSaveSlots = useCallback(() =>
    [1, 2, 3].map(slot => {
      const raw = localStorage.getItem(STORAGE_KEY(slot));
      if (!raw) return { slot, empty: true };
      try {
        const d = JSON.parse(raw);
        const pf = d.factions?.find(f => f.isPlayer);
        return {
          slot,
          empty:   false,
          turn:    d.currentTurn,
          savedAt: d.savedAt,
          bases:   `${d.bases?.filter(b => pf && b.factionId === pf.id).length ?? 0}`,
        };
      } catch { return { slot, empty: true }; }
    }),
  []);

  // ─────────────────────────────────────
  // 宣戦布告
  // ─────────────────────────────────────

  const declareWar = useCallback((targetFactionId) => {
    dispatch({ type: 'DECLARE_WAR', payload: { targetFactionId } });
  }, []);

  const isAtWar = useCallback((targetFactionId) => {
    const pf = stateRef.current.factions.find(f => f.isPlayer);
    return pf?.atWarWith?.includes(targetFactionId) ?? false;
  }, []);

  // ─────────────────────────────────────
  // イベントエフェクト適用オーケストレータ（Phase 1）
  // 純粋分は APPLY_EFFECTS 一括dispatchへ、副作用分は専用action / ref直呼びへ振り分ける。
  // EventEngine._applyEffect の置換先（Phase 4 で EventEngine 側を委譲）。
  // ─────────────────────────────────────
  const applyEffects = useCallback((effects) => {
    if (!effects || effects.length === 0) return;

    // 1. 副作用: itemGain → ItemSystemでインスタンス生成 → ADD_ITEM
    //    （itemLose より先に行い、同一バッチ内 gain→lose の順序を担保）
    effects.forEach(eff => {
      if (eff.type !== 'itemGain') return;
      const item = systemsRef.current.itemSystem.createInstance(eff.itemId);
      if (item) dispatch({ type: 'ADD_ITEM', payload: { item } });
    });

    // 2. 純粋分（applyEffectToState 対応の全種・itemLose含む）→ 一括dispatch
    //    reduce畳み込みで配列順を保持。reducerを汚さず副作用も持ち込まない。
    const pure = effects.filter(eff => PURE_EFFECT_TYPES.has(eff.type));
    if (pure.length) {
      dispatch({ type: 'APPLY_EFFECTS', payload: { effects: pure } });
    }

    // 3. 副作用: legion系 → legionAIRef のインスタンスを直接操作（stateに乗らない）
    const ai = legionAIRef.current;
    effects.forEach(eff => {
      if (eff.type === 'legionForceAttack') {
        ai?.forceAttack?.(eff.factionId, eff.targetFactionId);
      } else if (eff.type === 'legionUpdate') {
        const legion = ai?.legions?.find(l => l.id === eff.legionId);
        if (!legion) return;
        if (eff.factionId       !== undefined) legion.factionId       = eff.factionId;
        if (eff.attackFrequency !== undefined) legion.attackFrequency = eff.attackFrequency;
      }
    });
  }, []);

  // buildWsAdapter（前方宣言）からTDZなく参照させるため ref を同期
  useEffect(() => {
    applyEffectsRef.current = applyEffects;
  }, [applyEffects]);

  // ─────────────────────────────────────
  // 派生値
  // ─────────────────────────────────────

  const playerFaction = state.factions.find(f => f.isPlayer);
  const playerBases   = state.bases.filter(b => b.factionId === playerFaction?.id);
  const income        = playerBases.reduce((s, b) => s + (b.income ?? 0), 0);

  const availableChars = state.characters.filter(c =>
    c.factionId === playerFaction?.id &&
    !(c.penaltyTurns > 0) &&
    !c.usedThisTurn
  );

  // ─────────────────────────────────────
  // Context value
  // ─────────────────────────────────────

  const value = {
    // state
    ...state,
    // 派生値
    playerFaction,
    playerBases,
    income,
    availableChars,
    dungeonProgress:         state.dungeonProgress,
    dungeonExploredThisTurn: state.dungeonExploredThisTurn,
    // systems（直接アクセス用）
    systems: systemsRef.current,
    legionAI: legionAIRef.current,
    // actions
    setStartDialogHandler,
    actions: {
      startNewGame,
      runEnemyPhase,
      runEnemyPhaseForFaction,
      startPlayerTurn,
      battleEnd,
      beforeAttack,
      fireTrigger,
      doResearch,
      purchaseUpgrade,
      declareWar,
      isAtWar,
      applyEffects,
      getTheaterEvents,
      runTheaterEvent,
      updateChar:  (char)       => dispatch({ type: 'UPDATE_CHAR',   payload: char }),
      setFlag:     (key, val, withTimestamp = false) =>
        dispatch({ type: 'SET_FLAG', payload: { key, value: val, withTimestamp } }),
      clearFlag:   (key)        => dispatch({ type: 'CLEAR_FLAG',    payload: { key } }),
      setTreasury: (fid, amt)   => dispatch({ type: 'SET_TREASURY',  payload: { factionId: fid, amount: amt } }),
      addItem:     (item)       => dispatch({ type: 'ADD_ITEM',       payload: { item } }),
      removeItem:  (iid)        => dispatch({ type: 'REMOVE_ITEM',   payload: { instanceId: iid } }),
      conquerBase: (bid, fid)   => dispatch({ type: 'CONQUER_BASE',  payload: { baseId: bid, winnerFactionId: fid } }),
      save,
      load,
      getSaveSlots,
      // 後方互換
      addResearch: (id) => doResearch(id),
      setActionPoints: (n) => dispatch({ type: 'SET_ACTION_POINTS', payload: n }),
      startResearch: (id) => {
        const def = systemsRef.current.buildingSystem?.getDef(id);
        if (!def) return;
        const turns = def.turns ?? 1;
        const pf = stateRef.current.factions.find(f => f.isPlayer);
        if (!pf || pf.treasury < def.cost) return;
        dispatch({ type: 'SET_TREASURY', payload: { factionId: pf.id, amount: pf.treasury - def.cost } });
        dispatch({ type: 'SET_RESEARCH_QUEUE', payload: { id, turnsRemaining: turns } });
      },
      setSecretary: (charId) => dispatch({ type: 'SET_SECRETARY', payload: charId }),
      dungeonFloorClear: (payload) => dispatch({ type: 'DUNGEON_FLOOR_CLEAR', payload }),
      dungeonExplored:   ()        => dispatch({ type: 'DUNGEON_EXPLORED' }),
      dungeonDefeat:     (charId)  => dispatch({ type: 'DUNGEON_DEFEAT', payload: { charId } }),
    },
    buildBattleUnit: BattleEngineV3.buildUnit,
    checkVictory:    () => checkVictoryCondition(stateRef.current),
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
