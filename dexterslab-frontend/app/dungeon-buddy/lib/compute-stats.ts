import { LiveCharacter, SpellData } from './types';

// Helper to calculate raw stat modifier (e.g., 20 -> 5)
export const calcMod = (score: number) => {
  if (typeof score !== 'number' || isNaN(score)) return 0;
  return Math.floor((score - 10) / 2);
};

export function getSpellDamage(char: LiveCharacter | null, spell: SpellData): string {
  if (!spell.damage || !char) return spell.damage || '';

  let baseDmg = spell.damage; // e.g. "1d10"
  let flatBonus = 0;

  // Process global features
  char.features.forEach(feature => {
     feature.modifiers?.forEach(mod => {
        if (mod.type === 'add_damage_ability' && mod.target === spell.name.toLowerCase()) {
           const bonus = calcMod(char.stats[mod.ability as keyof typeof char.stats] || 10);
           flatBonus += bonus;
        }
     });
  });

  if (flatBonus > 0) {
      baseDmg += ` + ${flatBonus}`;
  } else if (flatBonus < 0) {
      baseDmg += ` - ${Math.abs(flatBonus)}`;
  }

  return baseDmg;
}

export function getSpellRange(char: LiveCharacter | null, spell: SpellData): string {
  if (!char) return spell.range;

  let finalRange = spell.range;

  char.features.forEach(feature => {
     feature.modifiers?.forEach(mod => {
        if (mod.type === 'add_range' && mod.target === spell.name.toLowerCase()) {
           finalRange = `${mod.value} feet`;
        }
     });
  });

  return finalRange;
}
