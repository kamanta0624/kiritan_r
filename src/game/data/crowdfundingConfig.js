/**
 * crowdfundingConfig.js — クラファン挑戦・浅層探索の仮置き数値を1箇所に集約
 *
 * 仕様: docs/DESIGN_CROWDFUNDING.md §2-1・2-3・2-3b・2-4・2-5・2-6・3
 * 「必要ミームのフィボナッチ列 / 報酬の上昇量 / ボス戦の頻度と倍率 /
 *   浅層探索のミーム報酬量 / ストレッチゴールの追加報酬 / 進捗ポイントの係数 /
 *   敵の強さ抽選テーブル」はすべてここにまとめる。
 * 数値は全て仮置き。後で調整する。
 */

/**
 * 挑戦回数（cfChallengeCount）から必要ミームを返す。
 * フィボナッチ: 300, 300, 600, 900, 1500, 2400, …
 *
 * @param {number} challengeCount キャラの過去挑戦回数（0始まり）
 * @returns {number}
 */
export function requiredMeme(challengeCount) {
  let prev = 300, curr = 300; // f(0), f(1)
  const n = Math.max(0, challengeCount ?? 0);
  if (n <= 0) return prev;
  for (let i = 1; i < n; i++) { [prev, curr] = [curr, prev + curr]; }
  return curr;
}

/** ゴール達成時、7種共通で加算される本体・ミームパラメータ */
export const COMMON_REWARD = {
  charHp:      10,   // charMaxHp も同時に加算する（呼び出し側の規約）
  charAttack:  3,
  charDefense: 3,
  attackCount: 1,
  soldierAtk:  10,
  soldierDef:  10,
};

/** ゴール種別の rewardType ごとの固有報酬（COMMON_REWARD に加算） */
export const GOAL_REWARD = {
  song: { charSong: 10 },
  stat: { charHp: 20, charAttack: 5, charDefense: 5 },
  memeGrowthMult: { memeGrowthMult: 0.1 },
};

/** ストレッチゴール（ゴール達成後の追加戦闘）1勝あたりの追加報酬 */
export const STRETCH_REWARD = { soldierAtk: 5, soldierDef: 5 };

/** 何戦かに1度、選出数の代わりにステータス倍率をかける（ボス演出）。頻度・倍率とも仮置き */
export const BOSS_FREQUENCY = 3;
export const BOSS_MULT      = 1.5;

/** 浅層探索1勝あたりのミーム報酬（少なめ・仮置き） */
export const SHALLOW_MEME_REWARD = 30;

/** 浅層探索の敵数（対称化しない・ランダム） */
export const SHALLOW_ENEMY_COUNT_RANGE = [1, 2];

// ─────────────────────────────────────────────────────────────
// 進捗ポイント制（C-4・DESIGN_CROWDFUNDING.md §2-3・§2-3b）
// ─────────────────────────────────────────────────────────────

/**
 * 必要進捗ポイント = Σ(参加キャラの必要ミーム) × PROGRESS_COEFFICIENT
 * 参加人数が増えるほど Σ が伸びるため、人数分ゴールが遠のく（§2-3 の「1名→4名で約4倍」）。
 */
export const PROGRESS_COEFFICIENT = 0.3;

/** @param {number} requiredMemeSum 参加キャラの必要ミームの合計 */
export function requiredProgress(requiredMemeSum) {
  return Math.max(1, Math.round(requiredMemeSum * PROGRESS_COEFFICIENT));
}

/**
 * 敵の強さ抽選（§2-3b）: プレイヤー側の強さスコアが高いほど上位 tier が出やすくなる。
 * strengthScore の帯ごとに tier 1/2/3 の抽選重みを変える。
 */
export const STRENGTH_TIER_THRESHOLDS = [600, 1500]; // [低帯の上限, 中帯の上限)
export const TIER_WEIGHTS_BY_BAND = [
  [70, 25, 5],  // 低帯: tier1 が主体
  [30, 50, 20], // 中帯
  [10, 30, 60], // 高帯: tier3 が主体
];

/** @param {number} strengthScore §2-3b の本体パラメータ合計＋必要ミーム */
export function pickEnemyTier(strengthScore) {
  const bandIdx = strengthScore < STRENGTH_TIER_THRESHOLDS[0] ? 0
    : strengthScore < STRENGTH_TIER_THRESHOLDS[1] ? 1 : 2;
  const weights = TIER_WEIGHTS_BY_BAND[bandIdx];
  const total   = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    if (r < weights[i]) return i + 1; // tier は1始まり
    r -= weights[i];
  }
  return weights.length;
}

/** tier 抽選 → 該当 tier のプールからランダムに count 体選ぶ（該当なしは全体からフォールバック） */
export function drawTieredEnemyDefs(pool, count, strengthScore) {
  const picks = [];
  for (let i = 0; i < count; i++) {
    const tier = pickEnemyTier(strengthScore);
    const bucket = pool.filter(e => e.tier === tier);
    const candidates = bucket.length ? bucket : pool;
    picks.push(candidates[Math.floor(Math.random() * candidates.length)]);
  }
  return picks;
}
