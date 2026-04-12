// ═══════════════════════════════════════════════════════════════
//  RESOURCE SCALING TABLES — Dungeon Buddy
//  Maps (class, resource, classLevel) → { max, die? }
//  Used by completeLevelUp() to auto-scale resources each level.
// ═══════════════════════════════════════════════════════════════

export interface ResourceScale {
  max: number;
  die?: string;       // For dice-based resources (e.g. "d8")
  description?: string;
}

// ── BARBARIAN: Rage ──
export const RAGE_SCALING: Record<number, ResourceScale> = {
  1: { max: 2 }, 2: { max: 2 }, 3: { max: 3 }, 4: { max: 3 },
  5: { max: 3 }, 6: { max: 4 }, 7: { max: 4 }, 8: { max: 4 },
  9: { max: 4 }, 10: { max: 4 }, 11: { max: 4 }, 12: { max: 5 },
  13: { max: 5 }, 14: { max: 5 }, 15: { max: 5 }, 16: { max: 5 },
  17: { max: 6 }, 18: { max: 6 }, 19: { max: 6 }, 20: { max: 99, description: 'Unlimited' }
};

// ── BARBARIAN: Rage Damage Bonus ──
export const RAGE_DAMAGE_SCALING: Record<number, number> = {
  1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2,
  9: 3, 10: 3, 11: 3, 12: 3, 13: 3, 14: 3, 15: 3, 16: 4,
  17: 4, 18: 4, 19: 4, 20: 4
};

// ── BARD: Bardic Inspiration Die ──
export const BARDIC_INSPIRATION_DIE: Record<number, string> = {
  1: 'd6', 2: 'd6', 3: 'd6', 4: 'd6', 5: 'd8', 6: 'd8', 7: 'd8', 8: 'd8',
  9: 'd8', 10: 'd10', 11: 'd10', 12: 'd10', 13: 'd10', 14: 'd10',
  15: 'd12', 16: 'd12', 17: 'd12', 18: 'd12', 19: 'd12', 20: 'd12'
};

// ── CLERIC / PALADIN: Channel Divinity Uses ──
export const CHANNEL_DIVINITY_SCALING: Record<number, ResourceScale> = {
  1: { max: 0 }, 2: { max: 1 }, 3: { max: 1 }, 4: { max: 1 }, 5: { max: 1 },
  6: { max: 2 }, 7: { max: 2 }, 8: { max: 2 }, 9: { max: 2 }, 10: { max: 2 },
  11: { max: 2 }, 12: { max: 2 }, 13: { max: 2 }, 14: { max: 2 }, 15: { max: 2 },
  16: { max: 2 }, 17: { max: 2 }, 18: { max: 3 }, 19: { max: 3 }, 20: { max: 3 }
};

// ── DRUID: Wild Shape Uses ──
export const WILD_SHAPE_SCALING: Record<number, ResourceScale & { maxCr: string }> = {
  1: { max: 0, maxCr: '0' }, 2: { max: 2, maxCr: '1/4' }, 3: { max: 2, maxCr: '1/4' },
  4: { max: 2, maxCr: '1/2' }, 5: { max: 2, maxCr: '1/2' }, 6: { max: 2, maxCr: '1/2' },
  7: { max: 2, maxCr: '1/2' }, 8: { max: 2, maxCr: '1' }, 9: { max: 2, maxCr: '1' },
  10: { max: 2, maxCr: '1' }, 11: { max: 2, maxCr: '1' }, 12: { max: 2, maxCr: '1' },
  13: { max: 2, maxCr: '1' }, 14: { max: 2, maxCr: '1' }, 15: { max: 2, maxCr: '1' },
  16: { max: 2, maxCr: '1' }, 17: { max: 2, maxCr: '1' }, 18: { max: 2, maxCr: '1' },
  19: { max: 2, maxCr: '1' }, 20: { max: 99, maxCr: '1', description: 'Unlimited' }
};

// Circle of the Moon overrides CR limits
export const MOON_DRUID_CR_SCALING: Record<number, string> = {
  2: '1', 3: '1', 4: '1', 5: '1', 6: '2', 7: '2', 8: '2',
  9: '3', 10: '3', 11: '3', 12: '4', 13: '4', 14: '4',
  15: '5', 16: '5', 17: '5', 18: '6', 19: '6', 20: '6'
};

