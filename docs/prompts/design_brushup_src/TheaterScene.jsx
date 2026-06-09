import React, { useState } from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass } from '../shared/tokens.js';
import { TopBar, NavButton } from '../shared/SharedUI.jsx';

const CATEGORY_ORDER = ['visit', 'main', 'character', 'recurring'];
const CATEGORY_LABEL = {
  visit:     '訪問',
  main:      'メインストーリー',
  character: 'キャラクターイベント',
  recurring: '繰り返しイベント',
};

export default function TheaterScene({
  onNavigate,
  theaterEvents,
  actionPoints,
  onStartTheater,
}) {
  // theaterEvents は getAvailableTheaterEvents で条件・出現上限を満たすよう
  // 既に絞り込み済み（優先度順）。ここでは表示用にカテゴリ分類するだけ。
  const visible = theaterEvents ?? [];

  // カテゴリ別グループ化
  const groups = {};
  visible.forEach(ev => {
    const cat = ev.category ?? 'recurring';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(ev);
  });

  const canAct = (actionPoints ?? 0) >= 1;

  return (
    <div className="scene-enter" style={{
      width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden',
      background: 'rgba(248,246,244,1)', fontFamily: "'Noto Sans JP'",
    }}>
      <TopBar breadcrumb={['マップ', '劇場']}
        rightSlot={
          <div style={{
            padding: '4px 12px', borderRadius: 20,
            background: 'rgba(196,66,122,.1)', border: '1px solid rgba(196,66,122,.25)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 10, color: TXD }}>行動力</span>
            <span style={{ fontFamily: 'Rajdhani', fontWeight: 900, fontSize: 14, color: PK }}>
              {actionPoints ?? 0}
            </span>
          </div>
        }
      />

      <div style={{
        position: 'absolute', top: 52, left: 0, right: 0, bottom: 52,
        overflowY: 'auto', padding: '20px 24px',
      }}>
        <div style={{
          fontSize: 10, fontFamily: 'Rajdhani', fontWeight: 700,
          letterSpacing: '.22em', color: TXD, marginBottom: 20,
        }}>
          THEATER — {visible.length}件のイベント
        </div>

        {visible.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 0', color: TXF,
            fontFamily: "'Noto Sans JP'", fontSize: 13,
          }}>
            現在利用可能なイベントはありません
          </div>
        )}

        {CATEGORY_ORDER.filter(cat => groups[cat]?.length).map(cat => (
          <div key={cat} style={{ marginBottom: 28 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
            }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: PK }} />
              <span style={{
                fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 11,
                color: TXD, letterSpacing: '.15em',
              }}>{CATEGORY_LABEL[cat] ?? cat}</span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 10,
            }}>
              {groups[cat].map(ev => (
                <div key={ev.id} style={{
                  ...glass({ borderRadius: 10, border: `1px solid ${BR}` }),
                  padding: '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{
                    fontFamily: "'Zen Maru Gothic'", fontSize: 15, fontWeight: 900,
                    color: TX, lineHeight: 1.2,
                  }}>{ev.title}</div>

                  <div style={{
                    fontSize: 11, color: TXD, lineHeight: 1.6, flex: 1,
                  }}>{ev.description}</div>

                  {ev.cost?.actionPoints && (
                    <div style={{ fontSize: 10, color: AC }}>
                      ⚡ 行動力 {ev.cost.actionPoints} 消費
                    </div>
                  )}

                  <button
                    onClick={() => onStartTheater(ev.id)}
                    disabled={!canAct}
                    style={{
                      width: '100%', padding: '9px', borderRadius: 7,
                      background: canAct
                        ? `linear-gradient(135deg, ${PK}, ${PK2})`
                        : 'rgba(0,0,0,.06)',
                      border: canAct ? 'none' : `1px solid ${BR}`,
                      color: canAct ? '#fff' : TXF,
                      cursor: canAct ? 'pointer' : 'not-allowed',
                      fontFamily: "'Noto Sans JP'", fontSize: 12, fontWeight: 700,
                      boxShadow: canAct ? `0 3px 12px ${PK}44` : 'none',
                    }}
                  >
                    {canAct ? '実行' : '行動力不足'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        ...glass({ borderRadius: 0, border: 'none', borderTop: `1px solid ${BR}`,
          background: 'rgba(255,253,251,.97)' }),
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 52,
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, zIndex: 10,
      }}>
        <NavButton label="← マップに戻る" onClick={() => onNavigate('map')}
          activeColor={TEAL} activeBg='rgba(26,138,150,.1)' />
      </div>
    </div>
  );
}
