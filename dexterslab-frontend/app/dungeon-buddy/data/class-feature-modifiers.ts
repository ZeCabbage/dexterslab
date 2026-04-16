// ═══════════════════════════════════════════════════════════════
//  CLASS FEATURE MODIFIERS — Mechanical Retrofit for Core Classes
//
//  The SRD's ClassData.features[] only carries { level, name, description }.
//  Subclass features have full modifier support via FeatureData[], but
//  core class features (Martial Arts, Unarmored Defense, Ki, etc.) do not.
//
//  This lookup table retrofits mechanical modifiers onto core class
//  features so the combat engine can process them automatically.
//
//  These modifiers are injected into char.features[] during:
//    1. Character creation (for level-1 features)
//    2. Level-up (when a feature's level matches the new level)
//
//  Usage in the leveling pipeline:
//    import { CLASS_FEATURE_MODIFIERS } from './class-feature-modifiers';
//    const key = `${classId}::${featureName}::${level}`;
//    const modifiers = CLASS_FEATURE_MODIFIERS[key] || [];
// ═══════════════════════════════════════════════════════════════

import { ModifierEffect } from '../lib/types';

/**
 * Lookup key format: "classId::featureName::level"
 *
 * For features that scale (like Martial Arts), we register
 * each level breakpoint separately. The leveling system replaces
 * the previous version's modifier when a new breakpoint is hit.
 */
export const CLASS_FEATURE_MODIFIERS: Record<string, ModifierEffect[]> = {

  // ═════════════════════════════════════════
  //  MONK — Martial Arts + Unarmored Defense
  // ═════════════════════════════════════════

  // Martial Arts: "You can use Dexterity instead of Strength for the
  // attack and damage rolls of your unarmed strikes and monk weapons."
  // PHB p.78: Damage die scales with monk level.
  //
  // Level  1-4:  1d4
  // Level  5-10: 1d6
  // Level 11-16: 1d8
  // Level 17-20: 1d10

  'monk::Martial Arts::1': [
    { type: 'modify_unarmed_strike', damageDie: '1d4', useDexterity: true },
  ],
  'monk::Martial Arts::5': [
    { type: 'modify_unarmed_strike', damageDie: '1d6', useDexterity: true },
  ],
  'monk::Martial Arts::11': [
    { type: 'modify_unarmed_strike', damageDie: '1d8', useDexterity: true },
  ],
  'monk::Martial Arts::17': [
    { type: 'modify_unarmed_strike', damageDie: '1d10', useDexterity: true },
  ],

  // Unarmored Defense (Monk): AC = 10 + DEX mod + WIS mod
  'monk::Unarmored Defense::1': [
    { type: 'set_ac_formula', formula: '10+dex+wis' },
  ],

  // Unarmored Movement: +10 ft speed at level 2, scaling at later levels.
  'monk::Unarmored Movement::2': [
    { type: 'grant_speed', value: 10 },
  ],


  // ═════════════════════════════════════════
  //  BARBARIAN — Unarmored Defense
  // ═════════════════════════════════════════

  // Unarmored Defense (Barbarian): AC = 10 + DEX mod + CON mod
  'barbarian::Unarmored Defense::1': [
    { type: 'set_ac_formula', formula: '10+dex+con' },
  ],
};

/**
 * Get the Martial Arts damage die for a Monk at a given level.
 * Used by the combat tab to display the correct unarmed strike die.
 *
 * Returns the highest applicable die for the given level.
 */
export function getMonkMartialArtsDie(level: number): string {
  if (level >= 17) return '1d10';
  if (level >= 11) return '1d8';
  if (level >= 5) return '1d6';
  return '1d4';
}

/**
 * Get all modifier breakpoints for a class feature up to a given level.
 * This resolves the "which die do I use at level 7?" question by
 * finding the highest applicable breakpoint.
 *
 * @param classId - e.g., "monk"
 * @param featureName - e.g., "Martial Arts"
 * @param currentLevel - The character's current level
 * @returns The modifiers from the highest applicable breakpoint, or []
 */
export function getClassFeatureModifiers(
  classId: string,
  featureName: string,
  currentLevel: number
): ModifierEffect[] {
  // Find all breakpoints for this feature
  const breakpoints: number[] = [];
  for (const key of Object.keys(CLASS_FEATURE_MODIFIERS)) {
    const [cls, name, lvl] = key.split('::');
    if (cls === classId && name === featureName) {
      breakpoints.push(parseInt(lvl));
    }
  }

  if (breakpoints.length === 0) return [];

  // Find the highest breakpoint <= currentLevel
  breakpoints.sort((a, b) => b - a);
  const applicableLevel = breakpoints.find(bp => bp <= currentLevel);
  if (!applicableLevel) return [];

  const key = `${classId}::${featureName}::${applicableLevel}`;
  return CLASS_FEATURE_MODIFIERS[key] || [];
}
