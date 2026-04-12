// ═══════════════════════════════════════════════════════════════
//  D&D 5E SRD Data — Dungeon Buddy
//  Core races, classes, backgrounds, and ability score rules.
// ═══════════════════════════════════════════════════════════════

export interface RaceData {
  id: string;
  name: string;
  speed: number;
  abilityBonuses: Partial<Record<AbilityName, number>>;
  traits: string[];
  languages: string[];
  description: string;
  subraces?: SubraceData[];
}

export interface SubraceData {
  id: string;
  name: string;
  abilityBonuses: Partial<Record<AbilityName, number>>;
  traits: string[];
  description: string;
}

export interface SubclassData {
  id: string;
  name: string;
  description: string;
  features: { level: number; name: string; description: string }[];
}

export interface ClassData {
  id: string;
  name: string;
  hitDie: number;
  primaryAbility: AbilityName[];
  savingThrows: AbilityName[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  skillChoices: SkillName[];
  numSkillChoices: number;
  startingHp: number; // hitDie + CON mod at level 1
  description: string;
  features: { level: number; name: string; description: string }[];
  spellcaster: boolean;
  spellcastingAbility?: AbilityName;
  asiLevels?: number[];
  subclassLevel?: number;
  subclassLabel?: string;
  subclasses?: SubclassData[];
  spellSlots?: Record<number, number[]>;
}

export interface BackgroundData {
  id: string;
  name: string;
  skillProficiencies: SkillName[];
  toolProficiencies: string[];
  languages: number; // number of extra languages
  equipment: string[];
  feature: string;
  description: string;
}

export type AbilityName = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type SkillName =
  | 'acrobatics' | 'animal_handling' | 'arcana' | 'athletics'
  | 'deception' | 'history' | 'insight' | 'intimidation'
  | 'investigation' | 'medicine' | 'nature' | 'perception'
  | 'performance' | 'persuasion' | 'religion' | 'sleight_of_hand'
  | 'stealth' | 'survival';

export const ABILITY_NAMES: { key: AbilityName; label: string }[] = [
  { key: 'str', label: 'Strength' },
  { key: 'dex', label: 'Dexterity' },
  { key: 'con', label: 'Constitution' },
  { key: 'int', label: 'Intelligence' },
  { key: 'wis', label: 'Wisdom' },
  { key: 'cha', label: 'Charisma' },
];

export const SKILL_ABILITY_MAP: Record<SkillName, AbilityName> = {
  acrobatics: 'dex', animal_handling: 'wis', arcana: 'int', athletics: 'str',
  deception: 'cha', history: 'int', insight: 'wis', intimidation: 'cha',
  investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis',
  performance: 'cha', persuasion: 'cha', religion: 'int', sleight_of_hand: 'dex',
  stealth: 'dex', survival: 'wis',
};

export const SKILL_LABELS: Record<SkillName, string> = {
  acrobatics: 'Acrobatics', animal_handling: 'Animal Handling', arcana: 'Arcana',
  athletics: 'Athletics', deception: 'Deception', history: 'History',
  insight: 'Insight', intimidation: 'Intimidation', investigation: 'Investigation',
  medicine: 'Medicine', nature: 'Nature', perception: 'Perception',
  performance: 'Performance', persuasion: 'Persuasion', religion: 'Religion',
  sleight_of_hand: 'Sleight of Hand', stealth: 'Stealth', survival: 'Survival',
};

export const POINT_BUY_COSTS: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};
export const POINT_BUY_TOTAL = 27;

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const ASI_LEVELS = {
  default: [4, 8, 12, 16, 19],
  fighter: [4, 6, 8, 12, 14, 16, 19],
  rogue: [4, 8, 10, 12, 16, 19]
};

export const FULL_CASTER_SLOTS: Record<number, number[]> = {
  1: [2], 2: [3], 3: [4,2], 4: [4,3], 5: [4,3,2], 6: [4,3,3],
  7: [4,3,3,1], 8: [4,3,3,2], 9: [4,3,3,3,1], 10: [4,3,3,3,2],
  11: [4,3,3,3,2,1], 12: [4,3,3,3,2,1], 13: [4,3,3,3,2,1,1],
  14: [4,3,3,3,2,1,1], 15: [4,3,3,3,2,1,1,1], 16: [4,3,3,3,2,1,1,1],
  17: [4,3,3,3,2,1,1,1,1], 18: [4,3,3,3,3,1,1,1,1], 19: [4,3,3,3,3,2,1,1,1], 20: [4,3,3,3,3,2,2,1,1]
};

export const HALF_CASTER_SLOTS: Record<number, number[]> = {
  1: [], 2: [2], 3: [3], 4: [3], 5: [4,2], 6: [4,2], 7: [4,3], 8: [4,3], 9: [4,3,2], 10: [4,3,2],
  11: [4,3,3], 12: [4,3,3], 13: [4,3,3,1], 14: [4,3,3,1], 15: [4,3,3,2], 16: [4,3,3,2],
  17: [4,3,3,3,1], 18: [4,3,3,3,1], 19: [4,3,3,3,2], 20: [4,3,3,3,2]
};

// ═══════════════════════════════════════════════
//  RACES
// ═══════════════════════════════════════════════

