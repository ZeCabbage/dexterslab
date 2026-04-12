import { InventoryItem } from '../types';

export const ITEM_DATABASE: Record<string, Partial<InventoryItem>> = {
  // --- ARMOR & SHIELDS ---
  item_chainmail: { id: "item_chainmail", name: "Chain Mail", type: "armor", armorCategory: "heavy", armorClass: 16, slot: "chest", weight: 55 },
  item_leather: { id: "item_leather", name: "Leather Armor", type: "armor", armorCategory: "light", armorClass: 11, slot: "chest", weight: 10 },
  item_scalemail: { id: "item_scalemail", name: "Scale Mail", type: "armor", armorCategory: "medium", armorClass: 14, slot: "chest", weight: 45 },
  item_shield: { id: "item_shield", name: "Shield", type: "armor", armorCategory: "shield", armorClass: 2, slot: "offHand", weight: 6 },
  item_wooden_shield: { id: "item_wooden_shield", name: "Wooden Shield", type: "armor", armorCategory: "shield", armorClass: 2, slot: "offHand", weight: 6 },
  
  // --- MELEE WEAPONS ---
  item_dagger: { id: "item_dagger", name: "Dagger", type: "weapon", slot: "mainHand", weight: 1, actionCost: "action", weaponCategory: "simple", damage: "1d4", damageType: "piercing", properties: ["finesse", "light", "thrown (range 20/60)"] },
  item_quarterstaff: { id: "item_quarterstaff", name: "Quarterstaff", type: "weapon", slot: "mainHand", weight: 4, actionCost: "action", weaponCategory: "simple", damage: "1d6", damageType: "bludgeoning", properties: ["versatile (1d8)"] },
  item_mace: { id: "item_mace", name: "Mace", type: "weapon", slot: "mainHand", weight: 4, actionCost: "action", weaponCategory: "simple", damage: "1d6", damageType: "bludgeoning", properties: [] },
  item_warhammer: { id: "item_warhammer", name: "Warhammer", type: "weapon", slot: "mainHand", weight: 2, actionCost: "action", weaponCategory: "martial", damage: "1d8", damageType: "bludgeoning", properties: ["versatile (1d10)"] },
  item_scimitar: { id: "item_scimitar", name: "Scimitar", type: "weapon", slot: "mainHand", weight: 3, actionCost: "action", weaponCategory: "martial", damage: "1d6", damageType: "slashing", properties: ["finesse", "light"] },
  item_shortsword: { id: "item_shortsword", name: "Shortsword", type: "weapon", slot: "mainHand", weight: 2, actionCost: "action", weaponCategory: "martial", damage: "1d6", damageType: "piercing", properties: ["finesse", "light"] },
  item_rapier: { id: "item_rapier", name: "Rapier", type: "weapon", slot: "mainHand", weight: 2, actionCost: "action", weaponCategory: "martial", damage: "1d8", damageType: "piercing", properties: ["finesse"] },
  item_longsword: { id: "item_longsword", name: "Longsword", type: "weapon", slot: "mainHand", weight: 3, actionCost: "action", weaponCategory: "martial", damage: "1d8", damageType: "slashing", properties: ["versatile (1d10)"] },
  item_greatsword: { id: "item_greatsword", name: "Greatsword", type: "weapon", slot: "mainHand", weight: 6, actionCost: "action", weaponCategory: "martial", damage: "2d6", damageType: "slashing", properties: ["heavy", "two-handed"] },
  item_greataxe: { id: "item_greataxe", name: "Greataxe", type: "weapon", slot: "mainHand", weight: 7, actionCost: "action", weaponCategory: "martial", damage: "1d12", damageType: "slashing", properties: ["heavy", "two-handed"] },
  item_battleaxe: { id: "item_battleaxe", name: "Battleaxe", type: "weapon", slot: "mainHand", weight: 4, actionCost: "action", weaponCategory: "martial", damage: "1d8", damageType: "slashing", properties: ["versatile (1d10)"] },
  item_handaxe: { id: "item_handaxe", name: "Handaxe", type: "weapon", slot: "mainHand", weight: 2, actionCost: "action", weaponCategory: "simple", damage: "1d6", damageType: "slashing", properties: ["light", "thrown (range 20/60)"] },
  item_spear: { id: "item_spear", name: "Spear", type: "weapon", slot: "mainHand", weight: 3, actionCost: "action", weaponCategory: "simple", damage: "1d6", damageType: "piercing", properties: ["thrown (range 20/60)", "versatile (1d8)"] },

  // --- RANGED WEAPONS & AMMO ---
  item_light_crossbow: { id: "item_light_crossbow", name: "Light Crossbow", type: "weapon", slot: "mainHand", weight: 5, actionCost: "action", weaponCategory: "simple", damage: "1d8", damageType: "piercing", properties: ["ammunition (range 80/320)", "loading", "two-handed"] },
  item_shortbow: { id: "item_shortbow", name: "Shortbow", type: "weapon", slot: "mainHand", weight: 2, actionCost: "action", weaponCategory: "simple", damage: "1d6", damageType: "piercing", properties: ["ammunition (range 80/320)", "two-handed"] },
  item_longbow: { id: "item_longbow", name: "Longbow", type: "weapon", slot: "mainHand", weight: 2, actionCost: "action", weaponCategory: "martial", damage: "1d8", damageType: "piercing", properties: ["ammunition (range 150/600)", "heavy", "two-handed"] },
  
  item_arrows_20: { id: "item_arrows_20", name: "Arrows (20)", type: "gear", weight: 1, qty: 20 },
  item_crossbow_bolts_20: { id: "item_crossbow_bolts_20", name: "Crossbow Bolts (20)", type: "gear", weight: 1.5, qty: 20 },
  item_javelin: { id: "item_javelin", name: "Javelin", type: "weapon", weight: 2, actionCost: "action", weaponCategory: "simple", damage: "1d6", damageType: "piercing", properties: ["thrown (range 30/120)"] },
  item_javelin_4: { id: "item_javelin_4", name: "Javelin (4)", type: "weapon", weight: 8, qty: 4, actionCost: "action", weaponCategory: "simple", damage: "1d6", damageType: "piercing", properties: ["thrown (range 30/120)"] },
  item_javelin_5: { id: "item_javelin_5", name: "Javelin (5)", type: "weapon", weight: 10, qty: 5, actionCost: "action", weaponCategory: "simple", damage: "1d6", damageType: "piercing", properties: ["thrown (range 30/120)"] },
  item_dart_10: { id: "item_dart_10", name: "Dart (10)", type: "weapon", weight: 2.5, qty: 10, actionCost: "action", weaponCategory: "simple", damage: "1d4", damageType: "piercing", properties: ["finesse", "thrown (range 20/60)"] },

  // --- PACKS ---
  item_explorers_pack: { id: "item_explorers_pack", name: "Explorer's Pack", type: "gear", weight: 59 },
  item_diplomats_pack: { id: "item_diplomats_pack", name: "Diplomat's Pack", type: "gear", weight: 36 },
  item_entertainers_pack: { id: "item_entertainers_pack", name: "Entertainer's Pack", type: "gear", weight: 38 },
  item_priests_pack: { id: "item_priests_pack", name: "Priest's Pack", type: "gear", weight: 25 },
  item_dungeoneers_pack: { id: "item_dungeoneers_pack", name: "Dungeoneer's Pack", type: "gear", weight: 61.5 },
  item_scholars_pack: { id: "item_scholars_pack", name: "Scholar's Pack", type: "gear", weight: 10 },
  item_burglars_pack: { id: "item_burglars_pack", name: "Burglar's Pack", type: "gear", weight: 46 },

  // --- TOOLS, FOCUSES & OTHER GEAR ---
  item_lute: { id: "item_lute", name: "Lute", type: "gear", weight: 2 },
  item_flute: { id: "item_flute", name: "Flute", type: "gear", weight: 1 },
  item_thieves_tools: { id: "item_thieves_tools", name: "Thieves' Tools", type: "gear", weight: 1 },
  item_holy_symbol: { id: "item_holy_symbol", name: "Holy Symbol", type: "gear", weight: 1 },
  item_druidic_focus: { id: "item_druidic_focus", name: "Druidic Focus (Yew Wand)", type: "gear", weight: 1 },
  item_component_pouch: { id: "item_component_pouch", name: "Component Pouch", type: "gear", weight: 2 },
  item_arcane_focus: { id: "item_arcane_focus", name: "Arcane Focus (Crystal)", type: "gear", weight: 1 },
  item_spellbook: { id: "item_spellbook", name: "Spellbook", type: "gear", weight: 3 },
};
