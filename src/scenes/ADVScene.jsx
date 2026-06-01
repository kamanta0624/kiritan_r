import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass, GAME_STATE, ROLES, CHARS } from '../shared/tokens.js';
import { TopBar } from '../shared/SharedUI.jsx';
import { useGame } from '../context/GameContext.jsx';

// ── Scenario data ────────────────────────────────────────
// expr: 'normal' (default), 'smile', 'angry', 'surprised', 'thinking'
//       — 表情差分は portrait_<id>_<expr>.png を読みに行き、無ければ通常立ち絵にフォールバック
// type: 'narration' (no speaker, full-width gray box), 'dialog' (speaker label + text)
//       'cutin' (special — full-screen close-up with quote, ペルソナ風カットイン)
export const DEMO_CAST = [
  { id:'c1', pos:'left' },
  { id:'c4', pos:'center' },
  { id:'c3', pos:'right' },
];
export const DEMO_BG = 'assets/bg_battle.jpg';
export const DEMO_LOCATION = '東北 — 仙台城本丸';

const DEMO_SCENARIO = [
  { type:'narration', text:'長きにわたる遠征を経て、東北家は仙台へと帰還した。' },

  { type:'dialog', speaker:'c1', expr:'normal',
    text:'みんな、ご苦労さまでした。' },

  { type:'dialog', speaker:'c1', expr:'smile',
    text:'今回の遠征、無事に終えられたのは…全員のおかげです。' },

  { type:'dialog', speaker:'c4', expr:'smile',
    text:'なのだー！ずんだもんの守りが効いたのだ！' },

  { type:'dialog', speaker:'c3', expr:'normal',
    text:'ふふ、ずんだもんが一番頑張ったとは言えませんが…まあ、よしとしましょう。' },

  { type:'dialog', speaker:'c4', expr:'angry',
    text:'なっ…！しゅおさん、それは聞き捨てならないのだ！' },

  { type:'dialog', speaker:'c3', expr:'smile',
    text:'冗談ですよ、ずんだもん。' },

  // ペルソナ風カットイン
  { type:'cutin', speaker:'c1', expr:'normal',
    text:'…でも、敵もこのまま黙ってはいないはず。', subtext:'次の動きを警戒します' },

  { type:'dialog', speaker:'c1', expr:'thinking',
    text:'特に大都会連合…あの物量は脅威です。' },

  { type:'dialog', speaker:'c3', expr:'normal',
    text:'同感ですね。北海道勢の動きも気になります。' },

  { type:'dialog', speaker:'c4', expr:'normal',
    text:'みんなで力を合わせれば、なんとかなるのだ！' },

  { type:'dialog', speaker:'c1', expr:'smile',
    text:'…そうですね。次のターンも、よろしくお願いします。' },

  { type:'narration', text:'こうして、東北家の新たなターンが始まろうとしていた。' },

  { type:'end' },
];

// ── Helper: get character + portrait ──────────────────────
function getChar(id) {
  return CHARS.find(c => c.id === id);
}
function getPortrait(char, expr) {
  if(!char) return null;
  // 差分対応（無ければベース立ち絵）
  if(expr && expr !== 'normal' && char.portrait) {
    // assets/portrait_kiritan.png → assets/portrait_kiritan_smile.png
    const variant = char.portrait.replace(/\.(png|jpg|jpeg)$/i, `_${expr}.$1`);
    // 実ファイルが無くてもonErrorで元立ち絵にフォールバックする実装
    return { primary: variant, fallback: char.portrait };
  }
  return { primary: char.portrait, fallback: null };
}

