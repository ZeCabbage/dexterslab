// ═══════════════════════════════════════════════════════════════
//  COMPUTE STATS — Combat Math Pipeline (Phase 1 Refactor)
//
//  Contains:
//    1. Legacy spell damage/range helpers (pre-Interceptor)
//    2. NEW: calculateIncomingDamage() — the strict 5e Damage
//       Order of Operations pipeline
//
//  The damage pipeline enforces the exact 5e rules:
//    Step 1: Vulnerability  (×2)
//    Step 2: Flat Reduction  (subtract fixed amount)
//    Step 3: Resistance      (÷2, round down)
//    Step 4: Immunity        (→ 0)
//
//  Reference: PHB p.197, "Damage Resistance and Vulnerability"
//  and Sage Advice Compendium (2020), "Order of Operations"
// ═══════════════════════════════════════════════════════════════

import { LiveCharacter, SpellData } from './types';
import { ResolvedModifiers } from './resolve-modifiers';

// ═══════════════════════════════════════════════════════════════
//  UTILITY HELPERS
// ═══════════════════════════════════════════════════════════════

/** Calculate raw stat modifier (e.g., 20 → +5) */
export const calcMod = (score: number) => {
  if (typeof score !== 'number' || isNaN(score)) return 0;
  return Math.floor((score - 10) / 2);
};

// ═══════════════════════════════════════════════════════════════
//  LEGACY SPELL HELPERS (Pre-Interceptor — kept for backward compat)
// ═══════════════════════════════════════════════════════════════

export function getSpellDamage(char: LiveCharacter | null, spell: SpellData): string {
  if (!spell.damage || !char) return spell.damage || '';

  let baseDmg = spell.damage; // e.g. "1d10"
  let flatBonus = 0;

  // Process global features
  char.features.forEach(feature => {
     feature.modifiers?.forEach(mod => {
        if (mod.type === 'add_damage_ability' && mod.target === spell.name.toLowerCase()) {
           const bonus = calcMod(char.stats[mod.ability as keyof typeof char.stats] || 10);
           flatBonus += bonus;
        }
     });
  });

  if (flatBonus > 0) {
      baseDmg += ` + ${flatBonus}`;
  } else if (flatBonus < 0) {
      baseDmg += ` - ${Math.abs(flatBonus)}`;
  }

  return baseDmg;
}

export function getSpellRange(char: LiveCharacter | null, spell: SpellData): string {
  if (!char) return spell.range;

  let finalRange = spell.range;

  char.features.forEach(feature => {
     feature.modifiers?.forEach(mod => {
        if (mod.type === 'add_range' && mod.target === spell.name.toLowerCase()) {
           finalRange = `${mod.value} feet`;
        }
     });
  });

  return finalRange;
}

// ═══════════════════════════════════════════════════════════════
//  DAMAGE ORDER OF OPERATIONS — 5e RAW Pipeline
//
//  This function computes the ACTUAL damage a character receives
//  after all defensive modifiers are applied, in the exact order
//  specified by the 5e rules.
//
//  The order is NOT arbitrary — the rules specify:
//    1. Vulnerability doubles BEFORE resistance halves
//    2. Flat reductions apply between vulnerability and resistance
//    3. Immunity overrides everything at the end
//
//  This means a character with both vulnerability AND resistance
//  to the same damage type takes normal damage (×2 then ÷2 = ×1),
//  and flat reductions can still reduce below that.
//
//  Reference:
//    PHB p.197: "Resistance and then vulnerability are applied
//    after all other modifiers to damage."
//    Sage Advice: Flat reductions (like Heavy Armor Master) are
//    "other modifiers" and apply before resistance.
// ═══════════════════════════════════════════════════════════════

/** Detailed breakdown of the damage pipeline for UI display */
export interface DamageBreakdown {
  /** Original damage before any modifications */
  baseDamage: number;
  /** Damage type (e.g., "fire", "slashing") */
  damageType: string;
  /** Whether the incoming damage is from a magical source */
  isMagical: boolean;

  // Pipeline steps (in order)
  /** Step 1: Was vulnerability applied? (×2) */
  vulnerabilityApplied: boolean;
  /** Damage after vulnerability */
  afterVulnerability: number;

  /** Step 2: Flat reductions applied (source → amount) */
  flatReductions: { source: string; amount: number }[];
  /** Damage after flat reductions */
  afterFlatReductions: number;

  /** Step 3: Was resistance applied? (÷2) */
  resistanceApplied: boolean;
  /** Damage after resistance */
  afterResistance: number;

  /** Step 4: Was immunity applied? (→ 0) */
  immunityApplied: boolean;

  /** Final computed damage */
  finalDamage: number;
}

/**
 * Calculate the actual incoming damage after the full 5e
 * Damage Order of Operations pipeline.
 *
 * @param baseDamage  — Raw damage number (after dice rolls, before defenses)
 * @param damageType  — The damage type (e.g., "fire", "slashing", "necrotic")
 * @param resolved    — ResolvedModifiers containing resistances, immunities,
 *                      and flat damage reductions
 * @param isMagical   — Whether the damage source is magical (affects Heavy
 *                      Armor Master's "non-magical B/P/S only" restriction)
 * @returns The final damage number after all pipeline steps
 */
