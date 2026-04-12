import { SubclassFeatureSet } from './subclass-features';

export const BARD_SUBCLASSES: SubclassFeatureSet[] = [
  {
    id: 'college_of_lore', name: 'College of Lore', className: 'Bard',
    description: 'Pursue knowledge, truth, and beauty. Masters of storytelling and scholarly magic.',
    features: [
      { name: 'Bonus Proficiencies', description: 'You gain proficiency with three skills of your choice.', level: 3, source: 'College of Lore', modifiers: [{ type: 'grant_skill', target: '__choice__' }, { type: 'grant_skill', target: '__choice__' }, { type: 'grant_skill', target: '__choice__' }], choiceType: 'totem', choiceCount: 3 },
      { name: 'Cutting Words', description: 'When a creature you can see within 60 feet makes an attack roll, ability check, or damage roll, use reaction to subtract your Bardic Inspiration die from the roll.', level: 3, source: 'College of Lore', modifiers: [{ type: 'passive', description: 'Reaction: subtract Bardic Inspiration die from enemy roll' }] },
      { name: 'Additional Magical Secrets', description: 'Learn two spells from any class. Must be of a level you can cast or a cantrip.', level: 6, source: 'College of Lore', modifiers: [{ type: 'passive', description: 'Learn 2 spells from any class list' }] },
      { name: 'Peerless Skill', description: 'When you make an ability check, you can expend a Bardic Inspiration die and add the roll to your check.', level: 14, source: 'College of Lore', modifiers: [{ type: 'passive', description: 'Add Bardic Inspiration to own ability checks' }] },
    ]
  },
  {
    id: 'college_of_valor', name: 'College of Valor', className: 'Bard',
    description: 'Heroic warrior-bards who inspire courage on the battlefield.',
    features: [
      { name: 'Bonus Proficiencies', description: 'You gain proficiency with medium armor, shields, and martial weapons.', level: 3, source: 'College of Valor', modifiers: [{ type: 'grant_proficiency', category: 'armor', value: 'Medium' }, { type: 'grant_proficiency', category: 'armor', value: 'Shields' }, { type: 'grant_proficiency', category: 'weapon', value: 'Martial' }] },
      { name: 'Combat Inspiration', description: 'Creature with your Bardic Inspiration can add the die to a weapon attack roll or as a reaction to their AC against one attack.', level: 3, source: 'College of Valor', modifiers: [{ type: 'passive', description: 'Bardic Inspiration usable for attack rolls or AC' }] },
      { name: 'Extra Attack', description: 'You can attack twice when you take the Attack action.', level: 6, source: 'College of Valor', modifiers: [{ type: 'grant_extra_attack', source: 'College of Valor', count: 1 }] },
      { name: 'Battle Magic', description: 'When you cast a bard spell as an action, you can make one weapon attack as a bonus action.', level: 14, source: 'College of Valor', modifiers: [{ type: 'passive', description: 'Bonus action weapon attack after casting a spell' }] },
    ]
  },
  {
    id: 'college_of_glamour', name: 'College of Glamour', className: 'Bard',
    description: 'Master the magic of the Feywild with captivating charm.',
    features: [
      { name: 'Mantle of Inspiration', description: 'As a bonus action, expend Bardic Inspiration to grant up to 5 creatures within 60 feet temp HP equal to 2× your bard level. Each can use reaction to move without provoking.', level: 3, source: 'College of Glamour', modifiers: [{ type: 'passive', description: 'Bonus action: grant THP and free movement to allies' }] },
      { name: 'Enthralling Performance', description: 'After 1 minute of performing, charm creatures (WIS save). Charmed creatures idolize you for 1 hour.', level: 3, source: 'College of Glamour', modifiers: [{ type: 'passive', description: '1-minute performance to charm creatures' }] },
      { name: 'Mantle of Majesty', description: 'As a bonus action, cast Command without a spell slot for 1 minute (concentration). While active, cast Command as bonus action each turn.', level: 6, source: 'College of Glamour', modifiers: [{ type: 'add_resource', resourceId: 'mantle_of_majesty', name: 'Mantle of Majesty', max: 1, recharge: 'long', actionCost: 'bonus_action', description: 'Free Command spell for 1 minute' }] },
      { name: 'Unbreakable Majesty', description: 'As a bonus action, assume a majestic presence for 1 minute. Creatures that attack you must make CHA save or choose a different target and waste the attack.', level: 14, source: 'College of Glamour', modifiers: [{ type: 'add_resource', resourceId: 'unbreakable_majesty', name: 'Unbreakable Majesty', max: 1, recharge: 'short', actionCost: 'bonus_action', description: 'CHA save or enemies can\'t target you' }] },
    ]
  },
  {
    id: 'college_of_swords', name: 'College of Swords', className: 'Bard',
    description: 'Daring warrior-entertainers with spectacular blade flourishes.',
    features: [
      { name: 'Bonus Proficiencies', description: 'Medium armor and scimitars. Choose: Dueling or Two-Weapon Fighting style.', level: 3, source: 'College of Swords', modifiers: [{ type: 'grant_proficiency', category: 'armor', value: 'Medium' }, { type: 'grant_proficiency', category: 'weapon', value: 'Scimitar' }], choiceType: 'fighting_style' },
      { name: 'Blade Flourish', description: 'On a melee attack, expend Bardic Inspiration for +die damage and choose: Defensive (+die AC), Slashing (die damage to adjacent), or Mobile (+die to speed, no opportunity attacks).', level: 3, source: 'College of Swords', modifiers: [{ type: 'passive', description: 'Expend Bardic Inspiration for Blade Flourish on melee attack' }] },
      { name: 'Extra Attack', description: 'Attack twice when you take the Attack action.', level: 6, source: 'College of Swords', modifiers: [{ type: 'grant_extra_attack', source: 'College of Swords', count: 1 }] },
      { name: "Master's Flourish", description: 'When you use Blade Flourish, you can roll a d6 instead of expending a Bardic Inspiration die.', level: 14, source: 'College of Swords', modifiers: [{ type: 'passive', description: 'Free d6 for Blade Flourish (saves Bardic Inspiration)' }] },
    ]
  },
  {
    id: 'college_of_whispers', name: 'College of Whispers', className: 'Bard',
    description: 'Harvest knowledge and secrets through shadowy manipulation.',
    features: [
      { name: 'Psychic Blades', description: 'When you hit with a weapon attack, expend Bardic Inspiration to deal extra psychic damage: 2d6 at L3, 3d6 at L5, 5d6 at L10, 8d6 at L15.', level: 3, source: 'College of Whispers', modifiers: [{ type: 'passive', description: 'Expend Bardic Inspiration for +2d6-8d6 psychic on weapon hit' }] },
      { name: 'Words of Terror', description: 'After speaking to a humanoid alone for 1 minute, WIS save or frightened of you or another creature for 1 hour.', level: 3, source: 'College of Whispers', modifiers: [{ type: 'passive', description: 'Frighten humanoid after 1 minute conversation' }] },
      { name: 'Mantle of Whispers', description: 'When a humanoid dies within 30 feet, capture its shadow. Use reaction to assume its appearance for 1 hour. Gain surface-level knowledge.', level: 6, source: 'College of Whispers', modifiers: [{ type: 'add_resource', resourceId: 'mantle_of_whispers', name: 'Mantle of Whispers', max: 1, recharge: 'short', description: 'Assume dead humanoid\'s appearance for 1 hour' }] },
      { name: 'Shadow Lore', description: 'Whisper to a creature, WIS save or charmed for 8 hours, believing you know a deep secret. It obeys you. Once per long rest.', level: 14, source: 'College of Whispers', modifiers: [{ type: 'add_resource', resourceId: 'shadow_lore', name: 'Shadow Lore', max: 1, recharge: 'long', description: 'Charm creature for 8 hours' }] },
    ]
  },
  {
    id: 'college_of_creation', name: 'College of Creation', className: 'Bard',
    description: 'Draw on the primordial power of creation to animate objects.',
    features: [
      { name: 'Mote of Potential', description: 'When you give Bardic Inspiration, the creature also gains a mote: if the die is used on an ability check, roll it twice; attack roll, if it hits, deal thunder damage; saving throw, gain temp HP.', level: 3, source: 'College of Creation', modifiers: [{ type: 'passive', description: 'Bardic Inspiration grants additional effects based on use' }] },
      { name: 'Performance of Creation', description: 'Create one nonmagical item worth up to 20 × bard level GP with a size based on level. Once per long rest (or by spending a 2nd level slot).', level: 3, source: 'College of Creation', modifiers: [{ type: 'add_resource', resourceId: 'performance_of_creation', name: 'Performance of Creation', max: 1, recharge: 'long', description: 'Create a nonmagical item' }] },
      { name: 'Animating Performance', description: 'As an action, animate a Large or smaller nonmagical item. It uses the Dancing Item stat block and obeys your commands. Prof bonus uses per long rest.', level: 6, source: 'College of Creation', modifiers: [{ type: 'add_resource', resourceId: 'animating_performance', name: 'Animating Performance', max: 2, recharge: 'long', actionCost: 'action', description: 'Animate an item as a Dancing Item' }, { type: 'scale_resource', resourceId: 'animating_performance', maxFormula: 'prof_bonus' }] },
      { name: 'Creative Crescendo', description: 'When you use Performance of Creation, you can create prof bonus items at once. One can be worth up to 20 × bard level GP; the rest max 200 GP.', level: 14, source: 'College of Creation', modifiers: [{ type: 'passive', description: 'Create multiple items with Performance of Creation' }] },
    ]
  },
  {
    id: 'college_of_eloquence', name: 'College of Eloquence', className: 'Bard',
    description: 'Master the art of oratory and persuasion.',
    features: [
      { name: 'Silver Tongue', description: 'Treat a roll of 9 or lower on Persuasion or Deception checks as a 10.', level: 3, source: 'College of Eloquence', modifiers: [{ type: 'passive', description: 'Minimum 10 on Persuasion and Deception checks' }] },
      { name: 'Unsettling Words', description: 'As a bonus action, expend Bardic Inspiration to subtract the die from a creature\'s next saving throw before your next turn.', level: 3, source: 'College of Eloquence', modifiers: [{ type: 'passive', description: 'Bonus action: penalize enemy saving throw with Bardic Inspiration' }] },
      { name: 'Unfailing Inspiration', description: 'When a creature adds your Bardic Inspiration die and still fails, it keeps the die.', level: 6, source: 'College of Eloquence', modifiers: [{ type: 'passive', description: 'Bardic Inspiration die is not wasted on failure' }] },
      { name: 'Universal Speech', description: 'Choose prof bonus creatures within 60 feet — they understand you regardless of language for 1 hour. Once per long rest.', level: 6, source: 'College of Eloquence', modifiers: [{ type: 'add_resource', resourceId: 'universal_speech', name: 'Universal Speech', max: 1, recharge: 'long', description: 'All creatures understand you for 1 hour' }] },
      { name: 'Infectious Inspiration', description: 'When a creature succeeds using your Bardic Inspiration, use reaction to give the die to another creature within 60 feet. CHA mod times per long rest.', level: 14, source: 'College of Eloquence', modifiers: [{ type: 'add_resource', resourceId: 'infectious_inspiration', name: 'Infectious Inspiration', max: 3, recharge: 'long', description: 'Pass Bardic Inspiration to another creature on success' }, { type: 'scale_resource', resourceId: 'infectious_inspiration', maxFormula: 'cha_mod' }] },
    ]
  },
  {
    id: 'college_of_spirits', name: 'College of Spirits', className: 'Bard',
    description: 'Commune with the dead to channel their tales and powers.',
    features: [
      { name: 'Guiding Whispers', description: 'Learn guidance cantrip (doesn\'t count against cantrips known). Range becomes 60 feet for you.', level: 3, source: 'College of Spirits', modifiers: [{ type: 'grant_cantrip', cantrip: 'guidance', source: 'College of Spirits' }] },
      { name: 'Spiritual Focus', description: 'You can use a candle, crystal ball, skull, spirit board, or tarokka deck as a spellcasting focus. When you cast a healing or damage spell through it, roll a d6 and add to one roll.', level: 3, source: 'College of Spirits', modifiers: [{ type: 'passive', description: '+1d6 to one healing or damage roll through spiritual focus' }] },
      { name: 'Tales from Beyond', description: 'As a bonus action, expend Bardic Inspiration to roll on the Spirit Tales table for a random beneficial tale effect.', level: 3, source: 'College of Spirits', modifiers: [{ type: 'passive', description: 'Bonus action: roll Spirit Tales table for random effect' }] },
      { name: 'Spirit Session', description: 'Conduct a 1-hour ritual with prof bonus willing creatures to learn one spell from any class until next long rest.', level: 6, source: 'College of Spirits', modifiers: [{ type: 'passive', description: 'Ritual: learn one spell from any class until long rest' }] },
      { name: 'Mystical Connection', description: 'Roll on Spirit Tales twice and choose which tale to use. The d6 from Spiritual Focus becomes a d8 at L6.', level: 14, source: 'College of Spirits', modifiers: [{ type: 'passive', description: 'Roll Spirit Tales twice, choose result' }] },
    ]
  }
];
