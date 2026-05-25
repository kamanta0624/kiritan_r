# Image Asset Audit — 戦国きりたん（仮）
_Generated 2026-05-25_

## What's already in `public/assets/`

| File | Used by | Status |
|------|---------|--------|
| `portrait_kiritan.png` | TitleScene (bg), ADVScene (CHARS c1), BattleScene, PartyScene | ✅ |
| `portrait_una.png` | ADVScene (CHARS c2), BattleScene, PartyScene | ✅ |
| `portrait_shuo.png` | ADVScene (CHARS c3), BattleScene, PartyScene | ✅ |
| `portrait_zundamon.png` | ADVScene (CHARS c4), BattleScene, PartyScene | ✅ |
| `portrait_meron.png` | ADVScene (CHARS c5), BattleScene, PartyScene | ✅ |
| `portrait_bern_fog.png` | ADVScene (CHARS c6), BattleScene, PartyScene | ✅ |
| `portrait_awamo.png` | ADVScene (CHARS c7), BattleScene, PartyScene | ✅ |
| `bg_battle.jpg` | BattleScene (default bg + StrategyCutin), ADVScene (DEMO_BG), FormationScene | ✅ |
| `logo_tohoku.png` | SharedUI TopBar, BattleScene | ✅ |
| `logo_daitoshi.png` | **In assets but not referenced anywhere in source** | ⚠️ orphan |

---

## Architectural note — two character systems

The codebase has **two parallel character registries** that don't share portrait data:

- **`src/shared/tokens.js` → `CHARS` array** (IDs: `c1`–`c15`): used directly by ADVScene, BattleScene, PartyScene, FormationScene, PartnerWidget. Portrait paths are hardcoded strings or `null`.
- **`src/game/data/characters.json`** (IDs: `char_001`–`char_093`, 92 entries): used by the game engine (EventEngine, BattleEngineV3). Has **no `portrait` field at all** — portraits will need to be added here when the event→ADV pipeline is wired up.

All 17 event-file speakers come from `characters.json`. The `convertEventScript()` function in ADVScene will call `getChar(id)` with IDs like `char_004`, but the CHARS array only has `c1`–`c15`. This is a **code-level wiring gap** to fix alongside adding the portrait files.

---

## Category 1 — Event speakers with no portrait (CRITICAL)

These characters appear as speakers in scripted event JSON files right now. They show a blank/SVG placeholder when the scene runs. All events currently only use `expression: normal`.

| Filename needed | Character | chars.json ID | Appears in events | Priority |
|-----------------|-----------|---------------|-------------------|----------|
| `portrait_kiritan.png` | 東北きりたん | char_004 | ev_turn1_status, ev_turn2_recruit_1/2, ev_mito_conquest, ev_saitama_chain_3, ev_defeated_naruhanahi_*, ev_companion_choice_legacy | **CRITICAL** — already exists but not wired to char_004 |
| `portrait_una.png` | 音街ウナ | char_005 | ev_000_opening | **CRITICAL** — already exists but not wired to char_005 |
| `portrait_zundamon.png` | ずんだもん | char_016 | ev_companion_choice_legacy, ev_turn2_recruit_1 | **CRITICAL** — already exists but not wired |
| `portrait_akane.png` | 琴葉茜 | char_008 | ev_turn3_join_akane | **CRITICAL** |
| `portrait_aoi.png` | 琴葉葵 | char_009 | ev_turn3_join_aoi | **CRITICAL** |
| `portrait_akari.png` | 紲星あかり | char_010 | ev_turn3_join_akari | **CRITICAL** |
| `portrait_yukari.png` | 結月ゆかり | char_011 | ev_turn3_join_yukari | **CRITICAL** |
| `portrait_maki.png` | 弦巻マキ | char_012 | ev_turn3_join_maki | **CRITICAL** |
| `portrait_zunko.png` | 東北ずんこ | char_014 | ev_join_zunko | **CRITICAL** |
| `portrait_itako.png` | 東北イタコ | char_015 | ev_join_itako | **CRITICAL** |
| `portrait_metan.png` | 四国めたん | char_017 | ev_turn1_status, ev_saitama_chain_3 | **CRITICAL** |
| `portrait_chanko.png` | 大江戸ちゃんこ | char_020 | ev_first_attack_from_natto, ev_mito_conquest | HIGH |
| `portrait_tsurugi.png` | 中部つるぎ | char_021 | ev_first_attack_from_natto, ev_mito_conquest | HIGH |
| `portrait_sora_sakurno.png` | 桜乃そら | char_034 | ev_turn3_join_sora | HIGH |
| `portrait_hime.png` | 鳴花ヒメ | char_073 | ev_defeated_naruhanahi_me | HIGH |
| `portrait_mikoto.png` | 鳴花ミコト | char_074 | ev_defeated_naruhanahi_mikoto | HIGH |
| `portrait_tsumugi.png` | 春日部つむぎ | char_075 | ev_saitama_chain_1/2/4 | HIGH |

