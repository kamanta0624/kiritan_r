/**
 * BattleAI.js — 戦闘AI行動決定
 *
 * V3設計:
 *   selectAction(unit, options) — optionsから1つ選ぶ（ランダム固定）
 *   selectTarget(unit, pool)   — poolから1つ選ぶ（ランダム固定）
 *
 * V1/V2後方互換:
 *   decideAction / forceAction は従来通り動作
 */

const _isV2 = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('engineV2') === '1';
const _isV3 = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('engineV3') === '1';

export class BattleAI {

  // ────────────────────────────────────────────────
  // V3: 共通行動選択API
  // ────────────────────────────────────────────────

  /**
   * optionsから1つのactionを選択してunit.actionにセットする。
   * 現在はランダム固定。将来的に戦略パラメータで切り替え可能にする。
   *
   * @param {object} unit
   * @param {string[]} options - BattleSceneが計算した選択可能action一覧
   * @returns {string} 選択されたaction
   */
  static selectAction(unit, options) {
    if (!options || options.length === 0) {
      unit.action = 'defend';
      return 'defend';
    }
    // charged → special 優先
    if (unit.charged && options.includes('special')) {
      unit.action = 'special';
      return 'special';
    }
    // focus: HP>=90% かつ 20% 確率（charge型スキル持ちかつ未集中）
    if (unit.char?.skillId && options.includes('focus') && !unit.charged && !unit.skillUsed) {
      const hp = unit.charHp ?? 0;
      const maxHp = unit.charMaxHp ?? 1;
      if (hp >= maxHp * 0.9 && Math.random() < 0.2) {
        unit.action = 'focus';
        return 'focus';
      }
    }
    // 攻撃系を優先
    const attackOpts = options.filter(o => ['attack','ranged','song','special'].includes(o));
    const chosen = attackOpts.length > 0
      ? attackOpts[Math.floor(Math.random() * attackOpts.length)]
      : options[Math.floor(Math.random() * options.length)];
    unit.action = chosen;
    return chosen;
  }

  /**
   * poolから1つのtargetを選択してunit.targetIdにセットする。
   * 現在はランダム固定。将来的に戦略パラメータで切り替え可能にする。
   *
   * @param {object} unit
   * @param {object[]} pool - BattleSceneが計算した選択可能target一覧
   * @returns {object|null} 選択されたtargetユニット
   */
  static selectTarget(unit, pool) {
    if (!pool || pool.length === 0) return null;
    const target = pool[Math.floor(Math.random() * pool.length)];
    unit.targetId = target.char.id;
    return target;
  }

  // ────────────────────────────────────────────────
  // V1/V2後方互換
  // ────────────────────────────────────────────────

  static decideAction(unit, isPlayerUnit = false) {
    const isV2        = _isV2();
    const isSong      = unit.char.attackType === 'song';
    const isRanged    = unit.char.attackType === 'ranged';
    const isFront     = unit.position === 'front';
    const isRearMelee = !isFront && !isRanged && !isSong;

    if (isRearMelee) { unit.action = 'defend'; return 'defend'; }

    if (isV2) {
      const attackOptions = ['attack'];
      if (isRanged) attackOptions.push('ranged');
      if (isSong)   attackOptions.push('song');

      if (isPlayerUnit) {
        unit.action = attackOptions[Math.floor(Math.random() * attackOptions.length)];
        return unit.action;
      }
      const lowHealth = unit.soldiers < unit.maxSoldiers * 0.2;
      if (lowHealth && Math.random() < 1 / 3) {
        unit.action = 'defend';
      } else {
        const r = Math.random();
        if (r < 0.6)       unit.action = attackOptions[Math.floor(Math.random() * attackOptions.length)];
        else if (r < 0.85) unit.action = 'defend';
        else               unit.action = 'retreat';
      }
    } else {
      if (isPlayerUnit) { unit.action = isSong ? 'song' : 'attack'; return unit.action; }
      const lowHealth = unit.soldiers < unit.maxSoldiers * 0.2;
      if (lowHealth && Math.random() < 1 / 3) {
        unit.action = 'defend';
      } else {
        const r = Math.random();
        if (r < 0.6)       unit.action = isSong ? 'song' : 'attack';
        else if (r < 0.85) unit.action = 'defend';
        else               unit.action = 'retreat';
      }
    }
    return unit.action;
  }

  static forceAction(unit, forceAction) {
    const isV2        = _isV2();
    const isSong      = unit.char.attackType === 'song';
    const isRanged    = unit.char.attackType === 'ranged';
    const isFront     = unit.position === 'front';
    const isRearMelee = !isFront && !isRanged && !isSong;

    if (isRearMelee) {
      unit.action = 'defend';
    } else if (isV2 && forceAction === 'attack') {
      const opts = ['attack'];
      if (isRanged) opts.push('ranged');
      if (isSong)   opts.push('song');
      unit.action = opts[Math.floor(Math.random() * opts.length)];
    } else if (!isV2 && isSong && forceAction === 'attack') {
      unit.action = 'song';
    } else {
      unit.action = forceAction;
    }
    return unit.action;
  }
}