// ── FIGHTER (Battle Master): Superiority Dice ──
export const SUPERIORITY_DICE_SCALING: Record<number, ResourceScale> = {
  3: { max: 4, die: 'd8' }, 4: { max: 4, die: 'd8' }, 5: { max: 4, die: 'd8' },
  6: { max: 4, die: 'd8' }, 7: { max: 5, die: 'd8' }, 8: { max: 5, die: 'd8' },
  9: { max: 5, die: 'd8' }, 10: { max: 5, die: 'd10' }, 11: { max: 5, die: 'd10' },
  12: { max: 5, die: 'd10' }, 13: { max: 5, die: 'd10' }, 14: { max: 5, die: 'd10' },
  15: { max: 6, die: 'd10' }, 16: { max: 6, die: 'd10' }, 17: { max: 6, die: 'd10' },
  18: { max: 6, die: 'd12' }, 19: { max: 6, die: 'd12' }, 20: { max: 6, die: 'd12' }
};

// ── MONK: Ki Points (= monk level) ──
export const KI_SCALING: Record<number, ResourceScale> = {
  1: { max: 0 }, 2: { max: 2 }, 3: { max: 3 }, 4: { max: 4 }, 5: { max: 5 },
  6: { max: 6 }, 7: { max: 7 }, 8: { max: 8 }, 9: { max: 9 }, 10: { max: 10 },
  11: { max: 11 }, 12: { max: 12 }, 13: { max: 13 }, 14: { max: 14 }, 15: { max: 15 },
  16: { max: 16 }, 17: { max: 17 }, 18: { max: 18 }, 19: { max: 19 }, 20: { max: 20 }
};

// ── MONK: Martial Arts Die ──
export const MARTIAL_ARTS_DIE: Record<number, string> = {
  1: '1d4', 2: '1d4', 3: '1d4', 4: '1d4', 5: '1d6', 6: '1d6', 7: '1d6', 8: '1d6',
  9: '1d6', 10: '1d6', 11: '1d8', 12: '1d8', 13: '1d8', 14: '1d8', 15: '1d8', 16: '1d8',
  17: '1d10', 18: '1d10', 19: '1d10', 20: '1d10'
};

// ── MONK: Unarmored Movement Bonus ──
export const UNARMORED_MOVEMENT: Record<number, number> = {
  1: 0, 2: 10, 3: 10, 4: 10, 5: 10, 6: 15, 7: 15, 8: 15,
  9: 15, 10: 20, 11: 20, 12: 20, 13: 20, 14: 25, 15: 25, 16: 25,
  17: 25, 18: 30, 19: 30, 20: 30
};

// ── PALADIN: Lay on Hands Pool (= paladin_level × 5) ──
export function getLayOnHandsPool(paladinLevel: number): number {
  return paladinLevel * 5;
}

// ── ROGUE: Sneak Attack Dice ──
export const SNEAK_ATTACK_DICE: Record<number, string> = {
  1: '1d6', 2: '1d6', 3: '2d6', 4: '2d6', 5: '3d6', 6: '3d6',
  7: '4d6', 8: '4d6', 9: '5d6', 10: '5d6', 11: '6d6', 12: '6d6',
  13: '7d6', 14: '7d6', 15: '8d6', 16: '8d6', 17: '9d6', 18: '9d6',
  19: '10d6', 20: '10d6'
};

// ── SORCERER: Sorcery Points (= sorcerer level) ──
export const SORCERY_POINTS_SCALING: Record<number, ResourceScale> = {
  1: { max: 0 }, 2: { max: 2 }, 3: { max: 3 }, 4: { max: 4 }, 5: { max: 5 },
  6: { max: 6 }, 7: { max: 7 }, 8: { max: 8 }, 9: { max: 9 }, 10: { max: 10 },
  11: { max: 11 }, 12: { max: 12 }, 13: { max: 13 }, 14: { max: 14 }, 15: { max: 15 },
  16: { max: 16 }, 17: { max: 17 }, 18: { max: 18 }, 19: { max: 19 }, 20: { max: 20 }
};

// ── WARLOCK: Pact Magic Slots (different from normal caster slots) ──
export const WARLOCK_PACT_SLOTS: Record<number, { slots: number; level: number }> = {
  1:  { slots: 1, level: 1 },
  2:  { slots: 2, level: 1 },
  3:  { slots: 2, level: 2 },
  4:  { slots: 2, level: 2 },
  5:  { slots: 2, level: 3 },
  6:  { slots: 2, level: 3 },
  7:  { slots: 2, level: 4 },
  8:  { slots: 2, level: 4 },
  9:  { slots: 2, level: 5 },
  10: { slots: 2, level: 5 },
  11: { slots: 3, level: 5 },
  12: { slots: 3, level: 5 },
  13: { slots: 3, level: 5 },
  14: { slots: 3, level: 5 },
  15: { slots: 3, level: 5 },
  16: { slots: 3, level: 5 },
  17: { slots: 4, level: 5 },
  18: { slots: 4, level: 5 },
  19: { slots: 4, level: 5 },
  20: { slots: 4, level: 5 }
};

