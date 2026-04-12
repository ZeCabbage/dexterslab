import { SubclassFeatureSet } from './subclass-features';

export const FIGHTER_SUBCLASSES: SubclassFeatureSet[] = [
  {
    id: 'champion', name: 'Champion', className: 'Fighter',
    description: 'Masters of raw physical strength and deadly precision.',
    features: [
      { name: 'Improved Critical', description: 'Your weapon attacks score a critical hit on a roll of 19 or 20.', level: 3, source: 'Champion', modifiers: [{ type: 'expand_crit_range', minRoll: 19 }] },
      { name: 'Remarkable Athlete', description: 'Add half prof bonus to STR, DEX, CON checks. Running jump dist increases by STR mod.', level: 7, source: 'Champion', modifiers: [{ type: 'passive', description: 'Add half prof to STR/DEX/CON checks.' }] },
      { name: 'Additional Fighting Style', description: 'Choose a second option from the Fighting Style class feature.', level: 10, source: 'Champion', choiceType: 'fighting_style', choiceCount: 1 },
      { name: 'Superior Critical', description: 'Your weapon attacks score a critical hit on a roll of 18-20.', level: 15, source: 'Champion', modifiers: [{ type: 'expand_crit_range', minRoll: 18 }] },
      { name: 'Survivor', description: 'At start of turn if you have less than half HP, regain 5 + CON mod HP.', level: 18, source: 'Champion', modifiers: [{ type: 'passive', description: 'Regain 5 + CON mod HP per turn when below half HP.' }] }
    ]
  },
  {
    id: 'battle_master', name: 'Battle Master', className: 'Fighter',
    description: 'Tacticians who use maneuvers to outwit and outfight opponents.',
    features: [
      { name: 'Combat Superiority', description: 'Learn 3 maneuvers. Gain 4 d8 superiority dice.', level: 3, source: 'Battle Master', choiceType: 'maneuver', choiceCount: 3, modifiers: [{ type: 'add_resource', resourceId: 'superiority_dice', name: 'Superiority Dice', max: 4, recharge: 'short', description: 'd8 superiority dice' }] },
      { name: 'Student of War', description: 'Proficiency with one artisan\'s tools.', level: 3, source: 'Battle Master', modifiers: [{ type: 'grant_proficiency', category: 'tool', value: 'Artisan_Tools' }] },
      { name: 'Know Your Enemy', description: 'Observing a creature outside combat for 1 minute reveals relative stats.', level: 7, source: 'Battle Master', modifiers: [{ type: 'passive', description: 'Determine relative stats by observing.' }] },
      { name: 'Improved Combat Superiority (d10)', description: 'Superiority dice become d10s.', level: 10, source: 'Battle Master', modifiers: [{ type: 'upgrade_resource_die', resourceId: 'superiority_dice', newDie: 'd10' }] },
      { name: 'Relentless', description: 'If you roll initiative with no superiority dice, gain 1.', level: 15, source: 'Battle Master', modifiers: [{ type: 'passive', description: 'Regain 1 die on initiative if empty.' }] },
      { name: 'Improved Combat Superiority (d12)', description: 'Superiority dice become d12s.', level: 18, source: 'Battle Master', modifiers: [{ type: 'upgrade_resource_die', resourceId: 'superiority_dice', newDie: 'd12' }] }
    ]
  },
  {
    id: 'eldritch_knight', name: 'Eldritch Knight', className: 'Fighter',
    description: 'Fighters who employ arcane magic (Abjuration and Evocation) to bolster martial prowess.',
    features: [
      { name: 'Spellcasting', description: 'Learn wizard cantrips and spells (third-caster).', level: 3, source: 'Eldritch Knight', modifiers: [{ type: 'grant_third_caster', spellList: 'Wizard', allowedSchools: ['Abjuration', 'Evocation'], freeSchoolLevels: [3, 8, 14, 20] }] },
      { name: 'Weapon Bond', description: 'Bond up to 2 weapons. Cannot be disarmed. Bonus action to summon.', level: 3, source: 'Eldritch Knight', modifiers: [{ type: 'passive', description: 'Cannot be disarmed, bonus action summon weapon.' }] },
      { name: 'War Magic', description: 'When you cast a cantrip, make a weapon attack as a bonus action.', level: 7, source: 'Eldritch Knight', modifiers: [{ type: 'passive', description: 'Bonus action attack after cantrip.' }] },
      { name: 'Eldritch Strike', description: 'When you hit a creature with a weapon, give it disadvantage on next save vs your spell.', level: 10, source: 'Eldritch Knight', modifiers: [{ type: 'passive', description: 'Weapon hit gives disadvantage on spell save.' }] },
      { name: 'Arcane Charge', description: 'When using Action Surge, teleport up to 30 ft.', level: 15, source: 'Eldritch Knight', modifiers: [{ type: 'passive', description: 'Action Surge grants 30 ft teleport.' }] },
      { name: 'Improved War Magic', description: 'When you cast a spell, make a weapon attack as a bonus action.', level: 18, source: 'Eldritch Knight', modifiers: [{ type: 'passive', description: 'Bonus action attack after spell.' }] }
    ]
  }
];
