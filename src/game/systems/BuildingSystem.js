/**
 * BuildingSystem
 * 研究の定義管理・実行・強化コマンド取得を担当。
 *
 * 研究は勢力全体バフ。拠点への紐づけなし。
 * worldScene.buildings = ['voice_1', 'voice_plus', ...] で管理する。
 *
 * 雇用候補は characters.json の status:'recruitable' かつ isTemplate:false のキャラ。
 */

import researchData   from '../data/facilities.json';
import charactersData from '../data/characters.json';

export class BuildingSystem {
  constructor() {
    this.defs = researchData.research;
    this.upgradeCommands = researchData.upgradeCommands ?? [];
  }

  // ----------------------------------------------------------------
  // 定義取得
  // ----------------------------------------------------------------
  getDef(researchId) {
    return this.defs.find(d => d.id === researchId) ?? null;
  }

  getAllDefs() { return this.defs; }

  // ----------------------------------------------------------------
  // 研究可能な一覧（未研究のもの）
  // ----------------------------------------------------------------
  getResearchable(buildings, treasury) {
    return this.defs
      .filter(def => !buildings.includes(def.id))
      .map(def => ({ ...def, canAfford: treasury >= def.cost }));
  }

  /** @deprecated getResearchable() を使用してください */
  getBuildable(buildings, treasury) { return this.getResearchable(buildings, treasury); }

  // ----------------------------------------------------------------
  // 研究実行（後方互換。GameContextが直接管理するため通常は呼ばれない）
  // ----------------------------------------------------------------
  research(buildings, researchId, faction, worldScene) {
    const def = this.getDef(researchId);
    if (!def) return false;
    if (buildings.includes(researchId)) return false;
    if (faction.treasury < def.cost) return false;
    faction.treasury -= def.cost;
    buildings.push(researchId);
    return true;
  }

  /** @deprecated research() を使用してください */
  build(buildings, buildingId, faction, worldScene) { return this.research(buildings, buildingId, faction, worldScene); }

  // ----------------------------------------------------------------
  // 収入ボーナス計算（incomeボーナス研究廃止のため常に0）
  // ----------------------------------------------------------------
  getIncomeBonus(buildings) {
    return 0;
  }

  // ----------------------------------------------------------------
  // イベントフラグ用（calling_allies廃止のため常にfalse）
  // ----------------------------------------------------------------
  hasAcademy(buildings) {
    return false;
  }

  getResearchNames(buildings) {
    return buildings.map(id => this.getDef(id)?.name ?? id);
  }

  /** @deprecated getResearchNames() を使用してください */
  getBuildingNames(buildings) { return this.getResearchNames(buildings); }

  // ----------------------------------------------------------------
  // キャラ固有強化コマンド取得
  // ----------------------------------------------------------------
  getUpgradeCommands(charId, buildings) {
    return (this.upgradeCommands ?? []).filter(cmd =>
      cmd.charId === charId &&
      buildings.includes(cmd.requiredResearch)
    );
  }

  // ----------------------------------------------------------------
  // 雇用関連
  // ----------------------------------------------------------------
  getHirePool(activeCharacters) {
    const activeIds = new Set(activeCharacters.map(c => c.id));
    return charactersData.characters.filter(c =>
      c.status === 'recruitable' &&
      !c.isTemplate &&
      !activeIds.has(c.id)
    );
  }

  hire(charId, faction, activeCharacters) {
    const activeIds = new Set(activeCharacters.map(c => c.id));
    const template  = charactersData.characters.find(c =>
      c.id === charId &&
      c.status === 'recruitable' &&
      !c.isTemplate &&
      !activeIds.has(c.id)
    );
    if (!template) return null;
    if (faction.treasury < (template.hireCost ?? 0)) return null;

    faction.treasury -= template.hireCost ?? 0;

    const newChar = {
      ...JSON.parse(JSON.stringify(template)),
      factionId:    faction.id,
      status:       'active',
      usedThisTurn: false,
      charHp:       template.charMaxHp,
      equipment:    { item: null },
    };
    activeCharacters.push(newChar);
    return newChar;
  }

  // ----------------------------------------------------------------
  // テンプレートモブからインスタンスを生成（EnemyAI用）
  // ----------------------------------------------------------------
  static createMobInstance(template, factionId) {
    const variance = template.statVariance ?? 0.1;

    function vary(val) {
      const factor = 1 + (Math.random() * 2 - 1) * variance;
      return Math.max(1, Math.round(val * factor));
    }

    const name = (template.nameVariants && template.nameVariants.length > 0)
      ? template.nameVariants[Math.floor(Math.random() * template.nameVariants.length)]
      : template.displayName;

    return {
      id:           `${template.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name,
      displayName:  template.displayName,
      factionId,
      status:       'active',
      isTemplate:   false,
      isLeader:     false,
      usedThisTurn: false,
      role:         template.role,
      attackType:   template.attackType,
      soldiers:     vary(template.soldiers),
      maxSoldiers:  vary(template.maxSoldiers),
      charHp:       vary(template.charMaxHp),
      charMaxHp:    vary(template.charMaxHp),
      charAttack:   vary(template.charAttack),
      charSong:     template.charSong ?? 15,
      attack:       vary(template.charAttack),
      defense:      vary(template.defense ?? 60),
      soldierName:  template.soldierName,
      soldierAtk:   vary(template.soldierAtk),
      soldierDef:   vary(template.soldierDef),
      description:  template.description ?? '',
      equipment:    { item: null },
      battleBonus:  JSON.parse(JSON.stringify(template.battleBonus ?? {
        attack:  { soldierAtk: 0, soldierDef: 0, charAttack: 0, charSong: 0 },
        defense: { soldierAtk: 0, soldierDef: 0, charAttack: 0, charSong: 0 },
        dungeon: { soldierAtk: 0, soldierDef: 0, charAttack: 0, charSong: 0 },
      })),
      _isMobInstance: true,
    };
  }

  // ----------------------------------------------------------------
  // テンプレート一覧を取得（EnemyAI用）
  // ----------------------------------------------------------------
  static getMobTemplates() {
    return charactersData.characters.filter(c => c.isTemplate === true);
  }
}
