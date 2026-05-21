/**
 * BattleEngineV3.js — 戦闘エンジン（V3）
 *
 * 設計思想:
 *   N = min(soldiers, battleCapacity) 体が突撃し N 回の攻撃判定が発生。
 *   SP への命中数 + 将軍への命中数 = N（常に成立）。
 *   攻撃と反撃を同時算出・同時適用。同時HP0はプレイヤー側を1に補正。
 *   部隊消滅条件: charHp <= 0 のみ（死亡廃止・ペナルティ制）。
 *
 * 主要機能:
 *   - 戦闘モード (normal / dungeon / duel / event)
 *   - 作戦システム (strategyRate差分でSPダメージ±10/50%補正)
 *   - 特技システム (skills.json 定義: instant / charge)
 */

import { resolveBonus } from '../utils/BattleBonus.js';
import skillsData from '../data/skills.json';

const MAX_ROUNDS_NORMAL = 5;

// ────────────────────────────────────────────────
// モジュールユーティリティ
// ────────────────────────────────────────────────

/** SP命中の振り分け: N体のうち何体が将軍に届くか */
function _splitHits(N, vicSol, atkSol) {
  if (N <= 0) return { toMeme: 0, toChar: 0 };
  const extreme = vicSol < 50 || vicSol === 0 || (vicSol > 0 && atkSol / vicSol >= 10);
  let p;
  if (extreme) {
    p = 1 / (vicSol + 1);
  } else {
    const dr = 1 - vicSol / atkSol;
    p = dr <= 0.3 ? 0 : (dr - 0.3) ** 2 * 0.5;
  }
  const toChar = Math.min(N, Math.max(0, Math.round(N * p * (0.8 + Math.random() * 0.4))));
  return { toMeme: N - toChar, toChar };
}

// ────────────────────────────────────────────────
export class BattleEngineV3 {
  /**
   * @param {object}   opts
   * @param {object[]} opts.playerSide
   * @param {object[]} opts.enemySide
   * @param {string}   opts.mode           'attack' | 'defense'
   * @param {number}   opts.battleCapacity
   * @param {string}   [opts.battleMode]   'normal' | 'dungeon' | 'duel' | 'event'
   * @param {number}   [opts.maxRounds]    省略時: normal=5、それ以外=無制限
   * @param {boolean}  [opts.allowRetreat] 省略時: dungeon/duel以外=true
   */
  constructor(opts) {
    this.playerSide     = opts.playerSide;
    this.enemySide      = opts.enemySide;
    this.mode           = opts.mode;
    this.battleCapacity = opts.battleCapacity;
    this.battleMode     = opts.battleMode   ?? 'normal';
    this.maxRounds      = opts.maxRounds    ?? (this.battleMode === 'normal' ? MAX_ROUNDS_NORMAL : Infinity);
    this.allowRetreat   = opts.allowRetreat ?? (this.battleMode !== 'dungeon' && this.battleMode !== 'duel');

    this._onLog              = opts.onLog             ?? (() => {});
    this._onCardUpdate       = opts.onCardUpdate      ?? (() => {});
    this._onShake            = opts.onShake           ?? (() => {});
    this._onPopup            = opts.onPopup           ?? (() => {});
    this._onBattleEnd        = opts.onBattleEnd       ?? (() => {});
    this._onExchangeResult   = opts.onExchangeResult  ?? (() => {});
    this._delayedCall        = opts.delayedCall       ?? ((ms, fn) => setTimeout(fn, ms));

    this.round         = 0;
    this.gameOver      = false;
    this._initStats    = new Map();
    this._skills       = Object.fromEntries((skillsData.skills ?? []).map(s => [s.id, s]));

    // 作戦補正（コンストラクタで1回だけ決定）
    this.strategyMult  = { give: 1.0, take: 1.0, side: null, bonus: 0, winnerChar: null };
    this._initStrategy();
  }

  // ────────────────────────────────────────────────
  // 公開 API
  // ────────────────────────────────────────────────

  startRound() {
    this.round++;
    this._onLog(`━━ ラウンド ${this.round} ━━`);
    [...this.playerSide, ...this.enemySide].forEach(u => {
      u.action = null;
      u._actedThisRound = false;
      if (!this._initStats.has(u.char.id)) {
        this._initStats.set(u.char.id, { soldiers: u.soldiers, charHp: u.charHp });
      }
    });
    return { round: this.round, maxRounds: this.maxRounds === Infinity ? '∞' : this.maxRounds };
  }