> **Quick win:** kiritan, una, and zundamon portraits already exist — just add a `portrait` field to their `characters.json` entries pointing to the existing files. The other 14 need new art.

---

## Category 2 — tokens.js CHARS with portrait:null (nice-to-have)

These 8 characters exist in the `CHARS` array (used by ADVScene/BattleScene/PartyScene/FormationScene) but are all `joined: false` — they can't appear in gameplay yet. They show an SVG silhouette placeholder when `portrait` is null. All gracefully degrade.

| Filename needed | Character | CHARS ID | Role | Origin |
|-----------------|-----------|----------|------|--------|
| `portrait_kagami.png` | 伊達かがみ | c8 | support | 東北 |
| `portrait_honoka.png` | 花巻ほのか | c9 | rear | 東北 |
| `portrait_sakura.png` | 山形さくら | c10 | ranged | 東北 |
| `portrait_minami.png` | 函館みなみ | c11 | support | 北海道 |
| `portrait_sora_kushiro.png` | 釧路そら | c12 | ranged | 北海道 |
| `portrait_yuki.png` | 旭川ゆき | c13 | front | 北海道 |
| `portrait_hikari.png` | 帯広ひかり | c14 | rear | 北海道 |
| `portrait_aoi_aizu.png` | 会津あおい | c15 | support | 東北 |

**Priority: NICE-TO-HAVE** — graceful SVG silhouette fallback exists.

---

## Category 3 — Expression variants (ADVScene)

ADVScene constructs variant filenames automatically: `portrait_kiritan.png` → `portrait_kiritan_smile.png`. Falls back to the base portrait via `onError` if the variant file is missing.

**Supported expressions:** `normal` (no suffix), `smile`, `angry`, `surprised`, `thinking`

Currently **no event JSON files** use any non-normal expression. The DEMO_SCENARIO hardcoded in ADVScene.jsx does use variants for kiritan, shuo, and zundamon.

| Filename needed | Character | Expression | Used in |
|-----------------|-----------|------------|---------|
| `portrait_kiritan_smile.png` | 東北きりたん | smile | DEMO_SCENARIO |
| `portrait_kiritan_angry.png` | 東北きりたん | angry | DEMO_SCENARIO (implied) |
| `portrait_kiritan_thinking.png` | 東北きりたん | thinking | DEMO_SCENARIO |
| `portrait_shuo_smile.png` | 彩澄しゅお | smile | DEMO_SCENARIO |
| `portrait_zundamon_angry.png` | ずんだもん | angry | DEMO_SCENARIO |

**Priority: NICE-TO-HAVE** — falls back to base portrait silently. Only needed if DEMO_SCENARIO is shown to players, or when event scripts start using expressions.

When events do start using expressions, the pattern will generate names automatically — no code changes needed, just drop the files.

---

## Category 4 — Faction portraits for EnemyTurnScene

`EnemyTurnScene` (`FactionCutin` component) checks `faction.portrait`. None of the 8 factions in `factions.json` have this field. The fallback is a centered sword icon (⚔) — graceful but low-quality for a full-screen cutin.