export const RACES: RaceData[] = [
  {
    id: 'human', name: 'Human', speed: 30,
    abilityBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    traits: ['Extra Language'],
    languages: ['Common', 'One extra'],
    description: 'Humans are the most adaptable and ambitious of the common races. They are diverse in their tastes, morals, and habits.',
  },
  {
    id: 'elf', name: 'Elf', speed: 30,
    abilityBonuses: { dex: 2 },
    traits: ['Darkvision', 'Keen Senses', 'Fey Ancestry', 'Trance'],
    languages: ['Common', 'Elvish'],
    description: 'Elves are a magical people of otherworldly grace, living in the world but not entirely part of it.',
    subraces: [
      { id: 'high_elf', name: 'High Elf', abilityBonuses: { int: 1 }, traits: ['Elf Weapon Training', 'Cantrip', 'Extra Language'], description: 'High elves have a keen mind and a mastery of at least the basics of magic.' },
      { id: 'wood_elf', name: 'Wood Elf', abilityBonuses: { wis: 1 }, traits: ['Elf Weapon Training', 'Fleet of Foot', 'Mask of the Wild'], description: 'Wood elves have keen senses and intuition, and their fleet feet carry them quickly through their native forests.' },
      { id: 'drow', name: 'Drow (Dark Elf)', abilityBonuses: { cha: 1 }, traits: ['Superior Darkvision', 'Sunlight Sensitivity', 'Drow Magic', 'Drow Weapon Training'], description: 'Descended from an earlier subrace of dark-skinned elves, the drow were banished from the surface world.' },
    ],
  },
  {
    id: 'dwarf', name: 'Dwarf', speed: 25,
    abilityBonuses: { con: 2 },
    traits: ['Darkvision', 'Dwarven Resilience', 'Dwarven Combat Training', 'Stonecunning'],
    languages: ['Common', 'Dwarvish'],
    description: 'Bold and hardy, dwarves are known as skilled warriors, miners, and workers of stone and metal.',
    subraces: [
      { id: 'hill_dwarf', name: 'Hill Dwarf', abilityBonuses: { wis: 1 }, traits: ['Dwarven Toughness'], description: 'Hill dwarves have keen senses, deep intuition, and remarkable resilience.' },
      { id: 'mountain_dwarf', name: 'Mountain Dwarf', abilityBonuses: { str: 2 }, traits: ['Dwarven Armor Training'], description: 'Mountain dwarves are strong and hardy, accustomed to a difficult life in rugged terrain.' },
    ],
  },
  {
    id: 'halfling', name: 'Halfling', speed: 25,
    abilityBonuses: { dex: 2 },
    traits: ['Lucky', 'Brave', 'Halfling Nimbleness'],
    languages: ['Common', 'Halfling'],
    description: 'The comforts of home are the goals of most halflings\' lives: a warm hearth, and a place at the table.',
    subraces: [
      { id: 'lightfoot', name: 'Lightfoot', abilityBonuses: { cha: 1 }, traits: ['Naturally Stealthy'], description: 'Lightfoot halflings are adept at slipping unnoticed alongside larger folk.' },
      { id: 'stout', name: 'Stout', abilityBonuses: { con: 1 }, traits: ['Stout Resilience'], description: 'Stout halflings are hardier than average and have some resistance to poison.' },
    ],
  },
  {
    id: 'dragonborn', name: 'Dragonborn', speed: 30,
    abilityBonuses: { str: 2, cha: 1 },
    traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance'],
    languages: ['Common', 'Draconic'],
    description: 'Born of dragons, dragonborn walk proudly through a world that greets them with fearful incomprehension.',
  },
  {
    id: 'gnome', name: 'Gnome', speed: 25,
    abilityBonuses: { int: 2 },
    traits: ['Darkvision', 'Gnome Cunning'],
    languages: ['Common', 'Gnomish'],
    description: 'A gnome\'s energy and enthusiasm for living shines through every inch of their tiny body.',
    subraces: [
      { id: 'rock_gnome', name: 'Rock Gnome', abilityBonuses: { con: 1 }, traits: ['Artificer\'s Lore', 'Tinker'], description: 'Rock gnomes are naturally inventive and hardy.' },
      { id: 'forest_gnome', name: 'Forest Gnome', abilityBonuses: { dex: 1 }, traits: ['Natural Illusionist', 'Speak with Small Beasts'], description: 'Forest gnomes are rare and secretive, using their natural stealth and illusions to hide.' },
    ],
  },
  {
    id: 'half_elf', name: 'Half-Elf', speed: 30,
    abilityBonuses: { cha: 2 },
    traits: ['Darkvision', 'Fey Ancestry', 'Skill Versatility (2 extra skills)'],
    languages: ['Common', 'Elvish', 'One extra'],
    description: 'Half-elves combine the best qualities of their elf and human parents.',
  },
  {
    id: 'half_orc', name: 'Half-Orc', speed: 30,
    abilityBonuses: { str: 2, con: 1 },
    traits: ['Darkvision', 'Menacing', 'Relentless Endurance', 'Savage Attacks'],
    languages: ['Common', 'Orc'],
    description: 'Half-orcs\' grayish pigmentation, sloping foreheads, and jutting jaws mark them for all to see.',
  },
  {
    id: 'tiefling', name: 'Tiefling', speed: 30,
    abilityBonuses: { int: 1, cha: 2 },
    traits: ['Darkvision', 'Hellish Resistance', 'Infernal Legacy'],
    languages: ['Common', 'Infernal'],
    description: 'Tieflings are derived from human bloodlines touched by the powers of the Nine Hells.',
  },
];

// ═══════════════════════════════════════════════
//  CLASSES
// ═══════════════════════════════════════════════

