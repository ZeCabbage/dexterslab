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
