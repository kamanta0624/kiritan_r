/**
 * ColorTokens.js — プロジェクト共通カラー定数
 *
 * デザイン方針：
 *   - メニュー・パネル類 → 案2「夜のボイロ文化圏」（深紫黒ベース）
 *   - マップ・戦闘シーン → 案4「平成の白昼夢」（白磁ベース）
 *
 * 16進数整数（Phaser用）と文字列（CSS/Phaserテキスト用）の両方を提供する。
 * カラーを変更する場合はこのファイルだけを修正すれば全画面に反映される。
 */

// ── プレイヤー主役色（きりたん瞳色・マゼンタ）
export const COLOR_PLAYER        = '#c4427a';
export const COLOR_PLAYER_INT    = 0xc4427a;

// ── アクセント・資金（稲穂金）
export const COLOR_ACCENT        = '#d4a044';
export const COLOR_ACCENT_INT    = 0xd4a044;

// ── サブカラー（青紫・情報テキスト・スカート色）
export const COLOR_SUB           = '#6a5a8a';
export const COLOR_SUB_INT       = 0x6a5a8a;

// ── 歌攻撃（ピンク）
export const COLOR_SONG          = '#e87aaa';
export const COLOR_SONG_INT      = 0xe87aaa;

// ── テキスト
export const COLOR_TEXT_PRIMARY  = '#f0ece4';   // 白磁
export const COLOR_TEXT_MUTED    = '#9a8aaa';   // 薄紫
export const COLOR_TEXT_DARK     = '#3a2a4a';   // 暗紫（非アクティブ）

// ── 背景
export const COLOR_BG_DEEP       = '#08060f';   // 最深部
export const COLOR_BG_PANEL      = '#0d0d1f';   // パネル
export const COLOR_BG_CARD       = '#1a1228';   // カード・ダーク

// ── ボーナス表示
export const COLOR_BONUS_POS     = '#88ffaa';   // プラス補正
export const COLOR_BONUS_NEG     = '#ff8888';   // マイナス補正

// ── 戦闘ダメージポップアップ
export const COLOR_DMG_SOLDIER   = '#c4427a';   // ミーム攻撃
export const COLOR_DMG_CHAR      = '#d4a044';   // キャラ本人攻撃
export const COLOR_DMG_SONG      = '#e87aaa';   // 歌攻撃

// ── ステータスバー
export const COLOR_BAR_HP_HIGH   = 0xc4427a;   // HP残量多
export const COLOR_BAR_HP_MID    = 0xd4a044;   // HP残量中
export const COLOR_BAR_HP_LOW    = 0xff4444;   // HP残量少