  /** SP最小の未行動・生存・未撤退ユニットを返す */
  nextActor() {
    const all = [
      ...this.playerSide.map(u => ({ u, isPlayer: true  })),
      ...this.enemySide .map(u => ({ u, isPlayer: false })),
    ].filter(({ u }) => !this.isDead(u) && !u.retreated && !u._actedThisRound);
    if (!all.length) return null;
    all.sort((a, b) => a.u.soldiers - b.u.soldiers);
    return all[0];
  }

  markActed(unit) { unit._actedThisRound = true; }

  _delay(ms) {
    return new Promise(resolve => this._delayedCall(ms, resolve));
  }

  async executeAction(unit, isPlayer) {
    const defenders = isPlayer ? this.enemySide : this.playerSide;
    const allies    = isPlayer ? this.playerSide : this.enemySide;

    switch (unit.action) {
      case 'retreat': return this._doRetreat(unit, isPlayer);
      case 'defend':  this._onLog(`${unit.char.name} が防御`); return { hasCounter: false };
      case 'skill':   return this._doSkill(unit, defenders, allies, isPlayer);
      case 'focus':   return this._doFocus(unit);
      case 'special': return this._doSpecialFire(unit, defenders, isPlayer);
      default:        return this._doAttack(unit, defenders, isPlayer);
    }
  }

  advance()      {}
  isRoundOver()  { return false; }

  isDead(unit)   { return unit.charHp <= 0; }

  checkGameOver() {
    const pAlive   = this.playerSide.some(u => this._isAlive(u));
    const eAlive   = this.enemySide.some(u => this._isAlive(u));
    const atkAlive = this.mode === 'attack' ? pAlive : eAlive;
    const defAlive = this.mode === 'attack' ? eAlive : pAlive;
    if (!defAlive || !atkAlive) {
      this._delayedCall(300, () => this._finish(!defAlive && atkAlive));
      return true;
    }
    return false;
  }

  checkRoundLimit() {
    if (this.maxRounds !== Infinity && this.round >= this.maxRounds) {
      this._delayedCall(300, () => this._finish(false));
      return true;
    }
    return false;
  }

  applyRetreatRule(rule, side) {
    if (!rule || rule === 'never') return;
    const alive = side.filter(u => this._isAlive(u));
    if (!alive.length) return;

    const check = {
      loss_25:   u => this._lossRatio(u) > 0.25,
      loss_50:   u => this._lossRatio(u) > 0.50,
      hp_any:    u => { const i = this._initStats.get(u.char.id); return i && u.charHp < i.charHp; },
      char_dead: () => side.some(u => u.charHp <= 0),
    }[rule];

    if (!check || !alive.some(check)) return;

    alive.forEach(u => {
      u.soldiers       = Math.floor(u.soldiers * 0.5);
      u.char.soldiers  = u.soldiers;
      u.retreated = true;
      this._onLog(`${u.char.name} が撤退（${rule}）`);
      this._onCardUpdate(u);
    });
  }

  static buildUnit(char, sideType, index) {
    return {
      char,
      sideType,
      bonus:       resolveBonus(char, sideType),
      position:    index < 2 ? 'front' : 'rear',
      soldiers:    char.soldiers,
      maxSoldiers: char.soldiers,
      charHp:      char.charHp    ?? 200,
      charMaxHp:   char.charMaxHp ?? 200,
      charActive:  false,
      action:      null,
      retreated:   false,
      charged:     false,   // 集中フラグ（特技: charge型）
      skillUsed:   false,   // 特技使用済み
      attackCount: char.attackCount ?? 8,
      charDefense: char.charDefense ?? 10,
      level:       char.level       ?? 0,
      targetId:    null,
    };
  }

  // ────────────────────────────────────────────────
  // アクション実行
  // ────────────────────────────────────────────────

