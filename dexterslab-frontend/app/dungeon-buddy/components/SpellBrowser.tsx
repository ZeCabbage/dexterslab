'use client';

import React, { useState } from 'react';
import { useCharacterStore } from '../lib/store';
import { useAllSpells } from '../hooks/useSpells';
import SpellCard from './SpellCard';
import styles from '../[id]/page.module.css';

interface SpellBrowserProps {
  onClose: () => void;
}

export default function SpellBrowser({ onClose }: SpellBrowserProps) {
  const { char, learnSpell, unlearnSpell } = useCharacterStore();
  const allSpells = useAllSpells();
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');

  if (!char) return null;

  const filteredSpells = allSpells.filter(spell => {
    if (levelFilter !== 'all' && spell.level.toString() !== levelFilter) return false;
    if (search && !spell.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.85)', zIndex: 9999,
      display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px'
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid #55aacc', borderRadius: '8px', 
        width: '100%', maxWidth: '900px', height: '90%', 
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '24px', background: 'rgba(10,30,50,0.8)', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className={styles.tabTitle} style={{ margin: 0, border: 'none', padding: 0 }}>The Grimoire Archive</h2>
          <button onClick={onClose} style={{ background: '#333', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Close</button>
        </div>

        {/* Filters */}
        <div style={{ padding: '16px 24px', display: 'flex', gap: '16px', background: '#111' }}>
          <input 
            type="text" 
            placeholder="Search spells..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, padding: '12px', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
          />
          <select 
            value={levelFilter} 
            onChange={(e) => setLevelFilter(e.target.value)}
            style={{ padding: '12px', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
          >
            <option value="all">All Levels</option>
            <option value="0">Cantrip</option>
            <option value="1">Level 1</option>
            <option value="2">Level 2</option>
            <option value="3">Level 3</option>
          </select>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
            {filteredSpells.length === 0 && <p style={{ color: '#666' }}>No spells found in the archives.</p>}
            {filteredSpells.map(spell => {
              const isKnown = char.knownSpells?.includes(spell.id) || false;
              return (
                <SpellCard 
                  key={spell.id}
                  spell={spell}
                  isKnown={isKnown}
                  isPrepared={false} // Preparing is done on the combat dashboard
                  onLearnToggle={() => isKnown ? unlearnSpell(spell.id) : learnSpell(spell.id)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
