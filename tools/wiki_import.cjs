#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'src/game/data');
const WIKI = path.join(ROOT, 'docs/wiki');

const YAML_OPTS = { indent: 2, lineWidth: -1, quotingType: '"', forceQuotes: false, noRefs: true };

const UNSAFE_CHARS = /[/\\:*?"<>|]/g;

function sanitizeFilename(name) {
  return name.replace(UNSAFE_CHARS, '_');
}

function loadJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(DATA, relPath), 'utf8'));
}

function normalizeFactionId(fid) {
  return fid === '東北家' ? 'faction_tohoku' : fid;
}

function writeMd(dir, filename, frontmatter) {
  const filepath = path.join(WIKI, dir, `${sanitizeFilename(filename)}.md`);
  if (fs.existsSync(filepath)) {
    throw new Error(`File already exists: ${filepath}`);
  }
  const yamlStr = yaml.dump(frontmatter, YAML_OPTS);
  fs.writeFileSync(filepath, `---\n${yamlStr}---\n`, 'utf8');
  return filepath;
}

function detectDuplicateNames(records, nameField) {
  const seen = new Map();
  const dupes = [];
  for (const r of records) {
    const name = r[nameField];
    if (!name) continue;
    const safe = sanitizeFilename(name);
    if (seen.has(safe)) {
      dupes.push({ name, id: r.id, conflictsWith: seen.get(safe) });
    } else {
      seen.set(safe, r.id);
    }
  }
  return dupes;
}

// --- Character / Mob Template ---

function importCharacters() {
  const chars = loadJson('characters.json').characters;
  let companionData;
  try {
    companionData = loadJson('companion_lines.json');
  } catch { companionData = null; }

  const normal = chars.filter(c => !c.isTemplate);
  const mobs = chars.filter(c => c.isTemplate);

  const dupes = detectDuplicateNames(normal, 'name');
  const dupeIds = new Set(dupes.map(d => d.id));
  if (dupes.length > 0) {
    for (const d of dupes) {
      process.stderr.write(`WARN: duplicate character name "${d.name}" (${d.id} conflicts with ${d.conflictsWith})\n`);
    }
  }

  let charCount = 0;
  for (const c of normal) {
    const fid = c.factionId ? normalizeFactionId(c.factionId) : null;
    const skills = c.skillId != null ? [c.skillId] : [];

    let companionLines = null;
    if (companionData && companionData.triggers) {
      const lines = {};
      for (const [triggerKey, triggerObj] of Object.entries(companionData.triggers)) {
        if (triggerObj[c.id]) {
          lines[triggerKey] = triggerObj[c.id];
        }
      }
      if (Object.keys(lines).length > 0) companionLines = lines;
    }

    const tags = ['type/character'];
    if (fid) tags.push(`faction/${fid}`);

    const fm = {
      id: c.id,
      name: c.name,
      factionId: fid,
      isLeader: c.isLeader,
      isTemplate: false,
      role: c.role,
      attackType: c.attackType,
      charHp: c.charHp,
      charMaxHp: c.charMaxHp,
      charAttack: c.charAttack,
      charDefense: c.charDefense,
      charSong: c.charSong,
      attack: c.attack,
      defense: c.defense,
      attackCount: c.attackCount,
      soldiers: c.soldiers,
      maxSoldiers: c.maxSoldiers,
      soldierAtk: c.soldierAtk,
      soldierDef: c.soldierDef,
      strategyRate: c.strategyRate,
      skills: skills,
    };

    if ('specialType' in c) fm.specialType = c.specialType;
    fm.kana = c.kana !== undefined ? c.kana : null;
    fm.hireCost = c.hireCost;
    fm.joinCondition = c.joinCondition;
    fm.description = c.description;
    if ('talkEventId' in c) fm.talkEventId = c.talkEventId;

    fm.battleBonus = c.battleBonus;
    fm.portrait = `/characters/portraits/${c.id}.png`;
    fm.companionLines = companionLines;
    fm.secretaryLines = null;
    fm.tags = tags;

    const filename = dupeIds.has(c.id) ? `${c.name}_${c.id}` : c.name;
    writeMd('characters', filename, fm);
    charCount++;
  }
  console.log(`characters: ${charCount}`);

  let mobCount = 0;
  for (const m of mobs) {
    const fm = {
      id: m.id,
      isTemplate: true,
      displayName: m.displayName,
      nameVariants: m.nameVariants || [],
      statVariance: m.statVariance,
      factionId: m.factionId ? normalizeFactionId(m.factionId) : null,
      role: m.role,
      attackType: m.attackType,
      charHp: m.charHp,
      charMaxHp: m.charMaxHp,
      charAttack: m.charAttack,
      charDefense: m.charDefense,
      charSong: m.charSong,
      attack: m.attack,
      defense: m.defense,
      soldiers: m.soldiers,
      maxSoldiers: m.maxSoldiers,
      soldierAtk: m.soldierAtk,
      soldierDef: m.soldierDef,
      strategyRate: m.strategyRate,
      hireCost: m.hireCost,
      description: m.description,
      battleBonus: m.battleBonus,
      tags: ['type/mob_template'],
    };
    writeMd('mob_templates', m.id, fm);
    mobCount++;
  }
  console.log(`mob_templates: ${mobCount}`);
}

