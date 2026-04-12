// ═══════════════════════════════════════════════════════════════
//  RESOLVE MODIFIERS ENGINE — Dungeon Buddy (v2: Interceptor Architecture)
//
//  Walks char.features[], char.feats[], and char.activeCombatToggles[]
//  to produce a computed overlay. The UI reads this overlay for
//  display, and the CombatTab Interceptor uses it for card mutation.
//
//  Key changes from v1:
//    - Feats are now walked alongside features (Rule 3)
//    - ActiveCombatToggles inject their modifiers when active
//    - grant_extra_hp removed from resolver (store-only, Amendment 5)
//    - ConditionalDamageEntry provides rich matching data for Interceptor
//    - Category-based matching helpers exported for CombatTab
//    - Ward HP tracked separately from bonus HP
// ═══════════════════════════════════════════════════════════════

import {
  LiveCharacter,
  ModifierEffect,
  TrackedResource,
  ActiveModifierState,
  TargetCondition,
  FeatData,
} from './types';

// ── Conditional Damage Entry: rich structure for the Interceptor ──
export interface ConditionalDamageEntry {
  source: string;           // Feature name that granted this (e.g. "Divine Fury", "Colossus Slayer")
  target: 'melee' | 'spell' | 'all';
  dice: string;             // e.g. "1d8"
  damageType: string;       // e.g. "radiant"
  condition: string;        // Human-readable trigger (e.g. "First hit each turn while raging")
  targetCondition?: TargetCondition;  // Structured matching for the Interceptor pipeline
}

// ── Ward HP Entry: separate damage absorption pool ──
export interface WardHPEntry {
  name: string;
  maxHP: number;
  regenFormula?: string;
  regenTrigger?: string;
}

// ── Post-Hit Modifier Entry: Divine Smite pattern ──
export interface PostHitModifierEntry {
  source: string;
  name: string;
  costType: 'spell_slot' | 'resource';
  costResourceId?: string;
  dicePerLevel: string;
  baseDice: string;
  maxDice?: string;
  damageType: string;
}

// ── Resolved Output ──

export interface ResolvedModifiers {
  // Damage modifiers: spellName/weaponName → bonus string (e.g. "+5", "+1d8 radiant")
  bonusDamage: Record<string, { flat: number; dice: string; damageType: string; condition: string; targetCondition?: TargetCondition }[]>;
  
  // NEW: Structured conditional damage entries for the Interceptor pipeline
  conditionalDamage: ConditionalDamageEntry[];

  // Defense
  bonusAC: number;
  acFormula: string | null;    // Override formula like "13+dex"
  bonusHP: number;             // From non-grant_extra_hp sources only (kept for future use)
  bonusSpeed: number;
  grantedResistances: string[];
  grantedImmunities: string[];
  darkvisionRange: number;

  // NEW: Ward HP pools (Arcane Ward, etc.)
  wardHP: WardHPEntry[];

  // NEW: Post-hit modifiers (Divine Smite pattern)
  postHitModifiers: PostHitModifierEntry[];

  // Proficiencies
  grantedArmorProficiencies: string[];
  grantedWeaponProficiencies: string[];
  grantedSkills: string[];
  grantedExpertise: string[];
  grantedSaveProficiencies: string[];
  grantedToolProficiencies: string[];

  // Spells
  alwaysPreparedSpells: string[];
  expandedSpellList: string[];
  grantedCantrips: string[];

  // Combat
  extraAttacks: number;        // max across all sources
  critRange: number;           // minimum roll for crit (default 20)
  fightingStyles: { id: string; name: string; effect: string }[];

  // Choice-based Modifiers
  metamagicOptions: { id: string; name: string; cost: number; effect: string }[];
  maneuverOptions: { id: string; name: string; dice: string; effect: string }[];

  // Resources auto-added by features
  featureResources: Record<string, TrackedResource>;

  // Third-caster info
  isThirdCaster: boolean;
  thirdCasterSpellList: string | null;
  thirdCasterSchools: string[] | null;
  thirdCasterFreeSchoolLevels: number[] | null;

