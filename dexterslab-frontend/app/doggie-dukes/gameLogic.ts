/**
 * Doggie Dukes — Game Logic Engine
 * 
 * Real dog breeds with realistic stats derived from actual breed characteristics.
 * Each dog gets a randomized personality that can cause upsets — a timid Rottweiler
 * might freeze up, while a scrappy Chihuahua with "berserker" temperament could
 * punch way above its weight class.
 */

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface BreedTemplate {
  breed: string;
  size: 'tiny' | 'small' | 'medium' | 'large' | 'giant';
  baseStats: {
    health: number;      // 40-120  — raw durability
    power: number;       // 1-10   — bite force / strike damage
    speed: number;       // 1-10   — action priority & dodge chance
    defense: number;     // 1-10   — damage reduction
    stamina: number;     // 1-10   — how long they stay effective
    aggression: number;  // 1-10   — base willingness to attack
  };
  description: string;
  fightStyle: string;     // flavor text for the announcer
}

export type PersonalityTrait = {
  name: string;
  emoji: string;
  description: string;
  // Stat modifiers applied as multipliers (1.0 = no change)
  modifiers: {
    power?: number;
    speed?: number;
    defense?: number;
    stamina?: number;
    aggression?: number;
  };
  // Special fight behaviors
  critBonus?: number;       // extra crit chance (0-0.3)
  freezeChance?: number;    // chance to skip a turn (0-0.3)
  rallyChance?: number;     // chance to get a damage boost when low HP
  dodgeBonus?: number;      // extra dodge chance (0-0.2)
  intimidateChance?: number; // chance to reduce opponent's attack
};

export interface Dog {
  id: string;
  name: string;
  nickname: string;
  breed: string;
  size: BreedTemplate['size'];
  age: number;             // 1-8 years
  weight: number;          // in lbs
  personality: PersonalityTrait;
  stats: {
    health: number;
    maxHealth: number;
    power: number;
    speed: number;
    defense: number;
    stamina: number;
    aggression: number;
  };
  fightStyle: string;
  description: string;
  record: { wins: number; losses: number };
  // Visual
  color: string;           // coat color description
  imageUrl: string;        // Path to the generated image
}

export interface FightAction {
  round: number;
  attacker: string;       // dog id
  defender: string;       // dog id
  action: string;         // 'attack' | 'crit' | 'dodge' | 'freeze' | 'rally' | 'intimidate'
  damage: number;
  narrative: string;       // the announcer text
  attackerHp: number;
  defenderHp: number;
}

export interface FightResult {
  winner: Dog;
  loser: Dog;
  rounds: number;
  actions: FightAction[];
  ko: boolean;            // true if HP hit 0, false if stamina gave out
}

export interface MatchOdds {
  dog1Odds: number;       // e.g. 1.5 means bet $100 win $150
  dog2Odds: number;
  dog1WinProb: number;    // 0-1
  dog2WinProb: number;
  upset: boolean;         // personality makes it closer than stats suggest
}

// ═══════════════════════════════════════════════════════════
// BREED DATABASE — 20 real breeds with realistic stats
// ═══════════════════════════════════════════════════════════

