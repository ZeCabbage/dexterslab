'use client';

import React, { useState } from 'react';
import { useCharacterStore } from '../lib/store';
import { useSpells, useAllSpells } from '../hooks/useSpells';
import { evaluateSpellLock } from '../lib/magic-system';
import SpellCard from './SpellCard';
import styles from '../[id]/page.module.css';

interface SpellBrowserProps {
  onClose?: () => void;
  inline?: boolean;
  draftMode?: boolean;
  draftedSpells?: string[];
  onSpellDraft?: (spellId: string) => void;
  contextChar?: any; // LiveCharacter shape for drafts
}

export default function SpellBrowser({ onClose, inline = false, draftMode = false, draftedSpells = [], onSpellDraft, contextChar }: SpellBrowserProps) {
  const store = useCharacterStore();
  const char = contextChar || store.char;
  
  const allSpells = useAllSpells(char?.customSpells || [], char?.homebrew?.spells || []);
  const currentlyKnown = useSpells(char?.knownSpells, char?.customSpells);
  
  // Mix in drafted spells for lock calculation if in draft mode
  const effectiveKnown = draftMode ? [...(char?.knownSpells||[]), ...draftedSpells] : char?.knownSpells;
  
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [strictMode, setStrictMode] = useState<boolean>(true); // BG3 logic

  if (!char) return null;

  const filteredSpells = allSpells.filter(spell => {
    if (levelFilter !== 'all' && spell.level.toString() !== levelFilter) return false;
    if (search && !spell.name.toLowerCase().includes(search.toLowerCase())) return false;
    
    // Strict Mode filter (hide spells we fundamentally cannot learn)
    if (strictMode) {
      const isKnown = effectiveKnown?.includes(spell.id) || false;
      if (!isKnown) {
        const lockData = evaluateSpellLock(char, spell, currentlyKnown);
        // Only completely hide spells if they are fundamentally illegal for the class/level
        // Do NOT hide spells just because they hit the quantity cap.
        if (lockData.locked && (lockData.reason?.includes('Requires') || lockData.reason?.includes('Class'))) {
          return false;
        }
      }
    }

    return true;
  });

  const overlayStyle = inline ? {
      display: 'flex', flexDirection: 'column' as const, height: '100%', width: '100%'
    } : {
      position: 'fixed' as const, top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.85)', zIndex: 9999,
      display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px'
    };

  const containerStyle = inline ? {
      display: 'flex', flexDirection: 'column' as const, flex: 1
    } : {
      background: '#1a1a1a', border: '1px solid #55aacc', borderRadius: '8px', 
      width: '100%', maxWidth: '900px', height: '90%', 
      display: 'flex', flexDirection: 'column' as const, overflow: 'hidden'
    };

  return (
    <div style={overlayStyle}>
      <div style={containerStyle}>
        {/* Header (Only show for modal or keep simple for inline) */}
        {!inline && (
          <div style={{ padding: '16px', background: 'rgba(10,30,50,0.8)', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h2 className={styles.tabTitle} style={{ margin: 0, border: 'none', padding: 0 }}>The Grimoire Archive</h2>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
               <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ccc', fontSize: '13px', cursor: 'pointer' }}>
                 <input type="checkbox" checked={strictMode} onChange={e => setStrictMode(e.target.checked)} />
                 Show Valid Leveling Magic Only
               </label>
               {onClose && <button onClick={onClose} style={{ background: '#333', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>Close</button>}
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ padding: inline ? '0 0 16px 0' : '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {inline && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ccc', fontSize: '13px', cursor: 'pointer', flex: 1, minWidth: '200px' }}>
              <input type="checkbox" checked={strictMode} onChange={e => setStrictMode(e.target.checked)} />
              Show Valid Leveling Magic Only
            </label>
          )}
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
            <option value="4">Level 4</option>
            <option value="5">Level 5</option>
          </select>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: inline ? '0' : '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 350px), 1fr))', gap: '24px' }}>
            {filteredSpells.length === 0 && <p style={{ color: '#666' }}>No spells match your current parameters.</p>}
            {filteredSpells.map(spell => {
              const isKnown = effectiveKnown?.includes(spell.id) || false;
              // Even in strict mode, we calculate lockData visually to display generic locks (like quantity caps)
              let lockData: { locked: boolean; reason?: string } = { locked: false };
              if (!isKnown) {
                lockData = evaluateSpellLock(char, spell, currentlyKnown);
              }

              return (
                <SpellCard 
                  key={spell.id}
                  spell={spell}
                  isKnown={isKnown}
                  isPrepared={false} // Preparing is done on the combat dashboard
                  onLearnToggle={() => {
                     if (draftMode && onSpellDraft) {
                       onSpellDraft(spell.id);
                     } else {
                       isKnown ? store.unlearnSpell(spell.id) : store.learnSpell(spell.id);
                     }
                  }}
                  lockReason={lockData.locked ? lockData.reason : undefined}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
