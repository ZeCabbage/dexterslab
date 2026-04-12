// ═══════════════════════════════════════════════════════════════
//  UNIFIED AC COMPUTATION — Integrated with Derived State
//
//  Directive 2: AC now reads from ResolvedModifiers to
//  incorporate subclass formulas (Draconic Resilience, Unarmored
//  Defense) and bonus AC from magic items / features.
//
//  Priority order:
//    1. Standard armor + DEX + shield (baseline)
//    2. resolved.acFormula (if unarmored AND yields higher)
//    3. + resolved.bonusAC (always stacks)
// ═══════════════════════════════════════════════════════════════

import { LiveCharacter } from './types';
import { ResolvedModifiers } from './resolve-modifiers';

function calcMod(score: number): number {
  if (typeof score !== 'number' || isNaN(score)) return 0;
  return Math.floor((score - 10) / 2);
}

/**
 * Calculate final AC from equipped armor, shield, subclass formulas, and modifier bonuses.
 *
 * @param char — The live character state (reads equipped.chest, equipped.offHand, stats)
 * @param resolved — Optional ResolvedModifiers for subclass AC formulas and bonus AC.
 *                   If omitted, only standard armor/DEX computation is used.
 */
export function calculateAC(char: LiveCharacter, resolved?: ResolvedModifiers | null): number {
  if (!char) return 10;

  const dexScore = char.stats?.dex || 10;
  const dexMod = calcMod(dexScore);

  const chest = char.equipped?.chest;
  const offHand = char.equipped?.offHand;

  // ── Standard Armor Calculation ──
  let standardAC = 10;
  let dexBonus = dexMod;
  let isWearingArmor = false;

  if (chest && chest.type === 'armor') {
    isWearingArmor = true;
    const armorClass = chest.armorClass || 11;
    
    if (chest.armorCategory === 'light') {
      standardAC = armorClass;
      dexBonus = dexMod; // Full DEX
    } else if (chest.armorCategory === 'medium') {
      standardAC = armorClass;
      dexBonus = Math.min(2, dexMod); // Capped at +2
    } else if (chest.armorCategory === 'heavy') {
      standardAC = armorClass;
      dexBonus = 0; // No DEX bonus
    }
  }

  let armorAC = standardAC + dexBonus;

  // Add shield bonus (stacks with everything)
  let shieldBonus = 0;
  if (offHand && offHand.armorCategory === 'shield') {
    shieldBonus = offHand.armorClass || 2;
  }

  // ── Subclass Formula AC (Unarmored Defense, Draconic Resilience, etc.) ──
  // Only applies when NOT wearing armor. If wearing armor, standard calc wins
  // unless the formula explicitly stacks (currently none do in 5e).
  let formulaAC = 0;
  if (resolved?.acFormula && !isWearingArmor) {
    // Parse formula like "13+dex" or "10+dex+con" or "10+dex+wis"
    const parts = resolved.acFormula.split('+').map(p => p.trim());
    let base = parseInt(parts[0]) || 10;
    let formulaMods = 0;

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      // Try to resolve as ability modifier
      const abilityScore = char.stats?.[part as keyof typeof char.stats];
      if (typeof abilityScore === 'number') {
        formulaMods += calcMod(abilityScore);
      } else {
        // Try as raw number
        const num = parseInt(part);
        if (!isNaN(num)) formulaMods += num;
      }
    }

    formulaAC = base + formulaMods;
  }

  // ── Choose the best base AC ──
  // Use whichever is higher: standard armor or subclass formula
  let finalAC = Math.max(armorAC, formulaAC);

  // Shield stacks on top of whichever base won
  finalAC += shieldBonus;

  // ── Add bonus AC from resolved modifiers ──
  // This covers magic items (Ring of Protection), spells (Shield of Faith),
  // and any other modifier that grants flat bonus AC.
  if (resolved) {
    finalAC += resolved.bonusAC;
  }

  return finalAC;
}