export const BREEDS: BreedTemplate[] = [
  {
    breed: 'American Pit Bull Terrier',
    size: 'medium',
    baseStats: { health: 85, power: 9, speed: 7, defense: 7, stamina: 9, aggression: 8 },
    description: 'Muscular, determined, and relentless. Originally bred for strength.',
    fightStyle: 'locks on and never lets go',
  },
  {
    breed: 'Rottweiler',
    size: 'large',
    baseStats: { health: 95, power: 9, speed: 5, defense: 8, stamina: 7, aggression: 7 },
    description: 'Powerful guardian breed with immense jaw strength.',
    fightStyle: 'overwhelming power, patient striker',
  },
  {
    breed: 'German Shepherd',
    size: 'large',
    baseStats: { health: 88, power: 7, speed: 8, defense: 7, stamina: 8, aggression: 7 },
    description: 'Versatile working dog — intelligent and athletic.',
    fightStyle: 'tactical and calculated, looks for openings',
  },
  {
    breed: 'Belgian Malinois',
    size: 'medium',
    baseStats: { health: 78, power: 7, speed: 9, defense: 6, stamina: 9, aggression: 8 },
    description: 'Elite military/police dog. Explosive speed and drive.',
    fightStyle: 'lightning fast strikes, never tires',
  },
  {
    breed: 'Doberman Pinscher',
    size: 'large',
    baseStats: { health: 82, power: 7, speed: 9, defense: 6, stamina: 7, aggression: 7 },
    description: 'Elegant and lethal. Speed is the weapon.',
    fightStyle: 'hit-and-run specialist, surgical strikes',
  },
  {
    breed: 'Cane Corso',
    size: 'giant',
    baseStats: { health: 105, power: 10, speed: 4, defense: 9, stamina: 6, aggression: 6 },
    description: 'Ancient Roman war dog. Built like a tank.',
    fightStyle: 'slow but devastating, one hit can end it',
  },
  {
    breed: 'Boxer',
    size: 'medium',
    baseStats: { health: 80, power: 7, speed: 8, defense: 6, stamina: 8, aggression: 7 },
    description: 'Athletic and playful but surprisingly tough.',
    fightStyle: 'bouncy footwork, jabs and weaves',
  },
  {
    breed: 'Bulldog',
    size: 'medium',
    baseStats: { health: 75, power: 6, speed: 3, defense: 9, stamina: 4, aggression: 5 },
    description: 'Stocky and stubborn. Low center of gravity.',
    fightStyle: 'immovable object, absorbs damage',
  },
  {
    breed: 'Husky',
    size: 'medium',
    baseStats: { health: 75, power: 5, speed: 8, defense: 5, stamina: 10, aggression: 4 },
    description: 'Built for endurance. Will outlast anyone.',
    fightStyle: 'keeps moving, wears opponents down over time',
  },
  {
    breed: 'Akita',
    size: 'large',
    baseStats: { health: 92, power: 8, speed: 5, defense: 8, stamina: 7, aggression: 8 },
    description: 'Ancient Japanese guardian. Loyal and ferocious.',
    fightStyle: 'explosive bursts of aggression, territorial fury',
  },
  {
    breed: 'Bull Terrier',
    size: 'medium',
    baseStats: { health: 78, power: 7, speed: 7, defense: 7, stamina: 8, aggression: 9 },
    description: 'Egg-headed maniac. All heart, zero quit.',
    fightStyle: 'charges head-first, overwhelms with intensity',
  },
  {
    breed: 'Kangal',
    size: 'giant',
    baseStats: { health: 110, power: 10, speed: 5, defense: 8, stamina: 7, aggression: 6 },
    description: 'Turkish livestock guardian. Strongest bite of any domestic dog.',
    fightStyle: 'one devastating bite at a time',
  },
  {
    breed: 'Dogo Argentino',
    size: 'large',
    baseStats: { health: 90, power: 9, speed: 7, defense: 7, stamina: 8, aggression: 8 },
    description: 'Bred to hunt big game. Fearless pack hunter.',
    fightStyle: 'relentless pursuit, coordinated attacks',
  },
  {
    breed: 'Presa Canario',
    size: 'giant',
    baseStats: { health: 100, power: 9, speed: 4, defense: 9, stamina: 6, aggression: 7 },
    description: 'Canary Island catch dog. Imposing and powerful.',
    fightStyle: 'grapples and controls, uses weight advantage',
  },
  {
    breed: 'Staffordshire Bull Terrier',
    size: 'small',
    baseStats: { health: 70, power: 7, speed: 7, defense: 7, stamina: 8, aggression: 7 },
    description: 'Small but incredibly strong for its size. Pure muscle.',
    fightStyle: 'compact powerhouse, low and aggressive',
  },
  {
    breed: 'Tosa Inu',
    size: 'giant',
    baseStats: { health: 108, power: 9, speed: 3, defense: 9, stamina: 7, aggression: 5 },
    description: 'Japanese fighting breed. Stoic and immovable.',
    fightStyle: 'sumo style — pushes, pins, and pressures',
  },
  {
    breed: 'Jack Russell Terrier',
    size: 'tiny',
    baseStats: { health: 45, power: 3, speed: 10, defense: 3, stamina: 10, aggression: 9 },
    description: 'Tiny psychopath. Doesn\'t know it\'s small.',
    fightStyle: 'chaos incarnate, bites ankles at mach speed',
  },
  {
    breed: 'Chihuahua',
    size: 'tiny',
    baseStats: { health: 35, power: 1, speed: 8, defense: 1, stamina: 6, aggression: 10 },
    description: 'Functionally insane. Believes it is a lion.',
    fightStyle: 'sheer unhinged rage, lots of noise',
  },
  {
    breed: 'Golden Retriever',
    size: 'large',
    baseStats: { health: 85, power: 4, speed: 6, defense: 5, stamina: 7, aggression: 2 },
    description: 'Would rather be friends. Absolute sweetheart.',
    fightStyle: 'confused and apologetic, occasionally sits down',
  },
  {
    breed: 'Great Dane',
    size: 'giant',
    baseStats: { health: 100, power: 7, speed: 5, defense: 6, stamina: 5, aggression: 3 },
    description: 'Gentle giant. Terrifying to look at, terrified of everything.',
    fightStyle: 'awkward swipes, trips over own legs',
  },
  {
    breed: 'Pug',
    size: 'small',
    baseStats: { health: 50, power: 3, speed: 3, defense: 7, stamina: 2, aggression: 4 },
    description: 'Struggles to breathe, struggles to care.',
    fightStyle: 'wheezes loudly, tries to fall asleep',
  },
  {
    breed: 'Dachshund',
    size: 'small',
    baseStats: { health: 55, power: 4, speed: 5, defense: 4, stamina: 6, aggression: 8 },
    description: 'Badger hound. Long body, short temper.',
    fightStyle: 'goes exclusively for the lower legs',
  },
  {
    breed: 'Shiba Inu',
    size: 'small',
    baseStats: { health: 65, power: 5, speed: 8, defense: 6, stamina: 7, aggression: 6 },
    description: 'A cat software running on dog hardware. Screams.',
    fightStyle: 'dodgy and dramatic, emits ear-piercing shrieks',
  },
  {
    breed: 'Greyhound',
    size: 'large',
    baseStats: { health: 70, power: 5, speed: 10, defense: 4, stamina: 4, aggression: 3 },
    description: 'Built like an arrow. Fast but fragile.',
    fightStyle: 'blistering opening speed, gasses out quickly',
  },
  {
    breed: 'Chow Chow',
    size: 'medium',
    baseStats: { health: 80, power: 6, speed: 4, defense: 8, stamina: 5, aggression: 7 },
    description: 'Purple tongue, thick fur, grumpy demeanor.',
    fightStyle: 'ignoring damage through sheer fluff and anger',
  },
  {
    breed: 'Poodle (Standard)',
    size: 'large',
    baseStats: { health: 75, power: 5, speed: 7, defense: 5, stamina: 8, aggression: 4 },
    description: 'Highly intelligent aristocrat. Do not mistake for soft.',
    fightStyle: 'calculated strikes, surprisingly agile',
  },
  {
    breed: 'Dalmatian',
    size: 'large',
    baseStats: { health: 80, power: 6, speed: 8, defense: 6, stamina: 9, aggression: 5 },
    description: 'Carriage dog with limitless energy. Spots everywhere.',
    fightStyle: 'relentless pacing, confusing the opponent',
  },
  {
    breed: 'Basset Hound',
    size: 'medium',
    baseStats: { health: 70, power: 5, speed: 2, defense: 8, stamina: 6, aggression: 3 },
    description: 'Ears drag on the floor. Built for comfort, not speed.',
    fightStyle: 'tripping opponents with their loose skin',
  },
  {
    breed: 'Mastiff',
    size: 'giant',
    baseStats: { health: 115, power: 8, speed: 3, defense: 8, stamina: 4, aggression: 4 },
    description: 'Massive, heavy, and lethargic. Hard to move.',
    fightStyle: 'lays down on top of the opponent',
  },
  {
    breed: 'Corgi',
    size: 'small',
    baseStats: { health: 60, power: 5, speed: 5, defense: 6, stamina: 7, aggression: 6 },
    description: 'Herding dog trapped in a potato body.',
    fightStyle: 'stumpy but surprisingly forceful charges',
  },
];

