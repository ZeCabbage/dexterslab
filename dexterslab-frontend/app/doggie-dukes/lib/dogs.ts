// ═══════════════════════════════════════════════════════════════
//  DOGGIE DUKES — Dog Data Layer
//  Breed templates, stat randomization, name generation, odds
// ═══════════════════════════════════════════════════════════════

export interface DogStats {
  biteForce: number;   // Damage per hit (1-100)
  agility: number;     // Dodge chance + attack speed (1-100)
  thickness: number;   // Damage reduction (1-100)
  heart: number;       // Total HP + comeback factor (1-100)
  fightIQ: number;     // Combo chance, counter-attack (1-100)
}

export interface Dog {
  id: string;
  name: string;
  breed: string;
  personality: Personality;
  color: string;
  stats: DogStats;
  maxHP: number;
  portrait?: string;   // AI-generated image data URL
}

export type Personality = 'Berserker' | 'Coward' | 'Zen Master' | 'Puppy Energy' | 'Old Veteran' | 'Scrapper';

// ── Breed Templates ──
// Each breed has base stats and a range for randomization

interface BreedTemplate {
  name: string;
  color: string;
  base: DogStats;
  range: DogStats; // How much each stat can deviate (+/-)
}

const BREEDS: BreedTemplate[] = [
  {
    name: 'Pit Bull',
    color: 'brown',
    base: { biteForce: 80, agility: 45, thickness: 75, heart: 70, fightIQ: 50 },
    range: { biteForce: 15, agility: 15, thickness: 10, heart: 15, fightIQ: 20 },
  },
  {
    name: 'Greyhound',
    color: 'silver',
    base: { biteForce: 40, agility: 90, thickness: 25, heart: 55, fightIQ: 60 },
    range: { biteForce: 15, agility: 8, thickness: 10, heart: 15, fightIQ: 15 },
  },
  {
    name: 'Rottweiler',
    color: 'black',
    base: { biteForce: 85, agility: 35, thickness: 80, heart: 75, fightIQ: 45 },
    range: { biteForce: 10, agility: 15, thickness: 10, heart: 10, fightIQ: 20 },
  },
  {
    name: 'German Shepherd',
    color: 'tan',
    base: { biteForce: 70, agility: 65, thickness: 60, heart: 65, fightIQ: 75 },
    range: { biteForce: 15, agility: 15, thickness: 15, heart: 15, fightIQ: 10 },
  },
  {
    name: 'Chihuahua',
    color: 'cream',
    base: { biteForce: 20, agility: 95, thickness: 10, heart: 30, fightIQ: 85 },
    range: { biteForce: 10, agility: 5, thickness: 8, heart: 15, fightIQ: 10 },
  },
  {
    name: 'Great Dane',
    color: 'grey',
    base: { biteForce: 75, agility: 30, thickness: 70, heart: 90, fightIQ: 35 },
    range: { biteForce: 15, agility: 10, thickness: 15, heart: 8, fightIQ: 20 },
  },
  {
    name: 'Husky',
    color: 'white',
    base: { biteForce: 60, agility: 70, thickness: 55, heart: 80, fightIQ: 55 },
    range: { biteForce: 15, agility: 15, thickness: 15, heart: 10, fightIQ: 15 },
  },
  {
    name: 'Doberman',
    color: 'dark brown',
    base: { biteForce: 75, agility: 80, thickness: 45, heart: 60, fightIQ: 70 },
    range: { biteForce: 10, agility: 10, thickness: 15, heart: 15, fightIQ: 15 },
  },
  {
    name: 'Bulldog',
    color: 'brindle',
    base: { biteForce: 70, agility: 20, thickness: 90, heart: 85, fightIQ: 30 },
    range: { biteForce: 15, agility: 10, thickness: 8, heart: 10, fightIQ: 20 },
  },
  {
    name: 'Border Collie',
    color: 'black and white',
    base: { biteForce: 35, agility: 85, thickness: 35, heart: 60, fightIQ: 90 },
    range: { biteForce: 15, agility: 10, thickness: 10, heart: 15, fightIQ: 8 },
  },
  {
    name: 'Boxer',
    color: 'fawn',
    base: { biteForce: 65, agility: 70, thickness: 60, heart: 75, fightIQ: 55 },
    range: { biteForce: 15, agility: 15, thickness: 15, heart: 10, fightIQ: 15 },
  },
  {
    name: 'Akita',
    color: 'red',
    base: { biteForce: 80, agility: 40, thickness: 75, heart: 85, fightIQ: 40 },
    range: { biteForce: 12, agility: 15, thickness: 10, heart: 8, fightIQ: 20 },
  },
];

// ── Personality Modifiers ──

const PERSONALITY_MODIFIERS: Record<Personality, Partial<DogStats>> = {
  'Berserker':    { biteForce: 15, agility: -5, thickness: -10, heart: 5, fightIQ: -10 },
  'Coward':       { biteForce: -15, agility: 20, thickness: -5, heart: -10, fightIQ: 10 },
  'Zen Master':   { biteForce: 0, agility: 5, thickness: 10, heart: 5, fightIQ: 15 },
  'Puppy Energy': { biteForce: -5, agility: 15, thickness: -5, heart: 15, fightIQ: -15 },
  'Old Veteran':  { biteForce: 5, agility: -10, thickness: 15, heart: 10, fightIQ: 20 },
  'Scrapper':     { biteForce: 10, agility: 10, thickness: -10, heart: 10, fightIQ: -5 },
};

