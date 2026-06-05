import React, { useState } from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass, ROLES } from '../shared/tokens.js';
import { TopBar, NavButton } from '../shared/SharedUI.jsx';

// ═══════════════════════════════════════════════════════════
//   ItemsScene — アイテム管理（inventory + items.json ベース）
// ═══════════════════════════════════════════════════════════

const TYPE_LABEL = { weapon:'武器', armor:'防具', accessory:'装飾品' };
const TYPE_COLOR = { weapon:'#c4427a', armor:'#1a8a96', accessory:'#6a55b0' };
const TYPE_GLYPH = { weapon:'⚔', armor:'⛨', accessory:'◈' };

const EFFECT_LABELS = {
  charAttack:  '攻撃力',
  charMaxHp:   '最大HP',
  soldierAtk:  'SP攻撃力',
  soldierDef:  'SP防御力',
  maxSoldiers: '最大SP',
};

function effectLabel(def, itemSystem) {
  if (itemSystem?.effectLabel) return itemSystem.effectLabel(def);
  if (!def?.effect) return '—';
  const label = EFFECT_LABELS[def.effect.type] ?? def.effect.type;
  return `${label} +${def.effect.value}`;
}

// ── アイテムアイコン ────────────────────────────────────
function ItemIcon({ type, color }) {
  const glyph = TYPE_GLYPH[type] || '◇';
  return (
    <div style={{
      width:36, height:36, borderRadius:6,
      background:`linear-gradient(135deg, ${color}33, ${color}11)`,
      border:`1px solid ${color}44`,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:20, color,
    }}>{glyph}</div>
  );
}