// ═══════════════════════════════════════════════════════════
// PERSONALITY TRAITS — These create upsets
// ═══════════════════════════════════════════════════════════

export const PERSONALITIES: PersonalityTrait[] = [
  {
    name: 'Berserker',
    emoji: '🔥',
    description: 'Sees red and goes nuclear. Hits harder but leaves openings.',
    modifiers: { power: 1.3, defense: 0.8, aggression: 1.2 },
    critBonus: 0.15,
  },
  {
    name: 'Coward',
    emoji: '😰',
    description: 'Would rather be literally anywhere else right now.',
    modifiers: { speed: 1.2, aggression: 0.5 },
    freezeChance: 0.25,
    dodgeBonus: 0.15,
  },
  {
    name: 'Underdog',
    emoji: '⭐',
    description: 'Gets stronger the more beat up they are. Heart of a champion.',
    modifiers: {},
    rallyChance: 0.4,
  },
  {
    name: 'Showboat',
    emoji: '🎭',
    description: 'Plays to the crowd. Sometimes brilliant, sometimes embarrassing.',
    modifiers: { speed: 1.1, defense: 0.9 },
    critBonus: 0.2,
    freezeChance: 0.1,
  },
  {
    name: 'Stone Cold',
    emoji: '🧊',
    description: 'Zero emotion. Mechanical efficiency. Boring but effective.',
    modifiers: { defense: 1.15, stamina: 1.1 },
  },
  {
    name: 'Glass Cannon',
    emoji: '💎',
    description: 'Devastating power, but can\'t take a hit.',
    modifiers: { power: 1.4, defense: 0.6, stamina: 0.8 },
    critBonus: 0.1,
  },
  {
    name: 'Old Soul',
    emoji: '🧓',
    description: 'Been around the block. Knows every trick.',
    modifiers: { speed: 0.85, defense: 1.2, stamina: 0.9 },
    dodgeBonus: 0.1,
    intimidateChance: 0.15,
  },
  {
    name: 'Puppy Energy',
    emoji: '🐾',
    description: 'So excited!! Everything is a game!! IS THAT A SQUIRREL?!',
    modifiers: { speed: 1.25, stamina: 1.15, aggression: 0.7 },
    freezeChance: 0.35,  // highly distracted
  },
  {
    name: 'Alpha',
    emoji: '👑',
    description: 'Born leader. Dominates through sheer presence.',
    modifiers: { power: 1.1, aggression: 1.15 },
    intimidateChance: 0.25,
  },
  {
    name: 'Scrapper',
    emoji: '🥊',
    description: 'Dirty fighter. Bites ears, steps on toes, no rules.',
    modifiers: { power: 1.05, speed: 1.05, aggression: 1.1 },
    critBonus: 0.12,
  },
  {
    name: 'Gentle Giant',
    emoji: '🌸',
    description: 'Big and strong but genuinely does not want to be here.',
    modifiers: { power: 0.7, defense: 1.3, aggression: 0.4 },
    freezeChance: 0.2,
  },
  {
    name: 'Survivor',
    emoji: '🩹',
    description: 'Has been through it all. Impossible to put down.',
    modifiers: { defense: 1.1, stamina: 1.3 },
    rallyChance: 0.25,
  },
  {
    name: 'Wild Card',
    emoji: '🃏',
    description: 'Completely unpredictable. Could do anything at any moment.',
    modifiers: { power: 1.15, speed: 1.15, defense: 0.85, stamina: 0.85 },
    critBonus: 0.2,
    freezeChance: 0.15,
  },
  {
    name: 'Zen Master',
    emoji: '🧘',
    description: 'Unnervingly calm. Waits for the perfect moment.',
    modifiers: { speed: 0.9, defense: 1.2 },
    dodgeBonus: 0.15,
    critBonus: 0.1,
  },
  {
    name: 'Hyperactive',
    emoji: '⚡',
    description: 'Consumed entirely by caffeine and anxiety.',
    modifiers: { speed: 1.4, stamina: 0.7, power: 0.8 },
    dodgeBonus: 0.25,
  },
  {
    name: 'Grumpy',
    emoji: '😠',
    description: 'Hates everyone. Woke up on the wrong side of the bed.',
    modifiers: { aggression: 1.3, speed: 0.9, defense: 1.1 },
    intimidateChance: 0.1,
  },
  {
    name: 'Clumsy',
    emoji: '🤕',
    description: 'Trips over air. Hits hard when they actually land a shot.',
    modifiers: { speed: 0.7, defense: 0.8, power: 1.2 },
    freezeChance: 0.2, // representing a trip
    critBonus: 0.25, // the accidental haymaker
  },
  {
    name: 'Sly',
    emoji: '🦊',
    description: 'Uses dirty tricks and evades constantly.',
    modifiers: { speed: 1.2, power: 0.8, defense: 0.9 },
    dodgeBonus: 0.18,
    critBonus: 0.05,
  },
  {
    name: 'Loyal',
    emoji: '🛡️',
    description: 'Fights for their owner. Statistically unremarkable, spiritually unbreakable.',
    modifiers: { stamina: 1.2, defense: 1.1, aggression: 1.1 },
    rallyChance: 0.3,
  },
  {
    name: 'Vindictive',
    emoji: '🔪',
    description: 'Holds a grudge. If you hit them, they hit back twice as hard.',
    modifiers: { power: 1.1, aggression: 1.2 },
    critBonus: 0.1, // higher retaliation
  }
];

