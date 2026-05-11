/**
 * LegionAI.js — 軍団ベースの敵AI
 *
 * EnemyAI を置き換える。
 * 各勢力の「軍団」単位で侵攻・防衛・モブ補充を管理する。
 */

import { BuildingSystem } from './BuildingSystem.js';

const MOB_RESPAWN_TURNS = 2; // モブ死亡後の復活ターン数

export class LegionAI {
  /**
   * @param {object[]} factions
   * @param {object[]} bases
   * @param {object[]} characters  ← worldScene.characters への参照
   * @param {object[]} legionDefs  ← legions.json の legions 配列
   */
  constructor(factions, bases, characters, legionDefs) {
    this.factions   = factions;
    this.bases      = bases;
    this.characters = characters;

    this.legions = legionDefs.map(def => ({
      ...JSON.parse(JSON.stringify(def)),
      _turnsSinceLastAttack: 0,
    }));

    this._mobTemplates = BuildingSystem.getMobTemplates();
    this._initMobSlots();
  }

  // ----------------------------------------------------------------
  // 起動時モブ初期化
  // ----------------------------------------------------------------
  _initMobSlots() {
    this.legions.forEach(legion => {
      legion.mobSlots.forEach(slot => {
        if (slot.charId === null && slot.respawnIn === null) {
          const mob = this._createMobForSlot(slot, legion.factionId, legion.id);
          if (mob) {
            slot.charId = mob.id;
            this.characters.push(mob);
          }
        }
      });
    });
  }

  // ----------------------------------------------------------------
  // 攻撃キュー構築
  // ----------------------------------------------------------------
  buildAttackQueue(playerFactionId) {
    const queue = [];

    this.legions.forEach(legion => {
      if (!legion.attackPriority || legion.attackPriority.length === 0) return;
      if (!legion.attackFrequency && !legion._forceAttackTarget) return;

      const myFaction = this.factions.find(f => f.id === legion.factionId);
      if (!myFaction?.atWarWith?.includes(playerFactionId)) return;

      const isForced = !!legion._forceAttackTarget;

      if (!isForced && !this._shouldAttackThisTurn(legion)) return;

      let targetBase;
      if (isForced) {
        // 強制攻撃: _forceAttackTarget の勢力の隣接拠点を選択
        const myBases = this.bases.filter(b => b.factionId === legion.factionId);
        for (const baseId of legion.attackPriority) {
          const candidate = this.bases.find(b => b.id === baseId);
          if (!candidate || candidate.factionId !== legion._forceAttackTarget) continue;
          const isReachable = myBases.some(mb => mb.adjacentBases.includes(baseId));
          if (isReachable) { targetBase = candidate; break; }
        }
        // attackPriority に対象なければ playerFactionId 拠点で代替
        if (!targetBase) targetBase = this._selectAttackTarget(legion, playerFactionId);
        legion._forceAttackTarget = null;
      } else {
        targetBase = this._selectAttackTarget(legion, playerFactionId);
      }

      if (!targetBase) return;

      const attackers = this._getLegionCombatChars(legion);
      if (attackers.length === 0) return;

      legion._turnsSinceLastAttack = 0;

      queue.push({
        attackerFactionId: legion.factionId,
        defenderBase:      targetBase,
        attackerCharIds:   attackers.map(c => c.id),
        legionId:          legion.id,
        retreatRule:       legion.retreatRule?.onAttack ?? 'char_dead',
      });
    });

    // 攻撃しなかった軍団もカウンターを進める
    this.legions.forEach(legion => {
      if (legion.attackFrequency) legion._turnsSinceLastAttack++;
    });

    return queue;
  }

  // ----------------------------------------------------------------
  // 強制攻撃指示
  // ----------------------------------------------------------------
  forceAttack(factionId, targetFactionId) {
    this.legions
      .filter(l => l.factionId === factionId)
      .forEach(l => {
        l._forceAttackTarget = targetFactionId;
      });
  }

  // ----------------------------------------------------------------
  // 防衛キャラ選出
  // ----------------------------------------------------------------
  getDefenders(defenderFactionId, defenderBase, allCharacters) {
    const legion = this.legions.find(l =>
      l.factionId === defenderFactionId &&
      l.defendBases?.includes(defenderBase.id)
    );

    if (legion) {
      const chars = this._getLegionCombatChars(legion);
      if (chars.length > 0) return chars;
    }

    // フォールバック
    return allCharacters.filter(c =>
      c.factionId === defenderFactionId && c.soldiers > 0
    );
  }

