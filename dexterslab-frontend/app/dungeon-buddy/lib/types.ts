export type EquipSlot = 
  | 'head' | 'chest' | 'cloak' 
  | 'mainHand' | 'offHand' | 'gloves' 
  | 'ring1' | 'ring2' | 'boots' | 'amulet';

export type ActionCost = 'action' | 'bonus_action' | 'reaction' | 'special' | 'none';

// ═══════════════════════════════════════════════════════════════
//  TARGET CONDITION — Elemental / School / Type matching
//  Used by add_conditional_damage and the Interceptor pipeline
//  to determine which combat cards a modifier applies to.
// ═══════════════════════════════════════════════════════════════

export interface TargetCondition {
  targetType?: 'melee' | 'ranged' | 'spell' | 'weapon' | 'all';  // What kind of action this applies to
  element?: string;           // e.g. 'fire', 'cold', 'lightning' — matches SpellData.damageType
  school?: string;            // e.g. 'Evocation' — matches SpellData.school
  isCantrip?: boolean;        // true = only matches level 0 spells
  spellName?: string;         // e.g. 'eldritch blast' — matches a specific spell by name (lowercase)
  requiresToggle?: string;    // e.g. 'rage' — only applies when the named ActiveCombatToggle is active
  narrative?: string;         // Human-readable condition for display (e.g. "First hit each turn while raging")
}

// ═══════════════════════════════════════════════════════════════
//  MODIFIER EFFECT SYSTEM
//  Every subclass feature can carry modifiers[] that the engine
//  resolves into mechanical changes on the character sheet.
// ═══════════════════════════════════════════════════════════════

export type ModifierEffect =
  // ── Damage Modifiers ──
  | { type: 'add_damage_ability'; target: string; ability: string; condition?: TargetCondition }
  | { type: 'add_flat_damage'; target: string; value: number; damageType?: string; condition?: TargetCondition }
  | { type: 'add_conditional_damage'; target: 'melee' | 'spell' | 'all'; dice: string; damageType: string; condition: string; targetCondition?: TargetCondition }
  | { type: 'add_range'; target: string; value: number }

  // ── Spell / Casting Modifiers ──
  | { type: 'cast_w_slot'; target: string; spell: string }
  | { type: 'grant_spells_always_prepared'; spells: string[] }
  | { type: 'expanded_spell_list'; spells: { level: number; spellIds: string[] }[] }
  | { type: 'grant_cantrip'; cantrip: string; source: string }

  // ── Proficiency Modifiers ──
  | { type: 'grant_skill'; target: string }
  | { type: 'grant_expertise'; target: string }
  | { type: 'grant_proficiency'; category: 'armor' | 'weapon' | 'save' | 'tool'; value: string }

  // ── Resource Modifiers ──
  | { type: 'add_resource'; resourceId: string; name: string; max: number; recharge: 'short' | 'long' | 'none'; actionCost?: ActionCost; description?: string }
  | { type: 'scale_resource'; resourceId: string; maxFormula: string }  // e.g. "wis_mod", "prof_bonus", "class_level", "half_class_level"
  | { type: 'upgrade_resource_die'; resourceId: string; newDie: string } // e.g. d8 → d10

  // ── Defense / Stat Modifiers ──
  | { type: 'modify_ac'; bonus: number }        // Flat AC bonus (stacks): Ring of Protection +1, Shield spell +5
  | { type: 'set_ac_formula'; formula: string }  // Base AC formula (pick-best): "13+dex" Draconic Resilience, "10+dex+wis" Monk
  | { type: 'grant_resistance'; damageType: string }
  | { type: 'grant_immunity'; condition: string }
  | { type: 'flat_damage_reduction'; value: number; damageTypes?: string[]; nonMagicalOnly?: boolean; source?: string }  // Heavy Armor Master: reduce B/P/S by 3
  | { type: 'grant_extra_hp'; formula: string }  // e.g. "class_level" for Draconic Resilience
  | { type: 'grant_speed'; value: number }
  | { type: 'grant_darkvision'; range: number }

  // ── Combat Feature Modifiers ──
  | { type: 'grant_extra_attack'; source: string; count: number }  // 1 = 2 total attacks, 2 = 3 total
  | { type: 'expand_crit_range'; minRoll: number }  // 19 for Improved Critical, 18 for Superior Critical
  | { type: 'fighting_style'; styleId: string; name: string; effect: string }

  // ── Choice-Based Modifiers (Sorcerer Metamagic, Battle Master Maneuvers) ──
  | { type: 'metamagic_option'; optionId: string; name: string; cost: number; effect: string }
  | { type: 'maneuver_option'; optionId: string; name: string; dice: string; effect: string }

  // ── Subclass-Specific Special ──
  | { type: 'wild_magic_surge'; description: string }
  | { type: 'wild_shape_enhancement'; enhancement: string; details: string }
  | { type: 'summon_companion'; templateId: string }
  | { type: 'grant_third_caster'; spellList: string; allowedSchools?: string[]; freeSchoolLevels?: number[] }

  // ── Post-Hit Modifiers (Divine Smite pattern) ──
  | { type: 'post_hit_modifier'; name: string; costType: 'spell_slot' | 'resource'; costResourceId?: string; dicePerLevel: string; baseDice: string; maxDice?: string; damageType: string }

  // ── Ward HP (Arcane Ward — separate damage absorption pool, NOT bonus HP) ──
  | { type: 'grant_ward_hp'; name: string; formula: string; regenFormula?: string; regenTrigger?: string }

  // ── Virtual Weapons (Unarmed Strikes + Natural Weapons) ──
  // These create combat cards without requiring equipped items.
  | { type: 'modify_unarmed_strike'; damageDie: string; useDexterity: boolean }      // Monk Martial Arts, Tavern Brawler
  | { type: 'grant_natural_weapon'; name: string; damageDie: string; damageType: string; useDexterity?: boolean; properties?: string[] }  // Tabaxi claws, Minotaur horns, etc.
  
  // ── Passive / Narrative (no mechanical automation, just display) ──
  | { type: 'passive'; description: string };