// ═══════════════════════════════════════════════════════════
// NAME GENERATION
// ═══════════════════════════════════════════════════════════

const FIRST_NAMES = [
  'Duke', 'Killer', 'Tank', 'Bruiser', 'Razor', 'Shadow',
  'Blaze', 'Fang', 'Rex', 'Titan', 'Maverick', 'Ghost',
  'Rocky', 'Zeus', 'Apollo', 'Bear', 'Diesel', 'Max',
  'Ace', 'Jaws', 'Spike', 'Bruno', 'Thor', 'Chaos',
  'Bandit', 'Storm', 'Chief', 'Gunner', 'Rebel', 'Havoc',
  'Biscuit', 'Pudding', 'Mr. Waffles', 'Sir Barks-a-lot',
  'Tiny', 'Princess', 'Cupcake', 'Snuggles', 'Bubbles',
  'Noodle', 'Potato', 'Meatball', 'Nugget', 'Pickles',
  'Buster', 'Champ', 'Bane', 'Goliath', 'Diablo', 'Viper',
  'Odin', 'Brutus', 'Kong', 'Dozer', 'Scout', 'Moose',
  'Rambo', 'Terminator', 'Gizmo', 'Marshmallow', 'T-Bone',
  'Cletus', 'Bojangles', 'Fido', 'Sir Chews-A-Lot', 'Pumpkin',
];

