import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
import os from 'os';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const {
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
} = require('./wiki_build.cjs');

describe('normalizeFactionId', () => {
  const dict = { faction_tohoku: '東北家' };

  it('converts faction_tohoku to 東北家', () => {
    expect(normalizeFactionId('faction_tohoku', dict)).toBe('東北家');
  });

  it('passes through non-legacy ids', () => {
    expect(normalizeFactionId('faction_red', dict)).toBe('faction_red');
  });

  it('returns null for null input', () => {
    expect(normalizeFactionId(null, dict)).toBeNull();
  });
});

describe('applyCharacterDefaults', () => {
  it('injects all defaults when fields missing', () => {
    const c = { id: 'test' };
    applyCharacterDefaults(c);
    expect(c.usedThisTurn).toBe(false);
    expect(c.recoveryRate).toBeNull();
    expect(c.equipment).toEqual({ item: null });
    expect(c.kana).toBeNull();
    expect(c.joinCondition).toBeNull();
    expect(c.isLeader).toBe(false);
    expect(c.attackCount).toBe(8);
  });

  it('preserves existing values', () => {
    const c = { id: 'test', kana: 'てすと', isLeader: true, attackCount: 12 };
    applyCharacterDefaults(c);
    expect(c.kana).toBe('てすと');
    expect(c.isLeader).toBe(true);
    expect(c.attackCount).toBe(12);
  });

  it('fills battleBonus missing keys with 0', () => {
    const c = { id: 'test', battleBonus: { attack: { soldierAtk: 5 }, defense: {}, dungeon: {} } };
    applyCharacterDefaults(c);
    expect(c.battleBonus.attack.soldierAtk).toBe(5);
    expect(c.battleBonus.attack.soldierDef).toBe(0);
    expect(c.battleBonus.attack.charAttack).toBe(0);
    expect(c.battleBonus.attack.charSong).toBe(0);
    expect(c.battleBonus.defense.soldierAtk).toBe(0);
  });

  it('defaults specialType to null when missing', () => {
    const c = { id: 'test' };
    applyCharacterDefaults(c);
    expect(c.specialType).toBeNull();
  });

  it('defaults talkEventId to null when missing', () => {
    const c = { id: 'test' };
    applyCharacterDefaults(c);
    expect(c.talkEventId).toBeNull();
  });

  it('preserves explicit null specialType', () => {
    const c = { id: 'test', specialType: null };
    applyCharacterDefaults(c);
    expect(c.specialType).toBeNull();
  });

  it('preserves existing specialType value', () => {
    const c = { id: 'test', specialType: 'char_strike' };
    applyCharacterDefaults(c);
    expect(c.specialType).toBe('char_strike');
  });
});

describe('applyFactionDefaults', () => {
  it('adds warFlags when missing', () => {
    const f = { id: 'test' };
    applyFactionDefaults(f);
    expect(f.warFlags).toEqual({});
  });

  it('preserves existing warFlags', () => {
    const f = { id: 'test', warFlags: { canDeclareWar: true } };
    applyFactionDefaults(f);
    expect(f.warFlags.canDeclareWar).toBe(true);
  });

  it('does not overwrite empty object', () => {
    const f = { id: 'test', warFlags: {} };
    applyFactionDefaults(f);
    expect(f.warFlags).toEqual({});
  });
});

describe('applyBaseDefaults', () => {
  it('defaults bgCastle to null when missing', () => {
    const b = { id: 'test' };
    applyBaseDefaults(b);
    expect(b.bgCastle).toBeNull();
  });

  it('defaults bgField to null when missing', () => {
    const b = { id: 'test' };
    applyBaseDefaults(b);
    expect(b.bgField).toBeNull();
  });

  it('preserves existing bgCastle value', () => {
    const b = { id: 'test', bgCastle: 'castle_01.png' };
    applyBaseDefaults(b);
    expect(b.bgCastle).toBe('castle_01.png');
  });
});

describe('convertSkillsToSkillId', () => {
  it('returns null for empty array', () => {
    expect(convertSkillsToSkillId([])).toBeNull();
  });

  it('returns single skill', () => {
    expect(convertSkillsToSkillId(['pierce'])).toBe('pierce');
  });

  it('returns first skill and warns on multiple', () => {
    const origWrite = process.stderr.write;
    let warned = false;
    process.stderr.write = (msg) => { warned = String(msg).includes('WARN'); return true; };
    const result = convertSkillsToSkillId(['a', 'b']);
    process.stderr.write = origWrite;
    expect(result).toBe('a');
    expect(warned).toBe(true);
  });

  it('returns null for null/undefined input', () => {
    expect(convertSkillsToSkillId(null)).toBeNull();
    expect(convertSkillsToSkillId(undefined)).toBeNull();
  });
});