// --- Factions ---

function importFactions() {
  const factions = loadJson('factions.json').factions;
  const dupes = detectDuplicateNames(factions, 'name');
  if (dupes.length > 0) {
    for (const d of dupes) {
      process.stderr.write(`WARN: duplicate faction name "${d.name}" (${d.id} conflicts with ${d.conflictsWith})\n`);
    }
  }

  let count = 0;
  for (const f of factions) {
    const isLegacy = f.id === '東北家';
    const fm = {};

    fm.id = isLegacy ? 'faction_tohoku' : f.id;
    if (isLegacy) fm.legacyId = '東北家';
    fm.name = f.name;
    fm.color = f.color;
    fm.isPlayer = f.isPlayer;
    fm.treasury = f.treasury;
    fm.atWarWith = f.atWarWith.map(normalizeFactionId);
    if (f.warFlags) fm.warFlags = f.warFlags;
    fm.tags = ['type/faction'];

    writeMd('factions', f.name, fm);
    count++;
  }
  console.log(`factions: ${count}`);
}

// --- Bases ---

function importBases() {
  const bases = loadJson('bases.json').bases;
  const dupes = detectDuplicateNames(bases, 'name');
  const dupeIds = new Set(dupes.map(d => d.id));
  if (dupes.length > 0) {
    for (const d of dupes) {
      process.stderr.write(`WARN: duplicate base name "${d.name}" (${d.id} conflicts with ${d.conflictsWith})\n`);
    }
  }

  let count = 0;
  for (const b of bases) {
    const fid = normalizeFactionId(b.factionId);
    const fm = {
      id: b.id,
      name: b.name,
      x: b.x,
      y: b.y,
      factionId: fid,
      income: b.income,
      isCapital: b.isCapital,
      adjacentBases: b.adjacentBases,
      battleCapacity: b.battleCapacity,
      dungeonId: b.dungeonId,
      area: b.area,
      tags: ['type/base', `faction/${fid}`, `region/${b.area}`],
    };
    if ('bgCastle' in b) fm.bgCastle = b.bgCastle;
    if ('bgField' in b) fm.bgField = b.bgField;

    const filename = dupeIds.has(b.id) ? `${b.name}_${b.id}` : b.name;
    writeMd('bases', filename, fm);
    count++;
  }
  console.log(`bases: ${count}`);
}

// --- Items ---

function importItems() {
  const items = loadJson('items.json').items;
  let count = 0;
  for (const i of items) {
    const fm = {
      id: i.id,
      name: i.name,
      type: i.type,
      slotType: i.slotType,
      description: i.description,
      effect: i.effect,
      cost: i.cost,
      sellPrice: i.sellPrice,
      startWithPlayer: i.startWithPlayer,
      tags: ['type/item'],
    };
    writeMd('items', i.name, fm);
    count++;
  }
  console.log(`items: ${count}`);
}

// --- Legions ---

