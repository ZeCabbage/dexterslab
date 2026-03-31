import { useMemo } from 'react';
import { SPELL_DATABASE } from '../lib/data/spells';
import { SpellData } from '../lib/types';

/**
 * Returns full rich spell payload objects safely mapped from live Zustand string IDs.
 * Separates data from state.
 */
export function useSpells(spellIds: string[] | undefined, customSpells: SpellData[] = []): SpellData[] {
  return useMemo(() => {
    if (!spellIds) return [];
    return spellIds.map(id => {
      return SPELL_DATABASE[id] || customSpells.find(cs => cs.id === id);
    }).filter(Boolean) as SpellData[];
  }, [spellIds, customSpells]);
}

export function useAllSpells(customSpells: SpellData[] = []): SpellData[] {
  return useMemo(() => {
    return [...Object.values(SPELL_DATABASE), ...customSpells];
  }, [customSpells]);
}