// ── WARLOCK: Invocations Known ──
export const WARLOCK_INVOCATIONS_KNOWN: Record<number, number> = {
  1: 0, 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4,
  9: 5, 10: 5, 11: 5, 12: 6, 13: 6, 14: 6, 15: 7, 16: 7,
  17: 7, 18: 8, 19: 8, 20: 8
};

// ── FIGHTER: Action Surge Uses ──
export const ACTION_SURGE_SCALING: Record<number, ResourceScale> = {
  2: { max: 1 }, 3: { max: 1 }, 4: { max: 1 }, 5: { max: 1 }, 6: { max: 1 },
  7: { max: 1 }, 8: { max: 1 }, 9: { max: 1 }, 10: { max: 1 }, 11: { max: 1 },
  12: { max: 1 }, 13: { max: 1 }, 14: { max: 1 }, 15: { max: 1 }, 16: { max: 1 },
  17: { max: 2 }, 18: { max: 2 }, 19: { max: 2 }, 20: { max: 2 }
};

// ── FIGHTER: Second Wind ──
// Always 1 use per short rest (doesn't scale in count, but healing scales: 1d10 + fighter level)

// ── FIGHTER: Indomitable Uses ──
export const INDOMITABLE_SCALING: Record<number, ResourceScale> = {
  9: { max: 1 }, 10: { max: 1 }, 11: { max: 1 }, 12: { max: 1 },
  13: { max: 2 }, 14: { max: 2 }, 15: { max: 2 }, 16: { max: 2 },
  17: { max: 3 }, 18: { max: 3 }, 19: { max: 3 }, 20: { max: 3 }
};

// ── THIRD-CASTER: Eldritch Knight / Arcane Trickster Spell Slots ──
export const THIRD_CASTER_SLOTS: Record<number, number[]> = {
  1: [], 2: [], 3: [2], 4: [3], 5: [3], 6: [3], 7: [4,2], 8: [4,2],
  9: [4,2], 10: [4,3], 11: [4,3], 12: [4,3], 13: [4,3,2], 14: [4,3,2],
  15: [4,3,2], 16: [4,3,3], 17: [4,3,3], 18: [4,3,3], 19: [4,3,3,1], 20: [4,3,3,1]
};

// ── THIRD-CASTER: Cantrips Known ──
export const THIRD_CASTER_CANTRIPS: Record<number, number> = {
  1: 0, 2: 0, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 3,
  11: 3, 12: 3, 13: 3, 14: 3, 15: 3, 16: 3, 17: 3, 18: 3, 19: 3, 20: 3
};

// ── THIRD-CASTER: Spells Known ──
export const THIRD_CASTER_SPELLS_KNOWN: Record<number, number> = {
  1: 0, 2: 0, 3: 3, 4: 4, 5: 4, 6: 4, 7: 5, 8: 6, 9: 6, 10: 7,
  11: 8, 12: 8, 13: 9, 14: 10, 15: 10, 16: 11, 17: 11, 18: 11, 19: 12, 20: 13
};

// ── DIVINE STRIKE / POTENT SPELLCASTING SCALING (Cleric subclasses) ──
export const DIVINE_STRIKE_DICE: Record<number, string> = {
  8: '1d8', 9: '1d8', 10: '1d8', 11: '1d8', 12: '1d8', 13: '1d8',
  14: '2d8', 15: '2d8', 16: '2d8', 17: '2d8', 18: '2d8', 19: '2d8', 20: '2d8'
};

// ── FIGHTER: Extra Attacks ──
export const FIGHTER_EXTRA_ATTACKS: Record<number, number> = {
  5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1,
  11: 2, 12: 2, 13: 2, 14: 2, 15: 2, 16: 2, 17: 2, 18: 2, 19: 2, 20: 3
};

// ═══════════════════════════════════════════════════════════════
//  METAMAGIC OPTIONS (Sorcerer)
// ═══════════════════════════════════════════════════════════════

export interface MetamagicOption {
  id: string;
  name: string;
  cost: number;         // Sorcery points
  description: string;
  effect: string;       // Short mechanical summary
}