const NICKNAMES = [
  'The Destroyer', 'No Mercy', 'Iron Jaw', 'Lightning',
  'The Machine', 'Bone Crusher', 'The Hurricane', 'Chainsaw',
  'Nightmare', 'The Wall', 'Sledgehammer', 'Dynamite',
  'The Menace', 'Thunderbolt', 'Freight Train', 'The Reaper',
  'Lil\' Terror', 'The Ankle Biter', 'Pint-Sized Pain',
  'The Snuggler', 'Good Boy', 'The Apologizer', 'Nap Time',
  'The Confused One', 'Who Let Him In', 'Emotional Support',
  'Mostly Harmless', 'The Yapper', 'Plot Armor', 'Fan Favorite',
  'The Meat Grinder', 'Widowmaker', 'Juggernaut', 'The Phantom',
  'Fuzzy Wuzzy', 'The Glitch', 'Walks-Into-Walls', 'The Goodest Boy',
  'The Tax Collector', 'Grim', 'The Untouchable', 'Zero Hesitation'
];

const COAT_COLORS = [
  'Black', 'Brindle', 'Fawn', 'Red', 'Blue', 'Merle',
  'Sable', 'Tan', 'White', 'Chocolate', 'Gray', 'Cream',
  'Rust', 'Gold', 'Silver', 'Tri-color', 'Spotted',
  'Piebald', 'Harlequin', 'Isabella', 'Tuxedo'
];

// ═══════════════════════════════════════════════════════════
// IMAGE MAP (Placeholder assignment based on breed, mapped to our generated assets)
// ═══════════════════════════════════════════════════════════
const BREED_IMAGE_MAP: Record<string, string> = {
  // We'll use 8 generated images and assign them out
  'American Pit Bull Terrier': '/dogs/dog_pitbull.png',
  'Rottweiler': '/dogs/dog_rottweiler.png',
  'German Shepherd': '/dogs/dog_gsd.png',
  'Bulldog': '/dogs/dog_bulldog.png',
  'Husky': '/dogs/dog_husky.png',
  'Chihuahua': '/dogs/dog_chihuahua.png',
  'Great Dane': '/dogs/dog_greatdane.png',
  'Pug': '/dogs/dog_pug.png',
  // Fallbacks map to similar dogs
  'Belgian Malinois': '/dogs/dog_gsd.png',
  'Doberman Pinscher': '/dogs/dog_rottweiler.png',
  'Cane Corso': '/dogs/dog_pitbull.png',
  'Boxer': '/dogs/dog_pitbull.png',
  'Akita': '/dogs/dog_husky.png',
  'Bull Terrier': '/dogs/dog_pitbull.png',
  'Kangal': '/dogs/dog_greatdane.png',
  'Dogo Argentino': '/dogs/dog_pitbull.png',
  'Presa Canario': '/dogs/dog_pitbull.png',
  'Staffordshire Bull Terrier': '/dogs/dog_pitbull.png',
  'Tosa Inu': '/dogs/dog_greatdane.png',
  'Jack Russell Terrier': '/dogs/dog_chihuahua.png',
  'Golden Retriever': '/dogs/dog_gsd.png', // Or husky, just a placeholder if needed
  'Dachshund': '/dogs/dog_pug.png',
  'Shiba Inu': '/dogs/dog_husky.png',
  'Greyhound': '/dogs/dog_greatdane.png',
  'Chow Chow': '/dogs/dog_husky.png',
  'Poodle (Standard)': '/dogs/dog_gsd.png',
  'Dalmatian': '/dogs/dog_greatdane.png',
  'Basset Hound': '/dogs/dog_bulldog.png',
  'Mastiff': '/dogs/dog_bulldog.png',
  'Corgi': '/dogs/dog_pug.png',
};

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// ═══════════════════════════════════════════════════════════
// DOG GENERATION
// ═══════════════════════════════════════════════════════════

export function generateDog(forcedBreed?: BreedTemplate): Dog {
  const template = forcedBreed || pick(BREEDS);
  const personality = pick(PERSONALITIES);
  const age = randInt(1, 8);
  
  // Weight varies by size class with some randomness
  const weightRanges: Record<string, [number, number]> = {
    tiny: [4, 15],
    small: [20, 40],
    medium: [40, 70],
    large: [65, 100],
    giant: [90, 150],
  };
  const [minW, maxW] = weightRanges[template.size];
  const weight = randInt(minW, maxW);

  // Apply ±20% randomization to base stats, then personality modifiers
  const varyStat = (base: number, personalityMod?: number) => {
    const varied = base * rand(0.8, 1.2);
    const modified = varied * (personalityMod || 1.0);
    return Math.round(clamp(modified, 0.5, 15) * 10) / 10;
  };

  // Age affects stats: prime at 3-5, young dogs are fast but weak, old dogs are tough but slow
  const agePowerMod = age <= 2 ? 0.85 : age >= 7 ? 0.9 : 1.0;
  const ageSpeedMod = age <= 2 ? 1.1 : age >= 7 ? 0.8 : 1.0;
  const ageDefMod = age <= 2 ? 0.9 : age >= 6 ? 1.1 : 1.0;

  const bs = template.baseStats;
  const pm = personality.modifiers;

  const power = varyStat(bs.power * agePowerMod, pm.power);
  const speed = varyStat(bs.speed * ageSpeedMod, pm.speed);
  const defense = varyStat(bs.defense * ageDefMod, pm.defense);
  const stamina = varyStat(bs.stamina, pm.stamina);
  const aggression = varyStat(bs.aggression, pm.aggression);
  
  // Health is based on base + weight bonus
  const healthVariation = rand(0.85, 1.15);
  const maxHealth = Math.round(bs.health * healthVariation + weight * 0.3);

  const name = pick(FIRST_NAMES);
  const nickname = pick(NICKNAMES);

  return {
    id: generateId(),
    name,
    nickname,
    breed: template.breed,
    size: template.size,
    age,
    weight,
    personality,
    stats: {
      health: maxHealth,
      maxHealth,
      power,
      speed,
      defense,
      stamina,
      aggression,
    },
    fightStyle: template.fightStyle,
    description: template.description,
    record: { wins: randInt(0, 15), losses: randInt(0, 10) },
    color: pick(COAT_COLORS),
    imageUrl: '', // Will be populated async by GenAI
  };
}

