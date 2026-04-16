/**
 * ═══════════════════════════════════════════════════════════════
 *  THE CRUCIBLE — Stress Test Seeder
 *  
 *  Injects a complex Paladin 5 / Warlock 5 (Hexblade) multiclass
 *  character into the backend storage. This character exercises
 *  every edge case from Phases 1–5:
 *
 *    Phase 1:  Plate Armor + Shield AC stacking
 *    Phase 2:  Unarmed Strike (universal)
 *    Phase 3:  Overlapping spell slots + pact magic pools
 *    Phase 4:  Pre-injected Bless external effect
 *    Phase 5:  Shield spell + reaction interrupt
 *
 *  Usage:  node scripts/seed-crucible.js
 * ═══════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'dungeon-buddy-characters.json');
const CRUCIBLE_ID = 'char_crucible_stress_test';

// ── Build the LiveCharacter ──

const crucibleChar = {
  id: CRUCIBLE_ID,
  name: 'Kael Ashbrand',
  race: 'Half-Elf',
  class: 'Paladin',
  subclass: 'Oath of Vengeance',
  background: 'Soldier',
  alignment: 'Lawful Neutral',
  level: 10,

  maxHp: 84,
  currentHp: 84,
  tempHp: 0,
  hitDie: '10',
  hitDiceTotal: 10,
  hitDiceUsed: 0,

  stats: { str: 18, dex: 10, con: 14, int: 8, wis: 10, cha: 16 },

  savingThrows: ['wis', 'cha'],
  skills: ['athletics', 'intimidation', 'persuasion', 'deception'],
  expertise: [],

  speed: 30,
  conditions: [],
  deathSaves: { successes: 0, failures: 0 },

  spellcaster: true,
  spellcastingAbility: 'cha',

  // ═══════════════════════════════════════
  //  RESOURCES — Phase 3 Stress Target
  //  Paladin slots + Warlock Pact Magic
  //  = overlapping pool cross-talk
  // ═══════════════════════════════════════

  resources: {
    // Paladin half-caster spell slots (Level 5 Paladin)
    spell_slot_1: { name: 'Level 1 Spell Slot', max: 4, used: 0, recharge: 'long' },
    spell_slot_2: { name: 'Level 2 Spell Slot', max: 2, used: 0, recharge: 'long' },

    // Warlock Pact Magic (Level 5 Warlock = 2 slots at Level 3)
    pact_magic: { name: 'Pact Slots (Lv.3)', max: 2, used: 0, recharge: 'short' },

    // Paladin class resources
    lay_on_hands: {
      name: 'Lay on Hands',
      max: 25,
      used: 0,
      recharge: 'long',
      actionCost: 'action',
      description: 'Restore HP from a pool of 25 (5 × Paladin level). Can also cure disease or neutralize poison for 5 points.'
    },

    // Warlock invocations don't use charges, but Channel Divinity does
    channel_divinity: {
      name: 'Channel Divinity',
      max: 1,
      used: 0,
      recharge: 'short',
      actionCost: 'action',
      description: 'Oath of Vengeance: Vow of Enmity (bonus action, advantage on attacks vs one creature for 1 min) or Abjure Enemy (action, frighten one creature).'
    },
  },

  // ═══════════════════════════════════════
  //  SPELLS — Phase 5 Stress Target
  //  Shield + Hellish Rebuke = reactions
  //  Bless = party buff (Phase 4 test)
  // ═══════════════════════════════════════

  cantrips: ['eldritch_blast', 'booming_blade'],
  knownSpells: [
    'shield',                // REACTION — Phase 5 interrupt
    'hellish_rebuke',        // REACTION — takes damage trigger
    'bless',                 // Concentration buff
    'eldritch_blast',        // Warlock cantrip (also in cantrips for dual registration)
    'hex',                   // Warlock concentration
    'armor_of_agathys',      // Warlock spell
    'wrathful_smite',        // Paladin spell
    'thunderous_smite',      // Paladin spell
    'misty_step',            // Warlock spell
    'hold_person',           // Paladin/Warlock overlap
    'branding_smite',        // Paladin spell
    'absorb_elements',       // REACTION — elemental damage trigger (Phase 5)
  ],
  preparedSpells: [
    'shield',
    'hellish_rebuke',
    'bless',
    'hex',
    'wrathful_smite',
    'thunderous_smite',
    'misty_step',
    'hold_person',
    'branding_smite',
    'absorb_elements',
  ],
  customSpells: [],

  // ═══════════════════════════════════════
  //  EQUIPMENT — Phase 1 Stress Target
  //  Plate + Shield = 20 AC base
  //  Longsword = versatile weapon
  // ═══════════════════════════════════════

  inventory: [
    {
      id: 'crucible_plate',
      name: 'Plate Armor',
      qty: 1,
      weight: 65,
      attuned: false,
      slot: 'chest',
      type: 'armor',
      description: 'Full plate armor forged in the furnaces of Neverwinter.',
      armorClass: 18,
      armorCategory: 'heavy',
      actionCost: 'none',
    },
    {
      id: 'crucible_shield',
      name: 'Shield',
      qty: 1,
      weight: 6,
      attuned: false,
      slot: 'offHand',
      type: 'armor',
      description: 'A sturdy steel shield emblazoned with a clenched fist.',
      armorClass: 2,
      armorCategory: 'shield',
      actionCost: 'none',
    },
    {
      id: 'crucible_longsword',
      name: 'Longsword',
      qty: 1,
      weight: 3,
      attuned: false,
      slot: 'mainHand',
      type: 'weapon',
      description: 'A finely balanced longsword, its blade etched with pale runes.',
      damage: '1d8',
      damageType: 'slashing',
      properties: ['versatile (1d10)'],
      weaponCategory: 'martial',
      actionCost: 'action',
    },
    {
      id: 'crucible_javelins',
      name: 'Javelin',
      qty: 5,
      weight: 2,
      attuned: false,
      slot: null,
      type: 'weapon',
      description: 'Standard throwing javelins.',
      damage: '1d6',
      damageType: 'piercing',
      properties: ['thrown (range 30/120)'],
      weaponCategory: 'simple',
      actionCost: 'action',
    },
  ],

  equipped: {
    head: null,
    chest: {
      id: 'crucible_plate',
      name: 'Plate Armor',
      qty: 1,
      weight: 65,
      attuned: false,
      slot: 'chest',
      type: 'armor',
      description: 'Full plate armor forged in the furnaces of Neverwinter.',
      armorClass: 18,
      armorCategory: 'heavy',
      actionCost: 'none',
    },
    cloak: null,
    mainHand: {
      id: 'crucible_longsword',
      name: 'Longsword',
      qty: 1,
      weight: 3,
      attuned: false,
      slot: 'mainHand',
      type: 'weapon',
      description: 'A finely balanced longsword, its blade etched with pale runes.',
      damage: '1d8',
      damageType: 'slashing',
      properties: ['versatile (1d10)'],
      weaponCategory: 'martial',
      actionCost: 'action',
    },
    offHand: {
      id: 'crucible_shield',
      name: 'Shield',
      qty: 1,
      weight: 6,
      attuned: false,
      slot: 'offHand',
      type: 'armor',
      description: 'A sturdy steel shield emblazoned with a clenched fist.',
      armorClass: 2,
      armorCategory: 'shield',
      actionCost: 'none',
    },
    gloves: null,
    boots: null,
    ring1: null,
    ring2: null,
    amulet: null,
  },

  gold: 150,
  silver: 30,
  copper: 0,

  // ═══════════════════════════════════════
  //  ATTACKS
  // ═══════════════════════════════════════

  attacks: [
    {
      id: 'atk_longsword',
      name: 'Longsword',
      bonus: '+7',     // STR 18 (+4) + Prof (+3)
      damage: '1d8+4',
      type: 'slashing',
      actionCost: 'action',
    },
    {
      id: 'atk_javelin',
      name: 'Javelin',
      bonus: '+7',
      damage: '1d6+4',
      type: 'piercing',
      actionCost: 'action',
    },
  ],

  // ═══════════════════════════════════════
  //  FEATURES — Multiclass Paladin/Warlock
  //  Includes Divine Smite post_hit_modifier
  // ═══════════════════════════════════════

  features: [
    // ── Paladin Core ──
    { level: 1, name: 'Divine Sense', description: 'Detect the location of any celestial, fiend, or undead within 60 feet.', source: 'Paladin' },
    { level: 1, name: 'Lay on Hands', description: 'Pool of healing power: 5 HP × Paladin level. Can cure disease for 5 points.', source: 'Paladin' },
    { level: 2, name: 'Fighting Style: Defense', description: '+1 AC while wearing armor.', source: 'Paladin',
      modifiers: [{ type: 'modify_ac', bonus: 1 }]
    },
    { level: 2, name: 'Divine Smite', description: 'Expend spell slot to deal extra 2d8 radiant damage on a hit. +1d8 per slot above 1st (max 5d8). +1d8 vs undead/fiend.', source: 'Paladin',
      modifiers: [{
        type: 'post_hit_modifier',
        name: 'Divine Smite',
        costType: 'spell_slot',
        baseDice: '2d8',
        dicePerLevel: '1d8',
        maxDice: '5d8',
        damageType: 'radiant'
      }]
    },
    { level: 3, name: 'Divine Health', description: 'Immune to disease.', source: 'Paladin' },
    { level: 3, name: 'Vow of Enmity', description: 'Bonus action: Choose a creature within 10 feet. You gain advantage on attack rolls against it for 1 minute.', source: 'Oath of Vengeance' },
    { level: 5, name: 'Extra Attack', description: 'You can attack twice when you take the Attack action on your turn.', source: 'Paladin',
      modifiers: [{ type: 'grant_extra_attack', count: 1 }]
    },

    // ── Warlock (Hexblade) Core ──
    { level: 1, name: 'Pact Magic', description: 'Cast warlock spells using Charisma. Slots recharge on short rest.', source: 'Warlock' },
    { level: 1, name: "Hexblade's Curse", description: "Bonus action: Curse a creature. +Prof bonus to damage, crit on 19-20, regain HP on its death.", source: 'Hexblade',
      modifiers: [{ type: 'passive', description: '+3 damage to cursed target, crit on 19-20 vs cursed.' }]
    },
    { level: 1, name: 'Hex Warrior', description: 'Use CHA instead of STR/DEX for one weapon you touch after long rest. Gain proficiency with medium armor, shields, and martial weapons.', source: 'Hexblade' },
    { level: 2, name: 'Eldritch Invocations', description: 'Agonizing Blast (CHA to Eldritch Blast damage) and Repelling Blast (push 10 ft on EB hit).', source: 'Warlock' },
    { level: 3, name: 'Pact of the Blade', description: 'Create a pact weapon. It counts as magical for overcoming resistance. Can turn a magic weapon into your pact weapon.', source: 'Warlock' },
    { level: 5, name: 'Thirsting Blade', description: 'Attack with your pact weapon twice when you take the Attack action.', source: 'Warlock (Invocation)' },
  ],

  feats: [],

  traits: ['Darkvision (60 ft)', 'Fey Ancestry (advantage vs charm, immune to magical sleep)', '+2 CHA, +1 STR, +1 CON (racial)'],
  languages: ['Common', 'Elvish', 'Infernal', 'Abyssal'],
  armorProficiencies: ['light', 'medium', 'heavy', 'shield'],
  weaponProficiencies: ['simple', 'martial'],

  portrait: null,
  personalityTraits: 'Speaks with a quiet intensity. Believes every oath must be honored or paid in blood.',
  ideals: 'Vengeance tempered by law. The wicked will face judgment.',
  bonds: "Bound to a pact with a sentient blade called Dusk's Edge. Searches for the fiend who destroyed his order.",
  flaws: 'Cannot forgive betrayal. Will sacrifice allies if it means fulfilling a sworn oath.',
  notes: '⚠️ CRUCIBLE TEST CHARACTER — Paladin 5 / Warlock 5 (Hexblade)\n\nPhase 1: Plate (18) + Shield (2) + Defense (+1) = 21 AC\nPhase 2: Universal Unarmed Strike\nPhase 3: Paladin slots + Pact Magic overlap\nPhase 4: Pre-injected Bless effect\nPhase 5: Shield + Absorb Elements reactions',
  quests: 'Find and destroy the fiend Xar\'rathos.',
  people: 'Serena Brightwell (Cleric ally), Thane Ulf (mercenary contact)',
  places: 'Ruins of the Silver Sanctum, The Hexed Wastes',

  // ═══════════════════════════════════════
  //  LOGBOOK — initial creation entry
  // ═══════════════════════════════════════

  logbook: [
    {
      id: 'log_crucible_seed',
      timestamp: Date.now(),
      type: 'creation',
      description: '⚗️ CRUCIBLE: Character seeded by stress-test script. Paladin 5 / Warlock 5 (Hexblade). All Edge Case Phases (1–5) should be exercisable.',
      previousState: null,
    }
  ],

  // ═══════════════════════════════════════
  //  MODIFIER ENGINE STATE
  // ═══════════════════════════════════════

  activeModifiers: [],
  activeCombatToggles: [],
  stagedModifier: null,
  companions: [],
  wildShapeForm: null,
  extraAttacks: 1,           // From Extra Attack (Paladin 5)
  critRange: 20,             // Default (Hexblade Curse sets to 19 when active)

  // ═══════════════════════════════════════
  //  PHASE 4: PRE-INJECTED EXTERNAL EFFECT
  //  Bless from party Cleric
  // ═══════════════════════════════════════

  externalEffects: [
    {
      id: 'eff_bless_crucible',
      name: 'Bless',
      source: 'Cleric (Serena)',
      duration: '1_minute',
      description: '+1d4 to attack rolls and saving throws',
      modifiers: [
        { type: 'passive', description: '+1d4 to attack rolls and saving throws (Bless)' }
      ],
    }
  ],

  homebrew: { spells: [], items: [], features: [], subclasses: [] },
};


// ═══════════════════════════════════════════════════════════════
//  INJECT INTO STORAGE
// ═══════════════════════════════════════════════════════════════

function seed() {
  console.log('');
  console.log('  ⚗️  THE CRUCIBLE — Stress Test Seeder');
  console.log('  ─────────────────────────────────────');

  // Read existing characters
  let characters = [];
  if (fs.existsSync(DATA_FILE)) {
    try {
      characters = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      console.warn('  ⚠️  Could not parse existing data file, starting fresh.');
      characters = [];
    }
  }

  // Remove any existing crucible character (idempotent)
  const before = characters.length;
  characters = characters.filter(c => c.id !== CRUCIBLE_ID);
  if (characters.length < before) {
    console.log('  🔄 Removed existing Crucible character (re-seeding).');
  }

  // Inject the new one
  characters.push(crucibleChar);

  // Ensure data directory exists
  const dataDir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Write
  fs.writeFileSync(DATA_FILE, JSON.stringify(characters, null, 2), 'utf8');

  console.log('');
  console.log(`  ✅ Injected: ${crucibleChar.name} (Paladin 5 / Warlock 5)`);
  console.log(`  📁 File: ${DATA_FILE}`);
  console.log(`  📊 Total characters in file: ${characters.length}`);
  console.log('');
  console.log('  Stress Targets:');
  console.log('    Phase 1: AC = 18 (Plate) + 2 (Shield) + 1 (Defense) = 21');
  console.log('    Phase 2: Universal Unarmed Strike card');
  console.log('    Phase 3: spell_slot_1 (×4) + spell_slot_2 (×2) + pact_magic (×2 Lv.3)');
  console.log('    Phase 4: Bless pre-injected as ExternalEffect');
  console.log('    Phase 5: Shield (reaction) + Absorb Elements (reaction)');
  console.log('    Smite:   Divine Smite post_hit_modifier on all weapon cards');
  console.log('');
  console.log('  🚀 Boot the app and navigate to Kael Ashbrand to begin testing.');
  console.log('');
}

seed();
