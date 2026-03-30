import { LiveCharacter } from './types';

export function calculateAC(char: LiveCharacter): number {
  if (!char) return 10;

  const dexScore = char.stats?.dex || 10;
  const dexMod = Math.floor((dexScore - 10) / 2);

  const chest = char.equipped?.chest;
  const offHand = char.equipped?.offHand;

  let baseAc = 10;
  let dexBonus = dexMod;

  if (chest && chest.type === 'armor') {
    const armorClass = chest.armorClass || 11; // Default fallback if missing
    
    if (chest.armorCategory === 'light') {
      baseAc = armorClass;
      dexBonus = dexMod;
    } else if (chest.armorCategory === 'medium') {
      baseAc = armorClass;
      dexBonus = Math.min(2, dexMod);
    } else if (chest.armorCategory === 'heavy') {
      baseAc = armorClass;
      dexBonus = 0; // Heavy armor gets no DEX bonus
    }
  }

  let finalAc = baseAc + dexBonus;

  // Add shield bonus if present
  if (offHand && offHand.armorCategory === 'shield') {
    finalAc += offHand.armorClass || 2;
  }

  // Any ring of protection or similar adjustments could be added here in the future
  
  return finalAc;
}