export const PERSONALITY_DESCRIPTIONS: Record<Personality, string> = {
  'Berserker':    'All offense, no defense. Hits like a truck but takes damage like paper.',
  'Coward':       'Runs first, bites second. Hard to hit but barely hurts.',
  'Zen Master':   'Calm, calculated, untouchable. Waits for the perfect counter.',
  'Puppy Energy': 'Chaotic, unpredictable, never stops moving. Exhausting to fight.',
  'Old Veteran':  'Seen it all. Slow but tough as nails with killer instincts.',
  'Scrapper':     'Dirty fighter. Gets in close, stays in close, never stops swinging.',
};

// ── Fight Name Generator ──

const FIRST_NAMES = [
  'Iron', 'The', 'Lil', 'Big', 'Mad', 'Ol\'', 'Mean', 'Tiny',
  'Crazy', 'Sweet', 'Stone', 'Bone', 'King', 'Razor', 'Ghost', 'Rusty',
];

const LAST_NAMES = [
  'Jaw', 'Fang', 'Paws', 'Thunder', 'Chomp', 'Bite', 'Rage', 'Storm',
  'Professor', 'Biscuit', 'Snapper', 'Bruiser', 'Ripper', 'Shredder',
  'Chaos', 'Fury', 'Mauler', 'Cruncher', 'Havoc', 'Destroyer',
];

// ── Utility ──

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function randRange(base: number, range: number): number {
  return base + Math.floor(Math.random() * (range * 2 + 1)) - range;
}

function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Generate a Random Dog ──

let dogIdCounter = 0;

export function generateDog(): Dog {
  const breed = randItem(BREEDS);
  const personality = randItem(Object.keys(PERSONALITY_MODIFIERS) as Personality[]);
  const mods = PERSONALITY_MODIFIERS[personality];

  const stats: DogStats = {
    biteForce: clamp(randRange(breed.base.biteForce, breed.range.biteForce) + (mods.biteForce || 0), 5, 99),
    agility:   clamp(randRange(breed.base.agility, breed.range.agility) + (mods.agility || 0), 5, 99),
    thickness: clamp(randRange(breed.base.thickness, breed.range.thickness) + (mods.thickness || 0), 5, 99),
    heart:     clamp(randRange(breed.base.heart, breed.range.heart) + (mods.heart || 0), 5, 99),
    fightIQ:   clamp(randRange(breed.base.fightIQ, breed.range.fightIQ) + (mods.fightIQ || 0), 5, 99),
  };

  const maxHP = 100 + Math.floor(stats.heart * 1.5);

  const name = `${randItem(FIRST_NAMES)} ${randItem(LAST_NAMES)}`;

  return {
    id: `dog-${++dogIdCounter}-${Date.now()}`,
    name,
    breed: breed.name,
    personality,
    color: breed.color,
    stats,
    maxHP,
  };
}

// ── Generate a Fight Pair (ensures different breeds) ──

export function generateFightPair(): [Dog, Dog] {
  const dog1 = generateDog();
  let dog2 = generateDog();

  // Ensure different breeds for variety
  let attempts = 0;
  while (dog2.breed === dog1.breed && attempts < 10) {
    dog2 = generateDog();
    attempts++;
  }

  return [dog1, dog2];
}

// ── Calculate Odds ──
// Returns odds as multipliers: [dog1Payout, dog2Payout]
// Favorite gets lower payout, underdog gets higher

export function calculateOdds(dog1: Dog, dog2: Dog): [number, number] {
  const power1 = dog1.stats.biteForce + dog1.stats.agility + dog1.stats.thickness + dog1.stats.heart + dog1.stats.fightIQ;
  const power2 = dog2.stats.biteForce + dog2.stats.agility + dog2.stats.thickness + dog2.stats.heart + dog2.stats.fightIQ;

  const total = power1 + power2;
  const ratio1 = power2 / total; // Higher opponent power = higher payout for betting on this dog
  const ratio2 = power1 / total;

  // Convert to payout multipliers (1.2x to 4.5x range)
  const payout1 = Math.max(1.2, Math.min(4.5, 1 + ratio1 * 3));
  const payout2 = Math.max(1.2, Math.min(4.5, 1 + ratio2 * 3));

  return [
    Math.round(payout1 * 10) / 10,
    Math.round(payout2 * 10) / 10,
  ];
}

// ── Bankroll Management ──

const BANKROLL_KEY = 'doggieDukes_bankroll';
const DEFAULT_BANKROLL = 1000;
const RESCUE_BANKROLL = 500;

export function getBankroll(): number {
  if (typeof window === 'undefined') return DEFAULT_BANKROLL;
  const saved = localStorage.getItem(BANKROLL_KEY);
  return saved ? parseInt(saved, 10) : DEFAULT_BANKROLL;
}

export function setBankroll(amount: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BANKROLL_KEY, String(Math.max(0, amount)));
}

export function rescueBankroll(): number {
  setBankroll(RESCUE_BANKROLL);
  return RESCUE_BANKROLL;
}