// ── Standing portrait ────────────────────────────────────
function StandingChar({ char, expr, pos, isActive, isSpeaking }) {
  const portrait = getPortrait(char, expr);
  if(!portrait?.primary) {
    return (
      <div style={{
        position:'absolute',
        bottom: isSpeaking ? '-2%' : '-6%',
        left:  pos==='left' ? '6%' : pos==='center' ? '50%' : 'auto',
        right: pos==='right' ? '6%' : 'auto',
        transform: pos==='center'
          ? `translateX(-50%) ${isSpeaking ? 'scale(1.04)' : 'scale(1)'}`
          : isSpeaking ? 'scale(1.04)' : 'scale(1)',
        width:'min(28vw, 340px)', height:'76%',
        display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'flex-end',
        paddingBottom:20,
        transition:'all .45s cubic-bezier(.16,1,.3,1)',
        filter: isSpeaking
          ? 'drop-shadow(0 12px 30px rgba(0,0,0,.5))'
          : 'brightness(.4)',
        zIndex: isSpeaking ? 5 : 2,
        pointerEvents:'none',
      }}>
        <svg viewBox="0 0 120 240" width="60%" style={{opacity: isSpeaking ? .45 : .2}}>
          <ellipse cx="60" cy="36" rx="28" ry="32" fill="rgba(255,255,255,.9)"/>
          <path d="M12 240 Q20 140 60 130 Q100 140 108 240Z" fill="rgba(255,255,255,.9)"/>
        </svg>
        {char && isSpeaking && (
          <div style={{
            fontFamily:"'Noto Sans JP'", fontSize:11, color:'rgba(255,255,255,.5)',
            letterSpacing:'.2em', marginTop:8,
          }}>{char.name}</div>
        )}
      </div>
    );
  }

  const [imgSrc, setImgSrc] = useState(portrait.primary);
  useEffect(() => { setImgSrc(portrait.primary); }, [portrait.primary]);

  // Position offset
  const baseLeft = pos==='left' ? '6%' : pos==='center' ? '50%' : 'auto';
  const baseRight = pos==='right' ? '6%' : 'auto';
  const baseTransform = pos==='center' ? 'translateX(-50%)' : 'none';

  return (
    <div style={{
      position:'absolute',
      bottom: isSpeaking ? '-2%' : '-6%',
      left:  baseLeft,
      right: baseRight,
      transform: `${baseTransform} ${isSpeaking ? 'scale(1.04)' : 'scale(1)'}`,
      transformOrigin: pos==='center' ? '50% 100%' : pos==='left' ? '10% 100%' : '90% 100%',
      width:'min(32vw, 460px)',
      height:'92%',
      transition:'all .45s cubic-bezier(.16,1,.3,1), filter .3s',
      filter: isSpeaking
        ? 'brightness(1.05) saturate(1.1) drop-shadow(0 12px 30px rgba(0,0,0,.5))'
        : 'brightness(.4) saturate(.5) drop-shadow(0 4px 14px rgba(0,0,0,.5))',
      zIndex: isSpeaking ? 5 : 2,
      pointerEvents:'none',
    }}>
      <img
        src={imgSrc}
        alt={char.name}
        onError={() => { if(portrait.fallback && imgSrc !== portrait.fallback) setImgSrc(portrait.fallback); }}
        style={{
          width:'100%', height:'100%',
          objectFit:'contain', objectPosition:'bottom center',
          display:'block',
        }}
      />
      {/* Speaker glow ring (only when speaking) */}
      {isSpeaking && (
        <div style={{
          position:'absolute', inset:'auto -8% -3% -8%', height:'30%',
          background:`radial-gradient(ellipse at center bottom, ${PK}55, transparent 70%)`,
          pointerEvents:'none',
          animation:'fadeIn .35s ease both',
        }}/>
      )}
    </div>
  );
}

// ── Speaker name tag (ペルソナ風斜めパネル) ──────────────
function SpeakerTag({ char, color }) {
  return (
    <div style={{
      display:'inline-flex', alignItems:'center',
      transform:'skewX(-12deg)',
      background: `linear-gradient(110deg, ${color}, ${color}dd)`,
      padding:'8px 26px 8px 22px',
      boxShadow:`0 4px 18px ${color}66, inset 0 -2px 0 rgba(0,0,0,.25)`,
      animation:'tagSlide .35s cubic-bezier(.16,1,.3,1) both',
    }}>
      <div style={{
        transform:'skewX(12deg)',
        display:'flex', alignItems:'baseline', gap:8,
      }}>
        <span style={{
          fontFamily:"'Zen Maru Gothic'", fontSize:16, fontWeight:900,
          color:'#fff', letterSpacing:'.06em',
          textShadow:'0 1px 2px rgba(0,0,0,.4)',
        }}>{char.name}</span>
        <span style={{
          fontFamily:'Rajdhani', fontSize:9, fontWeight:600,
          color:'rgba(255,255,255,.7)', letterSpacing:'.18em',
        }}>{(char.role||'').toUpperCase()}</span>
      </div>
    </div>
  );
}

// ── Type-on text ─────────────────────────────────────────
function useTypewriter(text, speed=24, paused=false) {
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    if(paused) return;
    setShown(''); setDone(false);
    if(!text) { setDone(true); return; }
    let i = 0;
    const tick = () => {
      i++;
      setShown(text.slice(0, i));
      if(i >= text.length) setDone(true);
      else timer = setTimeout(tick, speed);
    };
    let timer = setTimeout(tick, speed);
    return () => clearTimeout(timer);
  }, [text, speed, paused]);
  const finish = useCallback(() => { setShown(text || ''); setDone(true); }, [text]);
  return [shown, done, finish];
}