  _doRetreat(unit, isPlayer) {
    if (!this.allowRetreat) {
      this._onLog(`${unit.char.name}: この戦闘では撤退できない`);
      return { hasCounter: false };
    }
    unit.retreated = true;
    this._onLog(`${unit.char.name} が撤退`);
    this._onCardUpdate(unit);
    const isAtk = (this.mode === 'attack') === isPlayer;
    this._delayedCall(300, () => this._finish(!isAtk));
    return { hasCounter: false };
  }

  /** 集中（charge型の1ターン目）*/
  _doFocus(unit) {
    const skill = this._skills[unit.char.skillId ?? ''];
    unit.charged = true;
    this._onLog(`${unit.char.name} が集中（次ターン「${skill?.name ?? '必殺技'}」発動可能）`);
    this._onCardUpdate(unit);
    return { hasCounter: false };
  }

  /** 必殺技発動（charge型の2ターン目）*/
  _doSpecialFire(unit, defenders, isPlayer) {
    const skill = this._skills[unit.char.skillId ?? ''];
    this._execSpecial(unit, defenders, skill);
    unit.charged   = false;
    unit.skillUsed = true;
    this._updateAllCards();
    return { hasCounter: false };
  }

  /** 特技（instant型のみ）*/
  _doSkill(unit, defenders, allies, isPlayer) {
    const skill = this._skills[unit.char.skillId ?? ''];
    if (!skill || skill.trigger === 'charge') {
      this._onLog(`${unit.char.name}: 特技使用不可`);
      return { hasCounter: false };
    }
    if (unit.skillUsed) {
      this._onLog(`${unit.char.name}: 特技は使用済み`);
      return { hasCounter: false };
    }
    this._execInstant(unit, allies, defenders, skill);
    unit.skillUsed = true;
    this._updateAllCards();
    return { hasCounter: false };
  }

  _doAttack(unit, defenders, isPlayer) {
    const alive = defenders.filter(d => this._isAlive(d));
    if (!alive.length) return { hasCounter: false };

    const target = unit.targetId
      ? (alive.find(d => d.char.id === unit.targetId) ?? alive[Math.floor(Math.random() * alive.length)])
      : alive[Math.floor(Math.random() * alive.length)];
    unit.targetId = null;

    this._resolveExchange(unit, target, isPlayer);
    this._updateAllCards();
    return { hasCounter: false };
  }

  // ────────────────────────────────────────────────
  // 特技効果
  // ────────────────────────────────────────────────

  /** charge型: 必殺技発動 */
  _execSpecial(unit, defenders, skill) {
    const alive = defenders.filter(d => this._isAlive(d));
    if (!alive.length) return;

    const target = unit.targetId
      ? (alive.find(d => d.char.id === unit.targetId) ?? alive[0])
      : alive[Math.floor(Math.random() * alive.length)];
    unit.targetId = null;

    const cp   = this._charParams(unit, target);
    const type = skill?.specialType ?? unit.char.specialType ?? 'char_strike';

    if (type === 'sp_strike') {
      const count = Math.max(1, target.soldiers);
      const dmg   = this._calcDamage(count, this._calcRate(cp.charAtk, cp.defMemeVal));
      target.soldiers      = Math.max(0, target.soldiers - dmg);
      target.char.soldiers = target.soldiers;
      this._onLog(`💥 [必殺] ${unit.char.name} → ${target.char.name}: SP${dmg}体消散（残${target.soldiers}）`);
    } else {
      const dmg = this._calcDamage(unit.attackCount, this._calcRate(cp.charAtk, cp.defCharVal));
      target.charHp      = Math.max(0, target.charHp - dmg);
      target.char.charHp = target.charHp;
      this._onShake(target);
      this._onLog(`💥 [必殺] ${unit.char.name} → ${target.char.name}: HP-${dmg}（残${target.charHp}/${target.charMaxHp}）`);
    }
    this._onCardUpdate(target);
    this._applyPenalty(target);
  }

