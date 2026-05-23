import { useState, useEffect, useRef } from 'react';
import { PK, PK2, AC, TEAL, TX, TXD, TXF, BR, glass } from './tokens.js';

export default function PartnerWidget({
  secretaryId,
  characters,
  secretaryLines,
  defensePrompt,
  onDefend,
  onAbandon,
}) {
  const [bubbleText, setBubbleText]       = useState(null);
  const [abandonConfirm, setAbandonConfirm] = useState(false);
  const timerRef = useRef(null);

  // defensePrompt が変わったら confirm state をリセット
  useEffect(() => {
    setAbandonConfirm(false);
  }, [defensePrompt]);

  // バブル自動消去
  useEffect(() => {
    if (!bubbleText) return;
    timerRef.current = setTimeout(() => setBubbleText(null), 3000);
    return () => clearTimeout(timerRef.current);
  }, [bubbleText]);

  const char = secretaryId ? (characters ?? []).find(c => c.id === secretaryId) : null;

  const pickRandom = (arr) => {
    if (!arr?.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  };

  const handlePortraitClick = () => {
    if (bubbleText) { setBubbleText(null); return; }
    const lines = secretaryLines?.[secretaryId]?.idle ?? [];
    const text = pickRandom(lines);
    if (text) setBubbleText(text);
  };

  const defenseLines = secretaryId
    ? (secretaryLines?.[secretaryId]?.defense_prompt ?? secretaryLines?.[secretaryId]?.idle ?? [])
    : [];
  const defenseLine = defensePrompt ? pickRandom(defenseLines) : null;

  // 防衛プロンプトなし・秘書もなし → 非表示
  if (!defensePrompt && !secretaryId) return null;

  const hasPortrait = char && char.portrait;

  return (
    <div style={{
      position: 'fixed', bottom: 60, left: 16, zIndex: 200,
      display: 'flex', alignItems: 'flex-end', gap: 0,
      pointerEvents: 'none',
    }}>
      {/* 立ち絵エリア */}
      {(secretaryId || defensePrompt) && (
        <div style={{ position: 'relative', pointerEvents: 'auto' }}>
          {/* 台詞バブル */}
          {bubbleText && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, marginBottom: 8,
              background: 'rgba(255,253,251,.97)', border: `1px solid ${BR}`,
              borderRadius: 10, padding: '8px 12px',
              fontSize: 11, color: TX, fontFamily: "'Noto Sans JP'",
              whiteSpace: 'nowrap', maxWidth: 200, lineHeight: 1.5,
              boxShadow: '0 4px 16px rgba(0,0,0,.12)',
              animation: 'fadeIn .15s ease both',
            }}>
              {bubbleText}
              <div style={{
                position: 'absolute', bottom: -7, left: 20,
                width: 12, height: 12, background: 'rgba(255,253,251,.97)',
                border: `1px solid ${BR}`, borderTop: 'none', borderLeft: 'none',
                transform: 'rotate(45deg)', borderRadius: '0 0 2px 0',
              }}/>
            </div>
          )}

          {/* 立ち絵 or アイコン */}
          <div
            onClick={handlePortraitClick}
            style={{
              width: 80, height: 160, cursor: 'pointer',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              overflow: 'hidden', borderRadius: '8px 8px 0 0',
              background: secretaryId ? `rgba(196,66,122,.06)` : 'transparent',
              border: secretaryId ? `1px solid rgba(196,66,122,.2)` : 'none',
              borderBottom: 'none',
              flexShrink: 0,
            }}
          >
            {hasPortrait ? (
              <img
                src={char.portrait} alt={char.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
              />
            ) : secretaryId ? (
              <div style={{ fontSize: 40, paddingBottom: 16 }}>👤</div>
            ) : (
              <div style={{ fontSize: 32, paddingBottom: 16 }}>⚔</div>
            )}
          </div>
        </div>
      )}

      {/* 防衛プロンプトモーダル */}
      {defensePrompt && (
        <div style={{
          ...glass({ borderRadius: 12, border: `1.5px solid ${PK}44`,
            boxShadow: '0 8px 32px rgba(196,66,122,.2)' }),
          marginLeft: 8, padding: '14px 16px',
          minWidth: 220, maxWidth: 280,
          fontFamily: "'Noto Sans JP'",
          pointerEvents: 'auto',
          animation: 'fadeIn .2s ease both',
        }}>
          <div style={{
            fontSize: 10, fontFamily: 'Rajdhani', fontWeight: 700,
            letterSpacing: '.18em', color: PK, marginBottom: 6,
          }}>⚔ 侵攻を受けています</div>

          <div style={{ fontSize: 13, fontWeight: 700, color: TX, marginBottom: 2 }}>
            {defensePrompt.defenderBase?.name ?? '拠点'}
          </div>
          <div style={{ fontSize: 10, color: TXD, marginBottom: 4 }}>
            攻撃勢力: {defensePrompt.attackerFaction?.name ?? '不明'}
          </div>
          <div style={{ fontSize: 10, color: TXD, marginBottom: 10 }}>
            敵兵力: {(defensePrompt.enemySoldiers ?? 0).toLocaleString()}
          </div>

          {defenseLine && (
            <div style={{
              fontSize: 11, color: TXD, fontStyle: 'italic',
              borderLeft: `2px solid ${PK}44`, paddingLeft: 8,
              marginBottom: 10, lineHeight: 1.5,
            }}>
              「{defenseLine}」
            </div>
          )}

          {!abandonConfirm ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={onDefend}
                style={{
                  flex: 1, padding: '8px 4px', borderRadius: 6,
                  background: `linear-gradient(135deg, ${PK}, ${PK2})`,
                  border: 'none', color: '#fff', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700, fontFamily: "'Noto Sans JP'",
                }}>防衛する</button>
              <button
                onClick={() => setAbandonConfirm(true)}
                style={{
                  flex: 1, padding: '8px 4px', borderRadius: 6,
                  background: 'rgba(0,0,0,.05)', border: `1px solid ${BR}`,
                  color: TXD, cursor: 'pointer',
                  fontSize: 11, fontFamily: "'Noto Sans JP'",
                }}>放棄する</button>
            </div>
          ) : (
            <div>
              <div style={{
                fontSize: 11, color: TX, fontWeight: 700, marginBottom: 8, lineHeight: 1.5,
              }}>
                本当に「{defensePrompt.defenderBase?.name ?? '拠点'}」を放棄しますか？
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={onAbandon}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 6,
                    background: 'rgba(196,66,122,.12)', border: `1px solid ${PK}44`,
                    color: PK, cursor: 'pointer',
                    fontSize: 11, fontWeight: 700, fontFamily: "'Noto Sans JP'",
                  }}>はい、放棄する</button>
                <button
                  onClick={() => setAbandonConfirm(false)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 6,
                    background: 'rgba(0,0,0,.05)', border: `1px solid ${BR}`,
                    color: TXD, cursor: 'pointer',
                    fontSize: 11, fontFamily: "'Noto Sans JP'",
                  }}>戻る</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