// ── Dialog box (bottom) ─────────────────────────────────
function DialogBox({ entry, char, color, onAdvance, onFinishType, transparent, disabled }) {
  const [shown, done, finish] = useTypewriter(entry.text, 22);
  useEffect(() => { if(done) onFinishType?.(); }, [done]);

  // クリック共通ハンドラ（タイプライター完了前→即表示、完了後→進む）
  const handleClick = useCallback((e) => {
    e.stopPropagation();
    if(!done) finish();
    else onAdvance();
  }, [done, finish, onAdvance]);

  const textBlock = (
    <>
      <div style={{
        fontFamily:"'Noto Sans JP'",
        fontSize: char ? 20 : 17,
        fontStyle: char ? 'normal' : 'italic',
        fontWeight: char ? 500 : 400,
        color: char ? '#fff' : 'rgba(220,220,230,.78)',
        lineHeight: 1.7,
        letterSpacing:'.04em',
        textShadow: char ? '0 1px 6px rgba(0,0,0,.6)' : 'none',
        textAlign: char ? 'left' : 'center',
        minHeight: char ? '2em' : '1.4em',
      }}>
        {shown}
        {!done && <span style={{
          display:'inline-block', marginLeft:2,
          color: color || 'rgba(255,255,255,.7)',
          animation:'blink 1s steps(2) infinite',
        }}>▾</span>}
      </div>
      {done && (
        <div style={{
          position:'absolute', right:16, bottom:8,
          fontSize:13, color: color || 'rgba(255,255,255,.6)',
          animation:'bounceY 1.2s ease infinite',
        }}>▼</div>
      )}
    </>
  );

  return (
    // 全画面クリックエリア。バックログ/choice中は disabled=true で無効化
    <div
      onClick={disabled ? undefined : handleClick}
      style={{
        position:'absolute', inset:0, zIndex:20,
        cursor: disabled ? 'default' : 'pointer',
        background:'transparent',
      }}>

      {transparent ? (
        /* transparent mode: full-width bar at bottom */
        <div
          onClick={disabled ? undefined : handleClick}
          style={{
            position:'absolute', bottom:0, left:0, right:0,
            background:'rgba(10,5,15,.88)',
            borderTop:'1px solid rgba(255,255,255,.12)',
            borderRadius:0,
            padding:'28px 10vw 32px 10vw',
            minHeight:140,
            boxShadow:'0 -8px 32px rgba(0,0,0,.6)',
            backdropFilter:'blur(12px)',
            animation:'dialogFadeIn .3s ease both',
          }}>
          {textBlock}
        </div>
      ) : (
        /* normal mode: speaker tag + box anchored to bottom */
        <div style={{ position:'absolute', bottom:0, left:0, right:0 }}>
          {char && (
            <div style={{ position:'absolute', left:24, top:-16, zIndex:21 }}>
              <SpeakerTag char={char} color={color}/>
            </div>
          )}
          <div
            onClick={disabled ? undefined : handleClick}
            style={{
            position:'relative',
            margin:'0 16px 16px 16px',
            background: char
              ? `linear-gradient(180deg, rgba(20,12,30,.95), rgba(8,6,18,.97))`
              : `linear-gradient(180deg, rgba(35,32,40,.92), rgba(20,18,25,.95))`,
            borderTop: char ? `2px solid ${color}` : '2px solid rgba(255,255,255,.18)',
            borderLeft: '1px solid rgba(255,255,255,.06)',
            borderRight: '1px solid rgba(255,255,255,.06)',
            borderBottom: '1px solid rgba(255,255,255,.06)',
            borderRadius: 6,
            padding: char ? '24px 32px 22px 32px' : '20px 32px',
            minHeight: char ? 140 : 100,
            boxShadow:'0 -4px 24px rgba(0,0,0,.5)',
            backdropFilter:'blur(4px)',
            animation:'dialogFadeIn .3s ease both',
          }}>
            {char && [
              {top:8, left:8}, {top:8, right:8},
              {bottom:8, left:8}, {bottom:8, right:8},
            ].map((p,i)=>(
              <div key={i} style={{
                position:'absolute', ...p, width:14, height:14,
                borderColor: color,
                borderStyle:'solid',
                borderWidth: `${p.top!==undefined?1:0}px ${p.right!==undefined?1:0}px ${p.bottom!==undefined?1:0}px ${p.left!==undefined?1:0}px`,
                opacity:.55,
              }}/>
            ))}
            {textBlock}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Persona-style cutin ─────────────────────────────────
function PersonaCutin({ entry, char, color, onAdvance }) {
  const portrait = getPortrait(char, entry.expr);
  const [imgSrc, setImgSrc] = useState(portrait?.primary);
  const [shown, done, finish] = useTypewriter(entry.text, 28);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if(!done) finish();
        else onAdvance();
      }}
      style={{
        position:'absolute', inset:0, zIndex:30,
        background:`linear-gradient(135deg, ${color}33, rgba(8,4,16,.85) 50%, ${color}55)`,
        cursor:'pointer',
        overflow:'hidden',
        animation:'cutinAppear .4s cubic-bezier(.16,1,.3,1) both',
      }}>

      {/* diagonal stripes */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        backgroundImage:`repeating-linear-gradient(115deg, transparent 0, transparent 60px, ${color}18 60px, ${color}18 70px)`,
      }}/>

      {/* Portrait — large, right-aligned, slanted frame */}
      <div style={{
        position:'absolute', right:'-2%', top:'4%', bottom:'4%', width:'58%',
        clipPath:'polygon(15% 0, 100% 0, 100% 100%, 0% 100%)',
        animation:'cutinPortraitIn .5s cubic-bezier(.16,1,.3,1) both',
      }}>
        {imgSrc ? (
          <img src={imgSrc} alt={char.name}
            onError={() => { if(portrait?.fallback && imgSrc !== portrait.fallback) setImgSrc(portrait.fallback); }}
            style={{
              width:'100%', height:'100%',
              objectFit:'cover', objectPosition:'center 18%',
              filter:`drop-shadow(0 12px 30px ${color}88)`,
            }}/>
        ) : (
          <div style={{width:'100%', height:'100%', background:`${color}22`}}/>
        )}
        {/* edge accent */}
        <div style={{
          position:'absolute', left:0, top:0, bottom:0, width:6,
          background: `linear-gradient(180deg, transparent, ${color}, transparent)`,
          boxShadow:`0 0 24px ${color}`,
        }}/>
      </div>

      {/* Left side — large name + text */}
      <div style={{
        position:'absolute', left:'5%', top:'12%', width:'48%',
        display:'flex', flexDirection:'column', gap:18,
      }}>
        <div style={{
          fontFamily:'Rajdhani', fontSize:13, fontWeight:700, letterSpacing:'.4em',
          color:`${color}`,
          textShadow:`0 0 12px ${color}aa`,
          animation:'fadeRight .35s .1s both',
        }}>CHARACTER · CUT-IN</div>

        <div style={{
          transform:'skewX(-8deg)',
          background:`linear-gradient(110deg, ${color}, rgba(0,0,0,.4))`,
          padding:'14px 32px 14px 22px',
          alignSelf:'flex-start',
          boxShadow:`0 8px 32px ${color}99, inset 0 -3px 0 rgba(0,0,0,.3)`,
          animation:'tagSlide .45s .2s both',
        }}>
          <div style={{transform:'skewX(8deg)'}}>
            <div style={{
              fontFamily:"'Zen Maru Gothic'", fontSize:'min(5vw, 52px)', fontWeight:900,
              color:'#fff', lineHeight:1, letterSpacing:'.04em',
              textShadow:`0 2px 12px rgba(0,0,0,.5)`,
            }}>{char.name}</div>
            {char.kana && (
              <div style={{
                marginTop:4,
                fontFamily:"'Noto Sans JP'", fontSize:11, fontWeight:600,
                color:'rgba(255,255,255,.85)', letterSpacing:'.32em',
              }}>{char.kana.toUpperCase()}</div>
            )}
          </div>
        </div>

        {entry.subtext && (
          <div style={{
            fontFamily:"'Noto Sans JP'", fontSize:14, fontWeight:600,
            color: color, letterSpacing:'.12em',
            paddingLeft:8,
            borderLeft:`3px solid ${color}`,
            animation:'fadeRight .35s .35s both',
          }}>{entry.subtext}</div>
        )}

        <div style={{
          marginTop:14,
          padding:'18px 22px',
          background:`linear-gradient(180deg, rgba(20,12,30,.85), rgba(0,0,0,.85))`,
          borderTop:`2px solid ${color}`,
          borderLeft:'1px solid rgba(255,255,255,.07)',
          borderRadius:6,
          fontFamily:"'Noto Sans JP'", fontSize:18, fontWeight:500,
          color:'#fff', lineHeight:1.7,
          textShadow:'0 1px 6px rgba(0,0,0,.7)',
          minHeight:'4em',
          animation:'fadeRight .35s .45s both',
        }}>
          {shown}
          {!done && <span style={{
            display:'inline-block', marginLeft:2,
            color, animation:'blink 1s steps(2) infinite',
          }}>▾</span>}
          {done && (
            <div style={{
              marginTop:8, fontSize:11, color:`${color}cc`, letterSpacing:'.2em',
              animation:'fadeIn .3s both',
            }}>▼ クリックで進む</div>
          )}
        </div>
      </div>

      {/* faction tag bottom-left */}
      <div style={{
        position:'absolute', bottom:24, left:24,
        fontFamily:'Rajdhani', fontWeight:900, fontSize:11, letterSpacing:'.4em',
        color:'rgba(255,255,255,.35)',
      }}>{(char.origin||'').toUpperCase()} · {char.id.toUpperCase()}</div>
    </div>
  );
}

