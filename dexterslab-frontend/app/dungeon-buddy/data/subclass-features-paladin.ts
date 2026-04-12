import { SubclassFeatureSet } from './subclass-features';

export const PALADIN_SUBCLASSES: SubclassFeatureSet[] = [
  {
    id: 'oath_of_devotion', name: 'Oath of Devotion', className: 'Paladin',
    description: 'Knights in shining armor, defending justice and purity.',
    features: [
      { name: 'Oath Spells', description: 'Always prepared: protection from evil and good, sanctuary.', level: 3, source: 'Oath of Devotion', modifiers: [{ type: 'grant_spells_always_prepared', spells: ['protection_from_evil_and_good', 'sanctuary'] }] },
      { name: 'Channel Divinity', description: 'Sacred Weapon (add CHA mod to attack rolls for 1 min) or Turn the Unholy (fiends/undead flee for 1 min).', level: 3, source: 'Oath of Devotion', modifiers: [{ type: 'passive', description: 'Sacred Weapon (+CHA to hit) or Turn unholy.' }] },
      { name: 'Aura of Devotion', description: 'You and allies within 10 ft can\'t be charmed. Extends to 30 ft at level 18.', level: 7, source: 'Oath of Devotion', modifiers: [{ type: 'grant_immunity', condition: 'charmed' }, { type: 'passive', description: 'Allies within 10ft are immune to charm.' }] },
      { name: 'Purity of Spirit', description: 'Always under the effects of protection from evil and good.', level: 15, source: 'Oath of Devotion', modifiers: [{ type: 'passive', description: 'Permanent protection from evil and good vs aberrations/celestials/elementals/fey/fiends/undead.' }] },
      { name: 'Holy Nimbus', description: 'Action for 1 min: emit 30ft bright light, start of turn enemy takes 10 radiant. Adv on saves vs fiends/undead. 1/long rest.', level: 20, source: 'Oath of Devotion', modifiers: [{ type: 'passive', description: '1 minute super buff.' }] }
    ]
  },
  {
    id: 'oath_of_the_ancients', name: 'Oath of the Ancients', className: 'Paladin',
    description: 'Fey knights fighting to preserve the light and joy in the world.',
    features: [
      { name: 'Oath Spells', description: 'Always prepared: ensnaring strike, speak with animals.', level: 3, source: 'Oath of the Ancients', modifiers: [{ type: 'grant_spells_always_prepared', spells: ['ensnaring_strike', 'speak_with_animals'] }] },
      { name: 'Channel Divinity', description: 'Nature\'s Wrath (restrain creature) or Turn the Faithless (fey/fiends flee).', level: 3, source: 'Oath of the Ancients', modifiers: [{ type: 'passive', description: 'Restrain enemy or Turn fey/fiends.' }] },
      { name: 'Aura of Warding', description: 'Resistance to damage from spells for you and allies within 10 ft. Extends to 30 ft at level 18.', level: 7, source: 'Oath of the Ancients', modifiers: [{ type: 'passive', description: 'Resistance to spell damage for self and allies.' }] },
      { name: 'Undying Sentinel', description: 'Once per long rest, drop to 1 HP instead of 0. Ignore aging.', level: 15, source: 'Oath of the Ancients', modifiers: [{ type: 'passive', description: 'Drop to 1 HP instead of 0 once per long rest.' }] },
      { name: 'Elder Champion', description: 'Action for 1 min: cast paladin spells as bonus action, enemies in 10ft have disadv on saves vs your paladin spells. 1/long rest.', level: 20, source: 'Oath of the Ancients', modifiers: [{ type: 'passive', description: '1 minute super buff.' }] }
    ]
  },
  {
    id: 'oath_of_vengeance', name: 'Oath of Vengeance', className: 'Paladin',
    description: 'Avenge the wronged, hunting down the wicked at all costs.',
    features: [
      { name: 'Oath Spells', description: 'Always prepared: bane, hunter\'s mark.', level: 3, source: 'Oath of Vengeance', modifiers: [{ type: 'grant_spells_always_prepared', spells: ['bane', 'hunters_mark'] }] },
      { name: 'Channel Divinity', description: 'Abjure Enemy (frighten/reduce speed) or Vow of Enmity (advantage on attacks vs 1 creature for 1 min).', level: 3, source: 'Oath of Vengeance', modifiers: [{ type: 'passive', description: 'Frighten/slow enemy or Vow of Enmity (Advantage vs target).' }] },
      { name: 'Relentless Avenger', description: 'When you hit with opportunity attack, move up to half speed (doesn\'t provoke).', level: 7, source: 'Oath of Vengeance', modifiers: [{ type: 'passive', description: 'Move half speed after opportunity attack.' }] },
      { name: 'Soul of Vengeance', description: 'When creature under Vow of Enmity attacks, use reaction to attack it.', level: 15, source: 'Oath of Vengeance', modifiers: [{ type: 'passive', description: 'Reaction attack when Vow target attacks.' }] },
      { name: 'Avenging Angel', description: 'Action for 1 hr: gain fly speed 60ft, 30ft aura of menace (frighten enemies). 1/long rest.', level: 20, source: 'Oath of Vengeance', modifiers: [{ type: 'passive', description: '1 hour fly speed and frighten aura.' }] }
    ]
  }
];
