import { useMemo } from 'react';
import { SPELL_DATABASE, SpellData } from '../lib/data/spells';

/**
 * Returns full rich spell payload objects safely mapped from live Zustand string IDs.
 * Separates data from state.
 */
export function useSpells(spellIds: string[] | undefined): SpellData[] {
  return useMemo(() => {
    if (!spellIds) return [];
    return spellIds.map(id => SPELL_DATABASE[id]).filter(Boolean);
  }, [spellIds]);
}

export function useAllSpells(): SpellData[] {
  return useMemo(() => {
    return Object.values(SPELL_DATABASE);
  }, []);
}