// ── Backlog overlay ─────────────────────────────────────
function Backlog({ history, onClose }) {
  return (
    <div onClick={onClose} style={{
      position:'absolute', inset:0, zIndex:50,
      background:'rgba(8,4,16,.92)',
      backdropFilter:'blur(8px)',
      display:'flex', flexDirection:'column',
      animation:'fadeIn .25s ease both',
    }}>
      <div style={{
        padding:'18px 28px', display:'flex', alignItems:'center', gap:14,
        borderBottom:'1px solid rgba(255,255,255,.08)',
      }}>
        <div style={{
          fontFamily:'Rajdhani', fontSize:14, fontWeight:700, letterSpacing:'.32em',
          color:'rgba(255,255,255,.5)',
        }}>BACKLOG</div>
        <div style={{flex:1}}/>
        <button onClick={onClose} style={{
          padding:'8px 18px', borderRadius:4,
          background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)',
          color:'rgba(255,255,255,.85)', cursor:'pointer',
          fontFamily:"'Noto Sans JP'", fontSize:12,
        }}>閉じる ✕</button>
      </div>
      <div onClick={(e)=>e.stopPropagation()} style={{
        flex:1, overflowY:'auto', padding:'24px 32px', display:'flex', flexDirection:'column-reverse', gap:14,
      }}>
        {/* reverse order: newest at top */}
        {history.slice().reverse().map((h, i) => {
          const char = h.speaker ? getChar(h.speaker) : null;
          const color = char ? (ROLES[char.role]?.color || PK) : 'rgba(255,255,255,.4)';
          return (
            <div key={i} style={{
              padding:'14px 18px', borderRadius:6,
              background: char ? 'rgba(20,12,30,.7)' : 'rgba(40,38,46,.5)',
              borderLeft: char ? `3px solid ${color}` : `3px solid rgba(255,255,255,.18)`,
            }}>
              {char && (
                <div style={{
                  fontFamily:"'Zen Maru Gothic'", fontSize:13, fontWeight:900,
                  color, marginBottom:4,
                }}>{char.name}</div>
              )}
              <div style={{
                fontFamily:"'Noto Sans JP'", fontSize:14, lineHeight:1.7,
                color: char ? 'rgba(255,255,255,.92)' : 'rgba(220,220,230,.7)',
                fontStyle: char ? 'normal' : 'italic',
              }}>{h.text}</div>
            </div>
          );
        })}
        {history.length === 0 && (
          <div style={{textAlign:'center', color:'rgba(255,255,255,.3)', padding:'40px 0'}}>
            まだ履歴がありません
          </div>
        )}
      </div>
    </div>
  );
}

