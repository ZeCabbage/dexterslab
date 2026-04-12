import { SubclassFeatureSet } from './subclass-features';

export const CLERIC_SUBCLASSES: SubclassFeatureSet[] = [
  {
    id: 'life_domain', name: 'Life Domain', className: 'Cleric',
    description: 'Devoted to sustaining life and healing the injured.',
    features: [
      { name: 'Bonus Proficiencies', description: 'Heavy armor proficiency.', level: 1, source: 'Life Domain', modifiers: [{ type: 'grant_proficiency', category: 'armor', value: 'Heavy' }] },
      { name: 'Disciple of Life', description: 'Healing spells cure 2 + spell level extra HP.', level: 1, source: 'Life Domain', modifiers: [{ type: 'passive', description: 'Healing spells cure 2 + spell level extra HP.' }] },
      { name: 'Channel Divinity: Preserve Life', description: 'Heal 5 × cleric level, divide among creatures up to half max HP.', level: 2, source: 'Life Domain', modifiers: [{ type: 'passive', description: 'Channel Divinity: AoE heal up to half max HP.' }] },
      { name: 'Blessed Healer', description: 'Healing spells cast on others heal you 2 + spell level.', level: 6, source: 'Life Domain', modifiers: [{ type: 'passive', description: 'Healing spells cast on others heal you 2 + spell level.' }] },
      { name: 'Divine Strike', description: 'Once per turn weapon hit deals +1d8 radiant. +2d8 at L14.', level: 8, source: 'Life Domain', modifiers: [{ type: 'add_conditional_damage', target: 'melee', dice: '1d8', damageType: 'radiant', condition: 'Once per turn on hit' }] },
      { name: 'Supreme Healing', description: 'Healing spells maximize their dice.', level: 17, source: 'Life Domain', modifiers: [{ type: 'passive', description: 'Healing spells maximize their dice.' }] }
    ]
  },
  {
    id: 'light_domain', name: 'Light Domain', className: 'Cleric',
    description: 'Beacons against darkness, burning foes with radiant light.',
    features: [
      { name: 'Bonus Cantrip', description: 'Learn the Light cantrip.', level: 1, source: 'Light Domain', modifiers: [{ type: 'grant_cantrip', cantrip: 'light', source: 'Light Domain' }] },
      { name: 'Warding Flare', description: 'Reaction to impose disadvantage on attacker. WIS mod per day.', level: 1, source: 'Light Domain', modifiers: [{ type: 'add_resource', resourceId: 'warding_flare', name: 'Warding Flare', max: 1, recharge: 'long', description: 'Impose disadvantage on attack' }, { type: 'scale_resource', resourceId: 'warding_flare', maxFormula: 'wis_mod' }] },
      { name: 'Channel Divinity: Radiance of the Dawn', description: 'Dispels magical darkness. 2d10 + cleric level radiant damage (CON save half).', level: 2, source: 'Light Domain', modifiers: [{ type: 'passive', description: 'Channel Divinity: 2d10 + lvl radiant AoE' }] },
      { name: 'Improved Warding Flare', description: 'Use Warding Flare when an ally is attacked.', level: 6, source: 'Light Domain', modifiers: [{ type: 'passive', description: 'Warding Flare works to defend allies.' }] },
      { name: 'Potent Spellcasting', description: 'Add WIS mod to cleric cantrip damage.', level: 8, source: 'Light Domain', modifiers: [{ type: 'add_damage_ability', target: 'cantrips', ability: 'wis' }] },
      { name: 'Corona of Light', description: 'Emit 60ft bright light for 1 min. Enemies have disadvantage vs fire/radiant spells.', level: 17, source: 'Light Domain', modifiers: [{ type: 'passive', description: 'Emit light, enemies have disadvantage vs fire/radiant.' }] }
    ]
  },
  {
    id: 'trickery_domain', name: 'Trickery Domain', className: 'Cleric',
    description: 'Masters of illusion and stealth.',
    features: [
      { name: 'Blessing of the Trickster', description: 'Give another creature advantage on Stealth checks for 1 hr.', level: 1, source: 'Trickery Domain', modifiers: [{ type: 'passive', description: 'Grant advantage on Stealth checks for 1 hr.' }] },
      { name: 'Channel Divinity: Invoke Duplicity', description: 'Create an illusory duplicate for 1 min (concentration). Can cast spells from its space.', level: 2, source: 'Trickery Domain', modifiers: [{ type: 'passive', description: 'Channel Divinity: Illusory duplicate.' }] },
      { name: 'Channel Divinity: Cloak of Shadows', description: 'Become invisible until attack/cast or next turn.', level: 6, source: 'Trickery Domain', modifiers: [{ type: 'passive', description: 'Channel Divinity: Become invisible.' }] },
      { name: 'Divine Strike', description: 'Once per turn weapon hit deals +1d8 poison. +2d8 at L14.', level: 8, source: 'Trickery Domain', modifiers: [{ type: 'add_conditional_damage', target: 'melee', dice: '1d8', damageType: 'poison', condition: 'Once per turn on hit' }] },
      { name: 'Improved Duplicity', description: 'Create up to four duplicates.', level: 17, source: 'Trickery Domain', modifiers: [{ type: 'passive', description: 'Invoke Duplicity creates four duplicates.' }] }
    ]
  },
  {
    id: 'tempest_domain', name: 'Tempest Domain', className: 'Cleric',
    description: 'Wielding the furious power of storms.',
    features: [
      { name: 'Bonus Proficiencies', description: 'Martial weapons and heavy armor.', level: 1, source: 'Tempest Domain', modifiers: [{ type: 'grant_proficiency', category: 'weapon', value: 'Martial' }, { type: 'grant_proficiency', category: 'armor', value: 'Heavy' }] },
      { name: 'Wrath of the Storm', description: 'Reaction on hit: 2d8 lightning/thunder (DEX save half). WIS mod uses.', level: 1, source: 'Tempest Domain', modifiers: [{ type: 'add_resource', resourceId: 'wrath_of_the_storm', name: 'Wrath of the Storm', max: 1, recharge: 'long', description: 'Reaction damage to attacker' }, { type: 'scale_resource', resourceId: 'wrath_of_the_storm', maxFormula: 'wis_mod' }] },
      { name: 'Channel Divinity: Destructive Wrath', description: 'When rolling lightning/thunder dmg, maximize it.', level: 2, source: 'Tempest Domain', modifiers: [{ type: 'passive', description: 'Channel Divinity: Maximize lightning/thunder dmg.' }] },
      { name: 'Thunderous Strike', description: 'Lightning damage pushes Large or smaller creatures 10 ft.', level: 6, source: 'Tempest Domain', modifiers: [{ type: 'passive', description: 'Lightning damage pushes enemies 10 ft.' }] },
      { name: 'Divine Strike', description: 'Once per turn weapon hit deals +1d8 thunder. +2d8 at L14.', level: 8, source: 'Tempest Domain', modifiers: [{ type: 'add_conditional_damage', target: 'melee', dice: '1d8', damageType: 'thunder', condition: 'Once per turn on hit' }] },
      { name: 'Stormborn', description: 'Gain flying speed equal to walking speed outdoors.', level: 17, source: 'Tempest Domain', modifiers: [{ type: 'passive', description: 'Flying speed outdoors.' }] }
    ]
  }
];