export const CLASSES: ClassData[] = [
  {
    id: 'barbarian', name: 'Barbarian', hitDie: 12, startingHp: 12,
    primaryAbility: ['str'], savingThrows: ['str', 'con'],
    armorProficiencies: ['Light', 'Medium', 'Shields'],
    weaponProficiencies: ['Simple', 'Martial'],
    skillChoices: ['animal_handling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'],
    numSkillChoices: 2, spellcaster: false,
    description: 'A fierce warrior of primitive background who can enter a battle rage.',
    asiLevels: ASI_LEVELS.default, subclassLevel: 3, subclassLabel: 'Primal Path', subclasses: [
        { id: 'path_of_the_berserker', name: 'Path of the Berserker', description: 'A path of untrammeled fury.', features: [] },
        { id: 'path_of_the_totem_warrior', name: 'Path of the Totem Warrior', description: 'Accept a spirit animal as a guide.', features: [] },
        { id: 'path_of_the_ancestral_guardian', name: 'Path of the Ancestral Guardian', description: 'Call on the spirits of your ancestors.', features: [] },
        { id: 'path_of_the_storm_herald', name: 'Path of the Storm Herald', description: 'Learn to transform fury into primal magic.', features: [] },
        { id: 'path_of_the_zealot', name: 'Path of the Zealot', description: 'A warrior inspired by a deity.', features: [] },
        { id: 'path_of_the_beast', name: 'Path of the Beast', description: 'Unleash the beast within.', features: [] },
        { id: 'path_of_wild_magic', name: 'Path of Wild Magic', description: 'Magic surges from your inner power.', features: [] }
      ], spellSlots: undefined,
    features: [
      { level: 1, name: 'Rage', description: 'In battle, you fight with primal ferocity. Bonus damage and resistance.' },
      { level: 1, name: 'Unarmored Defense', description: 'AC = 10 + DEX mod + CON mod without armor.' },
      { level: 2, name: 'Reckless Attack', description: 'Advantage on STR melee attacks this turn, but attacks against you also have advantage.' },
      { level: 2, name: 'Danger Sense', description: 'Advantage on DEX saving throws against effects you can see.' },
      { level: 5, name: 'Extra Attack', description: 'Attack twice on your Attack action.' },
      { level: 5, name: 'Fast Movement', description: '+10 ft. speed when not wearing heavy armor.' },
    ],
  },
  {
    id: 'bard', name: 'Bard', hitDie: 8, startingHp: 8,
    primaryAbility: ['cha'], savingThrows: ['dex', 'cha'],
    armorProficiencies: ['Light'],
    weaponProficiencies: ['Simple', 'Hand Crossbows', 'Longswords', 'Rapiers', 'Shortswords'],
    skillChoices: ['acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight_of_hand', 'stealth', 'survival'],
    numSkillChoices: 3, spellcaster: true, spellcastingAbility: 'cha',
    description: 'An inspiring magician whose power echoes the music of creation.',
    asiLevels: ASI_LEVELS.default, subclassLevel: 3, subclassLabel: 'Bard College', subclasses: [
        { id: 'college_of_lore', name: 'College of Lore', description: 'Pursue knowledge, truth, and beauty.', features: [] },
        { id: 'college_of_valor', name: 'College of Valor', description: 'Sing the deeds of heroes.', features: [] },
        { id: 'college_of_glamour', name: 'College of Glamour', description: 'Master the magic of the Feywild.', features: [] },
        { id: 'college_of_swords', name: 'College of Swords', description: 'Entertain and fight with spectacular blade flourishes.', features: [] },
        { id: 'college_of_whispers', name: 'College of Whispers', description: 'Harvest knowledge and secrets.', features: [] },
        { id: 'college_of_creation', name: 'College of Creation', description: 'Draw on the primordial power of the cosmos.', features: [] },
        { id: 'college_of_eloquence', name: 'College of Eloquence', description: 'Master the art of oratory and persuasion.', features: [] },
        { id: 'college_of_spirits', name: 'College of Spirits', description: 'Commune with the dead to tell their tales.', features: [] }
      ], spellSlots: FULL_CASTER_SLOTS,
    features: [
      { level: 1, name: 'Spellcasting', description: 'You can cast bard spells using Charisma as your spellcasting ability.' },
      { level: 1, name: 'Bardic Inspiration', description: 'Inspire others through stirring words or music. Uses = CHA mod per long rest.' },
      { level: 2, name: 'Jack of All Trades', description: 'Add half proficiency bonus to non-proficient ability checks.' },
      { level: 2, name: 'Song of Rest', description: 'Use soothing music during a short rest for extra healing (1d6).' },
      { level: 3, name: 'Bard College', description: 'Choose your Bard College archetype.' },
      { level: 5, name: 'Font of Inspiration', description: 'Bardic Inspiration recharges on short or long rest.' },
    ],
  },
  {
    id: 'cleric', name: 'Cleric', hitDie: 8, startingHp: 8,
    primaryAbility: ['wis'], savingThrows: ['wis', 'cha'],
    armorProficiencies: ['Light', 'Medium', 'Shields'],
    weaponProficiencies: ['Simple'],
    skillChoices: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
    numSkillChoices: 2, spellcaster: true, spellcastingAbility: 'wis',
    description: 'A priestly champion who wields divine magic in service of a higher power.',
    asiLevels: ASI_LEVELS.default, subclassLevel: 1, subclassLabel: 'Divine Domain', subclasses: [
        { id: 'knowledge_domain', name: 'Knowledge Domain', description: 'Value learning and understanding above all.', features: [] },
        { id: 'life_domain', name: 'Life Domain', description: 'Focus on the vibrant positive energy.', features: [] },
        { id: 'light_domain', name: 'Light Domain', description: 'Promote the ideals of rebirth and renewal.', features: [] },
        { id: 'nature_domain', name: 'Nature Domain', description: 'Protect the natural world.', features: [] },
        { id: 'tempest_domain', name: 'Tempest Domain', description: 'Govern the skies and the fury of storms.', features: [] },
        { id: 'trickery_domain', name: 'Trickery Domain', description: 'Mischief-makers and instigators.', features: [] },
        { id: 'war_domain', name: 'War Domain', description: 'Champion of righteous conflict.', features: [] },
        { id: 'death_domain', name: 'Death Domain', description: 'Concerned with the forces that cause death.', features: [] },
        { id: 'forge_domain', name: 'Forge Domain', description: 'Artisans who honor deities of the forge.', features: [] },
        { id: 'grave_domain', name: 'Grave Domain', description: 'Watch over the line between life and death.', features: [] },
        { id: 'order_domain', name: 'Order Domain', description: 'Enforce order and justice.', features: [] },
        { id: 'peace_domain', name: 'Peace Domain', description: 'Preside over the forging of peace.', features: [] },
        { id: 'twilight_domain', name: 'Twilight Domain', description: 'Guard against the horrors of the night.', features: [] }
      ], spellSlots: FULL_CASTER_SLOTS,
    features: [
      { level: 1, name: 'Spellcasting', description: 'You can cast cleric spells using Wisdom as your spellcasting ability.' },
      { level: 1, name: 'Divine Domain', description: 'Choose a domain related to your deity.' },
      { level: 2, name: 'Channel Divinity', description: 'Channel divine energy for magical effects. Uses = 1 per short/long rest.' },
      { level: 5, name: 'Destroy Undead', description: 'Undead of CR 1/2 or lower are destroyed by Turn Undead.' },
    ],
  },
  {
    id: 'druid', name: 'Druid', hitDie: 8, startingHp: 8,
    primaryAbility: ['wis'], savingThrows: ['int', 'wis'],
    armorProficiencies: ['Light', 'Medium', 'Shields (non-metal)'],
    weaponProficiencies: ['Clubs', 'Daggers', 'Darts', 'Javelins', 'Maces', 'Quarterstaffs', 'Scimitars', 'Sickles', 'Slings', 'Spears'],
    skillChoices: ['arcana', 'animal_handling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'],
    numSkillChoices: 2, spellcaster: true, spellcastingAbility: 'wis',
    description: 'A priest of the Old Faith, wielding the powers of nature and adopting animal forms.',
    asiLevels: ASI_LEVELS.default, subclassLevel: 2, subclassLabel: 'Druid Circle', subclasses: [
        { id: 'circle_of_the_land', name: 'Circle of the Land', description: 'Mystics and sages of ancient knowledge.', features: [] },
        { id: 'circle_of_the_moon', name: 'Circle of the Moon', description: 'Fierce guardians of the wilds.', features: [] },
        { id: 'circle_of_dreams', name: 'Circle of Dreams', description: 'Tied to the Feywild and its dreamlike magic.', features: [] },
        { id: 'circle_of_the_shepherd', name: 'Circle of the Shepherd', description: 'Commune with the spirits of beasts.', features: [] },
        { id: 'circle_of_spores', name: 'Circle of Spores', description: 'Find beauty in decay.', features: [] },
        { id: 'circle_of_stars', name: 'Circle of Stars', description: 'Draw power from the cosmos.', features: [] },
        { id: 'circle_of_wildfire', name: 'Circle of Wildfire', description: 'Understand that destruction is part of creation.', features: [] }
      ], spellSlots: FULL_CASTER_SLOTS,
    features: [
      { level: 1, name: 'Druidic', description: 'You know Druidic, the secret language of druids.' },
      { level: 1, name: 'Spellcasting', description: 'Cast druid spells using Wisdom.' },
      { level: 2, name: 'Wild Shape', description: 'Magically assume the shape of a beast you have seen before.' },
      { level: 2, name: 'Druid Circle', description: 'Choose a Druid Circle archetype.' },
    ],
  },
  {
    id: 'fighter', name: 'Fighter', hitDie: 10, startingHp: 10,
    primaryAbility: ['str', 'dex'], savingThrows: ['str', 'con'],
    armorProficiencies: ['All armor', 'Shields'],
    weaponProficiencies: ['Simple', 'Martial'],
    skillChoices: ['acrobatics', 'animal_handling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'],
    numSkillChoices: 2, spellcaster: false,
    description: 'A master of martial combat, skilled with a variety of weapons and armor.',
    asiLevels: ASI_LEVELS.fighter, subclassLevel: 3, subclassLabel: 'Martial Archetype', subclasses: [
        { id: 'champion', name: 'Champion', description: 'Develop raw physical power.', features: [] },
        { id: 'battle_master', name: 'Battle Master', description: 'Meld combat maneuvers with martial art.', features: [] },
        { id: 'eldritch_knight', name: 'Eldritch Knight', description: 'Combine martial mastery with arcane magic.', features: [] },
        { id: 'arcane_archer', name: 'Arcane Archer', description: 'Weave magic into archery.', features: [] },
        { id: 'cavalier', name: 'Cavalier', description: 'Mount combatants and noble protectors.', features: [] },
        { id: 'samurai', name: 'Samurai', description: 'Unrelenting resolve and refined spirit.', features: [] },
        { id: 'psi_warrior', name: 'Psi Warrior', description: 'Augment physical might with psionic power.', features: [] },
        { id: 'rune_knight', name: 'Rune Knight', description: 'Enhance martial prowess using the magic of runes.', features: [] },
        { id: 'echo_knight', name: 'Echo Knight', description: 'Summon fading shades of alternate timelines.', features: [] }
      ], spellSlots: undefined,
    features: [
      { level: 1, name: 'Fighting Style', description: 'Adopt a particular style of fighting as your specialty.' },
      { level: 1, name: 'Second Wind', description: 'Regain 1d10 + fighter level HP as a bonus action. Once per short rest.' },
      { level: 2, name: 'Action Surge', description: 'Take one additional action on your turn. Once per short rest.' },
      { level: 3, name: 'Martial Archetype', description: 'Choose a martial archetype.' },
      { level: 5, name: 'Extra Attack', description: 'Attack twice on your Attack action.' },
    ],
  },
  {
    id: 'monk', name: 'Monk', hitDie: 8, startingHp: 8,
    primaryAbility: ['dex', 'wis'], savingThrows: ['str', 'dex'],
    armorProficiencies: [],
    weaponProficiencies: ['Simple', 'Shortswords'],
    skillChoices: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'],
    numSkillChoices: 2, spellcaster: false,
    description: 'A master of martial arts, harnessing the power of the body in pursuit of spiritual perfection.',
    asiLevels: ASI_LEVELS.default, subclassLevel: 3, subclassLabel: 'Monastic Tradition', subclasses: [
        { id: 'way_of_the_open_hand', name: 'Way of the Open Hand', description: 'Masters of martial arts combat.', features: [] },
        { id: 'way_of_shadow', name: 'Way of Shadow', description: 'Stealthy assassins and spies.', features: [] },
        { id: 'way_of_the_four_elements', name: 'Way of the Four Elements', description: 'Manipulate elemental forces.', features: [] },
        { id: 'way_of_the_long_death', name: 'Way of the Long Death', description: 'Study the mechanics of dying.', features: [] },
        { id: 'way_of_the_sun_soul', name: 'Way of the Sun Soul', description: 'Channel life energy into searing bolts of light.', features: [] },
        { id: 'way_of_the_drunken_master', name: 'Way of the Drunken Master', description: 'Sway and stagger like a drunkard in combat.', features: [] },
        { id: 'way_of_the_kensei', name: 'Way of the Kensei', description: 'Elevate weapon training to art.', features: [] },
        { id: 'way_of_mercy', name: 'Way of Mercy', description: 'Manipulate the life force of others.', features: [] },
        { id: 'way_of_the_astral_self', name: 'Way of the Astral Self', description: 'Manifest an astral body.', features: [] },
        { id: 'way_of_the_ascendant_dragon', name: 'Way of the Ascendant Dragon', description: 'Emulate the power of dragons.', features: [] }
      ], spellSlots: undefined,
    features: [
      { level: 1, name: 'Unarmored Defense', description: 'AC = 10 + DEX mod + WIS mod without armor.' },
      { level: 1, name: 'Martial Arts', description: 'Use DEX for unarmed/monk weapons. Bonus action unarmed strike (1d4).' },
      { level: 2, name: 'Ki', description: 'Harness mystical energy. Ki points = monk level.' },
      { level: 2, name: 'Unarmored Movement', description: '+10 ft speed without armor.' },
      { level: 3, name: 'Monastic Tradition', description: 'Choose a monastic tradition.' },
      { level: 5, name: 'Extra Attack', description: 'Attack twice on your Attack action.' },
      { level: 5, name: 'Stunning Strike', description: 'Spend 1 ki to stun a creature on a hit.' },
    ],
  },
  {
    id: 'paladin', name: 'Paladin', hitDie: 10, startingHp: 10,
    primaryAbility: ['str', 'cha'], savingThrows: ['wis', 'cha'],
    armorProficiencies: ['All armor', 'Shields'],
    weaponProficiencies: ['Simple', 'Martial'],
    skillChoices: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'],
    numSkillChoices: 2, spellcaster: true, spellcastingAbility: 'cha',
    description: 'A holy warrior bound to a sacred oath.',
    asiLevels: ASI_LEVELS.default, subclassLevel: 3, subclassLabel: 'Sacred Oath', subclasses: [
        { id: 'oath_of_devotion', name: 'Oath of Devotion', description: 'Bound to the loftiest ideals of justice.', features: [] },
        { id: 'oath_of_the_ancients', name: 'Oath of the Ancients', description: 'Love the beautiful and life-giving.', features: [] },
        { id: 'oath_of_vengeance', name: 'Oath of Vengeance', description: 'Punish those who have committed grievous sins.', features: [] },
        { id: 'oathbreaker', name: 'Oathbreaker', description: 'A paladin who has broken their sacred oaths.', features: [] },
        { id: 'oath_of_the_crown', name: 'Oath of the Crown', description: 'Sworn to the ideals of civilization.', features: [] },
        { id: 'oath_of_conquest', name: 'Oath of Conquest', description: 'Seek glory in battle and the subjugation of their enemies.', features: [] },
        { id: 'oath_of_redemption', name: 'Oath of Redemption', description: 'Believe that anyone can be redeemed.', features: [] },
        { id: 'oath_of_glory', name: 'Oath of Glory', description: 'Destined to achieve great deeds.', features: [] },
        { id: 'oath_of_the_watchers', name: 'Oath of the Watchers', description: 'Guard the mortal realm from extraplanar threats.', features: [] }
      ], spellSlots: HALF_CASTER_SLOTS,
    features: [
      { level: 1, name: 'Divine Sense', description: 'Detect celestials, fiends, and undead within 60 ft.' },
      { level: 1, name: 'Lay on Hands', description: 'A pool of healing power. Pool = 5 × paladin level.' },
      { level: 2, name: 'Fighting Style', description: 'Adopt a particular style of fighting.' },
      { level: 2, name: 'Spellcasting', description: 'Cast paladin spells using Charisma.' },
      { level: 2, name: 'Divine Smite', description: 'Expend spell slot to deal extra 2d8 radiant damage on a hit.' },
      { level: 3, name: 'Sacred Oath', description: 'Choose a sacred oath archetype.' },
      { level: 5, name: 'Extra Attack', description: 'Attack twice on your Attack action.' },
    ],
  },
  {
    id: 'ranger', name: 'Ranger', hitDie: 10, startingHp: 10,
    primaryAbility: ['dex', 'wis'], savingThrows: ['str', 'dex'],
    armorProficiencies: ['Light', 'Medium', 'Shields'],
    weaponProficiencies: ['Simple', 'Martial'],
    skillChoices: ['animal_handling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'],
    numSkillChoices: 3, spellcaster: true, spellcastingAbility: 'wis',
    description: 'A warrior who combats threats on the edges of civilization.',
    asiLevels: ASI_LEVELS.default, subclassLevel: 3, subclassLabel: 'Ranger Archetype', subclasses: [
        { id: 'hunter', name: 'Hunter', description: 'A bulwark between civilization and terrors.', features: [] },
        { id: 'beast_master', name: 'Beast Master', description: 'Bond with a beast to fight together.', features: [] },
        { id: 'gloom_stalker', name: 'Gloom Stalker', description: 'At home in the darkest places.', features: [] },
        { id: 'horizon_walker', name: 'Horizon Walker', description: 'Guard the world against extraplanar threats.', features: [] },
        { id: 'monster_slayer', name: 'Monster Slayer', description: 'Hunt down creatures of the night.', features: [] },
        { id: 'fey_wanderer', name: 'Fey Wanderer', description: 'Channel the mirthful power of the Feywild.', features: [] },
        { id: 'swarmkeeper', name: 'Swarmkeeper', description: 'Bond with a swarm of nature spirits.', features: [] },
        { id: 'drakewarden', name: 'Drakewarden', description: 'Bond with a draconic spirit.', features: [] }
      ], spellSlots: HALF_CASTER_SLOTS,
    features: [
      { level: 1, name: 'Favored Enemy', description: 'Advantage on Survival checks to track and INT checks to recall info about chosen enemy type.' },
      { level: 1, name: 'Natural Explorer', description: 'You are a master of navigating the natural world.' },
      { level: 2, name: 'Fighting Style', description: 'Adopt a particular style of fighting.' },
      { level: 2, name: 'Spellcasting', description: 'Cast ranger spells using Wisdom.' },
      { level: 3, name: 'Ranger Archetype', description: 'Choose a ranger archetype.' },
      { level: 5, name: 'Extra Attack', description: 'Attack twice on your Attack action.' },
    ],
  },
  {
    id: 'rogue', name: 'Rogue', hitDie: 8, startingHp: 8,
    primaryAbility: ['dex'], savingThrows: ['dex', 'int'],
    armorProficiencies: ['Light'],
    weaponProficiencies: ['Simple', 'Hand Crossbows', 'Longswords', 'Rapiers', 'Shortswords'],
    skillChoices: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleight_of_hand', 'stealth'],
    numSkillChoices: 4, spellcaster: false,
    description: 'A scoundrel who uses stealth and trickery to overcome obstacles and enemies.',
    asiLevels: ASI_LEVELS.rogue, subclassLevel: 3, subclassLabel: 'Roguish Archetype', subclasses: [
        { id: 'thief', name: 'Thief', description: 'Hone skills in the larcenous arts.', features: [] },
        { id: 'assassin', name: 'Assassin', description: 'Focus on the grim art of death.', features: [] },
        { id: 'arcane_trickster', name: 'Arcane Trickster', description: 'Enhance stealth and agility with magic.', features: [] },
        { id: 'mastermind', name: 'Mastermind', description: 'Focus on people and the influence of secrets.', features: [] },
        { id: 'swashbuckler', name: 'Swashbuckler', description: 'Focus on speed, elegance, and charm.', features: [] },
        { id: 'inquisitive', name: 'Inquisitive', description: 'Root out secrets and unravel mysteries.', features: [] },
        { id: 'scout', name: 'Scout', description: 'Skilled in stealth and navigating the wilderness.', features: [] },
        { id: 'phantom', name: 'Phantom', description: 'Walk the line between life and death.', features: [] },
        { id: 'soulknife', name: 'Soulknife', description: 'Strike with blades of psionic energy.', features: [] }
      ], spellSlots: undefined,
    features: [
      { level: 1, name: 'Expertise', description: 'Double proficiency bonus for two chosen skill proficiencies.' },
      { level: 1, name: 'Sneak Attack', description: 'Extra 1d6 damage once per turn with finesse/ranged weapons when you have advantage.' },
      { level: 1, name: 'Thieves\' Cant', description: 'A secret mix of dialect, jargon, and code.' },
      { level: 2, name: 'Cunning Action', description: 'Dash, Disengage, or Hide as a bonus action.' },
      { level: 3, name: 'Roguish Archetype', description: 'Choose a roguish archetype.' },
      { level: 5, name: 'Uncanny Dodge', description: 'Halve incoming attack damage as a reaction.' },
    ],
  },
  {
    id: 'sorcerer', name: 'Sorcerer', hitDie: 6, startingHp: 6,
    primaryAbility: ['cha'], savingThrows: ['con', 'cha'],
    armorProficiencies: [],
    weaponProficiencies: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light Crossbows'],
    skillChoices: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'],
    numSkillChoices: 2, spellcaster: true, spellcastingAbility: 'cha',
    description: 'A spellcaster who draws on inherent magic from a gift or bloodline.',
    asiLevels: ASI_LEVELS.default, subclassLevel: 1, subclassLabel: 'Sorcerous Origin', subclasses: [
        {
                id: "draconic_bloodline",
                name: "Draconic Bloodline",
                description: "Your innate magic comes from draconic power that was mingled with your blood or that of your ancestors. You might trace your lineage to a powerful sorcerer who made a bargain with a dragon, or even directly to a dragon itself. This heritage grants you draconic resistances, tough scales, and a fiery command over elemental magic.",
                features: [
                        {
                                level: 1,
                                name: "Draconic Ancestry",
                                description: "You choose one type of dragon as your ancestor. The damage type associated with each dragon is used by other features, and you can speak, read, and write Draconic."
                        },
                        {
                                level: 1,
                                name: "Dragon Resilience",
                                description: "As part of your draconic heritage, your skin is covered by a thin sheen of draconic scales. When you aren't wearing armor, your AC equals 13 + your Dexterity modifier. You also gain hit points equal to 1 + your sorcerer level."
                        },
                        {
                                level: 6,
                                name: "Elemental Affinity",
                                description: "When you cast a spell that deals damage of the type associated with your Draconic Ancestry, you can add your Charisma modifier to one damage roll of that spell. At the same time, you can spend 1 sorcery point to gain resistance to that damage type for 1 hour."
                        },
                        {
                                level: 14,
                                name: "Dragon Wings",
                                description: "You gain the ability to sprout a pair of dragon wings from your back, gaining a flying speed equal to your current walking speed. You can create these wings as a bonus action and dismiss them as a bonus action."
                        },
                        {
                                level: 18,
                                name: "Draconic Presence",
                                description: "You can use your action to unleash the frightful presence of your draconic ancestor. Each creature of your choice within 120 feet of you that is aware of you must succeed on a Wisdom saving throw or become frightened for 1 minute."
                        }
                ]
        },
        {
                id: "wild_magic",
                name: "Wild Magic",
                description: "The power of chaos courses through your veins, making your magic unpredictable and thrilling. You tap into the raw, untamed forces of magic itself, sometimes with spectacular results, sometimes with utterly bizarre and unexpected side effects. Every spell cast is a roll of the dice, bringing both immense power and delightful pandemonium to the battlefield.",
                features: [
                        {
                                level: 1,
                                name: "Wild Magic Surge",
                                description: "Whenever you cast a sorcerer spell of 1st level or higher, the DM can have you roll on the Wild Magic Surge table immediately after. This can result in anything from a shower of flowers to a fireball erupting around you."
                        },
                        {
                                level: 1,
                                name: "Tides of Chaos",
                                description: "You can gain advantage on one attack roll, ability check, or saving throw. Once you do so, you must finish a long rest before you can use it again, unless the DM has you roll on the Wild Magic Surge table first."
                        },
                        {
                                level: 6,
                                name: "Bend Luck",
                                description: "When another creature you can see within 30 feet of you makes an attack roll, an ability check, or a saving throw, you can use your reaction and spend 2 sorcery points to roll 1d4 and apply the number rolled as a bonus or penalty to the creature's roll."
                        },
                        {
                                level: 14,
                                name: "Controlled Chaos",
                                description: "Whenever you roll on the Wild Magic Surge table, you can roll twice and choose which of the two rolls to use."
                        },
                        {
                                level: 18,
                                name: "Spell Bombardment",
                                description: "When you cast a sorcerer spell of 1st level or higher, if you roll the highest possible number on any of the spell’s damage dice, choose one of those dice, roll it again and add that roll to the damage. You can do this only once per turn."
                        }
                ]
        },
        {
                id: "divine_soul",
                name: "Divine Soul",
                description: "Your innate magic stems from a divine source, granting you a connection to the gods or other potent celestials. Perhaps a divine ancestor blessed your lineage, you were touched by a deity, or you are destined for an important cosmic purpose. This grants you access to both arcane sorcery and the healing and protective powers of the divine.",
                features: [
                        {
                                level: 1,
                                name: "Divine Magic",
                                description: "You learn one spell of your choice from the cleric spell list. You also gain Cure Wounds as a known spell, which doesn't count against your number of sorcerer spells known. When you choose a sorcerer spell, you can choose it from the cleric spell list or the sorcerer spell list."
                        },
                        {
                                level: 1,
                                name: "Favored by the Gods",
                                description: "If you fail a saving throw or miss with an attack roll, you can use your reaction to roll 2d4 and add it to the total, potentially changing the outcome. You can use this a number of times equal to your Charisma modifier (minimum of once) per long rest."
                        },
                        {
                                level: 6,
                                name: "Empowered Healing",
                                description: "When you or an ally you can see within 30 feet of you rolls damage or hit points for a spell that restores hit points, you can spend 1 sorcery point to reroll up to three of the dice. You must use the new rolls."
                        },
                        {
                                level: 14,
                                name: "Otherworldly Wings",
                                description: "You can use a bonus action to manifest a pair of spectral, feathered wings from your shoulder blades, gaining a flying speed of 30 feet. These wings last until you're incapacitated, you dismiss them as a bonus action, or you die."
                        },
                        {
                                level: 18,
                                name: "Unearthly Recovery",
                                description: "You can use a bonus action to regain half your maximum hit points. Once you use this feature, you can't use it again until you finish a long rest."
                        }
                ]
        },
        {
                id: "shadow_magic",
                name: "Shadow Magic",
                description: "Your innate magic is born from the Shadowfell, drawing power from darkness itself. You might have been touched by a shadow dragon, survived a harrowing journey through the Plane of Shadow, or simply possess a lineage steeped in grim, primordial magic. This grants you the ability to manipulate shadows, instill fear, and even glimpse into the realm of the dead.",
                features: [
                        {
                                level: 1,
                                name: "Eyes of the Dark",
                                description: "You have darkvision with a range of 120 feet. If you already have darkvision, its range increases by 60 feet. As an action, you can spend 2 sorcery points to magically create a sphere of magical darkness with a 15-foot radius that lasts for 10 minutes. It functions as the Darkness spell, but you can see through it."
                        },
                        {
                                level: 1,
                                name: "Strength of the Grave",
                                description: "When damage reduces you to 0 hit points, you can make a Charisma saving throw (DC 5 + the damage taken). On a success, you drop to 1 hit point instead. You can't use this feature if the damage is radiant or from a critical hit."
                        },
                        {
                                level: 6,
                                name: "Hound of Ill Omen",
                                description: "As a bonus action, you can spend 3 sorcery points to summon a shadowy hound. The hound appears in an unoccupied space of your choice within 30 feet of you, acts on your turn, and targets a creature you designate. The target has disadvantage on saving throws against your spells while the hound is within 5 feet of it. The hound vanishes after 5 minutes, or when its target drops to 0 hit points, or when you die."
                        },
                        {
                                level: 14,
                                name: "Shadow Walk",
                                description: "When you are in dim light or darkness, as a bonus action, you can magically teleport up to 120 feet to an unoccupied space you can see that is also in dim light or darkness."
                        },
                        {
                                level: 18,
                                name: "Umbral Form",
                                description: "As an action, you can spend 6 sorcery points to transform into a shadowy form for 1 minute. In this form, you have resistance to all damage except force and radiant damage, can move through other creatures and objects as if they were difficult terrain, and gain a flying speed equal to your walking speed."
                        }
                ]
        }
],
       spellSlots: FULL_CASTER_SLOTS,
    features: [
      { level: 1, name: 'Spellcasting', description: 'Cast sorcerer spells using Charisma.' },
      { level: 1, name: 'Sorcerous Origin', description: 'Choose a sorcerous origin that shapes your innate magic.' },
      { level: 2, name: 'Font of Magic', description: 'Sorcery points = sorcerer level. Convert between spell slots and sorcery points.' },
      { level: 3, name: 'Metamagic', description: 'Twist spells to suit your needs with metamagic options.' },
    ],
  },
  {
    id: 'warlock', name: 'Warlock', hitDie: 8, startingHp: 8,
    primaryAbility: ['cha'], savingThrows: ['wis', 'cha'],
    armorProficiencies: ['Light'],
    weaponProficiencies: ['Simple'],
    skillChoices: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'],
    numSkillChoices: 2, spellcaster: true, spellcastingAbility: 'cha',
    description: 'A wielder of magic derived from a bargain with an extraplanar entity.',
    asiLevels: ASI_LEVELS.default, subclassLevel: 1, subclassLabel: 'Otherworldly Patron', subclasses: [
        {
                id: "the_fiend",
                name: "The Fiend",
                description: "You have made a pact with a powerful denizen of the Lower Planes—a demon lord, an archdevil, or some other diabolical entity. Your patron grants you access to dark, destructive power, fueling your spells with hellfire and shadow. Embrace the raw might and cunning granted by your infernal master, but always be wary of the price of such a deal.",
                features: [
                        {
                                level: 1,
                                name: "Dark One's Blessing",
                                description: "When you reduce a hostile creature to 0 hit points, you gain temporary hit points equal to your Charisma modifier + your warlock level, reflecting a surge of demonic vitality."
                        },
                        {
                                level: 6,
                                name: "Dark One's Own Luck",
                                description: "When you make an ability check or a saving throw, you can use this feature to add 1d10 to your roll. This infernal luck can turn failure into success once per short or long rest."
                        },
                        {
                                level: 10,
                                name: "Fiendish Resilience",
                                description: "You can choose one damage type when you finish a short or long rest. You gain resistance to that damage type, a boon from your patron's tough hide or magical protection, until you choose a different type."
                        },
                        {
                                level: 14,
                                name: "Hurl Through Hell",
                                description: "When you hit a creature with an attack, you can instantly transport that creature to the Lower Planes until the end of your next turn. It takes psychic damage and then reappears, shaken and vulnerable, back in its original space."
                        }
                ]
        },
        {
                id: "the_great_old_one",
                name: "The Great Old One",
                description: "Your patron is a mysterious entity whose motivations are incomprehensible and whose power is vast beyond mortal reckoning. Perhaps a creature from the Far Realm, an elder evil slumbering in the void, or an ancient alien intellect, this patron grants you whispers of cosmic truth and the ability to touch the minds of others. You wield power that warps reality and unravels sanity, a tiny fragment of an unspeakable terror.",
                features: [
                        {
                                level: 1,
                                name: "Awakened Mind",
                                description: "You can telepathically speak to any creature you can see within 30 feet of you, allowing silent communication directly into their thoughts, regardless of language barriers."
                        },
                        {
                                level: 6,
                                name: "Entropic Ward",
                                description: "When a creature makes an attack roll against you, you can use your reaction to impose disadvantage on that roll. If the attack misses, your next attack roll against the creature has advantage, a subtle shift in fate."
                        },
                        {
                                level: 10,
                                name: "Thought Shield",
                                description: "Your mind is shielded by your patron's alien influence. You are immune to having your thoughts read and to psychic damage, and any creature that deals psychic damage to you takes the same damage."
                        },
                        {
                                level: 14,
                                name: "Create Thrall",
                                description: "You can charm a humanoid, twisting its mind to serve you. This effect is permanent until you use this feature again or dismiss it, binding them to your cosmic will."
                        }
                ]
        },
        {
                id: "the_archfey",
                name: "The Archfey",
                description: "You have sworn allegiance to one of the ancient, mercurial lords of the Feywild—a powerful archfey whose whims shape the very fabric of nature and illusion. Your magic flows from the vibrant, unpredictable energies of the fae realm, allowing you to charm, beguile, and mislead your foes. Embrace the playful cruelty and enchanting allure of your patron, weaving illusions and whispers of the wild into your every spell.",
                features: [
                        {
                                level: 1,
                                name: "Fey Presence",
                                description: "As an action, you can cause any creatures in a 10-foot cube originating from you to either be charmed or frightened by you until the end of your next turn, reflecting your patron's enchanting or terrifying aura."
                        },
                        {
                                level: 6,
                                name: "Misty Escape",
                                description: "When you take damage, you can use your reaction to turn invisible and teleport up to 60 feet to an unoccupied space you can see. You remain invisible until the start of your next turn or until you attack or cast a spell, fading away like a whisper in the wind."
                        },
                        {
                                level: 10,
                                name: "Beguiling Defenses",
                                description: "Your patron's magic helps you turn mental assaults back on your foes. You are immune to being charmed, and when another creature attempts to charm you, you can use your reaction to turn the charm back on that creature."
                        },
                        {
                                level: 14,
                                name: "Dark Delirium",
                                description: "As an action, you can magically force a creature to perceive its surroundings as an illusory, nightmarish landscape for 1 minute. The creature is incapacitated and takes psychic damage if it takes damage from another source, trapped in a fae nightmare."
                        }
                ]
        }
],
       spellSlots: undefined,
    features: [
      { level: 1, name: 'Otherworldly Patron', description: 'Choose a patron who grants you power.' },
      { level: 1, name: 'Pact Magic', description: 'Cast warlock spells using Charisma. Slots recharge on short rest.' },
      { level: 2, name: 'Eldritch Invocations', description: 'Fragments of forbidden knowledge that imbue you with abilities.' },
      { level: 3, name: 'Pact Boon', description: 'Your patron bestows a gift upon you.' },
    ],
  },
  {
    id: 'wizard', name: 'Wizard', hitDie: 6, startingHp: 6,
    primaryAbility: ['int'], savingThrows: ['int', 'wis'],
    armorProficiencies: [],
    weaponProficiencies: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light Crossbows'],
    skillChoices: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'],
    numSkillChoices: 2, spellcaster: true, spellcastingAbility: 'int',
    description: 'A scholarly magic-user capable of manipulating the structures of reality.',
    asiLevels: ASI_LEVELS.default, subclassLevel: 2, subclassLabel: 'Arcane Tradition', subclasses: [
        {
                id: "school_of_abjuration",
                name: "School of Abjuration",
                description: "Masters of protective magic, Abjurers specialize in wards, counterspells, and banishment, creating impenetrable defenses against all manner of threats. They stand as bulwarks against harm, shielding allies and repelling foes with their intricate magical barriers.",
                features: [
                        {
                                level: 2,
                                name: "Abjuration Savant",
                                description: "The gold and time you must spend to copy an abjuration spell into your spellbook is halved."
                        },
                        {
                                level: 2,
                                name: "Arcane Ward",
                                description: "You can weave magic around yourself for protection. When you cast an abjuration spell of 1st level or higher, you can create a magical ward. It has hit points equal to twice your wizard level + your Intelligence modifier, and when you take damage, the ward takes the damage instead. If the ward drops to 0 hit points, you take any remaining damage. The ward regains 2 hit points whenever you cast an abjuration spell of 1st level or higher."
                        },
                        {
                                level: 6,
                                name: "Projected Ward",
                                description: "When a creature you can see within 30 feet of you takes damage, you can use your reaction to interpose your Arcane Ward between the attacker and the target. The ward takes the damage instead of the target."
                        },
                        {
                                level: 10,
                                name: "Improved Abjuration",
                                description: "When you cast an abjuration spell that requires you to make an ability check as part of casting that spell (as in counterspell and dispel magic), you add your proficiency bonus to that check."
                        },
                        {
                                level: 14,
                                name: "Spell Resistance",
                                description: "You have advantage on saving throws against spells and other magical effects. Additionally, you have resistance to the damage from spells."
                        }
                ]
        },
        {
                id: "school_of_evocation",
                name: "School of Evocation",
                description: "Evokers are spellcasters who channel raw magical energy into explosive and potent effects, specializing in creating devastating blasts of elemental force. They manipulate fire, ice, lightning, and more, shaping destructive power with surgical precision to obliterate their enemies.",
                features: [
                        {
                                level: 2,
                                name: "Evocation Savant",
                                description: "The gold and time you must spend to copy an evocation spell into your spellbook is halved."
                        },
                        {
                                level: 2,
                                name: "Sculpt Spells",
                                description: "When you cast an evocation spell that affects other creatures that you can see, you can choose a number of them equal to 1 + the spell's level. The chosen creatures automatically succeed on their saving throws against the spell and take no damage if they would normally take half damage on a successful save."
                        },
                        {
                                level: 6,
                                name: "Potent Cantrip",
                                description: "Your damaging cantrips affect even creatures that avoid the brunt of the effect. When a creature succeeds on a saving throw against your cantrip, the creature takes half the cantrip's damage (if any) but suffers no additional effect from the cantrip."
                        },
                        {
                                level: 10,
                                name: "Empowered Evocation",
                                description: "When you cast an evocation spell, you can add your Intelligence modifier to one damage roll of that spell."
                        },
                        {
                                level: 14,
                                name: "Overchannel",
                                description: "When you cast a wizard spell of 5th level or lower that deals damage, you can choose to maximize the damage. You can use this feature once, regaining use after a long rest. If you overchannel a spell of 1st through 3rd level, you take 2d12 necrotic damage per spell level after using this feature again before a long rest."
                        }
                ]
        },
        {
                id: "school_of_conjuration",
                name: "School of Conjuration",
                description: "Conjurers command the magic of creation and transportation, pulling objects and creatures from distant planes or teleporting across vast distances in an instant. They can manifest allies, summon useful items, or escape danger with unparalleled agility, bending space and time to their will.",
                features: [
                        {
                                level: 2,
                                name: "Conjuration Savant",
                                description: "The gold and time you must spend to copy a conjuration spell into your spellbook is halved."
                        },
                        {
                                level: 2,
                                name: "Minor Conjuration",
                                description: "You can use your action to conjure an inanimate object in your hand or on the ground within 10 feet of you. The object can be no larger than 3 feet on a side and weigh no more than 10 pounds, and its form must be that of a nonmagical object that you have seen. The object vanishes after 1 hour, or when you use this feature again, or if it takes or deals any damage."
                        },
                        {
                                level: 6,
                                name: "Benign Transposition",
                                description: "As an action, you can teleport up to 30 feet to an unoccupied space that you can see. Alternatively, you can choose a willing creature you can see within 30 feet of you and an unoccupied space within 30 feet of you. If both are within range, you magically swap places with that creature. Once you use this feature, you can't use it again until you finish a short or long rest, or until you cast a conjuration spell of 1st level or higher."
                        },
                        {
                                level: 10,
                                name: "Focused Conjuration",
                                description: "While you are concentrating on a conjuration spell, your concentration can't be broken as a result of taking damage."
                        },
                        {
                                level: 14,
                                name: "Durable Summons",
                                description: "Any creature that you summon or create with a conjuration spell has 30 temporary hit points."
                        }
                ]
        },
        {
                id: "school_of_divination",
                name: "School of Divination",
                description: "Diviners delve into the tapestry of fate, seeking knowledge of the past, present, and future to unravel mysteries and gain insight. They perceive hidden truths, glimpse possibilities, and subtly alter destiny's course, providing invaluable guidance and foresight to their companions.",
                features: [
                        {
                                level: 2,
                                name: "Divination Savant",
                                description: "The gold and time you must spend to copy a divination spell into your spellbook is halved."
                        },
                        {
                                level: 2,
                                name: "Portent",
                                description: "When you finish a long rest, roll two d20s and record the numbers rolled. You can replace any attack roll, saving throw, or ability check made by you or a creature you can see with one of these foretelling rolls. You must choose to do so before the roll, and you can only use each foretelling roll once."
                        },
                        {
                                level: 6,
                                name: "Expert Divination",
                                description: "When you cast a divination spell of 2nd level or higher using a spell slot, you regain one expended spell slot. The slot you regain must be of a lower level than the spell you cast and can't be higher than 5th level."
                        },
                        {
                                level: 10,
                                name: "The Third Eye",
                                description: "You can use your action to gain one of the following benefits, which lasts until you are incapacitated or you use this feature again: darkvision out to 120 feet, ethereal sight, greater comprehension of languages, or the ability to see invisibility."
                        },
                        {
                                level: 14,
                                name: "Greater Portent",
                                description: "The number of d20s you roll for your Portent feature increases to three, rather than two."
                        }
                ]
        }
],
       spellSlots: FULL_CASTER_SLOTS,
    features: [
      { level: 1, name: 'Spellcasting', description: 'Cast wizard spells using Intelligence.' },
      { level: 1, name: 'Arcane Recovery', description: 'Recover spell slots during a short rest. Levels = half wizard level (rounded up).' },
      { level: 2, name: 'Arcane Tradition', description: 'Choose an arcane tradition (school of magic).' },
    ],
  },
];

