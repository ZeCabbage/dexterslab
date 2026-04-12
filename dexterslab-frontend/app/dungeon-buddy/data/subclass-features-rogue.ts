import { SubclassFeatureSet } from './subclass-features';

export const ROGUE_SUBCLASSES: SubclassFeatureSet[] = [
  {
    id: 'thief', name: 'Thief', className: 'Rogue',
    description: 'Masters of burglary, picking locks, and infiltrating.',
    features: [
      { name: 'Fast Hands', description: 'Use Cunning Action (bonus action) to make a Sleight of Hand check, use thieves tools, or Use an Object.', level: 3, source: 'Thief', modifiers: [{ type: 'passive', description: 'Bonus action Use Object.' }] },
      { name: 'Second-Story Work', description: 'Climb without speed penalty. Running jump dist increases by DEX mod.', level: 3, source: 'Thief', modifiers: [{ type: 'passive', description: 'Climb at normal speed. Jump further.' }] },
      { name: 'Supreme Sneak', description: 'Advantage on Stealth checks if you move max half your speed.', level: 9, source: 'Thief', modifiers: [{ type: 'passive', description: 'Advantage on Stealth when moving slowly.' }] },
      { name: 'Use Magic Device', description: 'Ignore all class, race, and level requirements for magic items.', level: 13, source: 'Thief', modifiers: [{ type: 'passive', description: 'Ignore magic item requirements.' }] },
      { name: 'Thief\'s Reflexes', description: 'Take two turns during the first round of combat (at your initiative and initiative - 10).', level: 17, source: 'Thief', modifiers: [{ type: 'passive', description: 'Take two turns in round 1.' }] }
    ]
  },
  {
    id: 'assassin', name: 'Assassin', className: 'Rogue',
    description: 'Masters of poison, disguise, and deadly strikes.',
    features: [
      { name: 'Bonus Proficiencies', description: 'Proficiency with disguise kit and poisoner\'s kit.', level: 3, source: 'Assassin', modifiers: [{ type: 'grant_proficiency', category: 'tool', value: 'Disguise_Kit' }, { type: 'grant_proficiency', category: 'tool', value: 'Poisoners_Kit' }] },
      { name: 'Assassinate', description: 'Advantage on attacks vs creatures that haven\'t taken a turn. Any hit on a surprised creature is a critical hit.', level: 3, source: 'Assassin', modifiers: [{ type: 'passive', description: 'Advantage if enemy hasn\'t acted. Auto-crit surprised.' }] },
      { name: 'Infiltration Expertise', description: 'Spend 7 days and 25gp to create a false identity.', level: 9, source: 'Assassin', modifiers: [{ type: 'passive', description: 'Create false identities.' }] },
      { name: 'Impostor', description: 'Mimic another person\'s speech, writing, and behavior perfectly after 3 hrs study.', level: 13, source: 'Assassin', modifiers: [{ type: 'passive', description: 'Mimic people perfectly.' }] },
      { name: 'Death Strike', description: 'When you hit a surprised creature, it must CON save or the attack\'s damage is doubled.', level: 17, source: 'Assassin', modifiers: [{ type: 'passive', description: 'Surprised creature CON save or double damage.' }] }
    ]
  },
  {
    id: 'arcane_trickster', name: 'Arcane Trickster', className: 'Rogue',
    description: 'Rogues enhanced by illusion and enchantment magic.',
    features: [
      { name: 'Spellcasting', description: 'Learn wizard cantrips (including Mage Hand) and spells (third-caster).', level: 3, source: 'Arcane Trickster', modifiers: [{ type: 'grant_third_caster', spellList: 'Wizard', allowedSchools: ['Enchantment', 'Illusion'], freeSchoolLevels: [3, 8, 14, 20] }, { type: 'grant_cantrip', cantrip: 'mage_hand', source: 'Arcane Trickster' }] },
      { name: 'Mage Hand Legerdemain', description: 'Mage hand is invisible. Can use it to stow/retrieve objects from containers or pick locks/disarm traps at range.', level: 3, source: 'Arcane Trickster', modifiers: [{ type: 'passive', description: 'Invisible Mage Hand, can pick locks at range.' }] },
      { name: 'Magical Ambush', description: 'If hidden from a creature when casting a spell on it, it has disadvantage on the save.', level: 9, source: 'Arcane Trickster', modifiers: [{ type: 'passive', description: 'Hidden casting imposes disadvantage on save.' }] },
      { name: 'Versatile Trickster', description: 'Bonus action to distract a creature with your Mage Hand, giving you advantage on attacks against it.', level: 13, source: 'Arcane Trickster', modifiers: [{ type: 'passive', description: 'Bonus action Mage Hand distract grants attack advantage.' }] },
      { name: 'Spell Thief', description: 'Reaction when targeted by a spell (or in its area) to force a save. On failure, you negate it and steal the knowledge of how to cast it for 8 hrs.', level: 17, source: 'Arcane Trickster', modifiers: [{ type: 'passive', description: 'Reaction to steal spell.' }] }
    ]
  }
];