// ── Top control bar ─────────────────────────────────────
function ADVTopBar({ location, onAuto, isAuto, onSkip, onLog, onExit }) {
  const Btn = ({label, onClick, active}) => (
    <button onClick={onClick} style={{
      padding:'7px 16px', borderRadius:18,
      background: active ? 'rgba(196,66,122,.5)' : 'rgba(255,255,255,.08)',
      border:`1px solid ${active ? PK : 'rgba(255,255,255,.18)'}`,
      color: active ? '#fff' : 'rgba(255,255,255,.85)',
      fontFamily:"'Noto Sans JP'", fontSize:11, fontWeight:600,
      cursor:'pointer', letterSpacing:'.08em',
      backdropFilter:'blur(8px)',
      transition:'all .15s',
    }}>{label}</button>
  );

  return (
    <div style={{
      position:'absolute', top:0, left:0, right:0, zIndex:25,
      padding:'12px 18px',
      display:'flex', alignItems:'center', gap:10,
      background:'linear-gradient(180deg, rgba(0,0,0,.6), transparent)',
      pointerEvents:'none',
    }}>
      {location && (
        <div style={{
          padding:'7px 16px', borderRadius:4,
          background:'rgba(0,0,0,.55)', border:'1px solid rgba(255,255,255,.12)',
          fontFamily:"'Zen Maru Gothic'", fontSize:13, fontWeight:700,
          color:'rgba(255,255,255,.92)', letterSpacing:'.08em',
          backdropFilter:'blur(8px)', pointerEvents:'auto',
        }}>◤ {location}</div>
      )}
      <div style={{flex:1}}/>
      <div style={{display:'flex', gap:8, pointerEvents:'auto'}}>
        <Btn label={isAuto ? '■ AUTO' : 'AUTO'} onClick={onAuto} active={isAuto}/>
        <Btn label="SKIP →" onClick={onSkip}/>
        <Btn label="LOG" onClick={onLog}/>
        <Btn label="✕" onClick={onExit}/>
      </div>
    </div>
  );
}

