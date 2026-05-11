/**
 * BattleBonus.js — battleBonus 共通ユーティリティ
 *
 * BattleScene.js と BasePanelBuilder.js に重複していた関数を一元化する。
 * 両ファイルからこのモジュールをimportして使用すること。
 *
 * 補正対象フィールド: soldierAtk / soldierDef / charAttack / charSong
 */

/** @type {{ soldierAtk: number, soldierDef: number, charAttack: number, charSong: number }} */
const EMPTY_BONUS = { soldierAtk: 0, soldierDef: 0, charAttack: 0, charSong: 0 };

/**
 * キャラクターの battleBonus を戦闘タイプ別に解決して返す。
 * battleBonus が未定義の場合はすべて 0 のオブジェクトを返す（後方互換）。
 *
 * @param {object} char - キャラクターオブジェクト
 * @param {'attack'|'defense'|'dungeon'} battleType - 戦闘タイプ
 * @returns {{ soldierAtk: number, soldierDef: number, charAttack: number, charSong: number }}
 */
export function resolveBonus(char, battleType) {
  if (!char.battleBonus) return { ...EMPTY_BONUS };
  return { ...EMPTY_BONUS, ...(char.battleBonus[battleType] ?? {}) };
}

/**
 * ボーナスの概要を短い文字列で返す（戦闘カードUI用）。
 * ゼロ値は省略。すべてゼロなら空文字を返す。
 *
 * 例: "兵攻+2 歌+5"
 *
 * @param {{ soldierAtk: number, soldierDef: number, charAttack: number, charSong: number }} bonus
 * @returns {string}
 */
export function bonusSummary(bonus) {
  const parts = [];
  if (bonus.soldierAtk !== 0) parts.push(`兵攻${bonus.soldierAtk > 0 ? '+' : ''}${bonus.soldierAtk}`);
  if (bonus.soldierDef !== 0) parts.push(`兵守${bonus.soldierDef > 0 ? '+' : ''}${bonus.soldierDef}`);
  if (bonus.charAttack !== 0) parts.push(`攻${bonus.charAttack > 0 ? '+' : ''}${bonus.charAttack}`);
  if (bonus.charSong   !== 0) parts.push(`歌${bonus.charSong   > 0 ? '+' : ''}${bonus.charSong}`);
  return parts.join(' ');
}

/**
 * ボーナスのプレビュー文字列を返す（パネルのキャラ選択カード用）。
 * bonusSummary と同じ出力。エイリアスとして提供。
 *
 * @param {{ soldierAtk: number, soldierDef: number, charAttack: number, charSong: number }} bonus
 * @returns {string}
 */
export const bonusPreviewText = bonusSummary;

/**
 * ボーナスの合計値に応じた表示色を返す。
 *
 * @param {{ soldierAtk: number, soldierDef: number, charAttack: number, charSong: number }} bonus
 * @returns {string} HEX カラー文字列
 */
export function bonusTextColor(bonus) {
  const total = (bonus.soldierAtk ?? 0)
              + (bonus.soldierDef ?? 0)
              + (bonus.charAttack ?? 0)
              + (bonus.charSong   ?? 0);
  if (total > 0) return '#88ffaa';
  if (total < 0) return '#ff8888';
  return '#556677';
}

/**
 * ボーナスの合計値に応じた戦闘カード用表示色を返す（背景が暗い場合向け）。
 *
 * @param {{ soldierAtk: number, soldierDef: number, charAttack: number, charSong: number }} bonus
 * @returns {string} HEX カラー文字列
 */
export function bonusSummaryColor(bonus) {
  const total = (bonus.soldierAtk ?? 0)
              + (bonus.soldierDef ?? 0)
              + (bonus.charAttack ?? 0)
              + (bonus.charSong   ?? 0);
  if (total > 0) return '#88ffaa';
  if (total < 0) return '#ff8888';
  return '#3a2a4a';
}
