import { SubclassFeatureSet } from './subclass-features';

export const WARLOCK_SUBCLASSES: SubclassFeatureSet[] = [
  {
    id: 'the_fiend', name: 'The Fiend', className: 'Warlock',
    description: 'Pact with a being from the lower planes of existence.',
    features: [
      { name: 'Expanded Spell List', description: 'The Fiend lets you choose from an expanded list of spells.', level: 1, source: 'The Fiend', modifiers: [{ type: 'expanded_spell_list', spells: [{ level: 1, spellIds: ['burning_hands', 'command'] }, { level: 2, spellIds: ['blindness_deafness', 'scorching_ray'] }, { level: 3, spellIds: ['fireball', 'stinking_cloud'] }, { level: 4, spellIds: ['fire_shield', 'wall_of_fire'] }, { level: 5, spellIds: ['flame_strike', 'hallow'] }] }] },
      { name: 'Dark One\'s Blessing', description: 'When you reduce a hostile creature to 0 HP, gain temp HP equal to CHA mod + warlock level.', level: 1, source: 'The Fiend', modifiers: [{ type: 'passive', description: 'Gain THP on kill.' }] },
      { name: 'Dark One\'s Own Luck', description: 'Call on patron to add 1d10 to an ability check or save. 1/short rest.', level: 6, source: 'The Fiend', modifiers: [{ type: 'add_resource', resourceId: 'dark_ones_luck', name: 'Dark One\'s Luck', max: 1, recharge: 'short', description: 'Add 1d10 to check/save' }] },
      { name: 'Fiendish Resilience', description: 'Choose one damage type to gain resistance to at the end of a short/long rest. Magical/silver weapons bypass.', level: 10, source: 'The Fiend', modifiers: [{ type: 'passive', description: 'Choose damage resistance on rest.' }] },
      { name: 'Hurl Through Hell', description: 'When you hit with an attack, transport target to lower planes. Returns next turn and takes 10d10 psychic dmg (no save). 1/long rest.', level: 14, source: 'The Fiend', modifiers: [{ type: 'add_resource', resourceId: 'hurl_through_hell', name: 'Hurl Through Hell', max: 1, recharge: 'long', description: 'Transport foe to hell (10d10 psychic)' }] }
    ]
  },
  {
    id: 'the_archfey', name: 'The Archfey', className: 'Warlock',
    description: 'Pact with a lord or lady of the fey, a creature of legend.',
    features: [
      { name: 'Expanded Spell List', description: 'The Archfey lets you choose from an expanded list of spells.', level: 1, source: 'The Archfey', modifiers: [{ type: 'expanded_spell_list', spells: [{ level: 1, spellIds: ['faerie_fire', 'sleep'] }, { level: 2, spellIds: ['calm_emotions', 'phantasmal_force'] }, { level: 3, spellIds: ['blink', 'plant_growth'] }, { level: 4, spellIds: ['dominate_beast', 'greater_invisibility'] }, { level: 5, spellIds: ['dominate_person', 'seeming'] }] }] },
      { name: 'Fey Presence', description: 'Action to cause creatures in 10ft cube to make a WIS save or be charmed or frightened until end of next turn. 1/short rest.', level: 1, source: 'The Archfey', modifiers: [{ type: 'add_resource', resourceId: 'fey_presence', name: 'Fey Presence', max: 1, recharge: 'short', description: 'Charm/Frighten AoE' }] },
      { name: 'Misty Escape', description: 'When damaged, reaction to turn invisible and teleport up to 60ft. Invisible until next turn or attack/cast. 1/short rest.', level: 6, source: 'The Archfey', modifiers: [{ type: 'add_resource', resourceId: 'misty_escape', name: 'Misty Escape', max: 1, recharge: 'short', actionCost: 'reaction', description: 'Teleport and turn invisible on damage' }] },
      { name: 'Beguiling Defenses', description: 'Immune to being charmed. When a creature tries to charm you, use reaction to turn it back on them (WIS save or charmed by you for 1 min).', level: 10, source: 'The Archfey', modifiers: [{ type: 'grant_immunity', condition: 'charmed' }, { type: 'passive', description: 'Reaction to reflect charm attempt.' }] },
      { name: 'Dark Delirium', description: 'Action to cast a creature into an illusory realm (WIS save). Target thinks it is lost in fog for 1 min (concentration). 1/short rest.', level: 14, source: 'The Archfey', modifiers: [{ type: 'add_resource', resourceId: 'dark_delirium', name: 'Dark Delirium', max: 1, recharge: 'short', actionCost: 'action', description: 'Trap creature in illusion' }] }
    ]
  },
  {
    id: 'the_great_old_one', name: 'The Great Old One', className: 'Warlock',
    description: 'Pact with an ancient entity whose nature is utterly foreign to the fabric of reality.',
    features: [
      { name: 'Expanded Spell List', description: 'The Great Old One lets you choose from an expanded list of spells.', level: 1, source: 'The Great Old One', modifiers: [{ type: 'expanded_spell_list', spells: [{ level: 1, spellIds: ['dissonant_whispers', 'tashas_hideous_laughter'] }, { level: 2, spellIds: ['detect_thoughts', 'phantasmal_force'] }, { level: 3, spellIds: ['clairvoyance', 'sending'] }, { level: 4, spellIds: ['dominate_beast', 'evards_black_tentacles'] }, { level: 5, spellIds: ['dominate_person', 'telekinesis'] }] }] },
      { name: 'Awakened Mind', description: 'Communicate telepathically with any creature within 30ft.', level: 1, source: 'The Great Old One', modifiers: [{ type: 'passive', description: 'Telepathy (30 ft).' }] },
      { name: 'Entropic Ward', description: 'Reaction to impose disadvantage on attack against you. If it misses, you have adv on next attack against them. 1/short rest.', level: 6, source: 'The Great Old One', modifiers: [{ type: 'add_resource', resourceId: 'entropic_ward', name: 'Entropic Ward', max: 1, recharge: 'short', actionCost: 'reaction', description: 'Disadvantage on incoming attack' }] },
      { name: 'Thought Shield', description: 'Thoughts can\'t be read. Resistance to psychic damage. Retaliate psychic damage to attacker.', level: 10, source: 'The Great Old One', modifiers: [{ type: 'grant_resistance', damageType: 'psychic' }, { type: 'passive', description: 'Thoughts protected, reflect psychic damage.' }] },
      { name: 'Create Thrall', description: 'Action to touch an incapacitated humanoid. It is charmed by you until remove curse cast on it. Telepathic link.', level: 14, source: 'The Great Old One', modifiers: [{ type: 'passive', description: 'Permanently charm incapacitated humanoid.' }] }
    ]
  }
];
