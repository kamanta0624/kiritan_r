import React, { useState } from 'react';
import { PK, PK2, AC, AC2, TEAL, TX, TXD, TXF, BR, glass, GAME_STATE, ROLES, CHARS } from '../shared/tokens.js';
import { TopBar } from '../shared/SharedUI.jsx';

// ═══════════════════════════════════════════════════════════
//   ItemsScene — アイテム管理
// ═══════════════════════════════════════════════════════════

const DEMO_ITEMS = [
  { id:'i1',  name:'ずんだ餅',     kind:'consume',  effect:'HP+200',    desc:'ずんだもん特製。食べると元気が出る。',  count:5,  equip:false, rarity:'common'   },
  { id:'i2',  name:'鋼の太刀',     kind:'weapon',   effect:'攻撃+8',     desc:'仙台の名工が打った刃。前衛向け。',     count:1,  equip:true,  rarity:'rare', equippedBy:'c1' },
  { id:'i3',  name:'紙の鎧',       kind:'armor',    effect:'防御+4',     desc:'軽量だがそれなり。後衛にも装備可。',   count:3,  equip:true,  rarity:'common'   },
  { id:'i4',  name:'拡声器',       kind:'tool',     effect:'ミーム+1500', desc:'声を遠くまで届ける。一度のみ使用可。',  count:2,  equip:false, rarity:'rare'     },
  { id:'i5',  name:'銀の指環',     kind:'accessory',effect:'速度+3',     desc:'軽量化の魔法が込められている。',       count:1,  equip:true,  rarity:'epic'     },
  { id:'i6',  name:'霧の杖',       kind:'weapon',   effect:'攻撃+5, 範囲', desc:'霧を呼ぶ。後衛/間接向け。',           count:1,  equip:true,  rarity:'rare', equippedBy:'c6' },
  { id:'i7',  name:'回復薬',       kind:'consume',  effect:'HP+500',    desc:'戦闘中に1回使用可能。',                count:8,  equip:false, rarity:'common'   },
  { id:'i8',  name:'守護の御札',   kind:'accessory',effect:'防御+5',     desc:'護りの加護。被ダメ-10%。',             count:2,  equip:true,  rarity:'rare'     },
  { id:'i9',  name:'仙台みやげ',   kind:'tool',     effect:'好感度+1',   desc:'仲間に渡すと喜ばれる。',               count:4,  equip:false, rarity:'common'   },
  { id:'i10', name:'幻の毛糸',     kind:'material', effect:'素材',       desc:'研究で使える。今は持っているだけ。',   count:12, equip:false, rarity:'common'   },
];

const KIND_LABEL = {
  weapon:'武器', armor:'防具', accessory:'装飾', consume:'消費', tool:'道具', material:'素材',
};
const KIND_COLOR = {
  weapon:'#c4427a', armor:'#1a8a96', accessory:'#6a55b0',
  consume:'#2a9a58', tool:'#b87010', material:'#8a8e96',
};
const RARITY_COLOR = { common:'#8a8e96', rare:'#1a8a96', epic:'#9d4ed4', legendary:'#d4a044' };
const RARITY_LABEL = { common:'COMMON', rare:'RARE', epic:'EPIC', legendary:'LEGENDARY' };