  // Wild Shape enhancements (for Moon Druids etc.)
  wildShapeEnhancements: { enhancement: string; details: string }[];

  // Companion templates to offer
  companionTemplates: string[];

  // NEW: Active toggle state summary (for UI display)
  activeToggleIds: string[];
}

// ── Helper: calculate stat modifier ──
function calcMod(score: number): number {
  if (typeof score !== 'number' || isNaN(score)) return 0;
  return Math.floor((score - 10) / 2);
}

// ── Helper: resolve a formula string to a number ──
function resolveFormula(formula: string, char: LiveCharacter): number {
  const classLevel = char.level || 1;
  const profBonus = Math.ceil(classLevel / 4) + 1;
  
  switch (formula) {
    case 'class_level': return classLevel;
    case 'half_class_level': return Math.floor(classLevel / 2);
    case 'prof_bonus': return profBonus;
    case 'str_mod': return calcMod(char.stats?.str || 10);
    case 'dex_mod': return calcMod(char.stats?.dex || 10);
    case 'con_mod': return calcMod(char.stats?.con || 10);
    case 'int_mod': return calcMod(char.stats?.int || 10);
    case 'wis_mod': return calcMod(char.stats?.wis || 10);
    case 'cha_mod': return calcMod(char.stats?.cha || 10);
    default: {
      // Support compound formulas like "2 * class_level + int_mod"
      // For now, try parsing as raw number
      const parsed = parseInt(formula);
      return isNaN(parsed) ? 0 : parsed;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  CONDITION MATCHING — Used by the CombatTab Interceptor
// ═══════════════════════════════════════════════════════════════

export interface CardMatchContext {
  cardType: 'spell' | 'weapon' | 'feature';
  spellLevel?: number;
  spellSchool?: string;
  spellName?: string;
  damageType?: string;
  isRanged?: boolean;
  activeToggleIds?: string[];
}

/**
 * Check whether a TargetCondition matches a given combat card context.
 * Used by the CombatTab Interceptor to decide whether to inject modifiers.
 */
export function matchesCondition(condition: TargetCondition | undefined, ctx: CardMatchContext): boolean {
  if (!condition) return true; // No condition = unconditional match

  // Target type check
  if (condition.targetType) {
    switch (condition.targetType) {
      case 'melee':
        if (ctx.cardType === 'spell') return false;
        if (ctx.isRanged) return false;
        break;
      case 'ranged':
        if (ctx.cardType === 'spell') return false;
        if (!ctx.isRanged) return false;
        break;
      case 'spell':
        if (ctx.cardType !== 'spell') return false;
        break;
      case 'weapon':
        if (ctx.cardType !== 'weapon') return false;
        break;
      case 'all':
        // Matches everything
        break;
    }
  }

  // Element check
  if (condition.element && ctx.damageType) {
    if (ctx.damageType.toLowerCase() !== condition.element.toLowerCase()) return false;
  } else if (condition.element && !ctx.damageType) {
    return false; // Requires element match but card has no damage type
  }

  // School check (e.g., Empowered Evocation applies to Evocation spells)
  if (condition.school) {
    if (!ctx.spellSchool || ctx.spellSchool.toLowerCase() !== condition.school.toLowerCase()) return false;
  }

  // Cantrip check (e.g., Potent Spellcasting applies to cantrips only)
  if (condition.isCantrip !== undefined) {
    if (condition.isCantrip && ctx.spellLevel !== 0) return false;
    if (!condition.isCantrip && ctx.spellLevel === 0) return false;
  }

  // Specific spell name check (e.g., Agonizing Blast applies to Eldritch Blast)
  if (condition.spellName) {
    if (!ctx.spellName || ctx.spellName.toLowerCase() !== condition.spellName.toLowerCase()) return false;
  }

  // Toggle requirement check (e.g., "only while raging")
  if (condition.requiresToggle) {
    const toggleActive = ctx.activeToggleIds?.includes(condition.requiresToggle);
    if (!toggleActive) return false;
  }

  return true;
}


// ═══════════════════════════════════════════════════════════════
//  MAIN RESOLVER
// ═══════════════════════════════════════════════════════════════

export function resolveModifiers(char: LiveCharacter | null): ResolvedModifiers {
  const result: ResolvedModifiers = {
    bonusDamage: {},
    conditionalDamage: [],
    bonusAC: 0,
    acFormula: null,
    bonusHP: 0,
    bonusSpeed: 0,
    grantedResistances: [],
    grantedImmunities: [],
    darkvisionRange: 0,
    wardHP: [],
    postHitModifiers: [],
    grantedArmorProficiencies: [],
    grantedWeaponProficiencies: [],
    grantedSkills: [],
    grantedExpertise: [],
    grantedSaveProficiencies: [],
    grantedToolProficiencies: [],
    alwaysPreparedSpells: [],
    expandedSpellList: [],
    grantedCantrips: [],
    extraAttacks: 0,
    critRange: 20,
    fightingStyles: [],
    metamagicOptions: [],
    maneuverOptions: [],
    featureResources: {},
    isThirdCaster: false,
    thirdCasterSpellList: null,
    thirdCasterSchools: null,
    thirdCasterFreeSchoolLevels: null,
    wildShapeEnhancements: [],
    companionTemplates: [],
    activeToggleIds: [],
  };

  if (!char) return result;

  // ── Pass 1: Walk char.features[] (class + subclass + race features) ──
  const allFeatures = char.features || [];
  
  for (const feature of allFeatures) {
    if (!feature.modifiers || feature.modifiers.length === 0) continue;

    for (const mod of feature.modifiers) {
      processModifier(mod, char, result, feature.name);
    }
  }

  // ── Pass 2: Walk char.feats[] (Rule 3: Feats Integration) ──
  // FeatData doesn't have modifiers[] yet, but when they're added
  // they'll be picked up here automatically. This future-proofs the engine.
  const allFeats = char.feats || [];
  for (const feat of allFeats) {
    // FeatData may gain modifiers in the future
    const featWithMods = feat as FeatData & { modifiers?: ModifierEffect[] };
    if (!featWithMods.modifiers || featWithMods.modifiers.length === 0) continue;

    for (const mod of featWithMods.modifiers) {
      processModifier(mod, char, result, feat.name);
    }
  }

  // ── Pass 3: Walk char.activeCombatToggles[] (Rule 2: Active Toggles) ──
  // When a toggle is active, its modifiers[] are folded into the resolved
  // output as if they were permanent features. The UI can then see the
  // expanded stat block while Rage/Bladesong/etc. is active.
  const toggles = char.activeCombatToggles || [];
  for (const toggle of toggles) {
    if (!toggle.isActive) continue;

    // Track active toggle IDs for condition matching
    result.activeToggleIds.push(toggle.id);

    for (const mod of toggle.modifiers) {
      processModifier(mod, char, result, toggle.name);
    }
  }

  // ── Pass 4: Walk char.equipped items (Directive 3: Magic Item Bridge) ──
  // If an equipped item carries modifiers[] (e.g., Ring of Protection,
  // Cloak of Displacement), fold them into the derived state.
  // Only processes items that require attunement if attuned === true,
  // or items that don't require attunement at all.
  if (char.equipped) {
    const equippedSlots = Object.values(char.equipped) as (import('./types').InventoryItem | null)[];
    for (const item of equippedSlots) {
      if (!item || !item.modifiers || item.modifiers.length === 0) continue;
      // Skip attunement-required items that aren't attuned
      if (item.requiresAttunement && !item.attuned) continue;

      for (const mod of item.modifiers) {
        processModifier(mod, char, result, item.name);
      }
    }
  }

  // ── Pass 5: Walk char.homebrew (Universal Homebrew Engine) ──
  // 5a: Active homebrew features inject modifiers into derived state
  if (char.homebrew?.features) {
    for (const hbFeature of char.homebrew.features) {
      if (!hbFeature.isActive) continue;
      if (!hbFeature.modifiers || hbFeature.modifiers.length === 0) continue;
      for (const mod of hbFeature.modifiers) {
        processModifier(mod, char, result, `[HB] ${hbFeature.name}`);
      }
    }
  }

  // 5b: Homebrew items — check if any are equipped (already handled by Pass 4
  //     if they're in char.equipped). Also walk char.homebrew.items[] for items
  //     that carry passive modifiers (e.g., a homebrew amulet in inventory that
  //     grants a passive effect while carried, not just when equipped).
  if (char.homebrew?.items) {
    for (const hbItem of char.homebrew.items) {
      if (!hbItem.modifiers || hbItem.modifiers.length === 0) continue;
      // Skip items already processed by Pass 4 (equipped items)
      const isEquipped = char.equipped && Object.values(char.equipped).some(
        (eq: any) => eq?.id === hbItem.id
      );
      if (isEquipped) continue;
      // Only process non-equipped homebrew items if they have a 'carried' passive
      // (future extensibility — for now skip non-equipped to avoid double-counting)
    }
  }

  return result;
}

function processModifier(mod: ModifierEffect, char: LiveCharacter, result: ResolvedModifiers, sourceName: string = ''): void {
  switch (mod.type) {
    // ── Damage ──
    case 'add_damage_ability': {
      const bonus = calcMod(char.stats[mod.ability as keyof typeof char.stats] || 10);
      if (!result.bonusDamage[mod.target]) result.bonusDamage[mod.target] = [];
      result.bonusDamage[mod.target].push({
        flat: bonus,
        dice: '',
        damageType: '',
        condition: '',
        targetCondition: mod.condition,
      });
      break;
    }
    case 'add_flat_damage': {
      if (!result.bonusDamage[mod.target]) result.bonusDamage[mod.target] = [];
      result.bonusDamage[mod.target].push({
        flat: mod.value,
        dice: '',
        damageType: mod.damageType || '',
        condition: '',
        targetCondition: mod.condition,
      });
      break;
    }
    case 'add_conditional_damage': {
      // Legacy: still populate bonusDamage for backward compat
      const key = `__${mod.target}__`;
      if (!result.bonusDamage[key]) result.bonusDamage[key] = [];
      result.bonusDamage[key].push({
        flat: 0,
        dice: mod.dice,
        damageType: mod.damageType,
        condition: mod.condition,
        targetCondition: mod.targetCondition,
      });

      // NEW: Also populate the structured conditionalDamage array for the Interceptor
      result.conditionalDamage.push({
        source: sourceName,
        target: mod.target,
        dice: mod.dice,
        damageType: mod.damageType,
        condition: mod.condition,
        targetCondition: mod.targetCondition,
      });
      break;
    }

    // ── Spells ──
    case 'grant_spells_always_prepared':
      result.alwaysPreparedSpells.push(...mod.spells);
      break;
    case 'expanded_spell_list':
      for (const entry of mod.spells) {
        result.expandedSpellList.push(...entry.spellIds);
      }
      break;
    case 'grant_cantrip':
      result.grantedCantrips.push(mod.cantrip);
      break;

    // ── Proficiencies ──
    case 'grant_skill':
      if (!result.grantedSkills.includes(mod.target)) result.grantedSkills.push(mod.target);
      break;
    case 'grant_expertise':
      if (!result.grantedExpertise.includes(mod.target)) result.grantedExpertise.push(mod.target);
      break;
    case 'grant_proficiency':
      switch (mod.category) {
        case 'armor': if (!result.grantedArmorProficiencies.includes(mod.value)) result.grantedArmorProficiencies.push(mod.value); break;
        case 'weapon': if (!result.grantedWeaponProficiencies.includes(mod.value)) result.grantedWeaponProficiencies.push(mod.value); break;
        case 'save': if (!result.grantedSaveProficiencies.includes(mod.value)) result.grantedSaveProficiencies.push(mod.value); break;
        case 'tool': if (!result.grantedToolProficiencies.includes(mod.value)) result.grantedToolProficiencies.push(mod.value); break;
      }
      break;

    // ── Resources ──
    case 'add_resource':
      result.featureResources[mod.resourceId] = {
        name: mod.name,
        max: mod.max,
        used: 0,
        recharge: mod.recharge,
        actionCost: mod.actionCost,
        description: mod.description,
      };
      break;
    case 'scale_resource': {
      const existing = result.featureResources[mod.resourceId];
      if (existing) {
        existing.max = resolveFormula(mod.maxFormula, char);
      }
      break;
    }
    case 'upgrade_resource_die': {
      const existing2 = result.featureResources[mod.resourceId];
      if (existing2) {
        existing2.die = mod.newDie;
      }
      break;
    }

    // ── Defense ──
    case 'modify_ac':
      result.acFormula = mod.formula;
      break;
    case 'grant_resistance':
      if (!result.grantedResistances.includes(mod.damageType)) result.grantedResistances.push(mod.damageType);
      break;
    case 'grant_immunity':
      if (!result.grantedImmunities.includes(mod.condition)) result.grantedImmunities.push(mod.condition);
      break;
    case 'grant_extra_hp':
      // ═══ AMENDMENT 5: grant_extra_hp is store-only ═══
      // HP mutations are cumulative and historical — they happen once per
      // level-up in completeLevelUp(). The resolver no longer accumulates
      // bonusHP from this modifier to prevent double-counting.
      // This case is intentionally a no-op.
      break;
    case 'grant_speed':
      result.bonusSpeed += mod.value;
      break;
    case 'grant_darkvision':
      result.darkvisionRange = Math.max(result.darkvisionRange, mod.range);
      break;

    // ── Ward HP (Arcane Ward — separate damage absorption pool) ──
    case 'grant_ward_hp':
      result.wardHP.push({
        name: mod.name,
        maxHP: resolveFormula(mod.formula, char),
        regenFormula: mod.regenFormula,
        regenTrigger: mod.regenTrigger,
      });
      break;

    // ── Post-Hit Modifiers (Divine Smite pattern) ──
    case 'post_hit_modifier':
      result.postHitModifiers.push({
        source: sourceName,
        name: mod.name,
        costType: mod.costType,
        costResourceId: mod.costResourceId,
        dicePerLevel: mod.dicePerLevel,
        baseDice: mod.baseDice,
        maxDice: mod.maxDice,
        damageType: mod.damageType,
      });
      break;

    // ── Combat ──
    case 'grant_extra_attack':
      result.extraAttacks = Math.max(result.extraAttacks, mod.count);
      break;
    case 'expand_crit_range':
      result.critRange = Math.min(result.critRange, mod.minRoll);
      break;
    case 'fighting_style':
      result.fightingStyles.push({ id: mod.styleId, name: mod.name, effect: mod.effect });
      break;

    // ── Choice-based ──
    case 'metamagic_option':
      result.metamagicOptions.push({ id: mod.optionId, name: mod.name, cost: mod.cost, effect: mod.effect });
      break;
    case 'maneuver_option':
      result.maneuverOptions.push({ id: mod.optionId, name: mod.name, dice: mod.dice, effect: mod.effect });
      break;

    // ── Special ──
    case 'wild_shape_enhancement':
      result.wildShapeEnhancements.push({ enhancement: mod.enhancement, details: mod.details });
      break;
    case 'summon_companion':
      if (!result.companionTemplates.includes(mod.templateId)) result.companionTemplates.push(mod.templateId);
      break;
    case 'grant_third_caster':
      result.isThirdCaster = true;
      result.thirdCasterSpellList = mod.spellList;
      result.thirdCasterSchools = mod.allowedSchools || null;
      result.thirdCasterFreeSchoolLevels = mod.freeSchoolLevels || null;
      break;

    // ── Passive / narrative — no mechanical effect ──
    case 'passive':
    case 'add_range':
    case 'cast_w_slot':
    case 'wild_magic_surge':
      // These are handled by specific UI components, not the global resolver
      break;
  }
}

// ═══════════════════════════════════════════════════════════════
//  COMPUTED HELPERS
//  Use resolved modifiers to compute final display values.
// ═══════════════════════════════════════════════════════════════

/** Get the total spell damage string including all active modifiers */
export function getModifiedSpellDamage(char: LiveCharacter, spellName: string, baseDamage: string, resolved?: ResolvedModifiers): string {
  if (!baseDamage || !char) return baseDamage || '';
  
  const res = resolved || resolveModifiers(char);
  const bonuses = res.bonusDamage[spellName.toLowerCase()] || [];
  const globalBonuses = res.bonusDamage['__spell__'] || [];
  const allBonuses = res.bonusDamage['__all__'] || [];
  
  let totalFlat = 0;
  const extraDice: string[] = [];
  
  [...bonuses, ...globalBonuses, ...allBonuses].forEach(b => {
    totalFlat += b.flat;
    if (b.dice) extraDice.push(b.dice);
  });

  let result = baseDamage;
  if (extraDice.length > 0) result += ` + ${extraDice.join(' + ')}`;
  if (totalFlat > 0) result += ` + ${totalFlat}`;
  else if (totalFlat < 0) result += ` - ${Math.abs(totalFlat)}`;
  
  return result;
}

/** Check if a modifier toggle (Metamagic, Maneuver) is currently available (not spent) */
export function isModifierAvailable(char: LiveCharacter, modifierId: string): boolean {
  if (!char.activeModifiers) return true;
  const state = char.activeModifiers.find(m => m.modifierId === modifierId);
  if (!state) return true;
  return !state.isSpent;
}

/** Get all available metamagic options for display on spell cards */
export function getAvailableMetamagic(char: LiveCharacter, resolved?: ResolvedModifiers): { id: string; name: string; cost: number; effect: string; available: boolean }[] {
  const res = resolved || resolveModifiers(char);
  return res.metamagicOptions.map(mm => ({
    ...mm,
    available: isModifierAvailable(char, mm.id)
  }));
}

/** Get all available maneuvers for display on weapon cards */
export function getAvailableManeuvers(char: LiveCharacter, resolved?: ResolvedModifiers): { id: string; name: string; dice: string; effect: string; available: boolean }[] {
  const res = resolved || resolveModifiers(char);
  return res.maneuverOptions.map(mv => ({
    ...mv,
    available: isModifierAvailable(char, mv.id)
  }));
}

/** Compute final AC considering subclass overrides */
export function computeAC(char: LiveCharacter, resolved?: ResolvedModifiers): number {
  const res = resolved || resolveModifiers(char);
  
  // If there's an AC formula override (e.g. Draconic Resilience: 13+DEX when no armor)
  if (res.acFormula) {
    const parts = res.acFormula.split('+');
    const base = parseInt(parts[0]) || 10;
    let mod = 0;
    if (parts[1]) {
      mod = calcMod(char.stats[parts[1].trim() as keyof typeof char.stats] || 10);
    }
    // Only use formula if not wearing armor
    const hasArmor = char.equipped?.chest?.armorCategory;
    if (!hasArmor) {
      return base + mod + res.bonusAC;
    }
  }
  
  // Otherwise use standard AC calculation (handled elsewhere, just add bonus)
  return res.bonusAC; // Returns the bonus to add to existing AC calc
}

/**
 * Calculate the actual cost of a staged modifier for a specific spell level.
 * Handles the 'spell_level' sentinel for Twinned Spell (Rule 4).
 */
export function resolveStagedModifierCost(cost: number | 'spell_level', spellLevel: number): number {
  if (cost === 'spell_level') {
    return Math.max(1, spellLevel); // Cantrips cost 1, leveled spells cost their level
  }
  return cost;
}
