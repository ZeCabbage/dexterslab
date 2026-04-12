// ═══════════════════════════════════════════════════════════════
//  SUBCLASS FEATURES — Dungeon Buddy
//  All subclasses with features through L20 + mechanical modifiers.
//  Built from subclasses-output.json + official 5e SRD data.
// ═══════════════════════════════════════════════════════════════

import { FeatureData } from '../lib/types';
import { CLERIC_SUBCLASSES } from './subclass-features-cleric';
import { DRUID_SUBCLASSES } from './subclass-features-druid';
import { FIGHTER_SUBCLASSES } from './subclass-features-fighter';
import { MONK_SUBCLASSES } from './subclass-features-monk';
import { PALADIN_SUBCLASSES } from './subclass-features-paladin';
import { RANGER_SUBCLASSES } from './subclass-features-ranger';
import { ROGUE_SUBCLASSES } from './subclass-features-rogue';
import { SORCERER_SUBCLASSES } from './subclass-features-sorcerer';
import { WARLOCK_SUBCLASSES } from './subclass-features-warlock';
import { WIZARD_SUBCLASSES } from './subclass-features-wizard';
import { BARD_SUBCLASSES } from './subclass-features-bard';

export interface SubclassFeatureSet {
  id: string;
  name: string;
  className: string;
  description: string;
  features: FeatureData[];
}

// ═══════════════════════════════════════════════════════════════
//  BARBARIAN SUBCLASSES (kept in-file as they were generated first)
// ═══════════════════════════════════════════════════════════════

const BARBARIAN_BERSERKER: SubclassFeatureSet = {
  id: 'path_of_the_berserker', name: 'Path of the Berserker', className: 'Barbarian',
  description: 'A primal force of untamed fury, the Berserker sacrifices their own well-being for unbridled aggression.',
  features: [
    { name: 'Frenzy', description: 'When you enter a rage, you can choose to go into a frenzy, allowing you to make an additional melee weapon attack as a bonus action on each of your turns. When your rage ends, you suffer one level of exhaustion.', level: 3, source: 'Path of the Berserker', modifiers: [{ type: 'add_resource', resourceId: 'frenzy', name: 'Frenzy (Bonus Attack)', max: 1, recharge: 'short', actionCost: 'bonus_action' as const, description: 'While raging: make one bonus action melee attack per turn. Causes 1 exhaustion when rage ends.' }] },
    { name: 'Mindless Rage', description: 'You can\'t be charmed or frightened while raging. If you are charmed or frightened when you enter your rage, the effect is suspended for the duration of the rage.', level: 6, source: 'Path of the Berserker', modifiers: [{ type: 'grant_immunity', condition: 'charmed (while raging)' }, { type: 'grant_immunity', condition: 'frightened (while raging)' }] },
    { name: 'Intimidating Presence', description: 'You can use your action to frighten a creature with your menacing presence. If it fails a Wisdom save, it is frightened until the end of your next turn.', level: 10, source: 'Path of the Berserker', modifiers: [{ type: 'add_resource', resourceId: 'intimidating_presence', name: 'Intimidating Presence', max: 99, recharge: 'none', actionCost: 'action' as const, description: 'Frighten one creature (WIS save DC = 8 + prof + CHA mod)' }] },
    { name: 'Retaliation', description: 'When you take damage from a creature within 5 feet of you, you can use your reaction to make a melee weapon attack against that creature.', level: 14, source: 'Path of the Berserker', modifiers: [{ type: 'add_resource', resourceId: 'retaliation', name: 'Retaliation', max: 1, recharge: 'none', actionCost: 'reaction' as const, description: 'Reaction: melee weapon attack when damaged by creature within 5 ft.' }] },
  ]
};