// ═══════════════════════════════════════════════════════════════
//  EXTERNAL EFFECTS — Temporary buffs/debuffs from outside sources
//  (party member spells, environmental hazards, magic items)
// ═══════════════════════════════════════════════════════════════

export type EffectDuration = '1_round' | '1_minute' | '10_minutes' | '1_hour' | '8_hours' | 'until_short_rest' | 'until_long_rest' | 'permanent';

export interface ExternalEffect {
  id: string;                    // Unique identifier (e.g., "eff_shield_of_faith_1713...")
  name: string;                  // Display name (e.g., "Shield of Faith")
  source: string;                // Who applied it (e.g., "Cleric", "Wizard", "Environment")
  modifiers: ModifierEffect[];   // Mechanical effects that flow through the resolver
  duration: EffectDuration;      // When this should be automatically cleaned up
  description?: string;          // Optional flavor/rules text
}

// ═══════════════════════════════════════════════════════════════
//  FEATURE DATA
// ═══════════════════════════════════════════════════════════════

export interface FeatureData {
  id?: string;
  name: string;
  description: string;
  level: number;
  source?: string;           // e.g. "Draconic Bloodline", "Fighter", "Race"
  modifiers?: ModifierEffect[];
  choices?: string[];         // E.g. 'invocations', 'fighting_style'
  choiceType?: 'metamagic' | 'maneuver' | 'totem' | 'land_type' | 'draconic_ancestry' | 'fighting_style' | 'elemental_discipline' | 'invocation';
  choiceCount?: number;       // How many options to pick (e.g. 2 metamagic options at L3)
}

export interface FeatData {
  id: string;
  name: string;
  description: string;
  prerequisite?: string;
  abilityIncrease?: Partial<Record<string, number>>; // e.g. { str: 1 } for half-feats
}

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
  damageType?: string;         // e.g. 'fire', 'cold', 'radiant' — parsed from damage field or backfilled
  actionCost: ActionCost;
  classes: string[];
}

export interface InventoryItem {
  id: string;
  name: string;
  qty: number;
  weight: number;
  attuned: boolean;
  description: string;
  slot?: EquipSlot | null;
  armorClass?: number;
  armorCategory?: 'light' | 'medium' | 'heavy' | 'shield';
  type: 'weapon' | 'armor' | 'gear' | 'tool';
  actionCost?: ActionCost;
  damage?: string;
  damageType?: string;
  properties?: string[];
  weaponCategory?: 'simple' | 'martial';
  // ── Magic Item Bridge (Directive 3) ──
  modifiers?: ModifierEffect[];         // e.g., Ring of Protection carries modify_ac
  rarity?: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary' | 'artifact';
  requiresAttunement?: boolean;
}