export function calculateIncomingDamage(
  baseDamage: number,
  damageType: string,
  resolved: ResolvedModifiers,
  isMagical: boolean = false
): number {
  const breakdown = calculateIncomingDamageDetailed(baseDamage, damageType, resolved, isMagical);
  return breakdown.finalDamage;
}

/**
 * Full detailed damage pipeline — returns the complete breakdown
 * for UI display (combat log, damage hover tooltips, etc.)
 */
export function calculateIncomingDamageDetailed(
  baseDamage: number,
  damageType: string,
  resolved: ResolvedModifiers,
  isMagical: boolean = false
): DamageBreakdown {
  const normalizedType = damageType.toLowerCase().trim();

  const breakdown: DamageBreakdown = {
    baseDamage,
    damageType: normalizedType,
    isMagical,
    vulnerabilityApplied: false,
    afterVulnerability: baseDamage,
    flatReductions: [],
    afterFlatReductions: baseDamage,
    resistanceApplied: false,
    afterResistance: baseDamage,
    immunityApplied: false,
    finalDamage: baseDamage,
  };

  let damage = baseDamage;

  // ─────────────────────────────────────────────────
  //  STEP 1: VULNERABILITY (×2)
  //
  //  PHB p.197: "If a creature or an object has vulnerability
  //  to a damage type, damage of that type is doubled against it."
  //
  //  Note: We check grantedResistances for "vulnerable_<type>"
  //  entries. This is a convention — vulnerability is tracked
  //  as a separate list. For now we check both patterns:
  //    - "vulnerable_fire" in grantedResistances
  //    - "fire" in a future grantedVulnerabilities array
  // ─────────────────────────────────────────────────
  const hasVulnerability = resolved.grantedResistances.some(
    r => r.toLowerCase() === `vulnerable_${normalizedType}`
  );

  if (hasVulnerability) {
    damage = damage * 2;
    breakdown.vulnerabilityApplied = true;
  }
  breakdown.afterVulnerability = damage;

  // ─────────────────────────────────────────────────
  //  STEP 2: FLAT REDUCTIONS
  //
  //  e.g., Heavy Armor Master (PHB p.167):
  //  "While wearing heavy armor, B/P/S damage you take from
  //  nonmagical attacks is reduced by 3."
  //
  //  Flat reductions apply AFTER vulnerability but BEFORE
  //  resistance. This is the Sage Advice ruling (2020).
  //  Minimum damage after flat reductions is 0 (can't go negative).
  // ─────────────────────────────────────────────────
  for (const reduction of resolved.flatDamageReductions) {
    // Check if this reduction applies to our damage type
    const typesMatch = !reduction.damageTypes ||
      reduction.damageTypes.length === 0 ||
      reduction.damageTypes.some(t => t.toLowerCase() === normalizedType);

    // Check the non-magical restriction
    const magicalRestrictionPasses = !reduction.nonMagicalOnly || !isMagical;

    if (typesMatch && magicalRestrictionPasses) {
      const actualReduction = Math.min(reduction.value, damage); // Can't reduce below 0
      damage -= actualReduction;
      breakdown.flatReductions.push({
        source: reduction.source,
        amount: actualReduction,
      });
    }
  }

  // Enforce minimum 0 (in case of multiple reductions)
  damage = Math.max(0, damage);
  breakdown.afterFlatReductions = damage;

  // ─────────────────────────────────────────────────
  //  STEP 3: RESISTANCE (÷2, round down)
  //
  //  PHB p.197: "If a creature or an object has resistance to
  //  a damage type, damage of that type is halved against it."
  //
  //  Multiple sources of resistance do NOT stack — you either
  //  have it or you don't. Round DOWN per RAW.
  // ─────────────────────────────────────────────────
  const hasResistance = resolved.grantedResistances.some(
    r => r.toLowerCase() === normalizedType
  );

  if (hasResistance) {
    damage = Math.floor(damage / 2);
    breakdown.resistanceApplied = true;
  }
  breakdown.afterResistance = damage;

  // ─────────────────────────────────────────────────
  //  STEP 4: IMMUNITY (→ 0)
  //
  //  PHB p.197: "If a creature or an object has immunity to a
  //  damage type, damage of that type is reduced to 0."
  //
  //  Immunity is checked last because it overrides everything.
  //  Even if vulnerable + resistant + flat reduced, immunity = 0.
  //
  //  Note: grantedImmunities uses condition strings like
  //  "fire" (damage type immunity) or "charmed (while raging)"
  //  (condition immunity). We match the normalized damage type.
  // ─────────────────────────────────────────────────
  const hasImmunity = resolved.grantedImmunities.some(
    imm => imm.toLowerCase() === normalizedType
  );

  if (hasImmunity) {
    damage = 0;
    breakdown.immunityApplied = true;
  }

  breakdown.finalDamage = damage;
  return breakdown;
}