export const METAMAGIC_OPTIONS: MetamagicOption[] = [
  { id: 'careful_spell', name: 'Careful Spell', cost: 1, description: 'When you cast a spell that forces other creatures to make a saving throw, you can protect some of those creatures from the spell. Choose a number of creatures up to your Charisma modifier. A chosen creature automatically succeeds on its saving throw against the spell.', effect: 'Auto-succeed saves for CHA mod creatures' },
  { id: 'distant_spell', name: 'Distant Spell', cost: 1, description: 'When you cast a spell that has a range of 5 feet or greater, you can double the range. When you cast a spell that has a range of touch, you can make the range 30 feet.', effect: 'Double range or Touch → 30 ft.' },
  { id: 'empowered_spell', name: 'Empowered Spell', cost: 1, description: 'When you roll damage for a spell, you can reroll a number of the damage dice up to your Charisma modifier. You must use the new rolls.', effect: 'Reroll CHA mod damage dice' },
  { id: 'extended_spell', name: 'Extended Spell', cost: 1, description: 'When you cast a spell that has a duration of 1 minute or longer, you can double its duration, to a maximum of 24 hours.', effect: 'Double duration (max 24h)' },
  { id: 'heightened_spell', name: 'Heightened Spell', cost: 3, description: 'When you cast a spell that forces a creature to make a saving throw to resist its effects, you can give one target of the spell disadvantage on its first saving throw against the spell.', effect: 'Disadvantage on save' },
  { id: 'quickened_spell', name: 'Quickened Spell', cost: 2, description: 'When you cast a spell that has a casting time of 1 action, you can change the casting time to 1 bonus action for this casting.', effect: 'Action → Bonus Action' },
  { id: 'seeking_spell', name: 'Seeking Spell', cost: 2, description: 'If you make an attack roll for a spell and miss, you can reroll the d20, using the new roll. You can use this even after a Metamagic option like Twinned Spell.', effect: 'Reroll missed spell attack' },
  { id: 'subtle_spell', name: 'Subtle Spell', cost: 1, description: 'When you cast a spell, you can cast it without any somatic or verbal components.', effect: 'No verbal/somatic needed' },
  { id: 'transmuted_spell', name: 'Transmuted Spell', cost: 1, description: 'When you cast a spell that deals acid, cold, fire, lightning, poison, or thunder damage, you can change the damage type to one of the other listed types.', effect: 'Change damage type' },
  { id: 'twinned_spell', name: 'Twinned Spell', cost: 0, description: 'When you cast a spell that targets only one creature and doesn\'t have a range of self, you can spend a number of sorcery points equal to the spell\'s level (1 for cantrips) to target a second creature in range with the same spell.', effect: 'Twin target (cost = spell level)' }
];

// ═══════════════════════════════════════════════════════════════
//  BATTLE MASTER MANEUVERS
// ═══════════════════════════════════════════════════════════════

export interface ManeuverOption {
  id: string;
  name: string;
  description: string;
  effect: string;
}

