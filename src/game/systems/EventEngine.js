/**
 * src/systems/EventEngine.js
 *
 * イベントシステムの中核。
 *
 * ---- 責務 ----
 *   条件判定 / 発生抽選 / DialogScene 起動（直列） / エフェクト適用
 *
 * ---- 呼び出し元 ----
 *   WorldMapScene の以下のタイミングで processTrigger() を await する。
 *     game_start   : create() 末尾
 *     player_turn  : _startNextTurn() 冒頭
 *     enemy_turn   : _endTurn() 冒頭（LegionAI 処理前）
 *     base_visit   : 訪問ボタン押下時
 *     base_attack  : startAttack() 直前
 *     base_defense : startDefense() 直前
 *
 * ---- worldScene に必要な追加フィールド ----
 *   ws.eventFlags     = {}
 *   ws.occurredEvents = {}
 *
 * ---- events.json スキーマ ----
 *   script[] の各ステップ:
 *     { type: 'text', characterId, position, text }
 *     { type: 'narration', text }
 *     { type: 'conversation', lines: [{ characterId, position, text }, ...] }
 *     { type: 'choice', characterId, position, text, choices: [{label, next, effects?}] }
 *     { type: 'end' }
 *   話者名は characterId → characters 配列から DialogScene が解決する。
 *   speaker フィールドは廃止（後方互換のためエラーにはならないが無視される）。
 */

import indexData from '../data/events/_index.json';

// Viteの静的import: src/data/events/ 以下の全JSONをバンドル時に取り込む
const _eventModules = import.meta.glob('../data/events/**/*.json', { eager: true });

const MAX_RANDOM_EVENTS_PER_TURN = 3;

// イベントキャッシュ
let _eventsCache = null;

function _loadAllEvents() {
  if (_eventsCache) return _eventsCache;

  // テストモード: window.__TEST_EVENTS__ が注入されている場合はそちらを使用
  if (window.__TEST_EVENTS__) {
    _eventsCache = window.__TEST_EVENTS__.events ?? [];
    return _eventsCache;
  }

  const index = indexData.events ?? [];
  _eventsCache = index.map(entry => {
    const key = `../data/events/${entry.path}`;
    const mod = _eventModules[key];
    if (!mod) {
      console.warn(`[EventEngine] イベントファイルが見つかりません: ${key}`);
      return null;
    }
    return mod.default ?? mod;
  }).filter(Boolean);

  console.log(`[EventEngine] ${_eventsCache.length}件のイベントをロード`);
  return _eventsCache;
}

/** キャッシュを強制クリア（テスト用） */
export function clearEventCache() { _eventsCache = null; }

export class EventEngine {

  static async processTrigger(ws, trigger, ctx = {}) {
    const allEvents  = _loadAllEvents();
    const candidates = allEvents.filter(ev => ev.trigger === trigger);
    if (candidates.length === 0) return;

    if (trigger === 'player_turn') {
      await EventEngine._processPlayerTurn(ws, candidates, ctx);
    } else {
      const eligible = EventEngine._filterEligible(ws, candidates, ctx);
      if (eligible.length === 0) return;
      await EventEngine._runEvent(ws, eligible[0], ctx);
    }
  }

  static async _processPlayerTurn(ws, candidates, ctx) {
    const certain = EventEngine._filterEligible(ws, candidates, ctx)
      .filter(ev => ev.probability >= 1.0);
    for (const ev of certain) await EventEngine._runEvent(ws, ev, ctx);

    const random = EventEngine._filterEligible(ws, candidates, ctx)
      .filter(ev => ev.probability < 1.0);
    if (random.length === 0) return;

    const slots  = Math.floor(Math.random() * (MAX_RANDOM_EVENTS_PER_TURN + 1));
    if (slots === 0) return;
    const passed = random.filter(ev => Math.random() < ev.probability).slice(0, slots);
    for (const ev of passed) await EventEngine._runEvent(ws, ev, ctx);
  }