const BARBARIAN_TOTEM_WARRIOR: SubclassFeatureSet = {
  id: 'path_of_the_totem_warrior', name: 'Path of the Totem Warrior', className: 'Barbarian',
  description: 'Drawing spiritual strength from primeval animal spirits, the Totem Warrior embodies the might, resilience, or cunning of the wild.',
  features: [
    { name: 'Spirit Seeker', description: 'You gain the ability to cast beast sense and speak with animals as rituals.', level: 3, source: 'Path of the Totem Warrior', modifiers: [{ type: 'grant_spells_always_prepared', spells: ['beast_sense', 'speak_with_animals'] }] },
    { name: 'Totem Spirit', description: 'Choose Bear (resist all but psychic while raging), Eagle (dash as bonus while raging), or Wolf (allies have advantage on melee vs creatures within 5ft of you while raging).', level: 3, source: 'Path of the Totem Warrior', choiceType: 'totem', choiceCount: 1 },
    { name: 'Aspect of the Beast', description: 'Choose a totem animal for a passive benefit: Bear (double carry), Eagle (see 1 mile clearly), Wolf (track at fast pace).', level: 6, source: 'Path of the Totem Warrior', choiceType: 'totem', choiceCount: 1 },
    { name: 'Spirit Walker', description: 'Cast commune with nature as a ritual.', level: 10, source: 'Path of the Totem Warrior', modifiers: [{ type: 'grant_spells_always_prepared', spells: ['commune_with_nature'] }] },
    { name: 'Totemic Attunement', description: 'Choose a totem: Bear (disadvantage on attacks vs others near you while raging), Eagle (fly half speed while raging), Wolf (knock Large or smaller prone as bonus action while raging).', level: 14, source: 'Path of the Totem Warrior', choiceType: 'totem', choiceCount: 1 },
  ]
};

const BARBARIAN_ZEALOT: SubclassFeatureSet = {
  id: 'path_of_the_zealot', name: 'Path of the Zealot', className: 'Barbarian',
  description: 'Fueled by divine fervor and unyielding devotion, the Zealot channels raw divine energy into their rage.',
  features: [
    { name: 'Divine Fury', description: 'While raging, the first creature you hit on each turn takes extra 1d6 + half barbarian level radiant or necrotic damage.', level: 3, source: 'Path of the Zealot', modifiers: [{ type: 'add_conditional_damage', target: 'melee', dice: '1d6', damageType: 'radiant/necrotic', condition: 'First hit each turn while raging' }] },
    { name: 'Warrior of the Gods', description: 'Spells that restore you to life require no material components.', level: 3, source: 'Path of the Zealot', modifiers: [{ type: 'passive', description: 'Resurrection spells need no material components' }] },
    { name: 'Fanatical Focus', description: 'If you fail a saving throw while raging, you can reroll it and must use the new roll. Once per rage.', level: 6, source: 'Path of the Zealot', modifiers: [{ type: 'add_resource', resourceId: 'fanatical_focus', name: 'Fanatical Focus', max: 1, recharge: 'short', description: 'Reroll failed save while raging' }] },
    { name: 'Zealous Presence', description: 'As a bonus action, up to 10 allies within 60 feet gain advantage on attack rolls and saving throws until your next turn. Once per long rest.', level: 10, source: 'Path of the Zealot', modifiers: [{ type: 'add_resource', resourceId: 'zealous_presence', name: 'Zealous Presence', max: 1, recharge: 'long', actionCost: 'bonus_action', description: '10 allies gain advantage on attacks and saves' }] },
    { name: 'Rage Beyond Death', description: 'While raging, having 0 HP doesn\'t knock you unconscious. You still make death saves. You only die when rage ends if you still have 0 HP.', level: 14, source: 'Path of the Zealot', modifiers: [{ type: 'passive', description: 'Stay conscious at 0 HP while raging' }] },
  ]
};

const BARBARIAN_ANCESTRAL_GUARDIAN: SubclassFeatureSet = {
  id: 'path_of_the_ancestral_guardian', name: 'Path of the Ancestral Guardian', className: 'Barbarian',
  description: 'Guided by ancestral spirits who shield allies and harry enemies.',
  features: [
    { name: 'Ancestral Protectors', description: 'While raging, the first creature you hit each turn is hampered by ancestral spirits: disadvantage on attacks against others, and others gain resistance to its damage.', level: 3, source: 'Path of the Ancestral Guardian', modifiers: [{ type: 'passive', description: 'First hit target has disadvantage vs others, others resist its damage' }] },
    { name: 'Spirit Shield', description: 'While raging, when a creature within 30 feet takes damage, use reaction to reduce it by 2d6. Scales to 3d6 at L10, 4d6 at L14.', level: 6, source: 'Path of the Ancestral Guardian', modifiers: [{ type: 'passive', description: 'Reaction: reduce ally damage by 2d6/3d6/4d6' }] },
    { name: 'Consult the Spirits', description: 'Cast augury or clairvoyance without spell slot or material components. Uses = proficiency bonus per long rest.', level: 10, source: 'Path of the Ancestral Guardian', modifiers: [{ type: 'add_resource', resourceId: 'consult_spirits', name: 'Consult the Spirits', max: 2, recharge: 'long', description: 'Cast augury or clairvoyance' }, { type: 'scale_resource', resourceId: 'consult_spirits', maxFormula: 'prof_bonus' }] },
    { name: 'Vengeful Ancestors', description: 'When you use Spirit Shield, the attacker takes force damage equal to the damage prevented.', level: 14, source: 'Path of the Ancestral Guardian', modifiers: [{ type: 'passive', description: 'Spirit Shield reflects damage to attacker' }] },
  ]
};