The field accepts any path string (e.g. `"assets/portrait_foo.png"`). Suggested additions to `factions.json`:

| Suggested filename | Faction | faction_id | Priority |
|--------------------|---------|------------|----------|
| `portrait_daitoshi_leader.png` | 大都会 | faction_red | HIGH — main antagonist, appears in EnemyTurn earliest |
| `portrait_saitama_leader.png` | さいたま | faction_green | NICE-TO-HAVE |
| `portrait_otaru_leader.png` | 小樽潮風 | faction_yellow | NICE-TO-HAVE |
| `portrait_tokyo_leader.png` | 東京 | faction_new01 | NICE-TO-HAVE |
| (other 4 factions) | 自由都市, ボーカル界, AHS（仮） | faction_new02–04 | NICE-TO-HAVE |

> `logo_daitoshi.png` is already in assets. It could be repurposed as a faction logo/emblem display, but the `EnemyTurnScene` code specifically reads `faction.portrait` expecting a character-style portrait image, not a logo.

---

## Category 5 — Per-territory battle backgrounds (BattleScene)

`BattleScene` reads `targetNode.bgCastle` (for bases with `type: 'castle'`) and `targetNode.bgField` (for other types). Neither field exists in `bases.json` currently. Fallback: `bg_battle.jpg` for all battles.

| Suggested filename | Used for | Priority |
|--------------------|----------|----------|
| `bg_castle_sendai.jpg` | Sendai-type castle nodes | NICE-TO-HAVE |
| `bg_field_tohoku.jpg` | Field/plains nodes in Tohoku | NICE-TO-HAVE |
| `bg_castle_default.jpg` | Generic castle fallback | NICE-TO-HAVE |

**Priority: NICE-TO-HAVE** — bg_battle.jpg covers all cases until per-territory art is ready.

---

## Category 6 — Node/base images (BaseMenuScene, FormationScene)

`BaseMenuScene` shows `node.imageUrl` (thumbnail of the base) when present. `FormationScene` shows `targetNode.image` when present. Neither field exists in `bases.json`. Both are silently hidden when null — no fallback is shown.

**Priority: NICE-TO-HAVE** — invisible gap, not a broken feature.

---

## Category 7 — characters.json bulk (background / unused characters)

The 92-entry `characters.json` covers a huge cast (char_001–char_093). Of these, **17 appear in event scripts** (Category 1 above). The remaining ~70 are referenced only by faction membership or not at all yet. They all lack a `portrait` field.

A selection of notable ones that are faction members but not yet in events:

| char ID | Name | Faction |
|---------|------|---------|
| char_101, char_102 | 大都会 chars | faction_red |
| char_201, char_202 | さいたま chars | faction_green |
| char_301, char_302 | 小樽潮風 chars | faction_yellow |

**Priority: BACKGROUND** — none of these are reachable in current gameplay.

---

## Summary by priority

### Must-have (blocks or severely degrades a currently-scripted feature)
1. Wire existing portrait files to `characters.json` entries for char_004 (きりたん), char_005 (ウナ), char_016 (ずんだもん) — code change, no new art needed.
2. New portraits for the 14 event-scripted speakers who don't have files: 琴葉茜, 琴葉葵, 紲星あかり, 結月ゆかり, 弦巻マキ, 東北ずんこ, 東北イタコ, 四国めたん, 大江戸ちゃんこ, 中部つるぎ, 桜乃そら, 鳴花ヒメ, 鳴花ミコト, 春日部つむぎ.

### High (EnemyTurn cutin currently shows placeholder sword)
- `portrait_daitoshi_leader.png` — 大都会 is the first faction to go hostile.

### Nice-to-have (graceful fallback exists)
- c8–c15 portraits in tokens.js (8 files — characters not yet joinable)
- Expression variants for kiritan, shuo, zundamon (5 files)
- Per-territory battle backgrounds (bgCastle / bgField)
- Other faction leader portraits for EnemyTurnScene
- Node thumbnail images (BaseMenuScene / FormationScene)
