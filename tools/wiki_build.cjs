#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const WIKI = path.join(ROOT, 'docs/wiki');
const BUILD = path.join(ROOT, 'build/data');
const DATA = path.join(ROOT, 'src/game/data');

// --- Frontmatter Parser ---

function parseFrontmatter(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { fm: null, body: content };
  const fm = yaml.load(match[1]);
  const body = content.slice(match[0].length).trim();
  return { fm, body };
}

// --- Exported Helper Functions ---

function normalizeFactionId(factionId, legacyDict) {
  if (factionId == null) return null;
  return legacyDict[factionId] || factionId;
}

function applyCharacterDefaults(c) {
  if (!('usedThisTurn' in c)) c.usedThisTurn = false;
  if (!('recoveryRate' in c)) c.recoveryRate = null;
  if (!('equipment' in c)) c.equipment = { item: null };
  if (!('specialType' in c)) c.specialType = null;
  if (!('kana' in c)) c.kana = null;
  if (!('talkEventId' in c)) c.talkEventId = null;
  if (!('joinCondition' in c)) c.joinCondition = null;
  if (!('isLeader' in c)) c.isLeader = false;
  if (!('attackCount' in c)) c.attackCount = 8;
  if (c.battleBonus) {
    for (const phase of ['attack', 'defense', 'dungeon']) {
      if (!c.battleBonus[phase]) c.battleBonus[phase] = {};
      const b = c.battleBonus[phase];
      for (const k of ['soldierAtk', 'soldierDef', 'charAttack', 'charSong']) {
        if (!(k in b)) b[k] = 0;
      }
    }
  }
  return c;
}

function applyFactionDefaults(f) {
  if (!('warFlags' in f)) f.warFlags = {};
  return f;
}

function applyBaseDefaults(b) {
  if (!('bgCastle' in b)) b.bgCastle = null;
  if (!('bgField' in b)) b.bgField = null;
  return b;
}

function applyLegionDefaults(l) {
  if (!('isDefenseReserve' in l)) l.isDefenseReserve = false;
  if (!('attackFrequency' in l)) l.attackFrequency = null;
  return l;
}

function applySkillDefaults(s) {
  if (!('specialType' in s)) s.specialType = null;
  return s;
}

function convertSkillsToSkillId(skills) {
  if (!skills || skills.length === 0) return null;
  if (skills.length >= 2) {
    process.stderr.write(`WARN: multiple skills [${skills.join(', ')}], using first\n`);
  }
  return skills[0];
}

function parseChapterBody(body, chapterId) {
  if (!body || body.trim() === '') return [];
  const sections = body.split(/^## /m).slice(1);
  const events = [];
  for (const section of sections) {
    const lines = section.split('\n');
    const headingId = lines[0].trim();
    const yamlMatch = section.match(/```yaml\n([\s\S]*?)```/);
    if (!yamlMatch) {
      events.push({ headingId, data: null });
      continue;
    }
    const data = yaml.load(yamlMatch[1]);
    if (data.id !== headingId) {
      throw new Error(`chapter ${chapterId}: heading "${headingId}" != YAML id "${data.id}"`);
    }
    if (data.chapter !== chapterId) {
      throw new Error(`chapter ${chapterId}: YAML chapter "${data.chapter}" != frontmatter id "${chapterId}"`);
    }
    events.push({ headingId, data });
  }
  return events;
}

const WIKI_ONLY_FIELDS = {
  character: ['tags', 'portrait', 'companionLines', 'secretaryLines', 'skills'],
  faction: ['tags'],
  base: ['tags'],
  item: ['tags'],
  legion: ['tags'],
  skill: ['tags'],
  dungeon: ['tags'],
  command: ['tags', 'category', 'effects'],
  chapter: ['tags', 'title', 'category', 'order'],
};

function stripWikiOnlyFields(entity, type) {
  const fields = WIKI_ONLY_FIELDS[type] || ['tags'];
  const result = {};
  for (const [k, v] of Object.entries(entity)) {
    if (!fields.includes(k)) result[k] = v;
  }
  return result;
}

function buildIndexJson(allEvents) {
  return { events: allEvents };
}

// --- Collect Phase ---

function scanCharactersDir(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      result.push(path.join(dir, entry.name));
    } else if (entry.isDirectory()) {
      for (const subentry of fs.readdirSync(path.join(dir, entry.name), { withFileTypes: true })) {
        if (subentry.isFile() && subentry.name.endsWith('.md')) {
          result.push(path.join(dir, entry.name, subentry.name));
        }
      }
    }
  }
  return result.sort();
}