const BARBARIAN_STORM_HERALD: SubclassFeatureSet = {
  id: 'path_of_the_storm_herald', name: 'Path of the Storm Herald', className: 'Barbarian',
  description: 'Transform fury into primal magic, generating an aura of elemental power.',
  features: [
    { name: 'Storm Aura', description: 'While raging, you emanate a 10-foot aura. Choose Desert (fire damage), Sea (lightning damage), or Tundra (temp HP to allies). Activates as bonus action each turn.', level: 3, source: 'Path of the Storm Herald', choiceType: 'totem', choiceCount: 1, modifiers: [{ type: 'passive', description: 'Elemental aura while raging (10 ft.)' }] },
    { name: 'Storm Soul', description: 'Gain a resistance and utility based on your chosen environment: Desert (fire resistance, ignite objects), Sea (lightning resistance, breathe underwater), Tundra (cold resistance, freeze water).', level: 6, source: 'Path of the Storm Herald' },
    { name: 'Shielding Storm', description: 'Allies in your Storm Aura gain the same damage resistance as your Storm Soul.', level: 10, source: 'Path of the Storm Herald', modifiers: [{ type: 'passive', description: 'Allies in aura gain your elemental resistance' }] },
    { name: 'Raging Storm', description: 'Desert: reaction to force DEX save or fire damage. Sea: reaction to force STR save or knock prone. Tundra: bonus action - creature in aura makes STR save or speed reduced to 0.', level: 14, source: 'Path of the Storm Herald', modifiers: [{ type: 'passive', description: 'Enhanced storm aura effects' }] },
  ]
};

const BARBARIAN_BEAST: SubclassFeatureSet = {
  id: 'path_of_the_beast', name: 'Path of the Beast', className: 'Barbarian',
  description: 'Unleash the beast within, manifesting natural weapons when raging.',
  features: [
    { name: 'Form of the Beast', description: 'When you rage, choose: Bite (1d8, regain HP = prof bonus on hit when below half HP), Claws (1d6 each, extra claw attack), or Tail (1d8 reach 10ft, reaction +1d8 AC).', level: 3, source: 'Path of the Beast', modifiers: [{ type: 'passive', description: 'Natural weapon while raging: Bite, Claws, or Tail' }] },
    { name: 'Bestial Soul', description: 'Natural weapons count as magical. Choose: swimming speed, climbing speed, or jump distance increase.', level: 6, source: 'Path of the Beast', modifiers: [{ type: 'passive', description: 'Magical natural weapons + movement enhancement' }] },
    { name: 'Infectious Fury', description: 'When you hit with natural weapons while raging, force WIS save. On fail: target uses reaction to attack one of your enemies, or takes 2d12 psychic damage. Prof bonus uses per long rest.', level: 10, source: 'Path of the Beast', modifiers: [{ type: 'add_resource', resourceId: 'infectious_fury', name: 'Infectious Fury', max: 2, recharge: 'long', description: 'Force enemy WIS save on natural weapon hit' }, { type: 'scale_resource', resourceId: 'infectious_fury', maxFormula: 'prof_bonus' }] },
    { name: 'Call the Hunt', description: 'When you rage, choose prof bonus willing creatures within 30 ft. Each gains 5 temp HP and +1d6 damage once per turn. You gain 5 temp HP per creature that accepts. Once per long rest.', level: 14, source: 'Path of the Beast', modifiers: [{ type: 'add_resource', resourceId: 'call_the_hunt', name: 'Call the Hunt', max: 1, recharge: 'long', description: 'Grant allies +1d6 damage and 5 THP' }] },
  ]
};