  // ----------------------------------------------------------------
  // 撤退ルール取得（汎用）
  // mode: 'attack' | 'defense'
  // ----------------------------------------------------------------
  getRetreatRule(legionId, baseId, mode) {
    const legion = this.legions.find(l => l.id === legionId);
    if (!legion) return 'char_dead';

    if (mode === 'defense') {
      // 都市別上書きがあれば優先
      const overrideRule = legion.retreatRule?.onDefendBase?.[baseId];
      if (overrideRule) return overrideRule;
      return legion.retreatRule?.onDefend ?? 'char_dead';
    }

    return legion.retreatRule?.onAttack ?? 'hp_any';
  }

  // ----------------------------------------------------------------
  // 内政処理（モブ補充）
  // ----------------------------------------------------------------
  runDomestic() {
    this.legions.forEach(legion => {
      legion.mobSlots.forEach(slot => {
        if (slot.charId !== null) return;

        if (slot.respawnIn === null) {
          // 初期化漏れ → 即生成
          const mob = this._createMobForSlot(slot, legion.factionId, legion.id);
          if (mob) { slot.charId = mob.id; this.characters.push(mob); }
        } else if (slot.respawnIn > 0) {
          slot.respawnIn--;
        } else {
          // respawnIn === 0 → 補充
          const mob = this._createMobForSlot(slot, legion.factionId, legion.id);
          if (mob) {
            slot.charId    = mob.id;
            slot.respawnIn = null;
            this.characters.push(mob);
          }
        }
      });
    });
  }

  // ----------------------------------------------------------------
  // モブ死亡通知
  // ----------------------------------------------------------------
  onMobDeath(mobId) {
    this.legions.forEach(legion => {
      legion.mobSlots.forEach(slot => {
        if (slot.charId === mobId) {
          slot.charId    = null;
          slot.respawnIn = MOB_RESPAWN_TURNS;
        }
      });
    });
  }

  // ----------------------------------------------------------------
  // セーブ・ロード
  // ----------------------------------------------------------------
  serializeMobSlots() {
    return this.legions.map(l => ({
      id:       l.id,
      mobSlots: l.mobSlots.map(s => ({
        slotId:     s.slotId,
        templateId: s.templateId,
        charId:     s.charId,
        respawnIn:  s.respawnIn,
      })),
    }));
  }

  deserializeMobSlots(savedLegions) {
    savedLegions.forEach(saved => {
      const legion = this.legions.find(l => l.id === saved.id);
      if (!legion) return;
      saved.mobSlots.forEach(savedSlot => {
        const slot = legion.mobSlots.find(s => s.slotId === savedSlot.slotId);
        if (!slot) return;
        slot.charId    = savedSlot.charId;
        slot.respawnIn = savedSlot.respawnIn;
      });
    });
  }

  // ----------------------------------------------------------------
  // 内部ヘルパー
  // ----------------------------------------------------------------

  _getLegionCombatChars(legion) {
    const result = [];
    legion.charIds.forEach(id => {
      const c = this.characters.find(ch => ch.id === id);
      if (c && c.soldiers > 0 && c.charHp > 0) result.push(c);
    });
    legion.mobSlots.forEach(slot => {
      if (!slot.charId) return;
      const c = this.characters.find(ch => ch.id === slot.charId);
      if (c && c.soldiers > 0 && c.charHp > 0) result.push(c);
    });
    return result;
  }

  _selectAttackTarget(legion, playerFactionId) {
    const myBases = this.bases.filter(b => b.factionId === legion.factionId);
    for (const baseId of legion.attackPriority) {
      const target = this.bases.find(b => b.id === baseId);
      if (!target || target.factionId !== playerFactionId) continue;
      const isReachable = myBases.some(mb => mb.adjacentBases.includes(baseId));
      if (isReachable) return target;
    }
    return null;
  }

  _shouldAttackThisTurn(legion) {
    const freq = legion.attackFrequency;
    if (!freq) return false;

    switch (freq.type) {
      case 'every_turn':
        return true;

      case 'interval':
        return legion._turnsSinceLastAttack >= (freq.turns ?? 2);

      case 'interval_with_strength': {
        if (legion._turnsSinceLastAttack < (freq.turns ?? 2)) return false;
        const total = this._getLegionCombatChars(legion).reduce((s, c) => s + c.soldiers, 0);
        return total >= (freq.minSoldiers ?? 500);
      }

      case 'strength_only': {
        const total = this._getLegionCombatChars(legion).reduce((s, c) => s + c.soldiers, 0);
        return total >= (freq.minSoldiers ?? 500);
      }

      default:
        return false;
    }
  }

  _createMobForSlot(slot, factionId, legionId) {
    const template = this._mobTemplates.find(t => t.id === slot.templateId);
    if (!template) return null;
    const mob = BuildingSystem.createMobInstance(template, factionId);
    mob._isMobInstance = true;
    mob._legionId      = legionId;
    mob._slotId        = slot.slotId;
    return mob;
  }
}
