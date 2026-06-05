/**
 * SaveSystem
 * セーブ・ロードのロジックを担当。
 */

import charactersData from '../data/characters.json';
import { BuildingSystem } from './BuildingSystem.js';

const SAVE_VERSION = 7;
const SLOT_COUNT   = 3;
const STORAGE_KEY  = (slot) => `kiritan_save_${slot}`;

export class SaveSystem {

  static save(slot, worldScene) {
    try {
      localStorage.setItem(STORAGE_KEY(slot), JSON.stringify(SaveSystem._serialize(worldScene)));
      return true;
    } catch (e) { console.error('Save failed:', e); return false; }
  }

  static getRawData(slot) {
    const raw = localStorage.getItem(STORAGE_KEY(slot));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  static getSlotInfo(slot) {
    const raw = localStorage.getItem(STORAGE_KEY(slot));
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      const pFaction = data.factions.find(f => f.isPlayer);
      return {
        turn:        data.currentTurn,
        savedAt:     data.savedAt,
        playerBases: data.bases.filter(b => pFaction && b.factionId === pFaction.id).length,
      };
    } catch { return null; }
  }

  static getAllSlots() {
    return Array.from({ length: SLOT_COUNT }, (_, i) => ({
      slot: i,
      info: SaveSystem.getSlotInfo(i),
    }));
  }

  static deleteSlot(slot) {
    localStorage.removeItem(STORAGE_KEY(slot));
  }

  // ----------------------------------------------------------------
  // シリアライズ
  // ----------------------------------------------------------------
  static _serialize(ws) {
    const base = {
      version:           SAVE_VERSION,
      savedAt:           new Date().toISOString(),
      currentTurn:       ws.currentTurn,
      hireCooldownUntil: ws.hireCooldownUntil,
      conqueredThisTurn: ws.conqueredThisTurn,

      factions: ws.factions.map(f => ({
        id:        f.id,
        treasury:  f.treasury,
        isPlayer:  f.isPlayer,
        atWarWith: f.atWarWith ?? [],
        warFlags:  f.warFlags  ?? {},
      })),

      bases: ws.bases.map(b => ({
        id: b.id, factionId: b.factionId, income: b.income,
      })),

      buildings: [...(ws.buildings ?? [])],

      characters: ws.characters.map(c => {
        const base = {
          id:           c.id,
          factionId:    c.factionId,
          soldiers:     c.soldiers,
          maxSoldiers:  c.maxSoldiers,
          usedThisTurn: c.usedThisTurn,
          charHp:       c.charHp,
          charMaxHp:    c.charMaxHp,
          equipment:    { item: c.equipment?.item ?? null },
        };
        if (c._isMobInstance) {
          return {
            ...base,
            _isMobInstance: true,
            _legionId:   c._legionId  ?? null,
            _slotId:     c._slotId    ?? null,
            name:        c.name,
            displayName: c.displayName ?? c.name,
            role:        c.role,
            attackType:  c.attackType,
            isLeader:    c.isLeader ?? false,
            charAttack:  c.charAttack,
            charDefense: c.charDefense ?? 0,
            soldierAtk:  c.soldierAtk,
            soldierDef:  c.soldierDef,
            recoveryRate: c.recoveryRate ?? 0.05,
            description: c.description ?? '',
            battleBonus: c.battleBonus ?? null,
          };
        }
        return base;
      }),

      inventory: (ws.inventory ?? []).map(i => ({ id: i.id, itemId: i.itemId })),

      // 軍団モブスロット状態
      legions: ws.legionAI ? ws.legionAI.serializeMobSlots() : [],

      // イベントシステム
      eventFlags:     { ...(ws.eventFlags     ?? {}) },
      occurredEvents: { ...(ws.occurredEvents ?? {}) },
      flagTimestamps: { ...(ws.flagTimestamps ?? {}) },
    };

    return base;
  }

  // ----------------------------------------------------------------
  // デシリアライズ
  // ----------------------------------------------------------------
  static _deserialize(data, ws) {
    ws.currentTurn       = data.currentTurn;
    ws.hireCooldownUntil = data.hireCooldownUntil ?? 0;
    ws.conqueredThisTurn = data.conqueredThisTurn ?? false;

    data.factions.forEach(saved => {
      const f = ws.factions.find(f => f.id === saved.id);
      if (!f) return;
      f.treasury  = saved.treasury;
      f.atWarWith = saved.atWarWith ?? [];
      f.warFlags  = saved.warFlags  ?? {};
    });

    data.bases.forEach(saved => {
      const b = ws.bases.find(b => b.id === saved.id);
      if (!b) return;
      b.factionId = saved.factionId;
      b.income    = saved.income;
    });

    ws.buildings = data.buildings ? [...data.buildings] : [];

    const allDefs = charactersData.characters;
    const restoredChars = [];

    data.characters.forEach(saved => {
      if (saved._isMobInstance) {
        restoredChars.push({
          ...saved,
          usedThisTurn: saved.usedThisTurn ?? false,
          charDefense:  saved.charDefense  ?? 0,
          recoveryRate: saved.recoveryRate ?? 0.05,
          equipment: saved.equipment?.item !== undefined
            ? { item: saved.equipment.item }
            : { item: null },
          battleBonus: saved.battleBonus ?? null,
        });
        return;
      }

      const def = allDefs.find(c => c.id === saved.id);
      if (!def) return;

      restoredChars.push({
        ...JSON.parse(JSON.stringify(def)),
        factionId:    saved.factionId,
        soldiers:     saved.soldiers,
        maxSoldiers:  saved.maxSoldiers,
        usedThisTurn: saved.usedThisTurn,
        charHp:       saved.charHp    ?? def.charMaxHp,
        charMaxHp:    saved.charMaxHp ?? def.charMaxHp,
        equipment:    saved.equipment?.item !== undefined
          ? { item: saved.equipment.item }
          : { item: null },
      });
    });

    ws.characters = restoredChars;

    if (ws.itemSystem && data.inventory) {
      ws.inventory = ws.itemSystem.deserializeInventory(data.inventory);
    } else {
      ws.inventory = [];
    }

    // 軍団モブスロット復元
    if (ws.legionAI && data.legions) {
      ws.legionAI.deserializeMobSlots(data.legions);
    }

    // イベントシステム復元
    ws.eventFlags     = data.eventFlags     ? { ...data.eventFlags }     : {};
    ws.occurredEvents = data.occurredEvents ? { ...data.occurredEvents } : {};
    ws.flagTimestamps = data.flagTimestamps ? { ...data.flagTimestamps } : {};
  }
}
