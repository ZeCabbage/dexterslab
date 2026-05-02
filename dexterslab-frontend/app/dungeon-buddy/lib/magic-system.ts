import { LiveCharacter, SpellData } from './types';
import { THIRD_CASTER_CANTRIPS, THIRD_CASTER_SPELLS_KNOWN } from '../data/resource-scaling';

// ── Prep Caster Detection ──
// These classes prepare spells daily from their full class list.
// Limit = class level + spellcasting ability modifier (min 1).
const PREP_CASTER_IDS = ['cleric', 'druid', 'paladin', 'wizard'];

export function isPrepCaster(className: string): boolean {
  return PREP_CASTER_IDS.includes(className.toLowerCase());
}

// ── Third-Caster Subclass Detection ──
// These subclasses grant spellcasting to otherwise non-caster classes at level 3.
const THIRD_CASTER_SUBCLASSES: Record<string, string[]> = {
  'fighter': ['eldritch knight'],
  'rogue': ['arcane trickster'],
};

export function isThirdCaster(className: string, subclass?: string | null): boolean {
  if (!subclass) return false;
  const valid = THIRD_CASTER_SUBCLASSES[className.toLowerCase()];
  return !!valid && valid.includes(subclass.toLowerCase());
}

// ── Spell Progression Calculator ──
// Returns cantrip/spell caps and max spell level for a class at a given level.
// abilityMod: the spellcasting ability modifier (INT for Wizard, WIS for Cleric/Druid, CHA for Paladin/Bard/etc.)
//   — used by prep casters to compute prepared limit = level + abilityMod (min 1)
//   — ignored for "spells known" casters (Bard, Sorcerer, Warlock, Ranger)
// subclass: optional subclass name — enables third-caster progression for Fighter/Rogue
export function getSpellProgression(className: string, level: number, abilityMod: number = 0, subclass?: string | null) {
  const normClass = className.toLowerCase();
  
  let cantripsKnown = 0;
  let spellsKnown = 0;
  let maxSpellLevel = 0;
  const isPrep = isPrepCaster(normClass);

  if (['wizard', 'cleric', 'druid'].includes(normClass)) {
    // Full-caster prep casters: limit = level + ability mod (min 1)
    cantripsKnown = level < 4 ? 3 : level < 10 ? 4 : 5;
    spellsKnown = Math.max(1, level + abilityMod);
    maxSpellLevel = Math.ceil(level / 2);
  } else if (['bard', 'sorcerer', 'warlock'].includes(normClass)) {
    // Spells-known casters (fixed progression)
    cantripsKnown = level < 4 ? 2 : level < 10 ? 3 : 4;
    spellsKnown = level < 11 ? level + 1 : 15;
    maxSpellLevel = Math.ceil(level / 2);
  } else if (['paladin'].includes(normClass)) {
    // Half-caster prep caster: limit = floor(level/2) + ability mod (min 1)
    cantripsKnown = 0;
    spellsKnown = level < 2 ? 0 : Math.max(1, Math.floor(level / 2) + abilityMod);
    maxSpellLevel = Math.max(1, Math.ceil(level / 4));
  } else if (['ranger'].includes(normClass)) {
    // Half-caster spells-known
    cantripsKnown = 0;
    spellsKnown = level < 2 ? 0 : Math.floor(level / 2) + 2;
    maxSpellLevel = Math.max(1, Math.ceil(level / 4));
  } else if (isThirdCaster(normClass, subclass)) {
    // Third-caster subclasses (Eldritch Knight, Arcane Trickster)
    // Spellcasting starts at level 3
    cantripsKnown = THIRD_CASTER_CANTRIPS[level] || 0;
    spellsKnown = THIRD_CASTER_SPELLS_KNOWN[level] || 0;
    maxSpellLevel = level < 3 ? 0 : level < 7 ? 1 : level < 13 ? 2 : level < 19 ? 3 : 4;
  } else {
    // Non-casters (Fighter, Rogue, Barbarian, Monk without casting subclass)
    cantripsKnown = 0;
    spellsKnown = 0;
    maxSpellLevel = 0;
  }

  return { cantripsKnown, spellsKnown, maxSpellLevel, isPrepCaster: isPrep };
}