// ── 呼び出し元 script → ADV内部 scenario 変換 ──────────
// characters.json の char_NNN ID を tokens.js CHARS の c-ID に変換するマップ
const CHAR_ID_MAP = {
  'char_004': 'c1',  // 東北きりたん
  'char_005': 'c2',  // 音街ウナ
  'char_006': 'c3',  // 彩澄しゅお
  'char_016': 'c4',  // ずんだもん
  'char_024': 'c5',  // 北海道めろん
  'char_023': 'c7',  // 沖縄あわも
};
const resolveCharId = id => CHAR_ID_MAP[id] ?? id;

/**
 * 呼び出し元の script（raw: conversation / text / narration / choice / cutin / end）を
 * ADV内部 scenario（dialog / narration / cutin / choice / end）へ変換する。
 * conversation の展開もここで行う（EventEngine 側では展開しない）。
 *
 * 戻り値の stepIndexMap[origIdx] = その原ステップが scenario 内で始まる index。
 * choice.next（原 script index 基準）を scenario index に解決するために使う。
 */
function buildScenario(script = []) {
  const scenario = [];
  const stepIndexMap = [];

  script.forEach((step, origIdx) => {
    stepIndexMap[origIdx] = scenario.length;
    switch (step.type) {
      case 'conversation':
        (step.lines ?? []).forEach(line => scenario.push({
          type: 'dialog', speaker: resolveCharId(line.characterId),
          expr: line.expr ?? 'normal', text: line.text,
        }));
        break;
      case 'text':
        scenario.push({
          type: 'dialog', speaker: resolveCharId(step.characterId),
          expr: step.expr ?? 'normal', text: step.text,
        });
        break;
      case 'narration':
        scenario.push({ type: 'narration', text: step.text });
        break;
      case 'cutin':
        scenario.push({
          type: 'cutin', speaker: resolveCharId(step.speaker ?? step.characterId),
          expr: step.expr ?? 'normal', text: step.text, subtext: step.subtext,
        });
        break;
      case 'dialog': // 既に内部形式（DEMO_SCENARIO 等）
        scenario.push({ ...step, speaker: resolveCharId(step.speaker) });
        break;
      case 'choice':
        scenario.push({
          type: 'choice', speaker: resolveCharId(step.characterId), text: step.text,
          choices: (step.choices ?? []).map(c => ({
            label: c.label, next: c.next ?? null, effects: c.effects ?? null,
          })),
        });
        break;
      case 'end':
        scenario.push({ type: 'end' });
        break;
      default:
        break;
    }
  });

  if (!scenario.some(s => s.type === 'end')) scenario.push({ type: 'end' });
  return { scenario, stepIndexMap };
}

/** script の characterId / position から立ち絵 cast（位置→キャラ）を先着順で生成する。 */
function buildCast(script = []) {
  const castMap = new Map();
  const add = (characterId, position) => {
    const cid = resolveCharId(characterId);
    if (cid && position && getChar(cid) && !castMap.has(position)) castMap.set(position, cid);
  };
  script.forEach(step => {
    if (step.type === 'conversation') (step.lines ?? []).forEach(l => add(l.characterId, l.position));
    else if (step.type === 'text' || step.type === 'choice') add(step.characterId, step.position);
  });
  return Array.from(castMap.entries()).map(([pos, id]) => ({ id, pos }));
}

