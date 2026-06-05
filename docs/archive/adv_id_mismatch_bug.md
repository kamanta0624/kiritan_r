# Bug Note: ADVScene / BattleScene — Character ID Mismatch

## Symptom

When an event script (defined in `src/game/data/events/`) triggers an ADV scene via `convertEventScript()`, character portraits **never render**. The standing character silhouette (SVG placeholder) is shown instead of the actual portrait image, and speaker name tags display nothing. This happens for every character referenced in event scripts, regardless of whether a portrait file exists on disk.

## Root Cause

There are two separate character registries using incompatible ID schemes:

**Registry A — `src/shared/tokens.js` (`CHARS` array)**
Characters are keyed with short `c`-prefixed IDs: `c1`, `c2`, `c3` … `c15`.
This is the registry that `ADVScene.jsx` and `BattleScene` read from via `getChar(id)`.

```js
// tokens.js
export const CHARS = [
  { id: 'c1', name: '東北きりたん', portrait: 'assets/portrait_kiritan.png', ... },
  { id: 'c2', name: '音街ウナ',   portrait: 'assets/portrait_una.png',     ... },
  // ...
  { id: 'c15', name: '会津あおい', portrait: null, ... },
];
```

**Registry B — `src/game/data/characters.json`**
Characters are keyed with `char_NNN`-style IDs: `char_004`, `char_005`, `char_006` … `char_093`.
This is the registry used by the game engine, event scripts, factions, and battle logic.

```json
{ "id": "char_004", "name": "東北きりたん", ... }
{ "id": "char_005", "name": "音街ウナ",     ... }
```

**The broken bridge — `convertEventScript()` in `src/scenes/ADVScene.jsx`**

`convertEventScript()` reads `step.characterId` from the expanded event script and passes it directly as the `speaker` field of each scenario step:

```js
scenario.push({
  type:    'dialog',
  speaker: step.characterId,   // ← "char_004", "char_005", etc.
  ...
});
```

`ADVScene` then calls `getChar(current.speaker)`:

```js
function getChar(id) {
  return CHARS.find(c => c.id === id);  // searches for "char_004" in CHARS
}
```

`CHARS` contains only `"c1"` … `"c15"` — it has no entry with `id === "char_004"`. So `getChar` returns `undefined`, the portrait path is never resolved, and the scene renders blank silhouettes with no name tag.

## Files Involved

| File | Role |
|------|------|
| `src/shared/tokens.js` | CHARS array (c1–c15), has `portrait` field and other ADV-display metadata |
| `src/game/data/characters.json` | Full game character registry (char_004–char_093), **no** `portrait` field |
| `src/scenes/ADVScene.jsx` | `getChar()`, `convertEventScript()`, `StandingChar`, `PersonaCutin` |
| `src/game/data/events/*.js` | Event scripts that reference characters by `char_NNN` IDs |

## Proposed Fix Options

### Option A — Map `char_NNN` → `c-ID` inside `convertEventScript()`

Add a lookup table (or derive it programmatically) that translates `characters.json` IDs to their counterpart `c`-IDs in CHARS before building the scenario:

```js
const CHAR_ID_MAP = {
  'char_004': 'c1',   // 東北きりたん
  'char_005': 'c2',   // 音街ウナ
  'char_006': 'c3',   // 彩澄しゅお
  'char_016': 'c4',   // ずんだもん
  // ...
};

export function convertEventScript(script, opts) {
  // ...
  speaker: CHAR_ID_MAP[step.characterId] ?? step.characterId,
  // ...
}
```

**Pros:** Minimal blast radius — only `convertEventScript` changes.  
**Cons:** The map must be maintained manually as new characters are added; the two registries remain out of sync long-term.

### Option B — Unify the two registries

Make `characters.json` the single source of truth by adding a `portrait` field (and any other ADV-needed fields: `kana`, `origin`, `role`, `quote`) directly to each entry. Refactor `CHARS` in `tokens.js` to be derived from `characters.json` at runtime (or eliminate it entirely and have `getChar` query `characters.json` directly).

```js
// Derived at startup from characters.json
export const CHARS = CHARACTERS_JSON.characters.filter(c => !c.isTemplate);

function getChar(id) {
  return CHARS.find(c => c.id === id);  // now "char_004" → found
}
```

**Pros:** Eliminates the dual-registry problem permanently; event scripts and ADVScene share one ID space.  
**Cons:** Requires adding portrait path, kana, origin, and quote fields to all 90+ entries in `characters.json`; larger refactor touching both data and scenes.

## Notes

- Characters `c8`–`c15` in CHARS currently have `portrait: null` even within the CHARS registry itself, so they would show placeholder silhouettes even after the ID mismatch is fixed. Portrait files would need to be produced for them as well.
- `characters.json` has **no** `portrait` field at all on any entry today. Whichever fix option is chosen, portrait paths need to be wired in somewhere.
- The DEMO_CAST in `ADVScene.jsx` uses `c1`, `c3`, `c4` directly and works fine because it bypasses `convertEventScript` entirely — this is why the standalone ADV demo renders correctly while event-driven scenes do not.
