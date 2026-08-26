/**
 * Affinity.js — 好感度（affinity）純関数ユーティリティ
 *
 * 仕様: docs/DESIGN_AFFINITY_BATTLE.md §1
 * state.affinity は疎（sparse）管理。値0のペアはキーを持たない。
 * React / GameContext には依存させないこと。
 */

/** 好感度の上限（Lv3＝カンスト） */
export const AFFINITY_MAX = 40;

/** Lv1 / Lv2 / Lv3 の閾値 */
export const AFFINITY_THRESHOLDS = [8, 20, 40];

/**
 * 2つの charId をソートして '__' で連結したキーを返す。
 *
 * @param {string} a
 * @param {string} b
 * @returns {string} 例: 'char_004__char_016'
 */
export function pairKey(a, b) {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

/**
 * ペアの好感度を返す。未登録なら 0。
 *
 * @param {Record<string, number>} affinity
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function getAffinity(affinity, a, b) {
  return affinity?.[pairKey(a, b)] ?? 0;
}

/**
 * ペアの好感度レベルを返す（0〜3）。
 *
 * @param {Record<string, number>} affinity
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function getAffinityLv(affinity, a, b) {
  const value = getAffinity(affinity, a, b);
  let lv = 0;
  AFFINITY_THRESHOLDS.forEach((th, i) => { if (value >= th) lv = i + 1; });
  return lv;
}

/**
 * ID配列から全ペア（重複なし・自分自身を除く）を返す。
 *
 * @param {string[]} ids
 * @returns {Array<[string, string]>} 例: 4件 → 6組
 */
export function allPairs(ids) {
  const pairs = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push([ids[i], ids[j]]);
    }
  }
  return pairs;
}

/**
 * 指定ペア群に好感度を加算した新しい affinity オブジェクトを返す（上限40でクランプ）。
 *
 * @param {Record<string, number>} affinity
 * @param {Array<[string, string]>} pairs
 * @param {number} amount
 * @returns {Record<string, number>}
 */
export function gainAffinity(affinity, pairs, amount) {
  const next = { ...(affinity ?? {}) };
  pairs.forEach(([a, b]) => {
    const key = pairKey(a, b);
    next[key] = Math.min(AFFINITY_MAX, (next[key] ?? 0) + amount);
  });
  return next;
}
