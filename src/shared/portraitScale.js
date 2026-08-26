// カメラ(cm座標系)方式。PROMPT_adv_camera_and_defaults.md §1。
// PX_PER_CM を直接いじらせず、「地面から何cm〜何cmを画面に映すか」を
// VIEW_BOTTOM_CM / VIEW_TOP_CM の2値で決め、そこから逆算する。
// ?qa=adv のスライダで人間が実画面を見て決める値。コードに焼かず localStorage 経由で共有する。
export const VIEW_BOTTOM_CM_STORAGE_KEY = 'kiritan_view_bottom_cm';
export const VIEW_TOP_CM_STORAGE_KEY = 'kiritan_view_top_cm';
// 初期値は適当（どうせスライダで決める）。バストアップ寄りの範囲を仮に置く。
export const DEFAULT_VIEW_BOTTOM_CM = 60;
export const DEFAULT_VIEW_TOP_CM = 180;
export const BASE_HEIGHT_CM = 155; // DESIGN_PORTRAIT_SCALE.md §1

function getNum(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    const n = v != null ? parseFloat(v) : NaN;
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}
function setNum(key, v) {
  try { localStorage.setItem(key, String(v)); } catch { /* noop */ }
}

export function getViewBottomCm() { return getNum(VIEW_BOTTOM_CM_STORAGE_KEY, DEFAULT_VIEW_BOTTOM_CM); }
export function setViewBottomCm(v) { setNum(VIEW_BOTTOM_CM_STORAGE_KEY, v); }
export function getViewTopCm() { return getNum(VIEW_TOP_CM_STORAGE_KEY, DEFAULT_VIEW_TOP_CM); }
export function setViewTopCm(v) { setNum(VIEW_TOP_CM_STORAGE_KEY, v); }

// 立ち位置ごとの横アンカー比率（コンテナ幅に対する割合）。
// キャラの「体の中心」がこの位置に来るよう配置する（画像の端/中心ではない）。
export const ANCHOR_RATIO = { left: 0.25, center: 0.5, right: 0.75 };

/**
 * portrait.json の canvas/body と height_cm から、viewport(px)内での
 * 立ち絵の配置を計算する（§1-1、横位置は体の中心基準）。
 * viewBottomCm/viewTopCm は cm、viewportH は px。
 * 戻り値の imgTop はコンテナ上端からのpx（地面=足元が基準線に揃う）。
 * bodyCenterXPercent は画像内での体の中心X位置（%）。呼び出し側で
 *   left: `${anchorRatio*100}%`, transform: `translateX(-${bodyCenterXPercent}%) ...`,
 *   transformOrigin: `${bodyCenterXPercent}% 100%`
 * と組み合わせれば、コンテナ幅を実測しなくても体の中心がアンカー位置に揃う
 * （CSSの `%` transform は要素自身の幅基準のため）。
 */
export function computeGroundedFrame(portrait, heightCm, viewBottomCm, viewTopCm, viewportH) {
  const pxPerCm = viewportH / (viewTopCm - viewBottomCm);
  const scale = (heightCm * pxPerCm) / portrait.body.height;
  const imgH = portrait.canvas.h * scale;
  const imgW = portrait.canvas.w * scale;
  const groundY = viewportH + viewBottomCm * pxPerCm;
  const imgTop = groundY - portrait.body.bottom * scale;
  const bodyCenterXPercent = ((portrait.body.left + portrait.body.right) / 2 / portrait.canvas.w) * 100;
  return { imgTop, imgW, imgH, pxPerCm, scale, groundY, bodyCenterXPercent };
}
