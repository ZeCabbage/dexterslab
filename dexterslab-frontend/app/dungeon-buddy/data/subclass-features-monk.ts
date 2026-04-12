import { SubclassFeatureSet } from './subclass-features';

export const MONK_SUBCLASSES: SubclassFeatureSet[] = [
  {
    id: 'way_of_the_open_hand', name: 'Way of the Open Hand', className: 'Monk',
    description: 'Masters of martial arts combat, pushing/knocking down opponents and manipulating ki.',
    features: [
      { name: 'Open Hand Technique', description: 'When you hit with Flurry of Blows, you can impose an effect: DEX save or prone, STR save or pushed 15ft, or no reactions until end of your next turn.', level: 3, source: 'Way of the Open Hand', modifiers: [{ type: 'passive', description: 'Flurry of Blows adds prone, push, or reaction denial.' }] },
      { name: 'Wholeness of Body', description: 'Once per long rest, use an action to regain HP equal to 3 × monk level.', level: 6, source: 'Way of the Open Hand', modifiers: [{ type: 'add_resource', resourceId: 'wholeness_of_body', name: 'Wholeness of Body', max: 1, recharge: 'long', actionCost: 'action', description: 'Heal 3 × monk level HP' }] },
      { name: 'Tranquility', description: 'Gain sanctuary spell effect at the end of a long rest (DC 8 + WIS mod + prof bonus). Lasts until you attack/cast.', level: 11, source: 'Way of the Open Hand', modifiers: [{ type: 'passive', description: 'Permanent sanctuary effect until broken.' }] },
      { name: 'Quivering Palm', description: 'When you hit with an unarmed strike, spend 3 ki to set fatal vibrations (last monk level days). Use an action to trigger: CON save or 10d10 necrotic (0 HP on fail).', level: 17, source: 'Way of the Open Hand', modifiers: [{ type: 'passive', description: 'Spend 3 ki on hit for Quivering Palm effect.' }] }
    ]
  },
  {
    id: 'way_of_shadow', name: 'Way of Shadow', className: 'Monk',
    description: 'Masters of stealth and subterfuge, using shadows for travel and deception.',
    features: [
      { name: 'Shadow Arts', description: 'Spend 2 ki to cast darkness, darkvision, pass without trace, or silence. Learn minor illusion cantrip.', level: 3, source: 'Way of Shadow', modifiers: [{ type: 'grant_cantrip', cantrip: 'minor_illusion', source: 'Way of Shadow' }, { type: 'passive', description: 'Spend 2 ki for darkness/darkvision/pass without trace/silence.' }] },
      { name: 'Shadow Step', description: 'Bonus action to teleport 60 ft between dim light/darkness. Advantage on first melee attack before end of turn.', level: 6, source: 'Way of Shadow', modifiers: [{ type: 'passive', description: 'Bonus action teleport 60ft in shadows, gain advantage.' }] },
      { name: 'Cloak of Shadows', description: 'Action to become invisible in dim light or darkness. Lasts until you attack, cast, or enter bright light.', level: 11, source: 'Way of Shadow', modifiers: [{ type: 'passive', description: 'Action to turn invisible in shadows.' }] },
      { name: 'Opportunist', description: 'Reaction to make an attack against a creature hit by an attack made by someone else.', level: 17, source: 'Way of Shadow', modifiers: [{ type: 'passive', description: 'Reaction attack when ally hits enemy.' }] }
    ]
  },
  {
    id: 'way_of_the_four_elements', name: 'Way of the Four Elements', className: 'Monk',
    description: 'Focus ki to wield elemental forces.',
    features: [
      { name: 'Disciple of the Elements', description: 'Learn elemental disciplines to channel ki into magical effects.', level: 3, source: 'Way of the Four Elements', choiceType: 'elemental_discipline', choiceCount: 1, modifiers: [{ type: 'passive', description: 'Use ki for elemental disciplines.' }] },
      { name: 'Elemental Disciplines', description: 'Learn another discipline at levels 6, 11, and 17. Max ki spent equals monk level / 4.', level: 6, source: 'Way of the Four Elements', choiceType: 'elemental_discipline', choiceCount: 1 },
      { name: 'Elemental Disciplines', description: 'Learn another discipline at levels 6, 11, and 17.', level: 11, source: 'Way of the Four Elements', choiceType: 'elemental_discipline', choiceCount: 1 },
      { name: 'Elemental Disciplines', description: 'Learn another discipline at levels 6, 11, and 17.', level: 17, source: 'Way of the Four Elements', choiceType: 'elemental_discipline', choiceCount: 1 }
    ]
  }
];