function validateFactionSubdir(filepath, fm) {
  const rel = path.relative(path.join(WIKI, 'characters'), filepath);
  const parts = rel.split(path.sep);
  if (parts.length < 2) return null;
  const subdirName = parts[0];
  if (fm.factionId !== subdirName) {
    return `character: factionId mismatch (file: characters/${rel}, expected: ${subdirName}, got: ${fm.factionId})`;
  }
  return null;
}

function collectEntities() {
  const entities = {
    characters: [], mob_templates: [], factions: [], bases: [],
    items: [], legions: [], skills: [], dungeons: [], commands: [], chapters: [],
  };

  const dirs = {
    characters: 'characters', mob_templates: 'mob_templates',
    factions: 'factions', bases: 'bases', items: 'items',
    legions: 'legions', skills: 'skills', dungeons: 'dungeons',
    commands: 'commands', chapters: 'chapters',
  };

  for (const [key, dir] of Object.entries(dirs)) {
    const fullDir = path.join(WIKI, dir);
    if (!fs.existsSync(fullDir)) continue;

    const files = (key === 'characters')
      ? scanCharactersDir(fullDir)
      : fs.readdirSync(fullDir).filter(f => f.endsWith('.md')).sort().map(f => path.join(fullDir, f));

    for (const filepath of files) {
      try {
        const { fm, body } = parseFrontmatter(filepath);
        if (!fm) {
          throw new Error(`No frontmatter in ${filepath}`);
        }
        fm._file = filepath;
        fm._body = body;
        entities[key].push(fm);
      } catch (e) {
        throw new Error(`${filepath}: ${e.message}`);
      }
    }
  }
  return entities;
}

// --- Validate Phase ---