// ═══════════════════════════════════════════════
//  BACKGROUNDS
// ═══════════════════════════════════════════════

export const BACKGROUNDS: BackgroundData[] = [
  {
    id: 'acolyte', name: 'Acolyte',
    skillProficiencies: ['insight', 'religion'],
    toolProficiencies: [], languages: 2,
    equipment: ['Holy symbol', 'Prayer book', 'Incense (5 sticks)', 'Vestments', '15 gp'],
    feature: 'Shelter of the Faithful',
    description: 'You have spent your life in the service of a temple, learning sacred rites and providing sacrifices.',
  },
  {
    id: 'criminal', name: 'Criminal',
    skillProficiencies: ['deception', 'stealth'],
    toolProficiencies: ['Thieves\' tools', 'One gaming set'], languages: 0,
    equipment: ['Crowbar', 'Dark common clothes', 'Belt pouch', '15 gp'],
    feature: 'Criminal Contact',
    description: 'You are an experienced criminal with a history of breaking the law.',
  },
  {
    id: 'folk_hero', name: 'Folk Hero',
    skillProficiencies: ['animal_handling', 'survival'],
    toolProficiencies: ['One artisan\'s tools', 'Vehicles (land)'], languages: 0,
    equipment: ['Artisan\'s tools', 'Shovel', 'Iron pot', 'Common clothes', '10 gp'],
    feature: 'Rustic Hospitality',
    description: 'You come from a humble social rank, but you are destined for so much more.',
  },
  {
    id: 'noble', name: 'Noble',
    skillProficiencies: ['history', 'persuasion'],
    toolProficiencies: ['One gaming set'], languages: 1,
    equipment: ['Fine clothes', 'Signet ring', 'Scroll of pedigree', '25 gp'],
    feature: 'Position of Privilege',
    description: 'You understand wealth, power, and privilege.',
  },
  {
    id: 'sage', name: 'Sage',
    skillProficiencies: ['arcana', 'history'],
    toolProficiencies: [], languages: 2,
    equipment: ['Bottle of ink', 'Quill', 'Small knife', 'Letter from colleague', 'Common clothes', '10 gp'],
    feature: 'Researcher',
    description: 'You spent years learning the lore of the multiverse.',
  },
  {
    id: 'soldier', name: 'Soldier',
    skillProficiencies: ['athletics', 'intimidation'],
    toolProficiencies: ['One gaming set', 'Vehicles (land)'], languages: 0,
    equipment: ['Insignia of rank', 'Trophy', 'Dice or card set', 'Common clothes', '10 gp'],
    feature: 'Military Rank',
    description: 'War has been your life for as long as you care to remember.',
  },
  {
    id: 'charlatan', name: 'Charlatan',
    skillProficiencies: ['deception', 'sleight_of_hand'],
    toolProficiencies: ['Disguise kit', 'Forgery kit'], languages: 0,
    equipment: ['Fine clothes', 'Disguise kit', 'Con tools', '15 gp'],
    feature: 'False Identity',
    description: 'You have always had a way with people. You know what makes them tick.',
  },
  {
    id: 'hermit', name: 'Hermit',
    skillProficiencies: ['medicine', 'religion'],
    toolProficiencies: ['Herbalism kit'], languages: 1,
    equipment: ['Scroll case with notes', 'Winter blanket', 'Common clothes', 'Herbalism kit', '5 gp'],
    feature: 'Discovery',
    description: 'You lived in seclusion — either in a sheltered community or entirely alone.',
  },
  {
    id: 'outlander', name: 'Outlander',
    skillProficiencies: ['athletics', 'survival'],
    toolProficiencies: ['One musical instrument'], languages: 1,
    equipment: ['Staff', 'Hunting trap', 'Trophy', 'Traveler\'s clothes', '10 gp'],
    feature: 'Wanderer',
    description: 'You grew up in the wilds, far from civilization and the comforts of town and technology.',
  },
];

// ═══════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ═══════════════════════════════════════════════

export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function getProficiencyBonus(level: number): number {
  if (level <= 4) return 2;
  if (level <= 8) return 3;
  if (level <= 12) return 4;
  if (level <= 16) return 5;
  return 6;
}

export function calculateStartingHp(classData: ClassData, conMod: number): number {
  return classData.hitDie + conMod;
}

export function getPointBuyCost(scores: Record<AbilityName, number>): number {
  let total = 0;
  for (const key of Object.keys(scores) as AbilityName[]) {
    total += POINT_BUY_COSTS[scores[key]] ?? 0;
  }
  return total;
}