export const MANEUVER_OPTIONS: ManeuverOption[] = [
  { id: 'commanders_strike', name: "Commander's Strike", description: 'When you take the Attack action, you can forgo one attack to direct an ally to strike. The ally can use its reaction to make a weapon attack, adding your superiority die to the damage.', effect: 'Ally attacks + superiority die damage' },
  { id: 'disarming_attack', name: 'Disarming Attack', description: 'When you hit a creature with a weapon attack, you can add the superiority die to the damage and force the target to drop one item of your choice.', effect: '+die damage, target drops item' },
  { id: 'distracting_strike', name: 'Distracting Strike', description: 'When you hit a creature with a weapon attack, you can add the superiority die to the damage. The next attack roll against the target by someone else has advantage.', effect: '+die damage, next ally has advantage' },
  { id: 'evasive_footwork', name: 'Evasive Footwork', description: 'When you move, you can add a superiority die roll to your AC until you stop moving.', effect: '+die to AC while moving' },
  { id: 'feinting_attack', name: 'Feinting Attack', description: 'As a bonus action, you can feint, giving you advantage on your next attack roll against a creature within 5 feet. If the attack hits, add the superiority die to damage.', effect: 'Advantage + die damage on next attack' },
  { id: 'goading_attack', name: 'Goading Attack', description: 'When you hit a creature, add the superiority die to damage. The target has disadvantage on attacks against targets other than you until the end of your next turn.', effect: '+die damage, taunt target' },
  { id: 'lunging_attack', name: 'Lunging Attack', description: 'When you make a melee weapon attack, you can increase your reach by 5 feet and add the superiority die to the damage roll.', effect: '+5 ft. reach + die damage' },
  { id: 'maneuvering_attack', name: 'Maneuvering Attack', description: 'When you hit a creature, add the superiority die to damage. Choose an ally who can use their reaction to move up to half their speed without provoking opportunity attacks.', effect: '+die damage, ally moves free' },
  { id: 'menacing_attack', name: 'Menacing Attack', description: 'When you hit a creature, add the superiority die to damage. The target must make a Wisdom save or be frightened of you until the end of your next turn.', effect: '+die damage, frighten target' },
  { id: 'parry', name: 'Parry', description: 'When another creature damages you with a melee attack, you can use your reaction to reduce the damage by the superiority die roll + your Dexterity modifier.', effect: 'Reduce damage by die + DEX mod' },
  { id: 'precision_attack', name: 'Precision Attack', description: 'When you make a weapon attack roll, you can add the superiority die to the roll. You can use this before or after making the attack roll, but before any effects are applied.', effect: '+die to attack roll' },
  { id: 'pushing_attack', name: 'Pushing Attack', description: 'When you hit a creature, add the superiority die to damage. If the target is Large or smaller, it must make a STR save or be pushed up to 15 feet away.', effect: '+die damage, push 15 ft.' },
  { id: 'rally', name: 'Rally', description: 'As a bonus action, choose an ally within 60 feet who can see or hear you. That creature gains temporary hit points equal to the superiority die roll + your Charisma modifier.', effect: 'Ally gains THP = die + CHA mod' },
  { id: 'riposte', name: 'Riposte', description: 'When a creature misses you with a melee attack, you can use your reaction to make a melee weapon attack against the creature. If you hit, add the superiority die to damage.', effect: 'Reaction attack + die damage on miss' },
  { id: 'sweeping_attack', name: 'Sweeping Attack', description: 'When you hit a creature, if another creature is within 5 feet of the original target and your reach, you can deal the superiority die roll in damage to the second creature.', effect: 'Cleave die damage to adjacent' },
  { id: 'trip_attack', name: 'Trip Attack', description: 'When you hit a creature, add the superiority die to damage. If the target is Large or smaller, it must make a STR save or be knocked prone.', effect: '+die damage, knock prone' },
  { id: 'ambush', name: 'Ambush', description: 'When you make a Dexterity (Stealth) check or an initiative roll, you can add a superiority die to the roll.', effect: '+die to Stealth or initiative' },
  { id: 'brace', name: 'Brace', description: 'When a creature you can see moves into the reach you have with a melee weapon you\'re wielding, you can use your reaction to make one attack against the creature, adding the superiority die to the damage roll.', effect: 'Reaction attack on approach + die' },
  { id: 'commanding_presence', name: 'Commanding Presence', description: 'When you make a Charisma (Intimidation), a Charisma (Performance), or a Charisma (Persuasion) check, you can add a superiority die to the ability check.', effect: '+die to CHA checks' },
  { id: 'grappling_strike', name: 'Grappling Strike', description: 'Immediately after you hit a creature with a melee attack, you can use a bonus action to try to grapple the target. Add the superiority die to your Strength (Athletics) check.', effect: 'Free grapple + die bonus' },
  { id: 'quick_toss', name: 'Quick Toss', description: 'As a bonus action, you can make a ranged attack with a weapon that has the thrown property. You can draw the weapon as part of making this attack. If you hit, add the superiority die to the damage roll.', effect: 'Bonus action throw + die damage' },
  { id: 'tactical_assessment', name: 'Tactical Assessment', description: 'When you make an Intelligence (Investigation), an Intelligence (History), or a Wisdom (Insight) check, you can add a superiority die to the ability check.', effect: '+die to INT/WIS checks' }
];

// ═══════════════════════════════════════════════════════════════
//  FIGHTING STYLES
// ═══════════════════════════════════════════════════════════════

export interface FightingStyleOption {
  id: string;
  name: string;
  description: string;
  classes: string[];  // Which classes can pick this
}