// ── Choice UI ────────────────────────────────────────────
function ChoiceUI({ entry, onSelect }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20,
      padding: '0 16px 24px 16px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        fontFamily: "'Noto Sans JP'", fontSize: 18, fontWeight: 700,
        color: 'rgba(255,255,255,.9)',
        textShadow: '0 2px 8px rgba(0,0,0,.8)',
        marginBottom: 4,
      }}>{entry.text}</div>
      {(entry.choices ?? []).map((c, i) => (
        <button
          key={i}
          onClick={() => onSelect(c)}
          style={{
            width: '100%', maxWidth: 400,
            padding: '16px 32px',
            background: 'linear-gradient(180deg, rgba(40,24,60,.95), rgba(20,12,36,.97))',
            border: `2px solid ${PK}`,
            borderRadius: 6,
            color: '#fff',
            fontFamily: "'Noto Sans JP'", fontSize: 16, fontWeight: 700,
            letterSpacing: '.08em',
            cursor: 'pointer',
            boxShadow: `0 4px 20px ${PK}55`,
            transition: 'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `linear-gradient(180deg, ${PK}88, ${PK}55)`; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(180deg, rgba(40,24,60,.95), rgba(20,12,36,.97))'; }}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

// ── Main ADVScene ───────────────────────────────────────
// 契約: { script, effects, onExit }
//   script  : 呼び出し元の生スクリプト（conversation/text/narration/choice/cutin/end）。
//             bg / location / transparent は script.meta から読む。
//   effects : { default: [...], <key>: [...] }（イベント effects 形式）。end 到達時に
//             default を applyEffects で適用する。choice の effects は選択時に即時適用。
//   onExit  : 終了通知。戻り先制御・直列化（次イベント起動）は呼び出し元が onExit に閉じる。
export default function ADVScene({ script = [], effects = null, onExit, transparent: transparentProp }) {
  const { actions: { applyEffects } } = useGame();

  const { scenario, cast, indexMap, meta } = useMemo(() => {
    const { scenario, stepIndexMap } = buildScenario(script);
    return { scenario, cast: buildCast(script), indexMap: stepIndexMap, meta: script?.meta ?? {} };
  }, [script]);

  const bg          = meta.bg ?? null;
  const location    = meta.location ?? '';
  const transparent = transparentProp ?? meta.transparent ?? false;

  const [idx, setIdx]         = useState(0);
  const [history, setHistory] = useState([]); // dialog/narration only
  const [isAuto, setIsAuto]   = useState(false);
  const [showLog, setShowLog] = useState(false);
  const finishedRef = useRef(false);

  const current = scenario[idx];

  // 終了処理: トップレベル effects.default を適用してから onExit。多重実行は ref でガード。
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    applyEffects(effects?.default ?? []);
    onExit?.();
  }, [applyEffects, effects, onExit]);

  // end ステップ到達で終了
  useEffect(() => {
    if (scenario[idx]?.type === 'end') finish();
  }, [idx, scenario, finish]);

  // Add to history when entering a dialog/narration/cutin
  useEffect(() => {
    const c = scenario[idx];
    if (!c) return;
    if (c.type === 'dialog' || c.type === 'narration' || c.type === 'cutin') {
      setHistory(h => [...h, { speaker: c.speaker, text: c.text }]);
    }
  }, [idx, scenario]);

  // Auto mode
  const [autoReadyToAdvance, setAutoReadyToAdvance] = useState(false);
  useEffect(() => {
    if(!isAuto || !autoReadyToAdvance) return;
    const t = setTimeout(() => advance(), 1800);
    return () => clearTimeout(t);
  }, [isAuto, autoReadyToAdvance, idx]);

  const advance = useCallback(() => {
    setAutoReadyToAdvance(false);
    if(idx >= scenario.length - 1 || scenario[idx]?.type === 'end') {
      finish();
      return;
    }
    setIdx(i => i + 1);
  }, [idx, scenario, finish]);

  // choice 選択: その選択肢の effects を即時適用し、next（あれば）へ分岐
  const selectChoice = useCallback((choice) => {
    if (choice?.effects && choice.effects.length) applyEffects(choice.effects);
    const target = choice?.next != null && indexMap[choice.next] != null
      ? indexMap[choice.next]
      : idx + 1;
    if (target >= scenario.length) { finish(); return; }
    setIdx(target);
  }, [applyEffects, idx, indexMap, scenario, finish]);

  // Skip (right-click)
  const handleContextMenu = (e) => {
    e.preventDefault();
    if (current?.type === 'choice') return; // choice 中はスキップ無効
    // Skip: jump to next 'narration' break or end
    let next = idx + 1;
    while(next < scenario.length && scenario[next].type === 'dialog') next++;
    if(next >= scenario.length || scenario[next]?.type === 'end') {
      finish();
      return;
    }
    setIdx(next);
  };

  // Wheel up = backlog
  const handleWheel = (e) => {
    if(e.deltaY < 0 && !showLog) {
      setShowLog(true);
    }
  };

  if(!current) return null;

  // For dialog/cutin/choice, lookup speaking char
  const speakerChar = (current.type === 'dialog' || current.type === 'cutin' || current.type === 'choice') && current.speaker
    ? getChar(current.speaker) : null;
  const speakerColor = speakerChar
    ? (ROLES[speakerChar.role]?.color || PK)
    : PK;

  return (
    <div
      className="scene-enter"
      onContextMenu={handleContextMenu}
      onWheel={handleWheel}
      style={{
        width:'100vw', height:'100vh',
        position:'relative', overflow:'hidden',
        background: transparent ? 'transparent' : '#0a0610',
        fontFamily:"'Noto Sans JP'",
        userSelect:'none',
      }}>

      {/* BG */}
      {bg && !transparent && (
        <div style={{
          position:'absolute', inset:0,
          backgroundImage:`url(${bg})`,
          backgroundSize:'cover', backgroundPosition:'center',
          filter:'brightness(.55) saturate(.85) blur(1px)',
        }}/>
      )}
      {/* BG dim overlay */}
      {!transparent && <div style={{
        position:'absolute', inset:0,
        background:'linear-gradient(180deg, rgba(8,4,16,.4) 0%, rgba(8,4,16,.75) 100%)',
      }}/>}

      {/* Standing characters */}
      {cast.map(c => {
        const char = getChar(c.id);
        if(!char) return null;
        const isSpeaking = (current.type === 'dialog' || current.type === 'choice') && current.speaker === c.id;
        // expr: lookup from current entry only if speaker matches
        const expr = isSpeaking ? current.expr : 'normal';
        return (
          <StandingChar
            key={c.id}
            char={char}
            expr={expr}
            pos={c.pos}
            isSpeaking={isSpeaking}
          />
        );
      })}

      {/* Cutin */}
      {current.type === 'cutin' && speakerChar && (
        <PersonaCutin
          entry={current}
          char={speakerChar}
          color={speakerColor}
          onAdvance={() => { setAutoReadyToAdvance(true); advance(); }}
        />
      )}

      {/* Dialog/narration box */}
      {(current.type === 'dialog' || current.type === 'narration') && (
        <DialogBox
          entry={current}
          char={speakerChar}
          color={speakerColor}
          onAdvance={() => { setAutoReadyToAdvance(true); advance(); }}
          onFinishType={() => setAutoReadyToAdvance(true)}
          transparent={transparent}
          disabled={showLog}
        />
      )}

      {/* Choice */}
      {current.type === 'choice' && (
        <ChoiceUI
          entry={current}
          onSelect={selectChoice}
        />
      )}

      {/* Top bar */}
      <ADVTopBar
        location={location}
        onAuto={() => setIsAuto(a => !a)}
        isAuto={isAuto}
        onSkip={finish}
        onLog={() => setShowLog(true)}
        onExit={finish}
      />

      {/* Backlog */}
      {showLog && <Backlog history={history} onClose={() => setShowLog(false)}/>}

      {/* Hint at bottom-right */}
      <div style={{
        position:'absolute', right:14, bottom:140, zIndex:15,
        fontSize:9, color:'rgba(255,255,255,.35)',
        fontFamily:'Rajdhani', letterSpacing:'.2em',
        textAlign:'right', lineHeight:1.7,
        pointerEvents:'none',
      }}>
        左クリック: 進む<br/>
        右クリック: スキップ<br/>
        スクロール↑: バックログ
      </div>
    </div>
  );
}

// Inject keyframes
(function(){
  const id = '__adv_kf';
  if(document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = `
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
    @keyframes bounceY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
    @keyframes tagSlide { from{opacity:0;transform:skewX(-12deg) translateX(-30px)} to{opacity:1;transform:skewX(-12deg) translateX(0)} }
    @keyframes dialogFadeIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes cutinAppear { from{opacity:0} to{opacity:1} }
    @keyframes cutinPortraitIn { from{opacity:0;transform:translateX(60px) scale(1.05)} to{opacity:1;transform:translateX(0) scale(1)} }
    @keyframes fadeRight { from{opacity:0;transform:translateX(-30px)} to{opacity:1;transform:translateX(0)} }
  `;
  document.head.appendChild(s);
})();

Object.assign(window, { ADVScene, DEMO_SCENARIO });