/** Generate two dogs that aren't the same breed */
export function generateMatchup(): [Dog, Dog] {
  const dog1 = generateDog();
  let dog2 = generateDog();
  // Ensure different breeds for variety
  let attempts = 0;
  while (dog2.breed === dog1.breed && attempts < 20) {
    dog2 = generateDog();
    attempts++;
  }
  // Also ensure names are different
  if (dog2.name === dog1.name) {
    dog2.name = pick(FIRST_NAMES.filter(n => n !== dog1.name));
  }
  return [dog1, dog2];
}

export async function fetchDogImage(dog: Dog, status: string = 'pre-fight'): Promise<string> {
  try {
    const res = await fetch('http://localhost:8888/api/generate-dog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        breed: dog.breed,
        color: dog.color,
        personality: dog.personality.name,
        name: dog.name,
        status,
      }),
    });
    
    const data = await res.json();
    if (data.image) {
      return data.image;
    }
    return '/dogs/dog_pitbull.png'; // Fallback if API fails
  } catch (error) {
    console.error('Failed to fetch dog image:', error);
    return '/dogs/dog_pitbull.png';
  }
}

// ═══════════════════════════════════════════════════════════
// ODDS CALCULATION
// ═══════════════════════════════════════════════════════════

export function calculateOdds(dog1: Dog, dog2: Dog): MatchOdds {
  // Calculate composite "power rating" for each dog
  const rating = (d: Dog) => {
    const s = d.stats;
    return (
      s.power * 2.0 +
      s.speed * 1.5 +
      s.defense * 1.5 +
      s.stamina * 1.2 +
      s.aggression * 1.0 +
      s.maxHealth * 0.15
    );
  };

  const r1 = rating(dog1);
  const r2 = rating(dog2);
  const total = r1 + r2;

  let prob1 = r1 / total;
  let prob2 = r2 / total;

  // Personality quirks make things less predictable — pull odds toward 50/50
  const personalityVariance = 0.15;
  const quirkFactor1 = (dog1.personality.freezeChance || 0) * 0.5 - 
                        (dog1.personality.critBonus || 0) * 0.3 -
                        (dog1.personality.rallyChance || 0) * 0.2;
  const quirkFactor2 = (dog2.personality.freezeChance || 0) * 0.5 - 
                        (dog2.personality.critBonus || 0) * 0.3 -
                        (dog2.personality.rallyChance || 0) * 0.2;
  
  prob1 = prob1 * (1 - personalityVariance) + 0.5 * personalityVariance + quirkFactor1 * 0.1;
  prob2 = prob2 * (1 - personalityVariance) + 0.5 * personalityVariance + quirkFactor2 * 0.1;

  // Normalize
  const pTotal = prob1 + prob2;
  prob1 /= pTotal;
  prob2 /= pTotal;

  // Clamp so nothing is ever more than 85/15
  prob1 = clamp(prob1, 0.15, 0.85);
  prob2 = 1 - prob1;

  // Convert to decimal odds (what you get back per $1 bet)
  const dog1Odds = Math.round((1 / prob1) * 100) / 100;
  const dog2Odds = Math.round((1 / prob2) * 100) / 100;

  const upset = Math.abs(prob1 - prob2) < 0.15;

  return { dog1Odds, dog2Odds, dog1WinProb: prob1, dog2WinProb: prob2, upset };
}

// ═══════════════════════════════════════════════════════════
// FIGHT SIMULATION
// ═══════════════════════════════════════════════════════════

const ATTACK_NARRATIVES = [
  '{attacker} lunges forward with a vicious bite!',
  '{attacker} charges in and snaps at {defender}\'s flank!',
  '{attacker} goes low and catches {defender} off guard!',
  '{attacker} shakes loose and drives in hard!',
  '{attacker} circles and strikes from the side!',
  '{attacker} pushes forward with raw aggression!',
  '{attacker} gets a clean grip and thrashes!',
  '{attacker} feints left and strikes right!',
];

