export type EquipSlot = 
  | 'head' | 'chest' | 'cloak' 
  | 'mainHand' | 'offHand' | 'gloves' 
  | 'ring1' | 'ring2' | 'boots' | 'amulet';

export type ActionCost = 'action' | 'bonus_action' | 'reaction' | 'special' | 'none';

export interface SpellData {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  description: string;
  damage?: string;
  actionCost: ActionCost;
  classes: string[];
}

export interface InventoryItem {
  id: string;
  name: string;
  qty: number;
  weight: number;
  equipped: boolean;
  attuned: boolean;
  description: string;
  slot?: EquipSlot | null;
  armorClass?: number;
  armorCategory?: 'light' | 'medium' | 'heavy' | 'shield';
  type: 'weapon' | 'armor' | 'gear' | 'tool';
  actionCost?: ActionCost;
  damage?: string;
}

export interface TrackedResource {
  name: string;
  max: number;
  used: number; // Stored as integer, UI resolves to checkboxes
  recharge: 'short' | 'long' | 'none';
  actionCost?: ActionCost;
}

export interface Attack {
  id: string;
  name: string;
  bonus: string;
  damage: string;
  type: string;
  actionCost?: ActionCost;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'creation' | 'level_up' | 'manual_edit' | 'item' | 'spell' | 'note' | 'rest';
  description: string;
  previousState: any; // Used for undoing level-ups
}

export interface LiveCharacter {
  id: string;
  name: string;
  race: string;
  class: string;
  background: string;
  level: number;
  xp: number;
  alignment: string;
  
  maxHp: number;
  currentHp: number;
  tempHp: number;
  hitDie: string;
  hitDiceTotal: number;
  hitDiceUsed: number;
  
  stats: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  
  savingThrows: string[];
  skills: string[];
  expertise: string[];
  
  speed: number;
  conditions: string[];
  deathSaves: { successes: number; failures: number };
  
  attacks: Attack[];
  spellcaster: boolean;
  spellcastingAbility: string | null;
  resources: Record<string, TrackedResource>; // "spell_1": {max:4, used:2, recharge:'long'}
  cantrips: string[];
  knownSpells: string[];
  preparedSpells: string[];
  customSpells: SpellData[];
  
  inventory: InventoryItem[];
  gold: number;
  silver: number;
  copper: number;
  equipped: Record<EquipSlot, InventoryItem | null>; // Direct item tracking for Paper Doll
  
  traits: string[];
  features: { name: string; description: string; level: number }[]; // Raw features lists that aren't tracked
  languages: string[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  
  portrait: string | null;
  personalityTraits: string;
  ideals: string;
  bonds: string;
  flaws: string;
  notes: string;
  quests: string;
  people: string;
  places: string;
  logbook: LogEntry[];
}
