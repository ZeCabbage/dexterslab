// ═══════════════════════════════════════════════════════════════
//  BOUNDED ACCURACY — AC Priority Engine (Phase 1 Refactor)
//
//  5e Rule: A character can benefit from only ONE base AC formula
//  at any time, but flat bonuses ALWAYS stack on top.
//
//  The engine:
//    1. Collects ALL possible base AC formulas (armor, class, race)
//    2. Evaluates each to a numeric value
//    3. Picks the strictly HIGHEST one
//    4. Adds flat bonuses (shield, Ring of Protection, etc.)
//
//  Base AC Formulas (only one applies):
//    - Standard Armor: armorClass + dexBonus (from equipped chest)
//    - Unarmored Defense (Monk):     10 + DEX + WIS
//    - Unarmored Defense (Barbarian): 10 + DEX + CON
//    - Draconic Resilience:           13 + DEX  (no armor)
//    - Natural Armor (Tortle):        17 flat
//    - Natural Armor (Lizardfolk):    13 + DEX
//    - Base Unarmored:                10 + DEX  (always available)
//
//  Flat Bonuses (always stack):
//    - Shield (+2, or equipped offhand)
//    - resolved.bonusAC (Ring of Protection, Shield of Faith, etc.)
// ═══════════════════════════════════════════════════════════════

import { LiveCharacter } from './types';
import { ResolvedModifiers } from './resolve-modifiers';

// ── Ability Modifier Helper ──
function calcMod(score: number): number {
  if (typeof score !== 'number' || isNaN(score)) return 0;
  return Math.floor((score - 10) / 2);
}

// ── Formula Candidate: a named AC source with its computed value ──
export interface ACCandidate {
  name: string;       // Human-readable source label
  formula: string;    // The raw formula string (e.g., "10+dex+wis")
  value: number;      // The resolved numeric value
  isArmor: boolean;   // True if this candidate comes from worn armor
}

/**
 * Parse an AC formula string (e.g., "13+dex", "10+dex+wis") and
 * resolve it to a numeric value using the character's stats.
 */
function evaluateFormula(formula: string, char: LiveCharacter): number {
  const parts = formula.split('+').map(p => p.trim());
  let total = 0;

  for (const part of parts) {
    // Try as a stat name first (dex, con, wis, etc.)
    const abilityScore = char.stats?.[part as keyof typeof char.stats];
    if (typeof abilityScore === 'number') {
      total += calcMod(abilityScore);
      continue;
    }

    // Try as a raw number
    const num = parseInt(part);
    if (!isNaN(num)) {
      total += num;
      continue;
    }

    // Unknown token — skip gracefully
  }

  return total;
}

/**
 * Compute the final AC using the Bounded Accuracy priority engine.
 *
 * Step 1: Enumerate ALL base AC candidates
 * Step 2: Pick the highest single candidate
 * Step 3: Add flat bonuses (shield + modifiers)
 *
 * @param char    — The live character state
 * @param resolved — ResolvedModifiers for AC formulas & bonus AC
 * @returns The final computed AC number
 */