function validate(entities) {
  const errors = [];

  const factionIds = new Set(entities.factions.map(f => f.id));
  factionIds.add('faction_tohoku');
  const charIds = new Set();
  const templateIds = new Set();
  const baseIds = new Set(entities.bases.map(b => b.id));
  const dungeonIds = new Set(entities.dungeons.map(d => d.id));

  for (const c of entities.characters) charIds.add(c.id);
  for (const m of entities.mob_templates) templateIds.add(m.id);

  function checkRequired(entity, fields, label) {
    for (const f of fields) {
      if (!(f in entity) || entity[f] === undefined || entity[f] === null || entity[f] === '') {
        errors.push(`${label}: missing required field "${f}" (file: ${entity._file})`);
      }
    }
  }

  function checkIdUnique(items, label) {
    const seen = new Map();
    for (const item of items) {
      if (!item.id) continue;
      if (seen.has(item.id)) {
        errors.push(`${label}: duplicate id "${item.id}" in ${item._file} and ${seen.get(item.id)}`);
      } else {
        seen.set(item.id, item._file);
      }
    }
  }

  checkIdUnique([...entities.characters, ...entities.mob_templates], 'character+mob');
  checkIdUnique(entities.factions, 'faction');
  checkIdUnique(entities.bases, 'base');
  checkIdUnique(entities.items, 'item');
  checkIdUnique(entities.legions, 'legion');
  checkIdUnique(entities.skills, 'skill');
  checkIdUnique(entities.dungeons, 'dungeon');
  checkIdUnique(entities.commands, 'command');

  for (const f of entities.factions) {
    checkRequired(f, ['id', 'name'], 'faction');
  }
  for (const i of entities.items) {
    checkRequired(i, ['id', 'name'], 'item');
  }
  for (const s of entities.skills) {
    checkRequired(s, ['id', 'name'], 'skill');
  }
  for (const d of entities.dungeons) {
    checkRequired(d, ['id', 'name'], 'dungeon');
  }
  for (const cmd of entities.commands) {
    checkRequired(cmd, ['id', 'name'], 'command');
  }

  for (const c of entities.characters) {
    checkRequired(c, ['id', 'name', 'isTemplate', 'role', 'attackType'], 'character');
    if (c.factionId && c.factionId !== 'faction_tohoku' && !factionIds.has(c.factionId)) {
      errors.push(`character "${c.id}": factionId "${c.factionId}" not found (file: ${c._file})`);
    }
    const mismatch = validateFactionSubdir(c._file, c);
    if (mismatch) errors.push(mismatch);
  }

  for (const m of entities.mob_templates) {
    checkRequired(m, ['id', 'isTemplate', 'displayName', 'role', 'attackType'], 'mob_template');
  }

  for (const b of entities.bases) {
    checkRequired(b, ['id', 'name', 'factionId'], 'base');
    if (b.factionId && b.factionId !== 'faction_tohoku' && !factionIds.has(b.factionId)) {
      errors.push(`base "${b.id}": factionId "${b.factionId}" not found (file: ${b._file})`);
    }
    if (b.adjacentBases) {
      for (const adj of b.adjacentBases) {
        if (!baseIds.has(adj)) {
          errors.push(`base "${b.id}": adjacentBase "${adj}" not found (file: ${b._file})`);
        }
      }
    }
    if (b.dungeonId && !dungeonIds.has(b.dungeonId)) {
      errors.push(`base "${b.id}": dungeonId "${b.dungeonId}" not found (file: ${b._file})`);
    }
  }

  for (const l of entities.legions) {
    checkRequired(l, ['id', 'name', 'factionId'], 'legion');
    if (l.factionId && l.factionId !== 'faction_tohoku' && !factionIds.has(l.factionId)) {
      errors.push(`legion "${l.id}": factionId "${l.factionId}" not found (file: ${l._file})`);
    }
    if (l.charIds) {
      for (const cid of l.charIds) {
        if (!charIds.has(cid)) {
          errors.push(`legion "${l.id}": charId "${cid}" not found (file: ${l._file})`);
        }
      }
    }
    if (l.mobSlots) {
      for (const slot of l.mobSlots) {
        if (slot.templateId && !templateIds.has(slot.templateId)) {
          errors.push(`legion "${l.id}": mobSlot templateId "${slot.templateId}" not found (file: ${l._file})`);
        }
      }
    }
  }

  return errors;
}

// --- Output Phase ---

function buildLegacyDict(factions) {
  const dict = {};
  for (const f of factions) {
    if (f.legacyId) dict[f.id] = f.legacyId;
  }
  return dict;
}

function buildCharacterJson(src, legacyDict) {
  const c = { ...src };
  delete c._file;
  delete c._body;

  c.factionId = normalizeFactionId(c.factionId, legacyDict);
  c.skillId = convertSkillsToSkillId(c.skills || []);
  delete c.skills;

  return c;
}

function buildFactionJson(src, legacyDict) {
  const f = { ...src };
  delete f._file;
  delete f._body;

  f.id = f.legacyId || f.id;
  delete f.legacyId;
  f.atWarWith = (f.atWarWith || []).map(id => normalizeFactionId(id, legacyDict));

  return f;
}

function buildBaseJson(src, legacyDict) {
  const b = { ...src };
  delete b._file;
  delete b._body;
  b.factionId = normalizeFactionId(b.factionId, legacyDict);
  return b;
}

function buildLegionJson(src, legacyDict) {
  const l = { ...src };
  delete l._file;
  delete l._body;
  l.factionId = normalizeFactionId(l.factionId, legacyDict);
  return l;
}

function buildSimpleJson(src) {
  const o = { ...src };
  delete o._file;
  delete o._body;
  return o;
}

function writeJsonFile(relPath, data) {
  const buildPath = path.join(BUILD, relPath);
  const dataPath = path.join(DATA, relPath);

  fs.mkdirSync(path.dirname(buildPath), { recursive: true });
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });

  const json = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(buildPath, json, 'utf8');
  fs.writeFileSync(dataPath, json, 'utf8');
}

// --- Main Build ---

