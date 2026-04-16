import { SubclassFeatureSet } from './subclass-features';

export const SORCERER_SUBCLASSES: SubclassFeatureSet[] = [
  {
    id: 'draconic_bloodline', name: 'Draconic Bloodline', className: 'Sorcerer',
    description: 'Magic drawn from the ancient power of dragons.',
    features: [
      { name: 'Dragon Ancestor', description: 'Choose a dragon type. Speak/read/write Draconic. Double prof bonus on CHA checks vs dragons.', level: 1, source: 'Draconic Bloodline', choiceType: 'draconic_ancestry', choiceCount: 1 },
      { name: 'Draconic Resilience', description: 'Max HP increases by 1 per level. AC equals 13 + DEX when not wearing armor.', level: 1, source: 'Draconic Bloodline', modifiers: [{ type: 'grant_extra_hp', formula: 'class_level' }, { type: 'set_ac_formula', formula: '13+dex' }] },
      { name: 'Elemental Affinity', description: 'Add Charisma modifier to one damage roll of spells associated with your draconic ancestry. Can spend 1 sorcery point to gain resistance to that damage type for 1 hr.', level: 6, source: 'Draconic Bloodline', modifiers: [{ type: 'passive', description: 'Add CHA mod to ancestor damage type. Spend SP for resistance.' }] },
      { name: 'Dragon Wings', description: 'Bonus action to sprout wings, gaining fly speed equal to walking speed.', level: 14, source: 'Draconic Bloodline', modifiers: [{ type: 'passive', description: 'Bonus action sprout wings for fly speed.' }] },
      { name: 'Draconic Presence', description: 'Spend 5 sorcery points as an action to exude a 60ft aura of awe or fear (WIS save) for 1 minute.', level: 18, source: 'Draconic Bloodline', modifiers: [{ type: 'passive', description: 'Spend 5 SP for 60ft charm/fear aura.' }] }
    ]
  },
  {
    id: 'wild_magic', name: 'Wild Magic', className: 'Sorcerer',
    description: 'Magic that surges from the forces of chaos.',
    features: [
      { name: 'Wild Magic Surge', description: 'Your spellcasting can unleash surges of untamed magic. DM can have you roll a d20 after casting a sorcerer spell of 1st level or higher. If you roll a 1, roll on the Wild Magic Surge table.', level: 1, source: 'Wild Magic', modifiers: [{ type: 'wild_magic_surge', description: 'Roll d100 on Wild Surge table when triggered' }] },
      { name: 'Tides of Chaos', description: 'Gain advantage on one attack roll, ability check, or saving throw. Regain after long rest, or if DM triggers a Wild Magic Surge when you cast a spell.', level: 1, source: 'Wild Magic', modifiers: [{ type: 'add_resource', resourceId: 'tides_of_chaos', name: 'Tides of Chaos', max: 1, recharge: 'none', description: 'Advantage on one roll' }] },
      { name: 'Bend Luck', description: 'When another creature rolls an attack, save, or check, use reaction and spend 2 sorcery points to roll 1d4 and apply it as bonus or penalty.', level: 6, source: 'Wild Magic', modifiers: [{ type: 'passive', description: 'Reaction spend 2 SP to alter roll by 1d4.' }] },
      { name: 'Controlled Chaos', description: 'When rolling on the Wild Magic Surge table, roll twice and choose which result to use.', level: 14, source: 'Wild Magic', modifiers: [{ type: 'passive', description: 'Roll Wild Surge twice, choose result.' }] },
      { name: 'Spell Bombardment', description: 'When rolling spell damage, if you roll maximum on a die, you can roll one additional die and add it.', level: 18, source: 'Wild Magic', modifiers: [{ type: 'passive', description: 'Extra die if damage die rolls max.' }] }
    ]
  }
];