export function calculateAC(char: LiveCharacter, resolved?: ResolvedModifiers | null): number {
  if (!char) return 10;

  const dexMod = calcMod(char.stats?.dex || 10);

  // ═══════════════════════════════════════════════════════
  //  STEP 1: Collect ALL base AC candidates
  // ═══════════════════════════════════════════════════════

  const candidates: ACCandidate[] = [];

  // ── Candidate: Base Unarmored (always available) ──
  // PHB p.14: "Without armor or a shield, your character's AC
  // equals 10 + his or her Dexterity modifier."
  candidates.push({
    name: 'Base Unarmored',
    formula: '10+dex',
    value: 10 + dexMod,
    isArmor: false,
  });

  // ── Candidate: Standard Armor (from equipped chest piece) ──
  const chest = char.equipped?.chest;
  if (chest && chest.type === 'armor') {
    const armorClass = chest.armorClass || 11;
    let armorDexBonus = dexMod;

    if (chest.armorCategory === 'medium') {
      // PHB p.144: Medium armor caps DEX bonus at +2
      armorDexBonus = Math.min(2, dexMod);
    } else if (chest.armorCategory === 'heavy') {
      // PHB p.144: Heavy armor grants no DEX bonus
      armorDexBonus = 0;
    }
    // Light armor: full DEX bonus (no cap)

    candidates.push({
      name: `${chest.name || 'Armor'} (${chest.armorCategory})`,
      formula: `${armorClass}+${armorDexBonus}`,
      value: armorClass + armorDexBonus,
      isArmor: true,
    });
  }

  // ── Candidates: Subclass / Race AC formulas (from resolved modifiers) ──
  // These include Unarmored Defense (Monk/Barbarian), Draconic Resilience,
  // Natural Armor, and any homebrew AC formulas.
  //
  // 5e Rule: Class-based unarmored formulas (Monk, Barbarian, Draconic
  // Resilience) only apply when NOT wearing armor. The engine respects
  // this by tagging them as isArmor: false.
  if (resolved?.acFormulas && resolved.acFormulas.length > 0) {
    for (const formula of resolved.acFormulas) {
      const value = evaluateFormula(formula, char);
      candidates.push({
        name: `Formula (${formula})`,
        formula,
        value,
        isArmor: false,
      });
    }
  }
  // Legacy path: single acFormula (backward compat for pre-array data)
  else if (resolved?.acFormula) {
    const value = evaluateFormula(resolved.acFormula, char);
    candidates.push({
      name: `Formula (${resolved.acFormula})`,
      formula: resolved.acFormula,
      value,
      isArmor: false,
    });
  }

  // ═══════════════════════════════════════════════════════
  //  STEP 2: Pick the strictly highest base AC candidate
  //
  //  5e Rule: Only non-armor formulas can compete with each
  //  other AND with equipped armor. If wearing armor, the
  //  unarmored formulas still participate — the engine picks
  //  whichever is numerically highest. This matches Sage Advice:
  //  "You can benefit from only one base AC calculation at
  //  a time, and you always get to pick which one."
  // ═══════════════════════════════════════════════════════

  let bestCandidate = candidates[0]; // Base Unarmored is always present
  for (const candidate of candidates) {
    if (candidate.value > bestCandidate.value) {
      bestCandidate = candidate;
    }
  }

  let finalAC = bestCandidate.value;

  // ═══════════════════════════════════════════════════════
  //  STEP 3: Apply flat bonuses (always stack)
  // ═══════════════════════════════════════════════════════

  // ── Shield bonus ──
  // PHB p.144: A shield grants +2 AC. It stacks with
  // whichever base AC formula won above.
  const offHand = char.equipped?.offHand;
  if (offHand && offHand.armorCategory === 'shield') {
    finalAC += offHand.armorClass || 2;
  }

  // ── Resolved modifier bonuses ──
  // Ring of Protection, Shield of Faith, Shield spell,
  // Cloak of Protection, etc. These are accumulated by
  // the modifier resolver as resolved.bonusAC.
  if (resolved) {
    finalAC += resolved.bonusAC;
  }

  return finalAC;
}

/**
 * Debug helper: returns all AC candidates with their computed
 * values, showing exactly how the engine arrived at the final AC.
 * Useful for tooltip/breakdown display in the UI.
 */
export function getACBreakdown(char: LiveCharacter, resolved?: ResolvedModifiers | null): {
  candidates: ACCandidate[];
  winner: ACCandidate;
  shieldBonus: number;
  modifierBonus: number;
  finalAC: number;
} {
  if (!char) {
    const fallback: ACCandidate = { name: 'Base', formula: '10', value: 10, isArmor: false };
    return { candidates: [fallback], winner: fallback, shieldBonus: 0, modifierBonus: 0, finalAC: 10 };
  }

  const dexMod = calcMod(char.stats?.dex || 10);
  const candidates: ACCandidate[] = [];

  candidates.push({ name: 'Base Unarmored', formula: '10+dex', value: 10 + dexMod, isArmor: false });

  const chest = char.equipped?.chest;
  if (chest && chest.type === 'armor') {
    const armorClass = chest.armorClass || 11;
    let armorDexBonus = dexMod;
    if (chest.armorCategory === 'medium') armorDexBonus = Math.min(2, dexMod);
    else if (chest.armorCategory === 'heavy') armorDexBonus = 0;
    candidates.push({
      name: `${chest.name || 'Armor'} (${chest.armorCategory})`,
      formula: `${armorClass}+${armorDexBonus}`,
      value: armorClass + armorDexBonus,
      isArmor: true,
    });
  }

  if (resolved?.acFormulas && resolved.acFormulas.length > 0) {
    for (const formula of resolved.acFormulas) {
      candidates.push({ name: `Formula (${formula})`, formula, value: evaluateFormula(formula, char), isArmor: false });
    }
  } else if (resolved?.acFormula) {
    candidates.push({ name: `Formula (${resolved.acFormula})`, formula: resolved.acFormula, value: evaluateFormula(resolved.acFormula, char), isArmor: false });
  }

  let winner = candidates[0];
  for (const c of candidates) {
    if (c.value > winner.value) winner = c;
  }

  let shieldBonus = 0;
  const offHand = char.equipped?.offHand;
  if (offHand && offHand.armorCategory === 'shield') {
    shieldBonus = offHand.armorClass || 2;
  }

  const modifierBonus = resolved?.bonusAC || 0;
  const finalAC = winner.value + shieldBonus + modifierBonus;

  return { candidates, winner, shieldBonus, modifierBonus, finalAC };
}
