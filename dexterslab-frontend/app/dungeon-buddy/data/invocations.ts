import { FeatureData } from '../lib/types';

export const ELDRITCH_INVOCATIONS: Record<string, FeatureData> = {
  agonizing_blast: {
    id: 'agonizing_blast',
    name: 'Agonizing Blast',
    description: 'When you cast eldritch blast, add your Charisma modifier to the damage it deals on a hit.',
    level: 2,
    modifiers: [{ type: 'add_damage_ability', target: 'eldritch blast', ability: 'cha' }],
    choices: []
  },
  eldritch_spear: {
    id: 'eldritch_spear',
    name: 'Eldritch Spear',
    description: 'When you cast eldritch blast, its range is 300 feet.',
    level: 2,
    modifiers: [{ type: 'add_range', target: 'eldritch blast', value: 300 }],
    choices: []
  },
  armor_of_shadows: {
    id: 'armor_of_shadows',
    name: 'Armor of Shadows',
    description: 'You can cast mage armor on yourself at will, without expending a spell slot or material components.',
    level: 2,
    modifiers: [{ type: 'cast_w_slot', target: 'self', spell: 'mage armor' }]
  },
  beguiling_influence: {
    id: 'beguiling_influence',
    name: 'Beguiling Influence',
    description: 'You gain proficiency in the Deception and Persuasion skills.',
    level: 2,
    modifiers: [
      { type: 'grant_skill', target: 'Deception' },
      { type: 'grant_skill', target: 'Persuasion' }
    ]
  },
  repelling_blast: {
    id: 'repelling_blast',
    name: 'Repelling Blast',
    description: 'When you hit a creature with eldritch blast, you can push the creature up to 10 feet away from you in a straight line.',
    level: 2
  }
};