  /** instant型: 特技即時発動 */
  _execInstant(unit, allies, defenders, skill) {
    switch (skill.id) {
      case 'rally':
        allies.filter(u => this._isAlive(u)).forEach(u => { u._rallyBuff = (u._rallyBuff ?? 1) * 1.2; });
        this._onLog(`🎺 [特技] ${unit.char.name}「鼓舞」: 味方全体の攻撃 +20%`);
        break;
      case 'pierce':
        unit._pierce = true;
        this._onLog(`🔍 [特技] ${unit.char.name}「看破」: 次攻撃で相手防御を無視`);
        break;
      case 'fortress':
        unit._fortress = true;
        this._onLog(`🛡 [特技] ${unit.char.name}「鉄壁」: このラウンドの被ダメージを無効化`);
        break;
      case 'volley': {
        const N = Math.min(unit.soldiers, this.battleCapacity);
        defenders.filter(d => this._isAlive(d)).forEach(d => {
          const params = this._atkParams(unit, d);
          const rate   = this._calcRate(params.atkVal, params.defMemeVal, d.action === 'defend');
          const dmg    = Math.floor(this._calcDamage(N, rate) * params.mult * 0.5);
          d.soldiers        = Math.max(0, d.soldiers - dmg);
          d.char.soldiers   = d.soldiers;
          this._onLog(`🌀 [特技] ${unit.char.name}「乱撃」→ ${d.char.name}: SP${dmg}体消散（残${d.soldiers}）`);
          this._onCardUpdate(d);
        });
        break;
      }
      default:
        this._onLog(`[特技] ${unit.char.name}「${skill.name}」発動（効果未実装）`);
    }
  }

  // ────────────────────────────────────────────────
  // ダメージ計算
  // ────────────────────────────────────────────────

  /**
   * 攻撃パラメータを解決する（action基準）
   * @returns {{ atkVal, defMemeVal, defCharVal, mult, isSong, isRanged }}
   */
  _atkParams(atk, def) {
    const isSong   = atk.action === 'song';
    const isRanged = atk.action === 'ranged';

    const pierce   = atk._pierce;
    atk._pierce    = false;

    const atkRaw  = isSong
      ? Math.max(1, (atk.char.charSong ?? 20) + (atk.bonus.charSong ?? 0))
      : Math.max(1, (atk.char.soldierAtk ?? 10) + atk.bonus.soldierAtk);
    const atkVal  = atk._rallyBuff ? Math.round(atkRaw * atk._rallyBuff) : atkRaw;

    const defMemeVal = pierce ? 0 : def ? (isSong
      ? Math.max(1, (def.char.charSong ?? 20) + (def.bonus.charSong ?? 0))
      : Math.max(1, (def.char.soldierDef ?? 8) + def.bonus.soldierDef)) : 1;

    const defCharVal = pierce ? 0 : def ? (isSong
      ? Math.max(0, (def.char.charSong ?? 20) + (def.bonus.charSong ?? 0))
      : Math.max(0, def.charDefense ?? def.char.charDefense ?? 10)) : 1;

    const mult = isRanged ? 0.7 : isSong ? 0.8 : 1.0;
    return { atkVal, defMemeVal, defCharVal, mult, isSong, isRanged };
  }

  /** キャラ本体の攻撃パラメータ */
  _charParams(atk, def) {
    const isSong  = atk.action === 'song';
    const charAtk = isSong
      ? Math.max(1, (atk.char.charSong ?? 20) + (atk.bonus.charSong ?? 0))
      : Math.max(1, (atk.char.charAttack ?? atk.char.attack ?? 70) + (atk.bonus.charAttack ?? 0));
    return {
      charAtk,
      defMemeVal: Math.max(1, (def.char.soldierDef ?? 8) + def.bonus.soldierDef),
      defCharVal: Math.max(0, def.charDefense ?? def.char.charDefense ?? 10),
    };
  }

  _calcRate(atk, def, isDefending = false) {
    let r = atk > def ? (atk - def) * 8 : (8 + atk) - def;
    r = Math.max(1, Math.min(100, r)) - 1;
    if (isDefending) r -= Math.floor(Math.random() * 20);
    return Math.max(1, Math.min(100, r));
  }

  _calcDamage(N, rate) {
    if (N <= 0) return 0;
    if (N >= 81) {
      let d = Math.floor(N * rate / 100);
      return d <= 10
        ? Math.max(0, d + Math.floor(Math.random() * 3) - 1)
        : Math.max(0, Math.floor(d * (0.8 + Math.random() * 0.3)));
    }
    let d = 0;
    for (let i = 0; i < N; i++) if (Math.random() < rate / 100) d++;
    return d;
  }

  // ────────────────────────────────────────────────
  // 戦闘解決コア
  // ────────────────────────────────────────────────