function importLegions() {
  const legions = loadJson('legions.json').legions;
  const dupes = detectDuplicateNames(legions, 'name');
  const dupeIds = new Set(dupes.map(d => d.id));
  if (dupes.length > 0) {
    for (const d of dupes) {
      process.stderr.write(`WARN: duplicate legion name "${d.name}" (${d.id} conflicts with ${d.conflictsWith})\n`);
    }
  }

  let count = 0;
  for (const l of legions) {
    const fid = normalizeFactionId(l.factionId);
    const fm = {
      id: l.id,
      name: l.name,
      factionId: fid,
      charIds: l.charIds,
      mobSlots: l.mobSlots,
      maxMobSlots: l.maxMobSlots,
      attackPriority: l.attackPriority,
      defendBases: l.defendBases,
      attackFrequency: l.attackFrequency,
    };
    if ('isDefenseReserve' in l) fm.isDefenseReserve = l.isDefenseReserve;
    fm.retreatRule = l.retreatRule;
    fm.tags = ['type/legion', `faction/${fid}`];

    const filename = dupeIds.has(l.id) ? `${l.name}_${l.id}` : l.name;
    writeMd('legions', filename, fm);
    count++;
  }
  console.log(`legions: ${count}`);
}

// --- Skills ---

function importSkills() {
  const skills = loadJson('skills.json').skills;
  let count = 0;
  for (const s of skills) {
    const fm = {
      id: s.id,
      name: s.name,
      description: s.description,
      trigger: s.trigger,
      assignTo: s.assignTo,
    };
    if ('specialType' in s) fm.specialType = s.specialType;
    fm.tags = ['type/skill'];
    writeMd('skills', s.id, fm);
    count++;
  }
  console.log(`skills: ${count}`);
}

// --- Dungeons ---

function importDungeons() {
  const dungeons = loadJson('dungeons.json').dungeons;
  let count = 0;
  for (const d of dungeons) {
    const fm = {
      id: d.id,
      name: d.name,
      baseId: d.baseId,
      totalFloors: d.totalFloors,
      prerequisites: d.prerequisites,
      floors: d.floors,
      tags: ['type/dungeon'],
    };
    writeMd('dungeons', d.name, fm);
    count++;
  }
  console.log(`dungeons: ${count}`);
}

// --- Commands (promotion_commands) ---

function importCommands() {
  const cmds = loadJson('promotion_commands.json');
  let count = 0;
  for (const c of cmds) {
    const fm = {
      id: c.id,
      name: c.name,
      category: 'promotion',
      limited: c.limited,
      effects: [],
      tags: ['type/command', 'command/promotion'],
    };
    writeMd('commands', c.id, fm);
    count++;
  }
  console.log(`commands: ${count}`);
}

// --- Chapters ---

function importChapters() {
  const index = loadJson('events/_index.json').events;

  const groups = {};
  for (const entry of index) {
    if (!groups[entry.chapter]) groups[entry.chapter] = [];
    groups[entry.chapter].push(entry);
  }

  let count = 0;
  for (const [chapter, entries] of Object.entries(groups)) {
    const events = [];
    for (const entry of entries) {
      const evJson = loadJson(`events/${entry.path}`);
      events.push({
        id: evJson.id,
        trigger: evJson.trigger,
        priority: evJson.priority,
        maxOccurrences: evJson.maxOccurrences,
      });
    }
    events.sort((a, b) => b.priority - a.priority);

    let category;
    if (/^ch0[1-5]_/.test(chapter)) {
      category = 'story';
    } else if (['system', 'defeated', 'theater'].includes(chapter)) {
      category = chapter;
    } else {
      category = 'story';
    }

    const order = category === 'story' ? parseInt(chapter.match(/^ch0(\d)/)?.[1] || '0') : null;

    const fm = {
      id: chapter,
      title: '',
      category: category,
      order: order,
      events: events,
      tags: ['type/chapter', `chapter/${chapter}`],
    };

    writeMd('chapters', chapter, fm);
    count++;
  }
  console.log(`chapters: ${count}`);
}

// --- Main ---

function main() {
  console.log('wiki_import: start');

  importCharacters();
  importFactions();
  importBases();
  importItems();
  importLegions();
  importSkills();
  importDungeons();
  importCommands();
  importChapters();

  console.log('wiki_import: done');
}

main();