const CRIT_NARRATIVES = [
  '💥 {attacker} lands a DEVASTATING hit! The crowd goes wild!',
  '💥 {attacker} finds the perfect opening — CRITICAL STRIKE!',
  '💥 WHAT A SHOT! {attacker} connects with everything they\'ve got!',
  '💥 {attacker} unleashes a thunderous blow that rattles {defender}!',
];

const DODGE_NARRATIVES = [
  '{defender} gracefully sidesteps the attack!',
  '{defender} ducks under at the last second! Amazing reflexes!',
  '{defender} reads the move perfectly and evades!',
  '{defender} twists away — nothing but air!',
];

const FREEZE_NARRATIVES = [
  '❄️ {attacker} hesitates... just standing there, looking confused.',
  '❄️ {attacker} freezes up! Seems rattled!',
  '❄️ {attacker} stops to sniff something on the ground. Not the time!',
  '❄️ {attacker} gets distracted by something in the crowd!',
  '❄️ {attacker} sits down. Just... sits down. The crowd boos.',
];

const RALLY_NARRATIVES = [
  '🔥 {attacker} is HURT but FIRED UP! Second wind kicks in!',
  '🔥 {attacker} digs deep — refusing to go down! Power surge!',
  '🔥 The crowd rallies behind {attacker}! They\'re finding new strength!',
  '🔥 {attacker} lets out a ferocious bark and charges back in!',
];

const INTIMIDATE_NARRATIVES = [
  '😨 {attacker} stares down {defender} with cold eyes. {defender} flinches!',
  '😨 {attacker} growls deep and low. {defender} backs up a step...',
  '😨 {attacker}\'s sheer presence is overwhelming. {defender} looks shaken!',
];

function narrate(templates: string[], attacker: Dog, defender: Dog): string {
  const template = pick(templates);
  return template
    .replace(/\{attacker\}/g, `${attacker.name}`)
    .replace(/\{defender\}/g, `${defender.name}`);
}