describe('parseChapterBody', () => {
  it('parses valid YAML blocks', () => {
    const body = `## ev_001\n\`\`\`yaml\nid: ev_001\nchapter: ch01\ntrigger: game_start\n\`\`\`\n\n## ev_002\n\`\`\`yaml\nid: ev_002\nchapter: ch01\ntrigger: turn_start\n\`\`\``;
    const events = parseChapterBody(body, 'ch01');
    expect(events).toHaveLength(2);
    expect(events[0].data.id).toBe('ev_001');
    expect(events[1].data.trigger).toBe('turn_start');
  });

  it('throws on heading/YAML id mismatch', () => {
    const body = `## ev_001\n\`\`\`yaml\nid: ev_999\nchapter: ch01\n\`\`\``;
    expect(() => parseChapterBody(body, 'ch01')).toThrow('heading "ev_001" != YAML id "ev_999"');
  });

  it('throws on chapter mismatch', () => {
    const body = `## ev_001\n\`\`\`yaml\nid: ev_001\nchapter: ch99\n\`\`\``;
    expect(() => parseChapterBody(body, 'ch01')).toThrow('YAML chapter "ch99" != frontmatter id "ch01"');
  });

  it('returns empty array for empty body', () => {
    expect(parseChapterBody('', 'ch01')).toEqual([]);
    expect(parseChapterBody(null, 'ch01')).toEqual([]);
  });

  it('returns null data when YAML block missing', () => {
    const body = `## ev_001\nno yaml here`;
    const events = parseChapterBody(body, 'ch01');
    expect(events[0].data).toBeNull();
  });
});

describe('stripWikiOnlyFields', () => {
  it('strips character wiki-only fields', () => {
    const entity = { id: 'c1', name: 'test', tags: ['x'], portrait: '/img.png', companionLines: null, secretaryLines: null, skills: ['a'] };
    const result = stripWikiOnlyFields(entity, 'character');
    expect(result.id).toBe('c1');
    expect(result.name).toBe('test');
    expect('tags' in result).toBe(false);
    expect('portrait' in result).toBe(false);
    expect('companionLines' in result).toBe(false);
    expect('secretaryLines' in result).toBe(false);
    expect('skills' in result).toBe(false);
  });

  it('strips faction wiki-only fields', () => {
    const entity = { id: 'f1', name: 'test', tags: ['x'] };
    const result = stripWikiOnlyFields(entity, 'faction');
    expect('tags' in result).toBe(false);
    expect(result.id).toBe('f1');
  });

  it('strips command wiki-only fields', () => {
    const entity = { id: 'cmd1', name: 'test', tags: ['x'], category: 'promotion', effects: [], limited: false };
    const result = stripWikiOnlyFields(entity, 'command');
    expect('tags' in result).toBe(false);
    expect('category' in result).toBe(false);
    expect('effects' in result).toBe(false);
    expect(result.limited).toBe(false);
  });
});

describe('buildIndexJson', () => {
  it('wraps events array', () => {
    const events = [
      { id: 'ev_001', chapter: 'ch01', trigger: 'game_start', priority: 100, maxOccurrences: 1, path: 'events/ch01/ev_001.json' },
    ];
    const result = buildIndexJson(events);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].path).toBe('events/ch01/ev_001.json');
  });

  it('handles empty array', () => {
    expect(buildIndexJson([]).events).toEqual([]);
  });

  it('preserves all fields', () => {
    const ev = { id: 'ev_001', chapter: 'sys', trigger: 'game_start', priority: 999, maxOccurrences: 1, path: 'events/sys/ev_001.json' };
    const result = buildIndexJson([ev]);
    expect(result.events[0]).toEqual(ev);
  });
});

describe('scanCharactersDir', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns flat .md files only', () => {
    fs.writeFileSync(path.join(tmpDir, 'a.md'), '');
    fs.writeFileSync(path.join(tmpDir, 'b.md'), '');
    fs.writeFileSync(path.join(tmpDir, 'c.txt'), '');
    const result = scanCharactersDir(tmpDir);
    expect(result).toHaveLength(2);
    expect(result.every(f => f.endsWith('.md'))).toBe(true);
  });

  it('returns subdir .md files only', () => {
    fs.mkdirSync(path.join(tmpDir, 'faction_red'));
    fs.writeFileSync(path.join(tmpDir, 'faction_red', 'x.md'), '');
    fs.writeFileSync(path.join(tmpDir, 'faction_red', 'y.md'), '');
    const result = scanCharactersDir(tmpDir);
    expect(result).toHaveLength(2);
    expect(result.every(f => f.includes('faction_red'))).toBe(true);
  });

  it('returns combined flat + subdir files', () => {
    fs.writeFileSync(path.join(tmpDir, 'flat.md'), '');
    fs.mkdirSync(path.join(tmpDir, 'faction_green'));
    fs.writeFileSync(path.join(tmpDir, 'faction_green', 'sub.md'), '');
    const result = scanCharactersDir(tmpDir);
    expect(result).toHaveLength(2);
  });
});

describe('validateFactionSubdir', () => {
  const wikiCharDir = path.resolve(__dirname, '..', 'docs/wiki/characters');

  it('returns null for matching factionId', () => {
    const filepath = path.join(wikiCharDir, 'faction_red', 'test.md');
    const fm = { factionId: 'faction_red' };
    expect(validateFactionSubdir(filepath, fm)).toBeNull();
  });

  it('returns error for mismatching factionId', () => {
    const filepath = path.join(wikiCharDir, 'faction_red', 'test.md');
    const fm = { factionId: 'faction_tohoku' };
    const err = validateFactionSubdir(filepath, fm);
    expect(err).toContain('factionId mismatch');
    expect(err).toContain('expected: faction_red');
    expect(err).toContain('got: faction_tohoku');
  });
});