  static _filterEligible(ws, events, ctx) {
    return events
      .filter(ev => {
        const count = EventEngine.getOccurrenceCount(ws, ev.id);
        if (ev.maxOccurrences !== -1 && count >= ev.maxOccurrences) return false;
        return EventEngine.checkConditions(ws, ev.conditions ?? [], ctx);
      })
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  static checkConditions(ws, conditions, ctx = {}) {
    return conditions.every(cond => EventEngine._evalCondition(ws, cond, ctx));
  }

  static _evalCondition(ws, cond, ctx) {
    switch (cond.type) {
      case 'turn': {
        const t = ws.currentTurn ?? 1;
        if (cond.op === 'gte') return t >= cond.value;
        if (cond.op === 'lte') return t <= cond.value;
        if (cond.op === 'eq')  return t === cond.value;
        return false;
      }
      case 'flag':    return !!(ws.eventFlags?.[cond.flag]);
      case 'noFlag':  return !(ws.eventFlags?.[cond.flag]);
      case 'hasChar': {
        const pf = ws.factions?.find(f => f.isPlayer);
        if (!pf) return false;
        return ws.characters?.some(c => c.id === cond.charId && c.factionId === pf.id) ?? false;
      }
      case 'baseOwned': {
        const pf   = ws.factions?.find(f => f.isPlayer);
        const base = ws.bases?.find(b => b.id === cond.baseId);
        return base?.factionId === pf?.id;
      }
      case 'atWar': {
        const pf = ws.factions?.find(f => f.isPlayer);
        return pf?.atWarWith?.includes(cond.factionId) ?? false;
      }
      case 'attackerFaction':
        return ctx.attackerFactionId === cond.factionId;
      case 'defenderFaction': {
        const pf = ws.factions?.find(f => f.isPlayer);
        return pf?.id === cond.factionId;
      }
      case 'baseConquered': {
        const base = ws.bases?.find(b => b.id === cond.baseId);
        if (!base) return false;
        if (cond.factionId && base.factionId !== cond.factionId) return false;
        return ws.eventFlags?.[`conquered_${cond.baseId}`] === true;
      }
      case 'turnAfterFlag': {
        const stamp = ws.flagTimestamps?.[cond.flag];
        if (stamp == null) return false;
        return (ws.currentTurn - stamp) >= cond.value;
      }
      case 'defeatedChar':
        return ctx.defeatedCharId === cond.charId;
      case 'noOther': {
        const allEvents = _eventsCache ?? [];
        return (cond.eventIds ?? []).every(id => {
          const other = allEvents.find(e => e.id === id);
          if (!other) return true;
          return !EventEngine.checkConditions(ws, other.conditions ?? [], ctx);
        });
      }
      default:
        console.warn('[EventEngine] unknown condition type:', cond.type);
        return true;
    }
  }

  static _runEvent(ws, ev, ctx) {
    return new Promise(resolve => {
      if (!ws.occurredEvents) ws.occurredEvents = {};
      ws.occurredEvents[ev.id] = (ws.occurredEvents[ev.id] ?? 0) + 1;

      if (!ev.script || ev.script.length === 0) {
        EventEngine.applyEffects(ws, ev.effects?.default ?? []);
        resolve();
        return;
      }

      if (typeof ws.startDialog !== 'function') {
        console.error('[EventEngine] ws.startDialog is not a function. ev:', ev.id, 'ws:', ws);
        EventEngine.applyEffects(ws, ev.effects?.default ?? []);
        resolve();
        return;
      }

      let pendingEffectsKey = 'default';
      const expandedScript  = EventEngine._expandConversation(ev.script);

      const scriptWithCallback = expandedScript.map(step => {
        if (step.type === 'choice' && step.choices) {
          return {
            ...step,
            choices: step.choices.map(c => ({
              ...c,
              _onSelect: () => {
                if (c.effects && c.effects.length > 0) {
                  EventEngine.applyEffects(ws, c.effects);
                  pendingEffectsKey = null;
                } else if (c.effectsKey) {
                  pendingEffectsKey = c.effectsKey;
                }
              },
            })),
          };
        }
        return step;
      });

      ws.startDialog(scriptWithCallback, () => {
        if (pendingEffectsKey !== null) {
          const endStep = ev.script.find(s => s.type === 'end' && s.effectsKey);
          if (endStep && pendingEffectsKey === 'default') {
            pendingEffectsKey = endStep.effectsKey ?? 'default';
          }
          EventEngine.applyEffects(ws, ev.effects?.[pendingEffectsKey] ?? []);
        }
        resolve();
      });
    });
  }

  /**
   * conversation ステップを text ステップ列に展開する。
   * speaker フィールドは含めない（DialogScene が characterId から解決する）。
   */
  static _expandConversation(script) {
    const result = [];
    for (const step of script) {
      if (step.type === 'conversation' && Array.isArray(step.lines)) {
        for (const line of step.lines) {
          result.push({
            type:        'text',
            characterId: line.characterId ?? null,
            position:    line.position    ?? 'center',
            text:        line.text        ?? '',
          });
        }
      } else {
        result.push(step);
      }
    }
    return result;
  }

  static applyEffects(ws, effects) {
    if (!effects || effects.length === 0) return;
    effects.forEach(eff => {
      try { EventEngine._applyEffect(ws, eff); }
      catch (e) { console.error('[EventEngine] applyEffect error:', eff, e); }
    });
    ws.scene?.get?.('UIScene')?.updateTurn?.(ws.currentTurn, ws.factions);
    ws.refreshMap?.();
  }

  static _applyEffect(ws, eff) {
    const playerFaction = ws.factions?.find(f => f.isPlayer);
    switch (eff.type) {
      case 'treasury': {
        const faction = ws.factions?.find(f => f.id === eff.factionId) ?? playerFaction;
        if (faction) faction.treasury = Math.max(0, faction.treasury + eff.delta);
        break;
      }
      case 'charJoin': {
        const char = ws.characters?.find(c => c.id === eff.charId);
        if (char) { char.factionId = eff.factionId ?? playerFaction?.id; char.status = 'active'; }
        break;
      }
      case 'charLeave': {
        const char = ws.characters?.find(c => c.id === eff.charId);
        if (char) { char.factionId = null; char.status = 'standby'; }
        break;
      }
      case 'charParam': {
        const char = ws.characters?.find(c => c.id === eff.charId);
        if (!char) break;
        const next = (char[eff.field] ?? 0) + eff.delta;
        char[eff.field] = eff.min !== undefined ? Math.max(eff.min, next) : next;
        if (eff.field === 'charHp') char.charHp = Math.min(char.charHp, char.charMaxHp);
        break;
      }
      case 'baseIncome': {
        const base = ws.bases?.find(b => b.id === eff.baseId);
        if (base) base.income = Math.max(0, base.income + eff.delta);
        break;
      }
      case 'battleCap': {
        const base = ws.bases?.find(b => b.id === eff.baseId);
        if (base) base.battleCapacity = Math.max(100, base.battleCapacity + eff.delta);
        break;
      }
      case 'dungeonUnlock': {
        const base = ws.bases?.find(b => b.id === eff.baseId);
        if (base) base.dungeonUnlocked = true;
        break;
      }
      case 'warFlag': {
        if (!playerFaction) break;
        const target = ws.factions?.find(f => f.id === eff.factionId);
        if (!target) break;
        if (eff.atWar) {
          ws.declareWar?.(eff.factionId);
        } else {
          playerFaction.atWarWith = (playerFaction.atWarWith ?? []).filter(id => id !== eff.factionId);
          target.atWarWith        = (target.atWarWith        ?? []).filter(id => id !== playerFaction.id);
        }
        break;
      }
      case 'itemGain': {
        if (!ws.itemSystem) break;
        const item = ws.itemSystem.createInstance?.(eff.itemId);
        if (item) ws.inventory?.push(item);
        break;
      }
      case 'itemLose': {
        if (!ws.inventory) break;
        const idx = ws.inventory.findIndex(i => i.itemId === eff.itemId);
        if (idx !== -1) ws.inventory.splice(idx, 1);
        break;
      }
      case 'setFlag':   { if (!ws.eventFlags) ws.eventFlags = {}; ws.eventFlags[eff.flag] = true; break; }
      case 'setFlagWithTurn': {
        if (!ws.eventFlags)     ws.eventFlags     = {};
        if (!ws.flagTimestamps) ws.flagTimestamps  = {};
        ws.eventFlags[eff.flag]     = true;
        ws.flagTimestamps[eff.flag] = ws.currentTurn;
        break;
      }
      case 'clearFlag': { if (ws.eventFlags) delete ws.eventFlags[eff.flag]; break; }
      case 'charUsedThisTurn': {
        const char = ws.characters?.find(c => c.id === eff.charId);
        if (char) char.usedThisTurn = true;
        break;
      }
      case 'baseTransfer': {
        const from = eff.fromFactionId;
        const to   = eff.toFactionId ?? ws.factions?.find(f => f.isPlayer)?.id;
        ws.bases?.forEach(b => {
          if (b.factionId === from) b.factionId = to;
        });
        const pf      = ws.factions?.find(f => f.isPlayer);
        const fromFac = ws.factions?.find(f => f.id === from);
        if (pf && fromFac) {
          pf.atWarWith      = (pf.atWarWith      ?? []).filter(id => id !== from);
          fromFac.atWarWith = (fromFac.atWarWith ?? []).filter(id => id !== pf.id);
        }
        break;
      }
      case 'attackUnlock': {
        ws.declareWar?.(eff.factionId);
        break;
      }
      case 'legionForceAttack': {
        ws.legionAI?.forceAttack?.(eff.factionId, eff.targetFactionId);
        break;
      }
      case 'legionUpdate': {
        const legion = ws.legionAI?.legions?.find(l => l.id === eff.legionId);
        if (!legion) break;
        if (eff.factionId        !== undefined) legion.factionId        = eff.factionId;
        if (eff.attackFrequency  !== undefined) legion.attackFrequency  = eff.attackFrequency;
        break;
      }
      default: console.warn('[EventEngine] unknown effect type:', eff.type);
    }
  }

  static getOccurrenceCount(ws, eventId) {
    return ws.occurredEvents?.[eventId] ?? 0;
  }
}