export default function ItemsScene({ onNavigate }) {
  const [selectedId, setSelectedId] = useState('i2');
  const [filter, setFilter] = useState('all');

  const items = filter === 'all' ? DEMO_ITEMS : DEMO_ITEMS.filter(i => i.kind === filter);
  const selected = DEMO_ITEMS.find(i => i.id === selectedId) || items[0] || null;
  const equippedBy = selected?.equippedBy ? CHARS.find(c => c.id === selected.equippedBy) : null;
  const eligible = selected?.equip ? CHARS.filter(c => c.joined) : [];

  return (
    <div className="scene-enter" style={{
      width:'100vw', height:'100vh', position:'relative', overflow:'hidden',
      background:'rgba(248,246,244,1)',
      fontFamily:"'Noto Sans JP'",
    }}>
      <TopBar breadcrumb={['マップ','アイテム']}
        rightSlot={
          <div style={{padding:'4px 12px', borderRadius:20,
            background:'rgba(184,112,16,.1)', border:'1px solid rgba(184,112,16,.25)',
            display:'flex', alignItems:'center', gap:6}}>
            <div style={{width:6, height:6, borderRadius:'50%', background:AC}}/>
            <span style={{fontFamily:"'Zen Maru Gothic'", fontSize:11, fontWeight:900, color:TX}}>
              所持 {DEMO_ITEMS.length}種
            </span>
          </div>
        }/>

      <div style={{position:'absolute', top:52, left:0, right:0, bottom:52, display:'flex'}}>
        {/* Left — list */}
        <div style={{flex:1, display:'flex', flexDirection:'column', minWidth:0,
          borderRight:`1px solid ${BR}`}}>
          {/* Filter tabs */}
          <div style={{padding:'14px 18px 10px', display:'flex', gap:6, flexWrap:'wrap',
            borderBottom:`1px solid ${BR}`}}>
            {['all', ...Object.keys(KIND_LABEL)].map(k => (
              <button key={k} onClick={()=>setFilter(k)}
                style={{
                  padding:'5px 12px', borderRadius:14, fontSize:11,
                  fontFamily:"'Noto Sans JP'", cursor:'pointer',
                  border: filter===k ? `1px solid ${PK}` : `1px solid ${BR}`,
                  background: filter===k ? `${PK}1a` : 'transparent',
                  color: filter===k ? PK : TXD,
                }}>{k==='all' ? 'すべて' : KIND_LABEL[k]}</button>
            ))}
          </div>

          {/* Grid */}
          <div style={{flex:1, overflowY:'auto', padding:'14px 16px'}}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:8}}>
              {items.map(item => {
                const kc = KIND_COLOR[item.kind];
                const rc = RARITY_COLOR[item.rarity];
                const active = selectedId === item.id;
                return (
                  <button key={item.id}
                    onClick={()=>setSelectedId(item.id)}
                    style={{
                      position:'relative', cursor:'pointer',
                      padding:'12px 12px 10px', borderRadius:8, textAlign:'left',
                      background: active ? `${kc}1a` : 'rgba(255,255,255,.5)',
                      border: active ? `1.5px solid ${kc}` : `1px solid ${BR}`,
                      boxShadow: active ? `0 2px 14px ${kc}33` : 'none',
                      transition:'all .15s', fontFamily:'inherit',
                      minHeight:88, display:'flex', flexDirection:'column', gap:6,
                    }}>
                    {/* rarity ribbon */}
                    <div style={{position:'absolute', top:0, left:0,
                      padding:'1px 6px', fontFamily:'Rajdhani', fontWeight:700,
                      fontSize:8, letterSpacing:'.12em', color:'#fff',
                      background:rc, borderRadius:'8px 0 6px 0'}}>
                      {RARITY_LABEL[item.rarity]}
                    </div>
                    {item.count > 1 && (
                      <div style={{position:'absolute', top:6, right:8,
                        fontFamily:'Rajdhani', fontWeight:900, fontSize:13, color:TX}}>
                        ×{item.count}
                      </div>
                    )}
                    <ItemIcon kind={item.kind} color={kc}/>
                    <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:13, fontWeight:900,
                      color: active ? kc : TX, lineHeight:1.2}}>{item.name}</div>
                    <div style={{fontSize:9, color:TXD, fontFamily:"'Noto Sans JP'"}}>{KIND_LABEL[item.kind]} · {item.effect}</div>
                    {item.equippedBy && (
                      <div style={{fontSize:8, color:TEAL, fontFamily:'Rajdhani', fontWeight:700,
                        letterSpacing:'.12em', marginTop:'auto'}}>
                        ◉ 装備中
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right — detail */}
        <div style={{flex:'0 0 360px', display:'flex', flexDirection:'column', padding:'18px 20px', gap:16, overflowY:'auto',
          background:'rgba(255,253,251,.5)'}}>
          {selected ? (
            <>
              <div>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                  <span style={{fontSize:9, padding:'2px 8px', borderRadius:10,
                    background:RARITY_COLOR[selected.rarity]+'22',
                    color:RARITY_COLOR[selected.rarity], fontFamily:'Rajdhani', fontWeight:700,
                    letterSpacing:'.16em'}}>{RARITY_LABEL[selected.rarity]}</span>
                  <span style={{fontSize:10, color:TXD}}>{KIND_LABEL[selected.kind]}</span>
                </div>
                <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:22, fontWeight:900, color:TX, lineHeight:1.1}}>
                  {selected.name}
                </div>
              </div>

              <div style={{padding:'12px 14px', borderRadius:8,
                background:`${KIND_COLOR[selected.kind]}10`,
                border:`1px solid ${KIND_COLOR[selected.kind]}33`}}>
                <div style={{fontSize:9, fontFamily:'Rajdhani', fontWeight:700, letterSpacing:'.18em', color:TXD, marginBottom:5}}>EFFECT</div>
                <div style={{fontFamily:"'Zen Maru Gothic'", fontSize:14, fontWeight:900, color:KIND_COLOR[selected.kind]}}>
                  {selected.effect}
                </div>
              </div>

              <div style={{fontSize:11, color:TXD, lineHeight:1.7, fontFamily:"'Noto Sans JP'"}}>
                {selected.desc}
              </div>

              {selected.equip && (
                <div>
                  <div style={{fontSize:9, fontFamily:'Rajdhani', fontWeight:700, letterSpacing:'.18em', color:TXD, marginBottom:6}}>
                    装備可能キャラ
                  </div>
                  <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                    {eligible.map(c => {
                      const active = equippedBy?.id === c.id;
                      return (
                        <div key={c.id} title={c.name}
                          style={{width:32, height:32, borderRadius:'50%',
                            border: active ? `2px solid ${TEAL}` : `1px solid ${BR}`,
                            overflow:'hidden', flexShrink:0, position:'relative'}}>
                          {c.portrait
                            ? <img src={c.portrait} alt="" style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'top'}}/>
                            : <div style={{width:'100%',height:'100%',background:'rgba(0,0,0,.05)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:TXD}}>?</div>}
                          {active && <div style={{position:'absolute', inset:0, background:`${TEAL}33`,
                            display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'#fff', fontWeight:900}}>◉</div>}
                        </div>
                      );
                    })}
                  </div>
                  {equippedBy && (
                    <div style={{fontSize:10, color:TEAL, marginTop:6, fontFamily:"'Noto Sans JP'"}}>
                      現在 {equippedBy.name} が装備中
                    </div>
                  )}
                </div>
              )}

              <div style={{marginTop:'auto', display:'flex', gap:8}}>
                {selected.equip && (
                  <button style={{
                    flex:1, padding:'11px', borderRadius:8,
                    background:`linear-gradient(135deg, ${TEAL}, ${TEAL}cc)`,
                    border:'none', color:'#fff', cursor:'pointer',
                    fontFamily:"'Noto Sans JP'", fontSize:12, fontWeight:700,
                    boxShadow:`0 3px 14px ${TEAL}55`,
                  }}>装備する</button>
                )}
                {selected.kind === 'consume' && (
                  <button style={{
                    flex:1, padding:'11px', borderRadius:8,
                    background:`linear-gradient(135deg, ${PK}, ${PK2})`,
                    border:'none', color:'#fff', cursor:'pointer',
                    fontFamily:"'Noto Sans JP'", fontSize:12, fontWeight:700,
                    boxShadow:`0 3px 14px ${PK}55`,
                  }}>使用する</button>
                )}
                <button style={{
                  flex:'0 0 auto', padding:'11px 16px', borderRadius:8,
                  background:'rgba(0,0,0,.04)', border:`1px solid ${BR}`,
                  color:TXD, cursor:'pointer', fontFamily:"'Noto Sans JP'", fontSize:12,
                }}>売却</button>
              </div>
            </>
          ) : (
            <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center',
              color:TXF, fontSize:11}}>アイテムを選択</div>
          )}
        </div>
      </div>

      {/* Bottom — back */}
      <div style={{
        ...glass({borderRadius:0, border:'none', borderTop:`1px solid ${BR}`,
          background:'rgba(255,253,251,.97)'}),
        position:'absolute', bottom:0, left:0, right:0, height:52,
        display:'flex', alignItems:'center', padding:'0 16px', gap:10, zIndex:10,
      }}>
        <NavButton label="← マップに戻る" onClick={()=>onNavigate('map')}
          activeColor={TEAL} activeBg='rgba(26,138,150,.1)'/>
      </div>
    </div>
  );
}

function ItemIcon({ kind, color }) {
  const glyph = {weapon:'⚔', armor:'⛨', accessory:'◈', consume:'⚗', tool:'⚒', material:'❖'}[kind] || '◇';
  return (
    <div style={{width:36, height:36, borderRadius:6,
      background:`linear-gradient(135deg, ${color}33, ${color}11)`,
      border:`1px solid ${color}44`,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:20, color}}>{glyph}</div>
  );
}

Object.assign(window, { ItemsScene });