// ----------------------------------------------------
// BG3-Style Spell Evaluator
// ----------------------------------------------------
export function evaluateSpellLock(char: LiveCharacter | null, spell: SpellData, currentKnownSpells: SpellData[]): { locked: boolean, reason?: string } {
  if (!char) return { locked: true, reason: 'No active character' };

  // 1. Is the character even a spellcaster? (base class OR third-caster subclass)
  const charSubclass = char.subclasses?.[char.class] || char.subclass || null;
  const thirdCaster = isThirdCaster(char.class, charSubclass);
  if (!char.spellcaster && !thirdCaster) {
    return { locked: true, reason: `Requires Spellcasting Class` };
  }

  // Subclass expanded spell definitions
  const SUBCLASS_EXPANDED_SPELLS: Record<string, string[]> = {
    'The Fiend': ['command', 'burning hands', 'blindness/deafness', 'scorching ray', 'fireball', 'stinking cloud', 'fire shield', 'wall of fire', 'flame strike', 'hallow'],
    'The Archfey': ['faerie fire', 'sleep', 'calm emotions', 'phantasmal force', 'blink', 'plant growth', 'dominate beast', 'greater invisibility', 'dominate person', 'seeming'],
    'The Great Old One': ['dissonant whispers', "tasha's hideous laughter", 'detect thoughts', 'phantasmal force', 'clairvoyance', 'sending', 'dominate beast', "evard's black tentacles", 'dominate person', 'telekinesis'],
    'Divine Soul': ['cure wounds', 'healing word', 'bless', 'bane', 'guiding bolt', 'inflict wounds', 'sanctuary', 'shield of faith']
    // Expand as needed for Clerics, Paladins, etc.
  };

  // 2. Does this spell belong to the character's class?
  let isClassMatch = spell.classes.some(c => c.toLowerCase() === char.class.toLowerCase());
  
  // Check if subclass formally grants it
  if (!isClassMatch && char.subclass) {
     const expandedSpells = SUBCLASS_EXPANDED_SPELLS[char.subclass];
     if (expandedSpells && expandedSpells.includes(spell.name.toLowerCase())) {
        isClassMatch = true;
     }
  }
  
  // Divine Soul explicit exception (can pick from Cleric list)
  if (!isClassMatch && char.subclass === 'Divine Soul' && spell.classes.map(c=>c.toLowerCase()).includes('cleric')) {
     isClassMatch = true;
  }

  // For third-casters (EK uses Wizard list, AT uses Wizard list), allow Wizard spells
  if (!isClassMatch && thirdCaster && spell.classes.map((c: string) => c.toLowerCase()).includes('wizard')) {
    isClassMatch = true;
  }

  if (!isClassMatch && spell.classes.length > 0) { // If classes is empty, assume homebrew universal
    return { locked: true, reason: `Requires ${spell.classes.join(' or ')}` };
  }

  // 3. Are they a high enough level to cast this?
  const prog = getSpellProgression(char.class, char.level, 0, charSubclass);
  if (spell.level > prog.maxSpellLevel) {
    return { locked: true, reason: `Requires Level ${spell.level * 2 - 1} ${char.class}` }; // Rough max level inversion
  }

  // 4. Strict Quantity Constraints (Count cantrips vs levelled spells)
  const isCantrip = spell.level === 0;
  
  // Count how many of this type they already know
  const knownOfThisType = currentKnownSpells.filter(s => (s.level === 0) === isCantrip).length;
  
  if (isCantrip && knownOfThisType >= prog.cantripsKnown) {
    return { locked: true, reason: `Max Cantrips Known (${prog.cantripsKnown})` };
  } else if (!isCantrip && knownOfThisType >= prog.spellsKnown) {
    return { locked: true, reason: `Max Spells Known (${prog.spellsKnown})` };
  }

  return { locked: false };
}

// ═══════════════════════════════════════════════════════════════
//  RESOURCE CROSS-TALK — Phase 3: Overlapping Resource Pools
//
//  When a character has multiple valid ways to pay a cost
//  (e.g., standard spell slots AND Warlock Pact Magic),
//  the engine cannot auto-decide which pool to drain.
//
//  getValidResourcePools() returns ALL valid pool IDs so the
//  UI can prompt the user to choose.
// ═══════════════════════════════════════════════════════════════

export interface ResourcePoolOption {
  id: string;           // The resource key (e.g., "spell_slot_2", "pact_magic")
  name: string;         // Human-readable label
  remaining: number;    // Available charges
  slotLevel?: number;   // For spell-based pools, the effective level
}