export const FIGHTING_STYLE_OPTIONS: FightingStyleOption[] = [
  { id: 'archery', name: 'Archery', description: '+2 bonus to attack rolls with ranged weapons.', classes: ['Fighter', 'Ranger'] },
  { id: 'defense', name: 'Defense', description: '+1 bonus to AC while wearing armor.', classes: ['Fighter', 'Paladin', 'Ranger'] },
  { id: 'dueling', name: 'Dueling', description: '+2 bonus to damage rolls when wielding a melee weapon in one hand with no weapon in the other.', classes: ['Fighter', 'Paladin', 'Ranger', 'Bard'] },
  { id: 'great_weapon_fighting', name: 'Great Weapon Fighting', description: 'Reroll 1 or 2 on damage dice with two-handed melee weapons.', classes: ['Fighter', 'Paladin'] },
  { id: 'protection', name: 'Protection', description: 'Use reaction to impose disadvantage on attack against adjacent ally (requires shield).', classes: ['Fighter', 'Paladin'] },
  { id: 'two_weapon_fighting', name: 'Two-Weapon Fighting', description: 'Add ability modifier to the damage of off-hand attack.', classes: ['Fighter', 'Ranger', 'Bard'] },
  { id: 'blind_fighting', name: 'Blind Fighting', description: 'You have blindsight with a range of 10 feet.', classes: ['Fighter', 'Paladin', 'Ranger'] },
  { id: 'interception', name: 'Interception', description: 'Use reaction to reduce damage to adjacent ally by 1d10 + proficiency bonus.', classes: ['Fighter', 'Paladin'] },
  { id: 'superior_technique', name: 'Superior Technique', description: 'Learn one Battle Master maneuver. Gain 1 superiority die (d6).', classes: ['Fighter'] },
  { id: 'thrown_weapon_fighting', name: 'Thrown Weapon Fighting', description: '+2 damage with thrown weapons. Draw as part of the attack.', classes: ['Fighter', 'Ranger'] },
  { id: 'unarmed_fighting', name: 'Unarmed Fighting', description: 'Unarmed strikes deal 1d6+STR (or 1d8 with both hands free). Deal 1d4 bludgeoning at start of turn to grappled creature.', classes: ['Fighter'] },
  { id: 'druidic_warrior', name: 'Druidic Warrior', description: 'Learn two druid cantrips. They count as ranger spells.', classes: ['Ranger'] },
  { id: 'blessed_warrior', name: 'Blessed Warrior', description: 'Learn two cleric cantrips. They count as paladin spells.', classes: ['Paladin'] },
];

// ═══════════════════════════════════════════════════════════════
//  UTILITY: Get scaling for a class resource at a given level
// ═══════════════════════════════════════════════════════════════

// ── Generic: always 1 use per short rest ──
const SINGLE_USE_SCALING: Record<number, ResourceScale> = {};
for (let i = 1; i <= 20; i++) SINGLE_USE_SCALING[i] = { max: 1 };

// ── Bard: Bardic Inspiration uses = CHA mod (min 1), but we use prof as a safe default ──
const BARDIC_INSPIRATION_USES: Record<number, ResourceScale> = {};
for (let i = 1; i <= 20; i++) BARDIC_INSPIRATION_USES[i] = { max: Math.max(1, Math.ceil(i / 4) + 1) }; // approximation: scales with prof bonus

// ── Paladin: Lay on Hands pool = paladin_level * 5 ──
const LAY_ON_HANDS_SCALING: Record<number, ResourceScale> = {};
for (let i = 1; i <= 20; i++) LAY_ON_HANDS_SCALING[i] = { max: i * 5 };


export function getResourceScaling(className: string, resourceId: string, classLevel: number): ResourceScale | null {
  const tables: Record<string, Record<string, Record<number, ResourceScale>>> = {
    'Barbarian': { 'rage': RAGE_SCALING },
    'Fighter': { 
      'action_surge': ACTION_SURGE_SCALING, 
      'superiority_dice': SUPERIORITY_DICE_SCALING,
      'indomitable': INDOMITABLE_SCALING,
      'second_wind': SINGLE_USE_SCALING
    },
    'Monk': { 'ki_points': KI_SCALING },
    'Sorcerer': { 'sorcery_points': SORCERY_POINTS_SCALING },
    'Cleric': { 'channel_divinity': CHANNEL_DIVINITY_SCALING },
    'Paladin': { 'channel_divinity': CHANNEL_DIVINITY_SCALING, 'lay_on_hands': LAY_ON_HANDS_SCALING },
    'Druid': { 'wild_shape': WILD_SHAPE_SCALING },
    'Bard': { 'bardic_inspiration': BARDIC_INSPIRATION_USES },
  };

  const classTable = tables[className];
  if (!classTable) return null;
  const resourceTable = classTable[resourceId];
  if (!resourceTable) return null;
  return resourceTable[classLevel] || null;
}
