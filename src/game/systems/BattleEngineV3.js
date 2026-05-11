/**
 * BattleEngineV3.js — 戦闘システム完全再設計版
 *
 * 設計思想:
 * - N体（min(soldiers, battleCapacity)）が突撃し、N回分の攻撃判定が発生
 * - ミームへの命中数 + 将軍への命中数 = N（常に成立）
 * - 攻撃と反撃は同時処理（相手が死んでも反撃ダメージは成立）
 * - 同時にcharHp<=0になる場合はプレイヤー側を1に補正
 * - 部隊消滅条件: charHp <= 0 のみ
 * - 攻撃種別はaction（attack/ranged/song）で決定。attackTypeは初期値の参照のみ
 */

import { resolveBonus } from '../utils/BattleBonus.js';

const MAX_ROUNDS = 5;

// ────────────────────────────────────────────────
// 内部ユーティリティ
// ────────────────────────────────────────────────

/** rand(0.8~1.2) のブレ係数 */
const _jitter = () => 0.8 + Math.random() * 0.4;

/**
 * 攻撃N回分をミーム命中・将軍命中に振り分ける（一括計算）
 * @returns {{ toMeme: number, toChar: number }}
 */
function _split(N, vicSol, atkSol) {
  if (N <= 0) return { toMeme: 0, toChar: 0 };

  const isExtreme = vicSol < 50 || (vicSol > 0 && atkSol / vicSol >= 10) || vicSol === 0;
  let p_char;

  if (isExtreme) {
    p_char = 1 / (vicSol + 1); // 100/(残存+1)%
  } else {
    const deficit_ratio = 1 - vicSol / atkSol;
    p_char = deficit_ratio <= 0.3
      ? 0
      : Math.pow(deficit_ratio - 0.3, 2) * 0.5;
  }

  const toChar = Math.min(N, Math.max(0, Math.round(N * p_char * _jitter())));
  return { toMeme: N - toChar, toChar };
}

// ────────────────────────────────────────────────
export class BattleEngineV3 {
  constructor(opts) {
    this.playerSide     = opts.playerSide;
    this.enemySide      = opts.enemySide;
    this.mode           = opts.mode;
    this.battleCapacity = opts.battleCapacity;

    this._onLog        = opts.onLog        ?? (() => {});
    this._onCardUpdate = opts.onCardUpdate ?? (() => {});
    this._onShake      = opts.onShake      ?? (() => {});
    this._onPopup      = opts.onPopup      ?? (() => {});
    this._onRoundEnd   = opts.onRoundEnd   ?? (() => {});
    this._onBattleEnd  = opts.onBattleEnd  ?? (() => {});
    this._delayedCall  = opts.delayedCall  ?? ((ms, fn) => setTimeout(fn, ms));

    this.round    = 0;
    this.gameOver = false;
    this._initStats = new Map();
  }