/** Simulate one full fight step-by-step. Returns array of actions. */
export function simulateFight(dog1Input: Dog, dog2Input: Dog): FightResult {
  // Deep clone so we don't mutate originals
  const dog1: Dog = JSON.parse(JSON.stringify(dog1Input));
  const dog2: Dog = JSON.parse(JSON.stringify(dog2Input));
  
  const actions: FightAction[] = [];
  let round = 0;
  const maxRounds = 30;

  // Track stamina decay
  let stam1 = dog1.stats.stamina;
  let stam2 = dog2.stats.stamina;

  while (dog1.stats.health > 0 && dog2.stats.health > 0 && round < maxRounds) {
    round++;

    // Determine turn order by speed (with some randomness)
    const speed1 = dog1.stats.speed * rand(0.8, 1.2);
    const speed2 = dog2.stats.speed * rand(0.8, 1.2);
    
    const [first, second] = speed1 >= speed2 ? [dog1, dog2] : [dog2, dog1];
    const [firstStam, secondStam] = speed1 >= speed2 ? [stam1, stam2] : [stam2, stam1];

    // Each dog gets one action per round
    for (const [attacker, defender, attackerStamRef] of [
      [first, second, 'first'] as const,
      [second, first, 'second'] as const,
    ]) {
      if (defender.stats.health <= 0) break;

      const currentStam = attackerStamRef === 'first' ? firstStam : secondStam;

      // Stamina decay reduces effectiveness over time
      const staminaFactor = clamp(currentStam / attacker.stats.stamina, 0.4, 1.0);

      // Check for freeze (personality quirk)
      const freezeChance = (attacker.personality.freezeChance || 0) * (1 + (1 - staminaFactor) * 0.5);
      if (Math.random() < freezeChance) {
        actions.push({
          round,
          attacker: attacker.id,
          defender: defender.id,
          action: 'freeze',
          damage: 0,
          narrative: narrate(FREEZE_NARRATIVES, attacker, defender),
          attackerHp: attacker.stats.health,
          defenderHp: defender.stats.health,
        });
        continue;
      }

      // Check for intimidate
      const intimidateChance = attacker.personality.intimidateChance || 0;
      if (Math.random() < intimidateChance) {
        actions.push({
          round,
          attacker: attacker.id,
          defender: defender.id,
          action: 'intimidate',
          damage: 0,
          narrative: narrate(INTIMIDATE_NARRATIVES, attacker, defender),
          attackerHp: attacker.stats.health,
          defenderHp: defender.stats.health,
        });
        // Intimidate debuffs next defense
        defender.stats.defense *= 0.9;
        continue;
      }

      // Check for rally (when below 35% HP)
      const hpPercent = attacker.stats.health / attacker.stats.maxHealth;
      const rallyChance = attacker.personality.rallyChance || 0;
      let rallyBonus = 1.0;
      if (hpPercent < 0.35 && Math.random() < rallyChance) {
        rallyBonus = 1.5;
        actions.push({
          round,
          attacker: attacker.id,
          defender: defender.id,
          action: 'rally',
          damage: 0,
          narrative: narrate(RALLY_NARRATIVES, attacker, defender),
          attackerHp: attacker.stats.health,
          defenderHp: defender.stats.health,
        });
      }

      // Calculate dodge chance
      const baseDodge = defender.stats.speed * 0.03;
      const dodgeBonus = defender.personality.dodgeBonus || 0;
      const dodgeChance = clamp(baseDodge + dodgeBonus, 0, 0.4);

      if (Math.random() < dodgeChance) {
        actions.push({
          round,
          attacker: attacker.id,
          defender: defender.id,
          action: 'dodge',
          damage: 0,
          narrative: narrate(DODGE_NARRATIVES, attacker, defender),
          attackerHp: attacker.stats.health,
          defenderHp: defender.stats.health,
        });
        continue;
      }

      // Calculate damage
      const critChance = 0.08 + (attacker.personality.critBonus || 0);
      const isCrit = Math.random() < critChance;
      
      let baseDamage = attacker.stats.power * rand(0.7, 1.3) * staminaFactor * rallyBonus;
      
      // Aggression affects willingness to go all-in
      const aggressionFactor = attacker.stats.aggression / 10;
      baseDamage *= (0.7 + aggressionFactor * 0.3);

      if (isCrit) baseDamage *= 1.8;

      // Defense reduction
      const defReduction = defender.stats.defense * 0.4;
      let finalDamage = Math.max(1, Math.round(baseDamage - defReduction));
      
      // Size advantage / disadvantage
      const sizeValues: Record<string, number> = { tiny: 1, small: 2, medium: 3, large: 4, giant: 5 };
      const sizeDiff = sizeValues[attacker.size] - sizeValues[defender.size];
      if (sizeDiff > 0) finalDamage = Math.round(finalDamage * (1 + sizeDiff * 0.05));
      if (sizeDiff < 0) finalDamage = Math.round(finalDamage * (1 + sizeDiff * 0.03)); // small dogs take less penalty

      finalDamage = Math.max(1, finalDamage);

      defender.stats.health = Math.max(0, defender.stats.health - finalDamage);

      const actionType = isCrit ? 'crit' : 'attack';
      const templates = isCrit ? CRIT_NARRATIVES : ATTACK_NARRATIVES;
      let narrative = narrate(templates, attacker, defender);
      narrative += ` (-${finalDamage} HP)`;

      actions.push({
        round,
        attacker: attacker.id,
        defender: defender.id,
        action: actionType,
        damage: finalDamage,
        narrative,
        attackerHp: attacker.stats.health,
        defenderHp: defender.stats.health,
      });
    }

    // Stamina decay
    stam1 -= rand(0.3, 0.7);
    stam2 -= rand(0.3, 0.7);

    // If stamina is critically low, take health damage too (exhaustion)
    if (stam1 < 1) {
      const exhaustDmg = randInt(2, 5);
      dog1.stats.health = Math.max(0, dog1.stats.health - exhaustDmg);
      actions.push({
        round,
        attacker: dog1.id,
        defender: dog2.id,
        action: 'attack',
        damage: exhaustDmg,
        narrative: `${dog1.name} is gasping for air! Exhaustion takes its toll. (-${exhaustDmg} HP)`,
        attackerHp: dog1.stats.health,
        defenderHp: dog2.stats.health,
      });
    }
    if (stam2 < 1) {
      const exhaustDmg = randInt(2, 5);
      dog2.stats.health = Math.max(0, dog2.stats.health - exhaustDmg);
      actions.push({
        round,
        attacker: dog2.id,
        defender: dog1.id,
        action: 'attack',
        damage: exhaustDmg,
        narrative: `${dog2.name} is gasping for air! Exhaustion takes its toll. (-${exhaustDmg} HP)`,
        attackerHp: dog2.stats.health,
        defenderHp: dog1.stats.health,
      });
    }
  }

  // Determine winner
  let winner: Dog, loser: Dog, ko: boolean;
  if (dog1.stats.health <= 0) {
    winner = dog2Input;
    loser = dog1Input;
    ko = true;
  } else if (dog2.stats.health <= 0) {
    winner = dog1Input;
    loser = dog2Input;
    ko = true;
  } else {
    // Decision by remaining HP percentage
    const pct1 = dog1.stats.health / dog1.stats.maxHealth;
    const pct2 = dog2.stats.health / dog2.stats.maxHealth;
    if (pct1 >= pct2) {
      winner = dog1Input;
      loser = dog2Input;
    } else {
      winner = dog2Input;
      loser = dog1Input;
    }
    ko = false;
  }

  return { winner, loser, rounds: round, actions, ko };
}

// ═══════════════════════════════════════════════════════════
// BET HELPERS
// ═══════════════════════════════════════════════════════════

export function calculatePayout(betAmount: number, odds: number): number {
  return Math.round(betAmount * odds);
}