function build() {
  const entities = collectEntities();

  // Apply defaults (only for fields that are 100% present in baseline)
  for (const c of entities.characters) applyCharacterDefaults(c);
  for (const m of entities.mob_templates) applyCharacterDefaults(m);
  for (const f of entities.factions) applyFactionDefaults(f);
  for (const b of entities.bases) applyBaseDefaults(b);
  for (const l of entities.legions) applyLegionDefaults(l);
  for (const s of entities.skills) applySkillDefaults(s);
  for (const d of entities.dungeons) {
    if (d.floors) {
      for (const f of d.floors) {
        if (!('rewardItemId' in f)) f.rewardItemId = null;
        if (!('eventId' in f)) f.eventId = null;
      }
    }
  }

  const errors = validate(entities);
  if (errors.length > 0) {
    process.stderr.write(`wiki_build: ${errors.length} error(s):\n`);
    for (const e of errors) process.stderr.write(`  - ${e}\n`);
    process.exit(1);
  }

  const legacyDict = buildLegacyDict(entities.factions);

  // Characters (mob_templates + characters merged)
  const allChars = [
    ...entities.mob_templates.map(m => {
      const stripped = stripWikiOnlyFields(m, 'character');
      return buildCharacterJson(stripped, legacyDict);
    }),
    ...entities.characters.map(c => {
      const stripped = stripWikiOnlyFields(c, 'character');
      return buildCharacterJson(stripped, legacyDict);
    }),
  ];
  writeJsonFile('characters.json', { characters: allChars });

  // Factions (build BEFORE stripping legacyId)
  const factions = entities.factions.map(f => {
    const built = buildFactionJson(f, legacyDict);
    return stripWikiOnlyFields(built, 'faction');
  });
  writeJsonFile('factions.json', { factions });

  // Bases
  const bases = entities.bases.map(b => {
    const stripped = stripWikiOnlyFields(b, 'base');
    return buildBaseJson(stripped, legacyDict);
  });
  writeJsonFile('bases.json', { bases });

  // Items (preserve shopStock from wrapper)
  const items = entities.items.map(i => {
    const stripped = stripWikiOnlyFields(i, 'item');
    return buildSimpleJson(stripped);
  });
  writeJsonFile('items.json', { items, shopStock: [] });

  // Legions
  const legions = entities.legions.map(l => {
    const stripped = stripWikiOnlyFields(l, 'legion');
    return buildLegionJson(stripped, legacyDict);
  });
  writeJsonFile('legions.json', { legions });

  // Skills
  const skills = entities.skills.map(s => {
    const stripped = stripWikiOnlyFields(s, 'skill');
    return buildSimpleJson(stripped);
  });
  writeJsonFile('skills.json', { skills });

  // Dungeons
  const dungeons = entities.dungeons.map(d => {
    const stripped = stripWikiOnlyFields(d, 'dungeon');
    return buildSimpleJson(stripped);
  });
  writeJsonFile('dungeons.json', { dungeons });

  // Commands (promotion_commands) - plain array
  const commands = entities.commands.map(c => {
    const stripped = stripWikiOnlyFields(c, 'command');
    const o = buildSimpleJson(stripped);
    return { id: o.id, name: o.name, limited: o.limited };
  });
  writeJsonFile('promotion_commands.json', commands);

  // Chapters - skip if all bodies are empty
  let hasChapterContent = false;
  for (const ch of entities.chapters) {
    if (ch._body && ch._body.trim() !== '') {
      hasChapterContent = true;
      break;
    }
  }
  if (!hasChapterContent) {
    console.log('wiki_build: chapter bodies empty, skipping event generation');
  }

  console.log(`wiki_build: done (${allChars.length} chars, ${factions.length} factions, ${bases.length} bases, ${items.length} items, ${legions.length} legions, ${skills.length} skills, ${dungeons.length} dungeons, ${commands.length} commands)`);
}

// --- Exports for testing ---
if (typeof module !== 'undefined') {
  module.exports = {
    normalizeFactionId,
    applyCharacterDefaults,
    applyFactionDefaults,
    applyBaseDefaults,
    applyLegionDefaults,
    applySkillDefaults,
    convertSkillsToSkillId,
    parseChapterBody,
    stripWikiOnlyFields,
    buildIndexJson,
    scanCharactersDir,
    validateFactionSubdir,
  };
}

if (require.main === module) {
  build();
}