const BARBARIAN_WILD_MAGIC: SubclassFeatureSet = {
  id: 'path_of_wild_magic', name: 'Path of Wild Magic', className: 'Barbarian',
  description: 'Magic surges from your inner power, producing unpredictable magical effects.',
  features: [
    { name: 'Magic Awareness', description: 'As an action, sense the location of any spell or magic item within 60 feet. Prof bonus uses per long rest.', level: 3, source: 'Path of Wild Magic', modifiers: [{ type: 'add_resource', resourceId: 'magic_awareness', name: 'Magic Awareness', max: 2, recharge: 'long', actionCost: 'action', description: 'Detect magic 60 ft.' }, { type: 'scale_resource', resourceId: 'magic_awareness', maxFormula: 'prof_bonus' }] },
    { name: 'Wild Surge', description: 'When you rage, roll on the Wild Magic table for a random magical effect.', level: 3, source: 'Path of Wild Magic', modifiers: [{ type: 'wild_magic_surge', description: 'Roll d8 on Wild Surge table when raging' }] },
    { name: 'Bolstering Magic', description: 'Touch a creature to grant +1d3 to attacks/checks for 10 min, OR restore a spell slot (d3 level). Prof bonus uses per long rest.', level: 6, source: 'Path of Wild Magic', modifiers: [{ type: 'add_resource', resourceId: 'bolstering_magic', name: 'Bolstering Magic', max: 2, recharge: 'long', description: '+1d3 to attacks/checks or restore spell slot' }, { type: 'scale_resource', resourceId: 'bolstering_magic', maxFormula: 'prof_bonus' }] },
    { name: 'Unstable Backlash', description: 'When you take damage or fail a save while raging, use reaction to roll a new Wild Surge, replacing current one.', level: 10, source: 'Path of Wild Magic', modifiers: [{ type: 'passive', description: 'Reaction: reroll Wild Surge on damage/failed save' }] },
    { name: 'Controlled Surge', description: 'When you roll on the Wild Surge table, roll twice and choose which result to use.', level: 14, source: 'Path of Wild Magic', modifiers: [{ type: 'passive', description: 'Roll Wild Surge twice, choose result' }] },
  ]
};

// ═══════════════════════════════════════════════════════════════
//  MASTER EXPORT
// ═══════════════════════════════════════════════════════════════

export const SUBCLASS_FEATURES: Record<string, SubclassFeatureSet[]> = {
  Barbarian: [
    BARBARIAN_BERSERKER, BARBARIAN_TOTEM_WARRIOR, BARBARIAN_ZEALOT,
    BARBARIAN_ANCESTRAL_GUARDIAN, BARBARIAN_STORM_HERALD,
    BARBARIAN_BEAST, BARBARIAN_WILD_MAGIC,
  ],
  Bard: BARD_SUBCLASSES,
  Cleric: CLERIC_SUBCLASSES,
  Druid: DRUID_SUBCLASSES,
  Fighter: FIGHTER_SUBCLASSES,
  Monk: MONK_SUBCLASSES,
  Paladin: PALADIN_SUBCLASSES,
  Ranger: RANGER_SUBCLASSES,
  Rogue: ROGUE_SUBCLASSES,
  Sorcerer: SORCERER_SUBCLASSES,
  Warlock: WARLOCK_SUBCLASSES,
  Wizard: WIZARD_SUBCLASSES
};

// Lookup helper
export function getSubclassFeatures(className: string, subclassName: string): SubclassFeatureSet | null {
  const classSubclasses = SUBCLASS_FEATURES[className];
  if (!classSubclasses) return null;
  return classSubclasses.find(sc => sc.name === subclassName) || null;
}

// Get features for a specific level
export function getSubclassFeaturesAtLevel(className: string, subclassName: string, level: number): FeatureData[] {
  const sc = getSubclassFeatures(className, subclassName);
  if (!sc) return [];
  return sc.features.filter(f => f.level === level);
}

// Get ALL features up to and including a level
export function getSubclassFeaturesUpToLevel(className: string, subclassName: string, level: number): FeatureData[] {
  const sc = getSubclassFeatures(className, subclassName);
  if (!sc) return [];
  return sc.features.filter(f => f.level <= level);
}