// ── メインシーン ────────────────────────────────────────
export default function ItemsScene({ onNavigate, inventory, systems, characters, onRemoveItem }) {
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [filter, setFilter] = useState('all');

  const itemSystem = systems?.itemSystem;

  // inventory を itemId でグループ化
  const grouped = {};
  (inventory ?? []).forEach(inst => {
    if (!grouped[inst.itemId]) {
      const def = itemSystem?.getDef(inst.itemId);
      if (def) grouped[inst.itemId] = { def, instances: [], count: 0 };
    }
    if (grouped[inst.itemId]) {
      grouped[inst.itemId].instances.push(inst);
      grouped[inst.itemId].count++;
    }
  });
  const allItems = Object.values(grouped);

  // フィルター適用
  const filtered = filter === 'all' ? allItems : allItems.filter(g => g.def.type === filter);

  // 選択中アイテム（初期は先頭）
  const selectedGroup = filtered.find(g => g.def.id === selectedItemId)
    ?? filtered[0]
    ?? null;

  // 装備中キャラ一覧
  const equippedChars = selectedGroup
    ? (characters ?? []).filter(c => c.equipment?.item === selectedGroup.def.id)
    : [];

  return (
    <div className="scene-enter" style={{
      width:'100vw', height:'100vh', position:'relative', overflow:'hidden',
      background:'rgba(248,246,244,1)',
      fontFamily:"'Noto Sans JP'",
    }}>
      <TopBar breadcrumb={['マップ','アイテム']}
        rightSlot={
          <div style={{
            padding:'4px 12px', borderRadius:20,
            background:'rgba(184,112,16,.1)', border:'1px solid rgba(184,112,16,.25)',
            display:'flex', alignItems:'center', gap:6,
          }}>
            <div style={{width:6, height:6, borderRadius:'50%', background:AC}}/>
            <span style={{fontFamily:"'Zen Maru Gothic'", fontSize:11, fontWeight:900, color:TX}}>
              所持 {allItems.length}種
            </span>
          </div>
        }/>

      <div style={{position:'absolute', top:52, left:0, right:0, bottom:52, display:'flex'}}>

        {/* ── 左：リスト ── */}
        <div style={{flex:1, display:'flex', flexDirection:'column', minWidth:0, borderRight:`1px solid ${BR}`}}>

          {/* フィルタータブ */}
          <div style={{padding:'14px 18px 10px', display:'flex', gap:6, flexWrap:'wrap', borderBottom:`1px solid ${BR}`}}>
            {['all', 'weapon', 'armor', 'accessory'].map(k => (
              <button key={k} onClick={() => setFilter(k)} style={{
                padding:'5px 12px', borderRadius:14, fontSize:11,
                fontFamily:"'Noto Sans JP'", cursor:'pointer',
                border: filter===k ? `1px solid ${PK}` : `1px solid ${BR}`,
                background: filter===k ? `${PK}1a` : 'transparent',
                color: filter===k ? PK : TXD,
              }}>
                {k==='all' ? 'すべて' : TYPE_LABEL[k]}
              </button>
            ))}
          </div>

          {/* グリッド / 空メッセージ */}
          <div style={{flex:1, overflowY:'auto', padding:'14px 16px'}}>
            {filtered.length === 0 ? (
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'center',
                height:'100%', color:TXF, fontSize:13,
              }}>アイテムがありません</div>
            ) : (
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:8}}>
                {filtered.map(({ def, count }) => {
                  const tc = TYPE_COLOR[def.type] ?? '#8a8e96';
                  const active = selectedGroup?.def.id === def.id;
                  const equipped = (characters ?? []).some(c => c.equipment?.item === def.id);
                  return (
                    <button key={def.id}
                      onClick={() => setSelectedItemId(def.id)}
                      style={{
                        position:'relative', cursor:'pointer',
                        padding:'12px 12px 10px', borderRadius:8, textAlign:'left',
                        background: active ? `${tc}1a` : 'rgba(255,255,255,.5)',
                        border: active ? `1.5px solid ${tc}` : `1px solid ${BR}`,
                        boxShadow: active ? `0 2px 14px ${tc}33` : 'none',
                        transition:'all .15s', fontFamily:'inherit',
                        minHeight:88, display:'flex', flexDirection:'column', gap:6,
                      }}>
                      {/* type badge */}
                      <div style={{
                        position:'absolute', top:0, left:0,
                        padding:'1px 6px', fontFamily:'Rajdhani', fontWeight:700,
                        fontSize:8, letterSpacing:'.12em', color:'#fff',
                        background: tc, borderRadius:'8px 0 6px 0',
                      }}>
                        {(TYPE_LABEL[def.type] ?? def.type).toUpperCase()}
                      </div>
                      {/* 個数 */}
                      {count > 1 && (
                        <div style={{position:'absolute', top:6, right:8,
                          fontFamily:'Rajdhani', fontWeight:900, fontSize:13, color:TX}}>
                          ×{count}
                        </div>
                      )}
                      <ItemIcon type={def.type} color={tc}/>
                      <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:13, fontWeight:900,
                        color: active ? tc : TX, lineHeight:1.2}}>{def.name}</div>
                      <div style={{fontSize:9, color:TXD, fontFamily:"'Noto Sans JP'"}}>
                        {effectLabel(def, itemSystem)}
                      </div>
                      {equipped && (
                        <div style={{fontSize:8, color:TEAL, fontFamily:'Rajdhani', fontWeight:700,
                          letterSpacing:'.12em', marginTop:'auto'}}>
                          ◉ 装備中
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── 右：詳細パネル ── */}
        <div style={{
          flex:'0 0 360px', display:'flex', flexDirection:'column',
          padding:'18px 20px', gap:16, overflowY:'auto',
          background:'rgba(255,253,251,.5)',
        }}>
          {selectedGroup ? (() => {
            const { def, instances, count } = selectedGroup;
            const tc = TYPE_COLOR[def.type] ?? '#8a8e96';
            return (
              <>
                {/* 名前・タイプ */}
                <div>
                  <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                    <span style={{
                      fontSize:9, padding:'2px 8px', borderRadius:10,
                      background:`${tc}22`, color:tc,
                      fontFamily:'Rajdhani', fontWeight:700, letterSpacing:'.16em',
                    }}>
                      {(TYPE_LABEL[def.type] ?? def.type).toUpperCase()}
                    </span>
                  </div>
                  <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:22, fontWeight:900, color:TX, lineHeight:1.1}}>
                    {def.name}
                  </div>
                </div>

                {/* エフェクト */}
                <div style={{
                  padding:'12px 14px', borderRadius:8,
                  background:`${tc}10`, border:`1px solid ${tc}33`,
                }}>
                  <div style={{fontSize:9, fontFamily:'Rajdhani', fontWeight:700,
                    letterSpacing:'.18em', color:TXD, marginBottom:5}}>EFFECT</div>
                  <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:14, fontWeight:900, color:tc}}>
                    {effectLabel(def, itemSystem)}
                  </div>
                </div>

                {/* 説明 */}
                <div style={{fontSize:11, color:TXD, lineHeight:1.7, fontFamily:"'Noto Sans JP'"}}>
                  {def.description || '—'}
                </div>

                {/* 価格 */}
                <div style={{display:'flex', gap:16}}>
                  <div>
                    <div style={{fontSize:9, fontFamily:'Rajdhani', fontWeight:700,
                      letterSpacing:'.18em', color:TXD, marginBottom:3}}>購入価格</div>
                    <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:13, fontWeight:900, color:TX}}>
                      {def.cost != null ? `${def.cost.toLocaleString()} ミーム` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:9, fontFamily:'Rajdhani', fontWeight:700,
                      letterSpacing:'.18em', color:TXD, marginBottom:3}}>売却価格</div>
                    <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:13, fontWeight:900, color:AC}}>
                      {def.sellPrice != null ? `${def.sellPrice.toLocaleString()} ミーム` : '—'}
                    </div>
                  </div>
                </div>

                {/* 所持数 */}
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <div style={{fontSize:9, fontFamily:'Rajdhani', fontWeight:700,
                    letterSpacing:'.18em', color:TXD}}>所持数</div>
                  <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:16, fontWeight:900, color:TX}}>
                    {count}
                  </div>
                </div>

                {/* 装備中キャラ */}
                {equippedChars.length > 0 && (
                  <div>
                    <div style={{fontSize:9, fontFamily:'Rajdhani', fontWeight:700,
                      letterSpacing:'.18em', color:TXD, marginBottom:6}}>装備中キャラ</div>
                    <div style={{display:'flex', gap:6, flexWrap:'wrap', alignItems:'center'}}>
                      {equippedChars.map(c => (
                        <div key={c.id} title={c.name} style={{
                          display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                        }}>
                          <div style={{width:36, height:36, borderRadius:'50%',
                            border:`2px solid ${TEAL}`, overflow:'hidden', position:'relative'}}>
                            {c.portrait
                              ? <img src={c.portrait} alt="" style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'top'}}/>
                              : <div style={{width:'100%',height:'100%',background:'rgba(0,0,0,.05)',
                                  display:'flex',alignItems:'center',justifyContent:'center',
                                  fontSize:10,color:TXD}}>?</div>
                            }
                            <div style={{position:'absolute', inset:0,
                              background:`${TEAL}33`,
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:12, color:'#fff', fontWeight:900}}>◉</div>
                          </div>
                          <div style={{fontSize:9, color:TEAL, fontFamily:"'Noto Sans JP'"}}>{c.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ボタン */}
                <div style={{marginTop:'auto', display:'flex', gap:8}}>
                  <button
                    onClick={() => instances[0] && onRemoveItem?.(instances[0].id)}
                    style={{
                      flex:1, padding:'11px 16px', borderRadius:8,
                      background:'rgba(0,0,0,.04)', border:`1px solid ${BR}`,
                      color:TXD, cursor:'pointer', fontFamily:"'Noto Sans JP'", fontSize:12,
                    }}>
                    売却 ({def.sellPrice != null ? `${def.sellPrice.toLocaleString()}M` : '—'})
                  </button>
                </div>
              </>
            );
          })() : (
            <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center',
              color:TXF, fontSize:11}}>アイテムを選択</div>
          )}
        </div>
      </div>

      {/* ── 下部ナビ ── */}
      <div style={{
        ...glass({borderRadius:0, border:'none', borderTop:`1px solid ${BR}`,
          background:'rgba(255,253,251,.97)'}),
        position:'absolute', bottom:0, left:0, right:0, height:52,
        display:'flex', alignItems:'center', padding:'0 16px', gap:10, zIndex:10,
      }}>
        <NavButton label="← マップに戻る" onClick={() => onNavigate('map')}
          activeColor={TEAL} activeBg='rgba(26,138,150,.1)'/>
      </div>
    </div>
  );
}

Object.assign(window, { ItemsScene });
