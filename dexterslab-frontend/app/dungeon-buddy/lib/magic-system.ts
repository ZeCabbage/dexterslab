import { LiveCharacter, SpellData } from './types';

// Rough simplification of the 5e mechanics for this phase.
// A full implementation would have exact lookup tables per 20 levels per class.
export function getSpellProgression(className: string, level: number) {
  const normClass = className.toLowerCase();
  
  let cantripsKnown = 0;
  let spellsKnown = 0;
  let maxSpellLevel = 1;

  if (['wizard', 'cleric', 'druid'].includes(normClass)) {
    // Prepared casters technically know "all" or use a spellbook, but let's emulate BG3 prepared limits
    cantripsKnown = level < 4 ? 3 : level < 10 ? 4 : 5;
    spellsKnown = level + 5; // Simplified prepared limit
    maxSpellLevel = Math.ceil(level / 2);
  } else if (['bard', 'sorcerer', 'warlock'].includes(normClass)) {
    // Spells known casters
    cantripsKnown = level < 4 ? 2 : level < 10 ? 3 : 4;
    spellsKnown = level < 11 ? level + 1 : 15; // Rough approximation
    maxSpellLevel = Math.ceil(level / 2);
  } else if (['paladin', 'ranger'].includes(normClass)) {
    // Half-casters
    cantripsKnown = 0; // Historically 0 in 5e base, though BG3/Tashas might tweak this
    spellsKnown = level < 2 ? 0 : Math.floor(level / 2) + 2;
    maxSpellLevel = Math.max(1, Math.ceil(level / 4));
  } else {
    // Non-casters (Fighter, Rogue, Barbarian, Monk)
    // Eldritch Knight / Arcane Trickster ignored for this simplified matrix
    cantripsKnown = 0;
    spellsKnown = 0;
    maxSpellLevel = 0;
  }

  return { cantripsKnown, spellsKnown, maxSpellLevel };
}

// ----------------------------------------------------
// BG3-Style Spell Evaluator
// ----------------------------------------------------
export function evaluateSpellLock(char: LiveCharacter | null, spell: SpellData, currentKnownSpells: SpellData[]): { locked: boolean, reason?: string } {
  if (!char) return { locked: true, reason: 'No active character' };

  // 1. Is the character even a spellcaster?
  if (!char.spellcaster) {
    return { locked: true, reason: `Requires Spellcasting Class` };
  }

  // Subclass expanded spell definitions
  const SUBCLASS_EXPANDED_SPELLS: Record<string, string[]> = {
    'The Fiend': ['command', 'burning hands', 'blindness/deafness', 'scorching ray', 'fireball', 'stinking cloud', 'fire shield', 'wall of fire', 'flame strike', 'hallow'],
    'The Archfey': ['faerie fire', 'sleep', 'calm emotions', 'phantasmal force', 'blink', 'plant growth', 'dominate beast', 'greater invisibility', 'dominate person', 'seeming'],
    'The Great Old One': ['dissonant whispers', "tasha's hideous laughter", 'detect thoughts', 'phantasmal force', 'clairvoyance', 'sending', 'dominate beast', "evard's black tentacles", 'dominate person', 'telekinesis'],
    'Divine Soul': ['cure wounds', 'healing word', 'bless', 'bane', 'guiding bolt', 'inflict wounds', 'sanctuary', 'shield of faith']
    // Expand as needed for Clerics, Paladins, etc.
  };

  // 2. Does this spell belong to the character's class?
  let isClassMatch = spell.classes.some(c => c.toLowerCase() === char.class.toLowerCase());
  
  // Check if subclass formally grants it
  if (!isClassMatch && char.subclass) {
     const expandedSpells = SUBCLASS_EXPANDED_SPELLS[char.subclass];
     if (expandedSpells && expandedSpells.includes(spell.name.toLowerCase())) {
        isClassMatch = true;
     }
  }
  
  // Divine Soul explicit exception (can pick from Cleric list)
  if (!isClassMatch && char.subclass === 'Divine Soul' && spell.classes.map(c=>c.toLowerCase()).includes('cleric')) {
     isClassMatch = true;
  }

  if (!isClassMatch && spell.classes.length > 0) { // If classes is empty, assume homebrew universal
    return { locked: true, reason: `Requires ${spell.classes.join(' or ')}` };
  }

  // 3. Are they a high enough level to cast this?
  const prog = getSpellProgression(char.class, char.level);
  if (spell.level > prog.maxSpellLevel) {
    return { locked: true, reason: `Requires Level ${spell.level * 2 - 1} ${char.class}` }; // Rough max level inversion
  }

  // 4. Strict Quantity Constraints (Count cantrips vs levelled spells)
  const isCantrip = spell.level === 0;
  
  // Count how many of this type they already know
  const knownOfThisType = currentKnownSpells.filter(s => (s.level === 0) === isCantrip).length;
  
  if (isCantrip && knownOfThisType >= prog.cantripsKnown) {
    return { locked: true, reason: `Max Cantrips Known (${prog.cantripsKnown})` };
  } else if (!isCantrip && knownOfThisType >= prog.spellsKnown) {
    return { locked: true, reason: `Max Spells Known (${prog.spellsKnown})` };
  }

  return { locked: false };
}