  /**
   * 一方向ダメージを算出する（適用しない）
   * 返り値を _resolveExchange が双方同時適用する
   */
  _calcOneSide(atk, def, isAtkPlayer) {
    const p      = this._atkParams(atk, def);
    const N      = Math.min(atk.soldiers, this.battleCapacity);
    const atkSol = N;
    const vicSol = Math.min(def.soldiers, this.battleCapacity);
    const stratMult = this._strat(isAtkPlayer);

    const { toMeme, toChar } = _splitHits(N, vicSol, atkSol);

    // ① SP へのダメージ
    let memeDmg = 0;
    if (toMeme > 0 && def.soldiers > 0 && !def._fortress) {
      const rate = this._calcRate(p.atkVal, p.defMemeVal, def.action === 'defend');
      memeDmg    = Math.floor(this._calcDamage(toMeme, rate) * p.mult * stratMult);
    }

    // ② 将軍へのダメージ（charActive時のみ）
    let charDmg = 0;
    if (toChar > 0 && def.charHp > 0 && !def._fortress && def.soldiers < this.battleCapacity) {
      const rate = this._calcRate(p.atkVal, p.defCharVal);
      charDmg    = Math.floor(this._calcDamage(toChar, rate) * p.mult);
    }

    // ③ 将軍本人の攻撃
    let selfMemeDmg = 0, selfCharDmg = 0;
    if (atk.soldiers < this.battleCapacity && atk.charHp > 0 && def.action !== 'defend') {
      const cp     = this._charParams(atk, def);
      const defSol = Math.min(def.soldiers, this.battleCapacity);
      const extreme = defSol < 50 || defSol === 0 || (defSol > 0 && atkSol / defSol >= 10);
      if (extreme && Math.random() < 1 / (defSol + 1)) {
        if (def.charHp > 0 && !def._fortress) {
          selfCharDmg = this._calcDamage(atk.attackCount, this._calcRate(cp.charAtk, cp.defCharVal));
        }
      } else if (def.soldiers > 0 && !def._fortress) {
        const rate = this._calcRate(cp.charAtk, cp.defMemeVal, def.action === 'defend');
        selfMemeDmg = Math.floor(this._calcDamage(atk.attackCount, rate) * stratMult);
      }
    }

    return { memeDmg, charDmg, selfMemeDmg, selfCharDmg, N };
  }

  /** 攻撃と反撃を同時算出・同時適用 */
  _resolveExchange(atk, def, isPlayer) {
    const ar = this._calcOneSide(atk, def, isPlayer);
    const dr = (atk.action === 'attack' && def.char.attackType === 'melee' && this._isAlive(def))
      ? this._calcOneSide(def, atk, !isPlayer)
      : null;

    const atkMem = ar.memeDmg + ar.selfMemeDmg;
    const atkChr = ar.charDmg + ar.selfCharDmg;
    const defMem = dr ? dr.memeDmg + dr.selfMemeDmg : 0;
    const defChr = dr ? dr.charDmg + dr.selfCharDmg : 0;

    def.soldiers      = Math.max(0, def.soldiers - atkMem);
    def.char.soldiers = def.soldiers;
    atk.soldiers      = Math.max(0, atk.soldiers - defMem);
    atk.char.soldiers = atk.soldiers;
    let newDefHp = Math.max(0, def.charHp - atkChr);
    let newAtkHp = Math.max(0, atk.charHp - defChr);

    // 同時戦闘不能はプレイヤー側HP=1に補正
    if (newAtkHp <= 0 && newDefHp <= 0) {
      if (isPlayer) newAtkHp = 1; else newDefHp = 1;
    }
    atk.charHp      = newAtkHp;
    atk.char.charHp = atk.charHp;
    def.charHp      = newDefHp;
    def.char.charHp = def.charHp;

    // 一時フラグクリア
    def._fortress  = false;
    atk._fortress  = false;
    atk._rallyBuff = undefined;

    // ペナルティ・エフェクト
    this._applyPenalty(atk);
    this._applyPenalty(def);
    if (atkChr > 0 || defChr > 0) { this._onShake(def); this._onShake(atk); }
    if (atkMem > 0) this._onPopup(def, atkMem, '#c4427a');
    if (defMem > 0) this._onPopup(atk, defMem, '#c4427a');

    this._logExchange(atk, def, ar, dr, atkMem, atkChr, defMem, defChr);
    this._onExchangeResult(atk, def, {
      atkMem, atkChr, defMem, defChr,
      N:  ar.N,
      Nr: dr ? dr.N : 0,
    });
  }

