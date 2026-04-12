import { SubclassFeatureSet } from './subclass-features';

export const WIZARD_SUBCLASSES: SubclassFeatureSet[] = [
  {
    id: 'school_of_abjuration', name: 'School of Abjuration', className: 'Wizard',
    description: 'Magic that blocks, banishes, or protects.',
    features: [
      { name: 'Abjuration Savant', description: 'Gold and time to copy Abjuration spells is halved.', level: 2, source: 'School of Abjuration', modifiers: [{ type: 'passive', description: 'Cheaper Abjuration scribing.' }] },
      { name: 'Arcane Ward', description: 'Casting an Abjuration spell creates a magical ward with HP equal to twice your wizard level + INT mod. Absorbs damage for you. Casting later abjuration spells heals it by 2 × spell level.', level: 2, source: 'School of Abjuration', modifiers: [{ type: 'grant_extra_hp', formula: 'class_level' }, { type: 'passive', description: 'Arcane Ward pool.' }] },
      { name: 'Projected Ward', description: 'Use reaction when ally within 30 ft takes damage to have the Arcane Ward absorb it.', level: 6, source: 'School of Abjuration', modifiers: [{ type: 'passive', description: 'Reaction to protect ally with Arcane Ward.' }] },
      { name: 'Improved Abjuration', description: 'When you cast an abjuration spell that requires an ability check (like Dispel Magic or Counterspell), add proficiency bonus to the check.', level: 10, source: 'School of Abjuration', modifiers: [{ type: 'passive', description: 'Add prof bonus to abjuration ability checks.' }] },
      { name: 'Spell Resistance', description: 'Advantage on saves vs spells. Resistance against damage from spells.', level: 14, source: 'School of Abjuration', modifiers: [{ type: 'passive', description: 'Advantage vs spells, resistance to spell damage.' }] }
    ]
  },
  {
    id: 'school_of_evocation', name: 'School of Evocation', className: 'Wizard',
    description: 'Magic that creates powerful elemental effects such as bitter cold, searing flame, and rolling thunder.',
    features: [
      { name: 'Evocation Savant', description: 'Gold and time to copy Evocation spells is halved.', level: 2, source: 'School of Evocation', modifiers: [{ type: 'passive', description: 'Cheaper Evocation scribing.' }] },
      { name: 'Sculpt Spells', description: 'When you cast an evocation spell that affects other creatures you can see, choose 1 + spell level creatures. They automatically succeed on saving throws and take no damage if they would normally take half.', level: 2, source: 'School of Evocation', modifiers: [{ type: 'passive', description: 'Protect allies from your evocation spells.' }] },
      { name: 'Potent Cantrip', description: 'When a creature succeeds on a save against your cantrip, it takes half damage instead of no damage.', level: 6, source: 'School of Evocation', modifiers: [{ type: 'passive', description: 'Half damage on cantrip saves.' }] },
      { name: 'Empowered Evocation', description: 'Add your INT modifier to one damage roll of any wizard evocation spell you cast.', level: 10, source: 'School of Evocation', modifiers: [{ type: 'add_damage_ability', target: '__evocation__', ability: 'int' }] },
      { name: 'Overchannel', description: 'When you cast a wizard spell of 1st-5th level that deals damage, deal maximum damage on the spell. The first time is free. Subsequent uses cause necrotic damage to you (2d12 per spell level, increasing each time, ignores resistance). Resets on long rest.', level: 14, source: 'School of Evocation', modifiers: [{ type: 'passive', description: 'Maximize 1st-5th level spell damage.' }] }
    ]
  },
  {
    id: 'school_of_necromancy', name: 'School of Necromancy', className: 'Wizard',
    description: 'Magic that manipulates the energies of life and death.',
    features: [
      { name: 'Necromancy Savant', description: 'Gold and time to copy Necromancy spells is halved.', level: 2, source: 'School of Necromancy', modifiers: [{ type: 'passive', description: 'Cheaper Necromancy scribing.' }] },
      { name: 'Grim Harvest', description: 'Once per turn when you kill one or more creatures with a spell of 1st level or higher, regain HP equal to twice the spell\'s level (three times if it\'s a necromancy spell). Not constructs or undead.', level: 2, source: 'School of Necromancy', modifiers: [{ type: 'passive', description: 'Heal on spell kill.' }] },
      { name: 'Undead Thralls', description: 'Learn Animate Dead. When you cast it, target one additional corpse/pile of bones. Created undead have max HP increased by your wizard level, and add your prof bonus to their weapon damage rolls.', level: 6, source: 'School of Necromancy', modifiers: [{ type: 'grant_spells_always_prepared', spells: ['animate_dead'] }, { type: 'passive', description: 'Buffed undead creations.' }] },
      { name: 'Inured to Undeath', description: 'Gain resistance to necrotic damage. Max HP can\'t be reduced.', level: 10, source: 'School of Necromancy', modifiers: [{ type: 'grant_resistance', damageType: 'necrotic' }, { type: 'passive', description: 'Max HP cannot be reduced.' }] },
      { name: 'Command Undead', description: 'Action to choose an undead within 60 ft to make a CHA save against your spell save DC. On fail, it becomes friendly and obeys you. Intelligent undead get advantage/repeats.', level: 14, source: 'School of Necromancy', modifiers: [{ type: 'passive', description: 'Take control of an undead creature.' }] }
    ]
  }
];
