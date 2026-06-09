import React, { useState, useEffect, useRef } from 'react';
import { PK, PK2, TEAL } from '../shared/tokens.js';

function darkenHex(hex, factor = 0.38) {
  const n = parseInt((hex ?? '#888888').replace('#', ''), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - factor));
  const g = Math.round(((n >> 8) & 255) * (1 - factor));
  const b = Math.round((n & 255) * (1 - factor));
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

function LoadingOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10000,
      background: 'linear-gradient(135deg, #0a0610 0%, #1a0a20 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 24,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        border: '3px solid rgba(196,66,122,.15)',
        borderTopColor: '#c4427a',
        animation: 'spin 0.9s linear infinite',
      }}/>
      <div style={{
        fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 13,
        letterSpacing: '.4em', color: 'rgba(255,255,255,.45)',
      }}>ENEMY TURN</div>
    </div>
  );
}

function FactionCutin({ faction, index, total, phase, onSkip }) {
  const accent = faction.accent ?? darkenHex(faction.color ?? '#888');
  const hasPortrait = !!faction.portrait;
  return (
    <div
      onClick={onSkip}
      style={{
        position: 'absolute', inset: 0, zIndex: 10000,
        background: `linear-gradient(135deg, ${accent} 0%, #0a0610 50%, ${accent} 100%)`,
        display: 'flex', alignItems: 'stretch', overflow: 'hidden',
        cursor: 'pointer',
        animation: phase === 'out'
          ? 'cutinOut .5s cubic-bezier(.4,0,.2,1) forwards'
          : 'cutinIn .5s cubic-bezier(.16,1,.3,1) both',
      }}>

      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `repeating-linear-gradient(135deg, transparent 0, transparent 80px, ${faction.color}15 80px, ${faction.color}15 90px)`,
      }}/>

      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: `${i * 12}%`, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${faction.color}55, transparent)`,
          transform: `skewY(${-2 + (i % 3)}deg)`,
          animation: `streak 1.2s ${i * .05}s ease-out both`,
        }}/>
      ))}

      {/* LEFT: portrait or placeholder */}
      <div style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        animation: 'portraitSlideIn .6s cubic-bezier(.16,1,.3,1) both',
      }}>
        {hasPortrait ? (
          <img src={faction.portrait} alt={faction.leader ?? faction.name}
            style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              height: '130%', width: 'auto',
              objectFit: 'cover', objectPosition: 'top center',
              filter: 'drop-shadow(0 20px 40px rgba(0,0,0,.6))',
            }}/>
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(circle at 40% 50%, ${faction.color}33 0%, transparent 70%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 120, height: 120, borderRadius: '50%',
              background: `${faction.color}22`,
              border: `3px solid ${faction.color}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 48,
            }}>⚔</div>
          </div>
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(90deg, rgba(0,0,0,.5) 0%, transparent 30%, transparent 70%, ${accent}cc 100%)`,
        }}/>
        {faction.leader && faction.leader !== faction.name && (
          <div style={{
            position: 'absolute', bottom: '8%', left: '8%',
            fontFamily: "'Zen Maru Gothic'", fontSize: 18, fontWeight: 900,
            color: faction.color,
            textShadow: `0 2px 12px rgba(0,0,0,.95), 0 0 24px ${faction.color}`,
            padding: '6px 16px', background: 'rgba(0,0,0,.55)',
            borderLeft: `4px solid ${faction.color}`,
            animation: 'fadeUp .5s .35s both',
          }}>
            {faction.leader}
          </div>
        )}
      </div>

      {/* RIGHT: text / banner */}
      <div style={{
        flex: '0 0 52%', position: 'relative',
        background: 'linear-gradient(110deg, transparent 0%, rgba(0,0,0,.85) 18%, rgba(0,0,0,.92) 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 6vw 0 4vw', gap: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, animation: 'fadeRight .4s .15s both' }}>
          <div style={{ width: 48, height: 2, background: faction.color }}/>
          <div style={{
            fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 700, letterSpacing: '.32em',
            color: faction.color, textShadow: `0 0 12px ${faction.color}`,
          }}>ENEMY PHASE — {String(index + 1).padStart(2, '0')}/{String(total).padStart(2, '0')}</div>
        </div>

        <div style={{
          fontFamily: "'Zen Maru Gothic'", fontWeight: 900,
          fontSize: 'min(7vw, 110px)', lineHeight: .95,
          color: '#fff', letterSpacing: '.04em',
          textShadow: `0 4px 28px rgba(0,0,0,.9), 0 0 40px ${faction.color}80`,
          animation: 'fadeRight .55s .25s both',
        }}>
          {faction.name}
        </div>

        {faction.motto ? (
          <div style={{
            fontFamily: "'Noto Sans JP'", fontWeight: 700,
            fontSize: 'min(2.8vw, 40px)', lineHeight: 1.2,
            color: faction.color, textShadow: '0 2px 12px rgba(0,0,0,.8)',
            animation: 'fadeRight .5s .4s both',
          }}>
            「{faction.motto}」
          </div>
        ) : null}

        <div style={{
          marginTop: 8,
          display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 14,
          padding: '12px 28px',
          background: `linear-gradient(90deg, ${faction.color}, ${accent})`,
          borderLeft: '5px solid #fff',
          fontFamily: "'Zen Maru Gothic'", fontSize: 'min(3.5vw, 50px)', fontWeight: 900,
          color: '#fff', letterSpacing: '.16em',
          boxShadow: `0 6px 30px rgba(0,0,0,.5), 0 0 40px ${faction.color}66`,
          animation: 'bannerSlide .55s .55s cubic-bezier(.16,1,.3,1) both',
        }}>
          <span style={{ fontSize: '.7em', opacity: .9 }}>▶</span>
          <span>行動開始</span>
        </div>

        <div style={{
          marginTop: 6, display: 'flex', gap: 14, alignItems: 'center',
          fontFamily: 'Rajdhani', fontSize: 13, fontWeight: 600,
          color: 'rgba(255,255,255,.5)', letterSpacing: '.16em',
          animation: 'fadeRight .4s .75s both',
        }}>
          <span>侵攻 <b style={{ color: faction.color, fontSize: 18 }}>{faction.attackCount ?? 1}</b> 件</span>
          <span style={{ opacity: .4 }}>·</span>
          <span style={{ opacity: .6 }}>クリックでスキップ</span>
        </div>
      </div>

      <div style={{
        position: 'absolute', top: 24, right: 32,
        fontFamily: 'Rajdhani', fontWeight: 900, fontSize: 11, letterSpacing: '.4em',
        color: 'rgba(255,255,255,.3)', animation: 'fadeIn .4s .2s both',
      }}>
        FACTION · {(faction.id ?? '').toUpperCase()}
      </div>
    </div>
  );
}

function EnemyTurnProgress({ index, total, faction }) {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9998,
      padding: '10px 24px',
      background: 'linear-gradient(180deg, rgba(0,0,0,.85), rgba(0,0,0,.0))',
      pointerEvents: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, animation: 'fadeIn .3s ease both' }}>
        <div style={{
          fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 11, letterSpacing: '.28em',
          color: 'rgba(255,255,255,.55)',
        }}>ENEMY TURN</div>
        <div style={{ flex: 1, display: 'flex', gap: 6 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i < index ? faction.color
                : i === index ? `linear-gradient(90deg, ${faction.color}, ${faction.color}66)`
                : 'rgba(255,255,255,.12)',
              boxShadow: i === index ? `0 0 8px ${faction.color}` : 'none',
              transition: 'all .3s',
            }}/>
          ))}
        </div>
        <div style={{
          fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 13,
          color: faction.color,
        }}>{index + 1}/{total}</div>
      </div>
    </div>
  );
}

function PlayerTurnCutin({ playerFactionName, onComplete }) {
  const [phase, setPhase] = useState('in');
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 500);
    const t2 = setTimeout(() => setPhase('out'), 500 + 1300);
    const t3 = setTimeout(() => onComplete(), 500 + 1300 + 450);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div onClick={onComplete} style={{
      position: 'absolute', inset: 0, zIndex: 10000,
      background: 'linear-gradient(135deg, #1a4a66 0%, #0a1828 50%, #1a8a96 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer',
      animation: phase === 'out'
        ? 'cutinOut .45s cubic-bezier(.4,0,.2,1) forwards'
        : 'cutinIn .45s cubic-bezier(.16,1,.3,1) both',
      overflow: 'hidden',
    }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: `${i * 18}%`, left: '-30%', right: '-30%', height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(26,138,150,.5), transparent)',
          transform: `rotate(${-3 + i}deg)`,
          animation: `streak 1.2s ${i * .07}s ease-out both`,
        }}/>
      ))}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{
          fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 14, letterSpacing: '.5em',
          color: 'rgba(120,220,235,.85)',
          textShadow: '0 0 20px rgba(26,138,150,.8)',
          marginBottom: 14, animation: 'fadeUp .4s both',
        }}>YOUR TURN</div>
        <div style={{
          fontFamily: "'Zen Maru Gothic'", fontWeight: 900,
          fontSize: 'min(11vw, 160px)', lineHeight: 1,
          color: '#fff',
          textShadow: '0 0 60px rgba(120,220,235,.7), 0 0 24px rgba(255,255,255,.4)',
          letterSpacing: '.1em', animation: 'titleZoom .55s cubic-bezier(.16,1,.3,1) both',
        }}>{playerFactionName}</div>
        <div style={{
          marginTop: 10,
          fontFamily: "'Zen Maru Gothic'", fontWeight: 700,
          fontSize: 'min(4vw, 56px)', lineHeight: 1,
          color: '#7fdce5', letterSpacing: '.3em',
          textShadow: '0 0 20px rgba(120,220,235,.7)',
          animation: 'fadeUp .4s .25s both',
        }}>行動開始</div>
        <div style={{
          marginTop: 24, fontSize: 11, letterSpacing: '.3em',
          color: 'rgba(255,255,255,.4)', fontFamily: 'Rajdhani',
          animation: 'fadeIn .3s .5s both',
        }}>クリックでスキップ</div>
      </div>
    </div>
  );
}

// Inject keyframes
(function () {
  const id = '__cutin_kf';
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = `
    @keyframes spin { to { transform: rotate(360deg) } }
    @keyframes cutinIn { from{opacity:0;transform:scale(1.04)} to{opacity:1;transform:scale(1)} }
    @keyframes cutinOut { from{opacity:1} to{opacity:0;transform:scale(.98)} }
    @keyframes portraitSlideIn { from{transform:translateX(-80px) scale(1.02);opacity:0} to{transform:translateX(0) scale(1);opacity:1} }
    @keyframes fadeRight { from{opacity:0;transform:translateX(40px)} to{opacity:1;transform:translateX(0)} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes bannerSlide { from{opacity:0;transform:translateX(-30px) skewX(-8deg)} to{opacity:1;transform:translateX(0) skewX(0)} }
    @keyframes streak { 0%{transform:translateX(-30%) skewY(0deg);opacity:0} 30%{opacity:1} 100%{transform:translateX(30%);opacity:0} }
    @keyframes titleZoom { 0%{transform:scale(1.6);opacity:0;letter-spacing:.5em} 60%{transform:scale(.96)} 100%{transform:scale(1);opacity:1;letter-spacing:.1em} }
  `;
  document.head.appendChild(s);
})();

// 単一勢力カットイン（新フロー用）
function SingleFactionCutin({ faction, attackCount, onComplete }) {
  const [cutinPhase, setCutinPhase] = useState('in');
  const timers = useRef([]);
  const clearT = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const T = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); };

  useEffect(() => {
    T(() => setCutinPhase('hold'), 600);
    T(() => setCutinPhase('out'), 600 + 1700);
    T(() => onComplete?.(), 600 + 1700 + 500);
    return clearT;
  }, []);

  const handleSkip = () => {
    clearT();
    setCutinPhase('out');
    setTimeout(() => onComplete?.(), 350);
  };

  const enriched = {
    ...faction,
    accent: darkenHex(faction.color ?? '#888'),
    attackCount: attackCount ?? faction.attackCount ?? 1,
    leader: faction.leader ?? null,
    motto: faction.motto ?? '',
    portrait: faction.portrait ?? null,
  };

  return (
    <FactionCutin
      faction={enriched}
      index={0}
      total={1}
      phase={cutinPhase}
      onSkip={handleSkip}
    />
  );
}

// Main component（新フロー: faction + onComplete で単一カットイン、playerTurnMode で YOUR TURN のみ）
export default function EnemyTurnSequence({
  faction = null,
  attackQueue = [],
  playerFactionName = '東北家',
  onComplete,
  playerTurnMode = false,
}) {
  if (playerTurnMode) {
    return (
      <PlayerTurnCutin
        playerFactionName={playerFactionName}
        onComplete={onComplete}
      />
    );
  }

  if (!faction) return <LoadingOverlay />;

  return (
    <SingleFactionCutin
      faction={faction}
      attackCount={attackQueue.length}
      onComplete={onComplete}
    />
  );
}

Object.assign(window, { EnemyTurnSequence, PlayerTurnCutin });