  _logExchange(atk, def, ar, dr, atkMem, atkChr, defMem, defChr) {
    const label = { attack: '近接', ranged: '遠距離', song: '歌', skill: '特技' }[atk.action] ?? atk.action;
    this._onLog(`─ ${atk.char.name} が ${label} ▶ ${def.char.name}`);
    const ap = [atkMem > 0 && `SP${atkMem}体消散（残${def.soldiers}）`, atkChr > 0 && `HP-${atkChr}`].filter(Boolean);
    if (ap.length) this._onLog(`  [攻] N=${ar.N} → ${ap.join(' / ')}`);
    if (dr) {
      const dp = [defMem > 0 && `SP${defMem}体消散（残${atk.soldiers}）`, defChr > 0 && `HP-${defChr}`].filter(Boolean);
      if (dp.length) this._onLog(`  [被] N=${dr.N} → ${dp.join(' / ')}`);
    }
    this._onLog(`  HP: ${atk.char.name} ${atk.charHp}/${atk.charMaxHp}  ${def.char.name} ${def.charHp}/${def.charMaxHp}`);
  }

  // ────────────────────────────────────────────────
  // 作戦システム
  // ────────────────────────────────────────────────

  _initStrategy() {
    const maxRate = side => Math.max(0, ...side.map(u => u.char.strategyRate ?? 0));
    const pRate   = maxRate(this.playerSide);
    const eRate   = maxRate(this.enemySide);
    const diff    = Math.abs(pRate - eRate);

    if (diff <= 0 || Math.random() >= diff / 100) {
      this._onLog(`作戦: 両軍互角`);
      return;
    }

    const side  = pRate > eRate ? 'player' : 'enemy';
    const bonus = diff > 50 && Math.random() < (diff - 50) / 100 ? 0.5 : 0.1;
    const winnerSide = side === 'player' ? this.playerSide : this.enemySide;
    const winnerUnit = winnerSide.reduce((best, u) =>
      (u.char.strategyRate ?? 0) > (best.char.strategyRate ?? 0) ? u : best
    );
    this.strategyMult = { give: 0, take: 0, side, bonus, winnerChar: winnerUnit.char };
    this.strategyMult.give = side === 'player' ? 1 + bonus : 1 - bonus;
    this.strategyMult.take = side === 'player' ? 1 - bonus : 1 + bonus;

    this._onLog(`作戦成功（${side === 'player' ? 'プレイヤー' : '敵'}）: SPダメージ ${bonus === 0.5 ? '50' : '10'}%補正`);
  }

  /**
   * 攻撃側が受け取る作戦補正倍率（SP与ダメージに適用）
   */
  _strat(isAtkPlayer) {
    const { side, bonus } = this.strategyMult;
    if (!side) return 1.0;
    const atkWins = (isAtkPlayer && side === 'player') || (!isAtkPlayer && side === 'enemy');
    return atkWins ? 1 + bonus : 1 - bonus;
  }

  // ────────────────────────────────────────────────
  // ユーティリティ
  // ────────────────────────────────────────────────

  /** HP0ユニットに戦闘不能ペナルティをセット（死亡廃止） */
  _applyPenalty(unit) {
    if (unit.charHp <= 0 && !(unit.char.penaltyTurns > 0)) {
      unit.char.penaltyTurns = 2;
      this._onLog(`${unit.char.name} 戦闘不能（2ターンペナルティ）`);
      this._onCardUpdate(unit);
    }
  }

  _lossRatio(u) {
    const init = this._initStats.get(u.char.id);
    return init && init.soldiers > 0 ? 1 - u.soldiers / init.soldiers : 0;
  }

  _isAlive(unit)      { return !this.isDead(unit) && !unit.retreated; }
  _finish(atkWins)    { this.gameOver = true; this._onBattleEnd(atkWins); }
  _updateAllCards()   { [...this.playerSide, ...this.enemySide].forEach(u => this._onCardUpdate(u)); }
}