export interface TrackedResource {
  name: string;
  max: number;
  used: number; // Stored as integer, UI resolves to checkboxes
  recharge: 'short' | 'long' | 'none';
  actionCost?: ActionCost;
  description?: string;
  die?: string;  // For resources that use dice (e.g. Superiority Dice "d8")
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
  type: 'creation' | 'level_up' | 'manual_edit' | 'item' | 'spell' | 'note' | 'rest' | 'roll' | 'feature' | 'action';
  description: string;
  previousState: any; // Used for undoing level-ups
}

// ═══════════════════════════════════════════════════════════════
//  COMPANION SYSTEM
//  Persistent companions (Beast Master beast, Drake, Steel Defender)
//  stored in char.companions[]. Each has its own mini-sheet.
// ═══════════════════════════════════════════════════════════════

export interface CompanionAttack {
  name: string;
  bonus: string;           // e.g. "+5" or "prof+wis"
  damage: string;           // e.g. "1d8 + 3"
  damageType: string;
  range: string;            // e.g. "5 ft." or "60 ft."
  actionCost: ActionCost;
  description?: string;
}

export interface CompanionFeature {
  name: string;
  description: string;
  actionCost?: ActionCost;
  usesPerRest?: number;
  usesRemaining?: number;
  recharge?: 'short' | 'long';
}

export interface Companion {
  id: string;
  name: string;
  templateId: string;       // Links to companion-templates.ts for base stats
  type: 'beast' | 'drake' | 'spirit' | 'construct' | 'familiar' | 'other';
  source: string;           // e.g. "Beast Master", "Drakewarden", "Find Familiar"

  // Core Stats (can be overridden from template based on class level)
  maxHp: number;
  currentHp: number;
  tempHp: number;
  ac: number;
  speed: string;            // e.g. "40 ft., fly 60 ft."
  
  stats: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };

  // Combat
  attacks: CompanionAttack[];
  features: CompanionFeature[];

  // Scaling
  proficiencyBonus: number;  // Uses master's proficiency bonus
  savingThrows: string[];
  skills: string[];
  resistances: string[];
  immunities: string[];
  senses: string;            // e.g. "Darkvision 60 ft."
  
  // State
  isActive: boolean;         // Currently summoned/alive
  isMounted: boolean;        // For Cavalier / mounted combat
  portrait?: string;
}

// ═══════════════════════════════════════════════════════════════
//  WILD SHAPE FORM (Temporary combat card, NOT a companion)
// ═══════════════════════════════════════════════════════════════

export interface WildShapeForm {
  id: string;
  name: string;              // e.g. "Brown Bear", "Giant Eagle"
  cr: string;                // Challenge Rating
  maxHp: number;
  currentHp: number;
  ac: number;
  speed: string;
  stats: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  attacks: CompanionAttack[];
  features: string[];         // Passive abilities like "Keen Smell"
  isActive: boolean;
}

// ═══════════════════════════════════════════════════════════════
//  ACTIVE MODIFIER STATE (Legacy — retained for backward compat)
// ═══════════════════════════════════════════════════════════════

export interface ActiveModifierState {
  modifierId: string;
  name: string;
  isSpent: boolean;          // true = used this rest, disabled until rest
  recharge: 'short' | 'long';
}

// ═══════════════════════════════════════════════════════════════
//  ACTIVE COMBAT TOGGLE — Sustained buff packages (Rage, Bladesong, etc.)
//  Replaces activeModifiers[] for multi-round combat state toggles.
//  When isActive=true, the resolver folds its modifiers[] into
//  the ResolvedModifiers output as if they were permanent features.
// ═══════════════════════════════════════════════════════════════

export interface ActiveCombatToggle {
  id: string;                    // e.g., 'rage', 'bladesong', 'symbiotic_entity'
  name: string;
  resourceId: string;            // Which resource to expend on activation (e.g., 'rage', 'wild_shape')
  isActive: boolean;
  modifiers: ModifierEffect[];   // Package of effects applied while active
  duration?: string;             // Display string: '1 minute', 'until rest', etc.
}

