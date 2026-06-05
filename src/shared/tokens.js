// ── Design tokens ──────────────────────────────────────────
export const PK='#c4427a', PK2='#9e2d5f';
export const AC='#b87010', AC2='#d4a044';
export const TEAL='#1a8a96';
export const TX='#1c1020', TXD='rgba(28,16,32,.55)', TXF='rgba(28,16,32,.24)';
export const BR='rgba(0,0,0,.08)';

export const glass = (extra={}) => ({
  background:'rgba(255,253,251,.92)',
  backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
  border:'1px solid rgba(255,255,255,.8)',
  boxShadow:'0 2px 18px rgba(0,0,0,.13)',
  ...extra,
});

// ── Game state (shared across scenes) ────────────────────
export const GAME_STATE = {
  turn: 1,
  meme: 500,
  income: 600,
  bases: '11/92',
  round: '1 / 5',
};

// ── Character data ────────────────────────────────────────
export const ROLES = {
  front:  {label:'前衛', color:PK,        bg:'rgba(196,66,122,.12)'},
  ranged: {label:'間接', color:TEAL,      bg:'rgba(26,138,150,.12)'},
  rear:   {label:'後衛', color:AC,        bg:'rgba(184,112,16,.12)'},
  support:{label:'支援', color:'#6a55b0', bg:'rgba(106,85,176,.12)'},
};

export const CHARS = [
  {id:'c1', name:'東北きりたん', kana:'とうほく きりたん', portrait:'assets/portrait_kiritan.png',
   role:'front', atk:6, def:4, meme:620, memeMax:800, spd:7,
   origin:'東北', skill:'連続攻撃', skillDesc:'同ターンに2回攻撃できる',
   joined:true, quote:'みんなのために戦います！'},
  {id:'c2', name:'音街ウナ', kana:'おとまち うな', portrait:'assets/portrait_una.png',
   role:'ranged', atk:3, def:3, meme:5000, memeMax:5000, spd:5,
   origin:'東北', skill:'超波動', skillDesc:'広範囲の敵のミームを大幅に削る',
   joined:true, quote:'音楽で世界を変えるよ！'},
  {id:'c3', name:'彩澄しゅお', kana:'あやすみ しゅお', portrait:'assets/portrait_shuo.png',
   role:'ranged', atk:4, def:3, meme:320, memeMax:400, spd:6,
   origin:'東北', skill:'精密射撃', skillDesc:'敵単体に確実にダメージを与える',
   joined:true, quote:'狙った標的は外さない。'},
  {id:'c4', name:'ずんだもん', kana:'ずんだもん', portrait:'assets/portrait_zundamon.png',
   role:'rear', atk:4, def:9, meme:400, memeMax:400, spd:4,
   origin:'東北', skill:'ずんだの守り', skillDesc:'味方全体の防御を1ターン強化',
   joined:true, quote:'なのだ！絶対に守るのだ！'},
  {id:'c5', name:'北海道めろん', kana:'ほっかいどう めろん', portrait:'assets/portrait_meron.png',
   role:'front', atk:10, def:8, meme:500, memeMax:500, spd:8,
   origin:'北海道', skill:'大地の咆哮', skillDesc:'前列全体に強力なダメージ',
   joined:true, quote:'北の大地の力、見せてやる。'},
  {id:'c6', name:'ベルン', kana:'べるん', portrait:'assets/portrait_bern_fog.png',
   role:'rear', atk:8, def:10, meme:518, memeMax:518, spd:3,
   origin:'北海道', skill:'霧の障壁', skillDesc:'味方全体にシールドを展開',
   joined:true, quote:'……守ります。'},
  {id:'c7', name:'沖縄あわも', kana:'おきなわ あわも', portrait:'assets/portrait_awamo.png',
   role:'front', atk:10, def:8, meme:500, memeMax:500, spd:9,
   origin:'沖縄', skill:'南風一閃', skillDesc:'単体に素早く2連撃',
   joined:true, quote:'太陽みたいに突っ込むよ！'},
  {id:'c8',  name:'伊達かがみ', kana:'だて かがみ', portrait:null,
   role:'support', atk:3, def:5, meme:0, memeMax:300, spd:6,
   origin:'東北', skill:'策士の眼', skillDesc:'???', joined:false, quote:''},
  {id:'c9',  name:'花巻ほのか', kana:'はなまき ほのか', portrait:null,
   role:'rear', atk:5, def:7, meme:0, memeMax:350, spd:4,
   origin:'東北', skill:'???', skillDesc:'???', joined:false, quote:''},
  {id:'c10', name:'山形さくら', kana:'やまがた さくら', portrait:null,
   role:'ranged', atk:6, def:4, meme:0, memeMax:280, spd:7,
   origin:'東北', skill:'???', skillDesc:'???', joined:false, quote:''},
  {id:'c11', name:'函館みなみ', kana:'はこだて みなみ', portrait:null,
   role:'support', atk:2, def:6, meme:0, memeMax:260, spd:5,
   origin:'北海道', skill:'???', skillDesc:'???', joined:false, quote:''},
  {id:'c12', name:'釧路そら', kana:'くしろ そら', portrait:null,
   role:'ranged', atk:5, def:3, meme:0, memeMax:320, spd:8,
   origin:'北海道', skill:'???', skillDesc:'???', joined:false, quote:''},
  {id:'c13', name:'旭川ゆき', kana:'あさひかわ ゆき', portrait:null,
   role:'front', atk:7, def:6, meme:0, memeMax:400, spd:6,
   origin:'北海道', skill:'???', skillDesc:'???', joined:false, quote:''},
  {id:'c14', name:'帯広ひかり', kana:'おびひろ ひかり', portrait:null,
   role:'rear', atk:4, def:8, meme:0, memeMax:380, spd:3,
   origin:'北海道', skill:'???', skillDesc:'???', joined:false, quote:''},
  {id:'c15', name:'会津あおい', kana:'あいず あおい', portrait:null,
   role:'support', atk:3, def:5, meme:0, memeMax:290, spd:6,
   origin:'東北', skill:'???', skillDesc:'???', joined:false, quote:''},
];

// export to window
Object.assign(window, {
  PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR,
  glass, GAME_STATE, ROLES, CHARS,
});