  // ────────────────────────────────────────────────
  // 公開 API（BattleSceneと互換）
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
    return { round: this.round, maxRounds: MAX_ROUNDS };
  }

  nextActor() {
    const candidates = [
      ...this.playerSide.map(u => ({ u, isPlayer: true  })),
      ...this.enemySide .map(u => ({ u, isPlayer: false })),
    ].filter(({ u }) => !this.isDead(u) && !u.retreated && !u._actedThisRound);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.u.soldiers - b.u.soldiers);
    return candidates[0];
  }

  markActed(unit) { unit._actedThisRound = true; }

  executeAction(unit, isPlayer) {
    const defenders = isPlayer ? this.enemySide : this.playerSide;

    if (unit.action === 'retreat') {
      unit.retreated = true;
      this._onLog(`${unit.char.name} が撤退`);
      this._onCardUpdate(unit);
      const attackSide     = this.mode === 'attack' ? this.playerSide : this.enemySide;
      const retreaterIsAtk = attackSide.includes(unit);
      this._delayedCall(300, () => this._finishBattle(!retreaterIsAtk));
      return { hasCounter: false };
    }

    if (unit.action === 'defend') {
      this._onLog(`${unit.char.name} が防御`);
      return { hasCounter: false };
    }

    const alive = defenders.filter(d => this._isAlive(d));
    if (alive.length === 0) return { hasCounter: false };

    // targetIdはBattleScene側で確定済み。未セットの場合はフォールバックでランダム選択
    let target = alive[Math.floor(Math.random() * alive.length)];
    if (unit.targetId) {
      target = alive.find(d => d.char.id === unit.targetId) ?? target;
      unit.targetId = null;
    }

    this._resolveExchange(unit, target, isPlayer);
    this._updateAllCards();
    return { hasCounter: false }; // 反撃は _resolveExchange 内で同時処理済み
  }

  advance() {}
  isRoundOver() { return false; } // nextActor()で管理

  checkGameOver() {
    const pAlive   = this.playerSide.some(u => this._isAlive(u));
    const eAlive   = this.enemySide.some(u => this._isAlive(u));
    const atkAlive = this.mode === 'attack' ? pAlive : eAlive;
    const defAlive = this.mode === 'attack' ? eAlive : pAlive;
    if (!defAlive || !atkAlive) {
      this._delayedCall(300, () => this._finishBattle(!defAlive && atkAlive));
      return true;
    }
    return false;
  }

  checkRoundLimit() {
    if (this.round >= MAX_ROUNDS) {
      this._delayedCall(300, () => this._finishBattle(false));
      return true;
    }
    return false;
  }

  isDead(unit) { return unit.charHp <= 0; }

  applyRetreatRule(rule, side) {
    if (!rule || rule === 'never') return;
    const alive = side.filter(u => this._isAlive(u));
    if (alive.length === 0) return;
    let shouldRetreat = false;
    switch (rule) {
      case 'loss_25':
        shouldRetreat = alive.some(u => {
          const init = this._initStats.get(u.char.id);
          return init && init.soldiers > 0 && (1 - u.soldiers / init.soldiers) > 0.25;
        }); break;
      case 'loss_50':
        shouldRetreat = alive.some(u => {
          const init = this._initStats.get(u.char.id);
          return init && init.soldiers > 0 && (1 - u.soldiers / init.soldiers) > 0.50;
        }); break;
      case 'hp_any':
        shouldRetreat = alive.some(u => {
          const init = this._initStats.get(u.char.id);
          return init && u.charHp < init.charHp;
        }); break;
      case 'char_dead':
        shouldRetreat = side.some(u => u.charHp <= 0); break;
    }
    if (shouldRetreat) {
      alive.forEach(u => {
        u.soldiers  = Math.floor(u.soldiers * 0.5);
        u.retreated = true;
        this._onLog(`${u.char.name} が撤退（撤退ルール: ${rule}）`);
        this._onCardUpdate(u);
      });
    }
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
      attackCount: char.attackCount ?? 8,
      charDefense: char.charDefense ?? 10,
      level:       char.level       ?? 0,
      targetId:    null,
    };
  }

  // ────────────────────────────────────────────────
  // 内部: パラメータ解決
  // ────────────────────────────────────────────────

  /** action に応じた攻撃/防御パラメータを返す */
  _params(atk, def) {
    const isSong   = atk.action === 'song';
    const isRanged = atk.action === 'ranged';

    const atkVal = isSong
      ? Math.max(1, (atk.char.charSong ?? 20) + (atk.bonus.charSong ?? 0))
      : Math.max(1, (atk.char.soldierAtk ?? 10) + atk.bonus.soldierAtk);

    const defMemeVal = isSong
      ? Math.max(1, (def.char.charSong ?? 20) + (def.bonus.charSong ?? 0))
      : Math.max(1, (def.char.soldierDef ?? 8) + def.bonus.soldierDef);

    const defCharVal = isSong
      ? Math.max(0, (def.char.charSong ?? 20) + (def.bonus.charSong ?? 0))
      : Math.max(0, def.charDefense ?? def.char.charDefense ?? 10);

    const damageMult = isRanged ? 0.7 : isSong ? 0.8 : 1.0;
    const canCounter = !isRanged && !isSong; // melee のみ反撃

    return { atkVal, defMemeVal, defCharVal, damageMult, isSong, isRanged, canCounter };
  }

  /** 将軍本人攻撃のパラメータ（action基準） */
  _charParams(atk, def) {
    const isSong = atk.action === 'song';
    const charAtk = isSong
      ? Math.max(1, (atk.char.charSong ?? 20) + (atk.bonus.charSong ?? 0))
      : Math.max(1, (atk.char.charAttack ?? atk.char.attack ?? 70) + (atk.bonus.charAttack ?? 0));
    const defMemeVal = isSong
      ? Math.max(1, (def.char.charSong ?? 20) + (def.bonus.charSong ?? 0))
      : Math.max(1, (def.char.soldierDef ?? 8) + def.bonus.soldierDef);
    const defCharVal = isSong
      ? Math.max(0, (def.char.charSong ?? 20) + (def.bonus.charSong ?? 0))
      : Math.max(0, def.charDefense ?? def.char.charDefense ?? 10);
    return { charAtk, defMemeVal, defCharVal };
  }

  // ────────────────────────────────────────────────
  // 内部: ダメージ計算
  // ────────────────────────────────────────────────

  _calcRate(atk, def, isDefending = false) {
    let rate = atk > def ? (atk - def) * 8 : (8 + atk) - def;
    rate = Math.max(1, Math.min(100, rate));
    if (isDefending) rate -= 1 + Math.floor(Math.random() * 20);
    else             rate -= 1;
    return Math.max(1, Math.min(100, rate));
  }

  _calcDamage(N, rate) {
    if (N <= 0) return 0;
    if (N >= 81) {
      let dmg = Math.floor(N * rate / 100);
      dmg = dmg <= 10
        ? Math.max(0, dmg + Math.floor(Math.random() * 3) - 1)
        : Math.max(0, Math.floor(dmg * (0.80 + Math.random() * 0.30)));
      return dmg;
    }
    let dmg = 0;
    for (let i = 0; i < N; i++) if (Math.random() < rate / 100) dmg++;
    return dmg;
  }

  // ────────────────────────────────────────────────
  // 内部: コアロジック
  // ────────────────────────────────────────────────

  /**
   * atk→def の一方向ダメージを算出する（適用はしない）
   * @returns {{ memeDmg, charDmg, toMeme, toChar, N, p }}
   */
  _calcOneSide(atk, def) {
    const p = this._params(atk, def);
    const N = Math.min(atk.soldiers, this.battleCapacity);

    const atkSol = N;
    const vicSol = Math.min(def.soldiers, this.battleCapacity);

    // ミーム攻撃の振り分け
    const { toMeme, toChar } = _split(N, vicSol, atkSol);

    // ミームへのダメージ
    let memeDmg = 0;
    if (toMeme > 0 && def.soldiers > 0) {
      const rate = this._calcRate(p.atkVal, p.defMemeVal, def.action === 'defend');
      memeDmg = Math.floor(this._calcDamage(toMeme, rate) * p.damageMult);
    }

    // 将軍へのダメージ
    let charDmg = 0;
    if (toChar > 0 && def.charHp > 0) {
      const charActive = def.soldiers < this.battleCapacity;
      if (charActive) {
        const rate = this._calcRate(p.atkVal, p.defCharVal, false);
        charDmg = Math.floor(this._calcDamage(toChar, rate) * p.damageMult);
      }
    }

    // 将軍本人の攻撃
    let charSelfMemeDmg = 0;
    let charSelfCharDmg = 0;
    const selfActive = atk.soldiers < this.battleCapacity && atk.charHp > 0;
    if (selfActive && def.action !== 'defend') {
      const cp     = this._charParams(atk, def);
      const defSol = Math.min(def.soldiers, this.battleCapacity);
      const isExtreme = defSol < 50 || (defSol > 0 && atkSol / defSol >= 10) || defSol === 0;

      if (isExtreme) {
        const p_char = 1 / (defSol + 1);
        if (Math.random() < p_char) {
          // 全攻撃が将軍へ
          if (def.charHp > 0) {
            const rate = this._calcRate(cp.charAtk, cp.defCharVal, false);
            charSelfCharDmg = this._calcDamage(atk.attackCount, rate);
          }
        } else {
          // 全攻撃がミームへ
          if (def.soldiers > 0) {
            const rate = this._calcRate(cp.charAtk, cp.defMemeVal, def.action === 'defend');
            charSelfMemeDmg = this._calcDamage(atk.attackCount, rate);
          }
        }
      } else {
        // 通常時: 全てミームへ
        if (def.soldiers > 0) {
          const rate = this._calcRate(cp.charAtk, cp.defMemeVal, def.action === 'defend');
          charSelfMemeDmg = this._calcDamage(atk.attackCount, rate);
        }
      }
    }

    return { memeDmg, charDmg, charSelfMemeDmg, charSelfCharDmg, toMeme, toChar, N, p };
  }

  /**
   * 攻撃と反撃を同時算出して適用する。
   * melee同士のとき def→atk も同時に計算。
   */
  _resolveExchange(atk, def, isPlayer) {
    const atkResult = this._calcOneSide(atk, def);
    const defResult = atk.action === 'attack' && def.char.attackType === 'melee' && this._isAlive(def)
      ? this._calcOneSide(def, atk)
      : null;

    // ── ダメージ適用 ──
    // atk→def
    const atkMemeDmg     = atkResult.memeDmg + atkResult.charSelfMemeDmg;
    const atkCharDmg     = atkResult.charDmg + atkResult.charSelfCharDmg;
    def.soldiers = Math.max(0, def.soldiers - atkMemeDmg);
    let newDefHp = Math.max(0, def.charHp - atkCharDmg);

    // def→atk（同時）
    let newAtkHp = atk.charHp;
    let defMemeDmgTotal = 0;
    let defCharDmgTotal = 0;
    if (defResult) {
      defMemeDmgTotal = defResult.memeDmg + defResult.charSelfMemeDmg;
      defCharDmgTotal = defResult.charDmg + defResult.charSelfCharDmg;
      atk.soldiers = Math.max(0, atk.soldiers - defMemeDmgTotal);
      newAtkHp     = Math.max(0, atk.charHp - defCharDmgTotal);
    }

    // 同時死亡補正: プレイヤー側HP=1
    if (newAtkHp <= 0 && newDefHp <= 0) {
      if (isPlayer) newAtkHp = 1;
      else          newDefHp = 1;
    }

    atk.charHp = newAtkHp;
    def.charHp = newDefHp;

    if (atkCharDmg > 0 || defCharDmgTotal > 0) {
      this._onShake(def);
      this._onShake(atk);
    }
    if (atkMemeDmg > 0) this._onPopup(def, atkMemeDmg, '#c4427a');
    if (defMemeDmgTotal > 0) this._onPopup(atk, defMemeDmgTotal, '#c4427a');

    // ── ログ出力 ──
    this._log(atk, def, atkResult, defResult, atkMemeDmg, atkCharDmg, defMemeDmgTotal, defCharDmgTotal);
  }

  _log(atk, def, ar, dr, atkMemeDmg, atkCharDmg, defMemeDmg, defCharDmg) {
    const actionLabel = { attack: '近接', ranged: '遠距離', song: '歌' }[atk.action] ?? atk.action;
    const lines = [];

    lines.push(`─ ${atk.char.name} が ${actionLabel} ▶ ${def.char.name}`);

    // ミーム攻撃
    const memeParts = [];
    if (atkMemeDmg > 0)  memeParts.push(`ミーム${atkMemeDmg}体消散（残${def.soldiers}）`);
    if (atkCharDmg > 0)  memeParts.push(`将軍に${atkCharDmg}ダメージ`);
    if (memeParts.length > 0) lines.push(`  [攻] N=${ar.N} → ${memeParts.join(' / ')}`);

    // 同時反撃
    if (dr) {
      const defParts = [];
      if (defMemeDmg > 0) defParts.push(`ミーム${defMemeDmg}体消散（残${atk.soldiers}）`);
      if (defCharDmg > 0) defParts.push(`将軍に${defCharDmg}ダメージ`);
      if (defParts.length > 0) lines.push(`  [被] N=${dr.N} → ${defParts.join(' / ')}`);
    }

    // HP
    lines.push(`  HP: ${atk.char.name} ${atk.charHp}/${atk.charMaxHp}  ${def.char.name} ${def.charHp}/${def.charMaxHp}`);

    lines.forEach(l => this._onLog(l));
  }

  // ────────────────────────────────────────────────
  // 内部: ユーティリティ
  // ────────────────────────────────────────────────

  _isAlive(unit) { return !this.isDead(unit) && !unit.retreated; }
  _finishBattle(attackerWins) { this.gameOver = true; this._onBattleEnd(attackerWins); }
  _updateAllCards() { [...this.playerSide, ...this.enemySide].forEach(u => this._onCardUpdate(u)); }
}
