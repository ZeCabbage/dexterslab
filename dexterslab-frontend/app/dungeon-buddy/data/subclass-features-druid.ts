import { SubclassFeatureSet } from './subclass-features';

export const DRUID_SUBCLASSES: SubclassFeatureSet[] = [
  {
    id: 'circle_of_the_moon', name: 'Circle of the Moon', className: 'Druid',
    description: 'Fierce guardians of the wilds who seamlessly meld their forms with beasts.',
    features: [
      { name: 'Combat Wild Shape', description: 'Wild Shape as a bonus action, and expend spell slots to heal 1d8 per level while in beast form.', level: 2, source: 'Circle of the Moon', modifiers: [{ type: 'passive', description: 'Bonus action Wild Shape. Bonus action heal while shifted.' }] },
      { name: 'Circle Forms', description: 'Wild Shape into more dangerous beasts (CR 1). Scales with level.', level: 2, source: 'Circle of the Moon', modifiers: [{ type: 'passive', description: 'Increases Wild Shape CR limit.' }] },
      { name: 'Primal Strike', description: 'Attacks in beast form count as magical.', level: 6, source: 'Circle of the Moon', modifiers: [{ type: 'wild_shape_enhancement', enhancement: 'magical_attacks', details: 'Beast form attacks are magical' }] },
      { name: 'Elemental Wild Shape', description: 'Expend two Wild Shape uses to transform into a water, fire, earth, or air elemental.', level: 10, source: 'Circle of the Moon', modifiers: [{ type: 'passive', description: 'Can transform into elementals.' }] },
      { name: 'Thousand Forms', description: 'Cast Alter Self at will.', level: 14, source: 'Circle of the Moon', modifiers: [{ type: 'grant_spells_always_prepared', spells: ['alter_self'] }] }
    ]
  },
  {
    id: 'circle_of_the_land', name: 'Circle of the Land', className: 'Druid',
    description: 'Mystics tied to specific environments, learning ancient rites to bolster spellcasting.',
    features: [
      { name: 'Bonus Cantrip', description: 'Learn one additional druid cantrip.', level: 2, source: 'Circle of the Land', modifiers: [{ type: 'grant_cantrip', cantrip: 'druid_cantrip', source: 'Circle of the Land' }] },
      { name: 'Natural Recovery', description: 'Recover spell slots (half druid level) on a short rest once per day.', level: 2, source: 'Circle of the Land', modifiers: [{ type: 'passive', description: 'Recover spell slots on short rest once per day.' }] },
      { name: 'Circle Spells', description: 'Choose a land type. Gain prepared spells based on land.', level: 3, source: 'Circle of the Land', choiceType: 'land_type', choiceCount: 1 },
      { name: "Land's Stride", description: 'Move through nonmagical difficult terrain without penalty. Adv on saves vs magical plants.', level: 6, source: 'Circle of the Land', modifiers: [{ type: 'passive', description: 'Ignore nonmagical difficult terrain. Advantage vs magical plants.' }] },
      { name: "Nature's Ward", description: 'Can\'t be charmed/frightened by elementals/fey. Immune to poison/disease.', level: 10, source: 'Circle of the Land', modifiers: [{ type: 'grant_immunity', condition: 'poison' }, { type: 'grant_immunity', condition: 'disease' }, { type: 'passive', description: 'Immune to charm/frighten from elementals and fey.' }] },
      { name: "Nature's Sanctuary", description: 'Beasts/plants attacking you must make a WIS save or attack another target/auto miss.', level: 14, source: 'Circle of the Land', modifiers: [{ type: 'passive', description: 'Beasts/plants must save to attack you.' }] }
    ]
  },
  {
    id: 'circle_of_spores', name: 'Circle of Spores', className: 'Druid',
    description: 'Druids who find beauty and power in decay and fungal life.',
    features: [
      { name: 'Circle Spells', description: 'Learn chill touch cantrip. Always prepare certain spells.', level: 2, source: 'Circle of Spores', modifiers: [{ type: 'grant_cantrip', cantrip: 'chill_touch', source: 'Circle of Spores' }, { type: 'grant_spells_always_prepared', spells: ['blindness_deafness', 'gentle_repose', 'animate_dead', 'gaseous_form', 'blight', 'confusion', 'cloudkill', 'contagion'] }] },
      { name: 'Halo of Spores', description: 'Reaction to deal 1d4 necrotic (CON save negates) to adjacent creature.', level: 2, source: 'Circle of Spores', modifiers: [{ type: 'add_resource', resourceId: 'halo_of_spores', name: 'Halo of Spores', max: 0, recharge: 'none', actionCost: 'reaction', description: '1d4/1d6/1d8/1d10 necrotic (CON save)' }] },
      { name: 'Symbiotic Entity', description: 'Use Wild Shape to gain 4 temp HP per level, double Halo of Spores damage, and +1d6 necrotic to melee hits for 10 min.', level: 2, source: 'Circle of Spores', modifiers: [{ type: 'passive', description: 'Gain THP, buff Halo of Spores, +1d6 necrotic to melee hits.' }] },
      { name: 'Fungal Infestation', description: 'Reaction to animate a humanoid corpse as a zombie with 1 HP. WIS mod uses.', level: 6, source: 'Circle of Spores', modifiers: [{ type: 'add_resource', resourceId: 'fungal_infestation', name: 'Fungal Infestation', max: 1, recharge: 'long', actionCost: 'reaction', description: 'Animate a zombie on reaction' }, { type: 'scale_resource', resourceId: 'fungal_infestation', maxFormula: 'wis_mod' }] },
      { name: 'Spreading Spores', description: 'Bonus action to drop 10ft cube of spores. Deals Halo damage. Symbiotic Entity must be active.', level: 10, source: 'Circle of Spores', modifiers: [{ type: 'passive', description: 'Create 10ft Spore area.' }] },
      { name: 'Fungal Body', description: 'Immune to blinded, deafened, frightened, poisoned. Crits against you become normal hits.', level: 14, source: 'Circle of Spores', modifiers: [{ type: 'grant_immunity', condition: 'blinded' }, { type: 'grant_immunity', condition: 'deafened' }, { type: 'grant_immunity', condition: 'frightened' }, { type: 'grant_immunity', condition: 'poisoned' }, { type: 'passive', description: 'Crits become normal hits.' }] }
    ]
  }
];