/**
 * Get all valid resource pools that can pay a given cost.
 *
 * @param char         — The live character
 * @param baseCostId   — The preferred resource ID (e.g., "spell_slot_2", "ki_points")
 * @param minLevel     — For spell slots, the minimum slot level required
 * @returns Array of valid pools. Length > 1 means UI must prompt.
 */
export function getValidResourcePools(
  char: LiveCharacter,
  baseCostId: string,
  minLevel?: number
): ResourcePoolOption[] {
  const pools: ResourcePoolOption[] = [];
  const resources = char.resources || {};

  // ── Case 1: Standard (non-spell-slot) resource ──
  // For simple resources like ki_points, sorcery_points, etc.,
  // there's typically only one pool.
  if (!baseCostId.startsWith('spell_slot_')) {
    const res = resources[baseCostId];
    if (res && res.used < res.max) {
      pools.push({
        id: baseCostId,
        name: res.name,
        remaining: res.max - res.used,
      });
    }
    return pools;
  }

  // ── Case 2: Spell slot resource ──
  // The requested slot (e.g., spell_slot_2) may have alternatives:
  //   a) The exact requested slot level
  //   b) Pact Magic (if its level >= minLevel)
  //   c) Higher-level standard slots (upcasting)

  const requestedLevel = parseInt(baseCostId.split('_').pop() || '0');
  const requiredLevel = minLevel || requestedLevel;

  // 2a. Exact match: the requested slot level
  const exactSlot = resources[baseCostId];
  if (exactSlot && exactSlot.used < exactSlot.max) {
    pools.push({
      id: baseCostId,
      name: `Level ${requestedLevel} Slot`,
      remaining: exactSlot.max - exactSlot.used,
      slotLevel: requestedLevel,
    });
  }

  // 2b. Pact Magic (Warlock short-rest slots)
  // Pact slots are stored as a single resource "pact_magic" with
  // a level encoded in the name (e.g., "Pact Slots (Lv.3)").
  // They can be used for any spell of their level or lower.
  const pactMagic = resources['pact_magic'];
  if (pactMagic && pactMagic.used < pactMagic.max) {
    // Extract pact slot level from name: "Pact Slots (Lv.3)" → 3
    const pactLevelMatch = pactMagic.name.match(/Lv\.(\d+)/);
    const pactLevel = pactLevelMatch ? parseInt(pactLevelMatch[1]) : 1;

    if (pactLevel >= requiredLevel) {
      pools.push({
        id: 'pact_magic',
        name: `Pact Slot (Lv.${pactLevel})`,
        remaining: pactMagic.max - pactMagic.used,
        slotLevel: pactLevel,
      });
    }
  }

  // 2c. Higher-level standard slots (upcasting)
  // Only include if there's no exact match available, or for completeness
  for (let lvl = requestedLevel + 1; lvl <= 9; lvl++) {
    const slotId = `spell_slot_${lvl}`;
    const slot = resources[slotId];
    if (slot && slot.used < slot.max) {
      pools.push({
        id: slotId,
        name: `Level ${lvl} Slot (upcast)`,
        remaining: slot.max - slot.used,
        slotLevel: lvl,
      });
    }
  }

  return pools;
}

// ═══════════════════════════════════════════════════════════════
//  SORCERY POINT CONVERSION — Font of Magic (PHB p.101)
//
//  Sorcerers can:
//    1. Burn a spell slot → gain Sorcery Points (slot level = points)
//    2. Burn Sorcery Points → create a spell slot (costs vary by level)
//
//  5e Conversion Table:
//    Slot Level | SP Cost to Create | SP Gained from Burning
//    1st        | 2 SP              | 1 SP
//    2nd        | 3 SP              | 2 SP
//    3rd        | 5 SP              | 3 SP
//    4th        | 6 SP              | 4 SP
//    5th        | 7 SP              | 5 SP
//
//  RAW: Cannot create slots above 5th level via Font of Magic.
//  Created slots vanish on long rest.
// ═══════════════════════════════════════════════════════════════

/** SP cost to CREATE a spell slot of this level */
export const SORCERY_POINT_SLOT_COST: Record<number, number> = {
  1: 2,
  2: 3,
  3: 5,
  4: 6,
  5: 7,
};

/** SP gained from BURNING a spell slot of this level */
export const SORCERY_POINT_FROM_SLOT: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6, // RAW doesn't specify above 5, but level = points is standard
  7: 7,
  8: 8,
  9: 9,
};

/** Maximum slot level that can be created via Font of Magic */
export const MAX_FONT_OF_MAGIC_LEVEL = 5;