// ═══════════════════════════════════════════════════════════════
//  STAGED MODIFIER — Pre-cast/pre-attack modifier staging (Metamagic, Maneuvers)
//  Two-step model: (1) player stages a modifier, (2) system applies it
//  and deducts cost on the next qualifying spell/attack.
// ═══════════════════════════════════════════════════════════════

export interface StagedModifier {
  id: string;                    // e.g., 'twinned_spell', 'trip_attack'
  name: string;
  cost: number | 'spell_level';  // Static SP/dice cost, or dynamic 'spell_level' for Twinned Spell
  costResourceId: string;         // e.g., 'sorcery_points', 'superiority_dice'
  effect: string;                 // Human-readable effect description
  targetCondition?: TargetCondition;  // What cards this can be staged onto
  bonusDice?: string;             // e.g., '1d8' for maneuver damage
  bonusDamageType?: string;       // e.g., 'force' for some maneuvers
}

// ═══════════════════════════════════════════════════════════════
//  HOMEBREW REGISTRY — Player-created content with full modifier support
//  All homebrew types support modifiers?: ModifierEffect[] so they
//  hook directly into the resolveModifiers() engine.
// ═══════════════════════════════════════════════════════════════

export interface CustomSpell extends SpellData {
  isHomebrew: true;
  modifiers?: ModifierEffect[];   // e.g., a spell that passively grants resistance while concentrated
  createdAt?: number;
}

export interface CustomItem extends InventoryItem {
  isHomebrew: true;
  // modifiers[] already inherited from InventoryItem
  createdAt?: number;
}

export interface CustomFeature {
  id: string;
  name: string;
  description: string;
  level: number;                  // Minimum level to gain this feature (or current level when created)
  source: string;                 // e.g., "Homebrew", "DM Grant", player notes
  isHomebrew: true;
  modifiers?: ModifierEffect[];   // Mechanical effects resolved by the engine
  isActive: boolean;              // Can be toggled on/off by the player
  createdAt?: number;
}

export interface CustomSubclass {
  id: string;
  name: string;
  className: string;              // Which class this subclass belongs to
  description: string;
  isHomebrew: true;
  features: FeatureData[];        // Full feature tree with modifiers[] on each
  createdAt?: number;
}

export interface HomebrewRegistry {
  spells: CustomSpell[];
  items: CustomItem[];
  features: CustomFeature[];
  subclasses: CustomSubclass[];
}

// ═══════════════════════════════════════════════════════════════
//  LIVE CHARACTER (Master Character Sheet)
// ═══════════════════════════════════════════════════════════════

export interface LiveCharacter {
  id: string;
  name: string;
  race: string;
  class: string; // Origin / Primary Class
  classes?: Record<string, number>; // Full BG3-style Multiclass mapping e.g { "Fighter": 2, "Wizard": 3 }
  subclasses?: Record<string, string>; // Multi-subclass mapping
  subclass: string | null;
  subclassChoices?: Record<string, any>;  // Subclass-specific selections (Draconic Ancestry, Totem animal, Land type)
  background: string;
  level: number; // Total Character Level
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
  features: FeatureData[];
  feats: FeatData[]; // Optional feats chosen over ASIs
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

  // ── Subclass Modifier Engine ──
  activeModifiers?: ActiveModifierState[];     // Legacy one-shot togglable modifiers (maintained for backward compat)
  activeCombatToggles?: ActiveCombatToggle[];  // Sustained combat state toggles (Rage, Bladesong, etc.)
  stagedModifier?: StagedModifier | null;      // Currently staged modifier awaiting next spell/attack
  companions?: Companion[];                    // Persistent companions (Beast Master, Drakewarden, etc.)
  wildShapeForm?: WildShapeForm | null;        // Active Wild Shape form (temporary combat card)
  extraAttacks?: number;                       // Computed: max Extra Attack count (1 = 2 attacks total)
  critRange?: number;                          // Computed: minimum crit roll (default 20, Champion 19/18)

  // ── External Effects (Phase 4: Floating Modifiers) ──
  externalEffects?: ExternalEffect[];          // Temporary buffs/debuffs from outside sources

  // ── Universal Homebrew Engine ──
  homebrew?: HomebrewRegistry;                 // Player-created spells, items, features, subclasses
}
