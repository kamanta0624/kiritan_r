/**
 * ItemSystem
 * アイテムの定義管理・装備/外し・効果計算を担当。
 *
 * 装備スロット構成（キャラクターごと）:
 *   equipment: { item: itemId|null }  ← 1スロットのみ
 *
 * 所持アイテムはWorldMapScene.inventory（配列）で管理する。
 * 各要素: { id: instanceId, itemId: 定義ID }
 */

import itemsData from '../data/items.json';

let _nextInstanceId = 1;
function genId() { return `inv_${_nextInstanceId++}`; }

export class ItemSystem {

  constructor() {
    this.defs = itemsData.items;
  }

  // ----------------------------------------------------------------
  // 静的ヘルパー
  // ----------------------------------------------------------------
  static ensureEquipment(char) {
    // 旧形式（weapon/armor/accessory）を新形式（item）に移行
    if (!char.equipment || !('item' in char.equipment)) {
      char.equipment = { item: null };
    }
  }

  // ----------------------------------------------------------------
  // 定義取得
  // ----------------------------------------------------------------
  getDef(itemId) {
    return this.defs.find(d => d.id === itemId) ?? null;
  }

  getAllDefs() { return this.defs; }

  getShopStock() {
    return itemsData.shopStock.map(id => this.getDef(id)).filter(Boolean);
  }

  // ----------------------------------------------------------------
  // 所持アイテム操作
  // ----------------------------------------------------------------
  addToInventory(inventory, itemId) {
    const inst = { id: genId(), itemId };
    inventory.push(inst);
    return inst;
  }

  removeFromInventory(inventory, instanceId) {
    const idx = inventory.findIndex(i => i.id === instanceId);
    if (idx === -1) return false;
    inventory.splice(idx, 1);
    return true;
  }

  // ----------------------------------------------------------------
  // 装備操作（1スロット）
  // ----------------------------------------------------------------
  equip(char, inventory, instanceId) {
    const inst = inventory.find(i => i.id === instanceId);
    if (!inst) return false;
    const def = this.getDef(inst.itemId);
    if (!def) return false;

    ItemSystem.ensureEquipment(char);

    // 既存装備を所持品に戻す
    if (char.equipment.item) {
      this.addToInventory(inventory, char.equipment.item);
    }

    char.equipment.item = inst.itemId;
    this.removeFromInventory(inventory, instanceId);
    return true;
  }

  unequip(char, inventory) {
    ItemSystem.ensureEquipment(char);
    if (!char.equipment.item) return false;
    this.addToInventory(inventory, char.equipment.item);
    char.equipment.item = null;
    return true;
  }

  // ----------------------------------------------------------------
  // 効果適用（BattleScene用）
  // ----------------------------------------------------------------
  applyEquipment(char) {
    const result = {
      charAttack:  char.charAttack  ?? char.attack ?? 70,
      charMaxHp:   char.charMaxHp   ?? 200,
      charHp:      char.charHp      ?? 200,
      soldierAtk:  char.soldierAtk  ?? 10,
      soldierDef:  char.soldierDef  ?? 8,
      maxSoldiers: char.maxSoldiers ?? 1000,
    };

    const itemId = char.equipment?.item;
    if (itemId) {
      const def = this.getDef(itemId);
      if (def) {
        const { type, value } = def.effect;
        if (type in result) result[type] += value;
      }
    }

    result.charHp = Math.min(result.charHp, result.charMaxHp);
    return result;
  }

  // ----------------------------------------------------------------
  // 表示用ヘルパー
  // ----------------------------------------------------------------
  effectLabel(def) {
    const labels = {
      charAttack:  '攻撃力',
      charMaxHp:   '最大HP',
      soldierAtk:  '兵士攻撃力',
      soldierDef:  '兵士防御力',
      maxSoldiers: '最大兵士数',
    };
    return `${labels[def.effect.type] ?? def.effect.type} +${def.effect.value}`;
  }

  // 装備中のアイテム定義を返す（表示用）
  getEquippedDef(char) {
    const itemId = char.equipment?.item;
    return itemId ? this.getDef(itemId) : null;
  }

  // ----------------------------------------------------------------
  // セーブ/ロード用
  // ----------------------------------------------------------------
  serializeInventory(inventory) {
    return inventory.map(i => ({ id: i.id, itemId: i.itemId }));
  }

  deserializeInventory(saved) {
    const inventory = saved.map(i => ({ id: i.id, itemId: i.itemId }));
    saved.forEach(i => {
      const n = parseInt(i.id.replace('inv_', ''), 10);
      if (!isNaN(n) && n >= _nextInstanceId) _nextInstanceId = n + 1;
    });
    return inventory;
  }
}
