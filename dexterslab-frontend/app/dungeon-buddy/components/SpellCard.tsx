'use client';

import React from 'react';
import { SpellData } from '../lib/types';
import styles from '../[id]/page.module.css';
import { useCharacterStore } from '../lib/store';
import D20Icon from './D20Icon';
import { getSpellDamage, getSpellRange } from '../lib/compute-stats';

interface SpellCardProps {
  spell: SpellData;
  isKnown?: boolean;
  isPrepared?: boolean;
  onPrepareToggle?: () => void;
  onLearnToggle?: () => void;
  lockReason?: string;
}

export default function SpellCard({ spell, isKnown, isPrepared, onPrepareToggle, onLearnToggle, lockReason }: SpellCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  // Optional chaining fallback because SpellCard might be used during draft mode
  const rawCharState = useCharacterStore.getState().char; 
  const computedDmg = getSpellDamage(rawCharState, spell);
  const computedRange = getSpellRange(rawCharState, spell);

  return (
    <div style={{
      background: 'rgba(20,20,20,0.8)',
      border: `1px solid ${isPrepared ? '#cfaa5e' : '#444'}`, // Highlight if prepared
      borderRadius: '6px',
      padding: '12px',
      position: 'relative',
      boxShadow: isPrepared ? '0 0 10px rgba(207, 170, 94, 0.1)' : 'none',
      display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => setIsExpanded(!isExpanded)}>
          <h4 style={{ margin: '0 0 4px 0', color: isPrepared ? '#fff' : '#cfaa5e', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {spell.name}
            <span style={{ fontSize: '10px', color: '#cfaa5e', border: '1px solid #cfaa5e', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '1px' }}>i</span>
          </h4>
          <span style={{ fontSize: '12px', color: '#888', fontStyle: 'italic' }}>
            {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`} {spell.school}
          </span>
          {spell.level > 0 && (
            <span style={{ marginLeft: '8px', background: '#aa4444', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '4px', fontWeight: 'bold', display: 'inline-block' }}>
              Costs Level {spell.level} Slot
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {onPrepareToggle && spell.level > 0 && (
            <button 
              onClick={onPrepareToggle}
              style={{
                background: isPrepared ? '#cfaa5e' : 'transparent',
                color: isPrepared ? '#000' : '#888',
                border: `1px solid ${isPrepared ? '#cfaa5e' : '#555'}`,
                padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {isPrepared ? 'PREPARED' : 'Prepare'}
            </button>
          )}

          {isPrepared && (
            <button
               onClick={(e) => {
                 e.stopPropagation();
                 if (spell.level > 0) {
                    useCharacterStore.getState().expendResource(`spell_slot_${spell.level}`);
                 }
                 useCharacterStore.getState().addLog('spell', `Casted ${spell.name}!`);
                 alert(`Casting ${spell.name}! ${spell.level > 0 ? "Spell Slot deducted." : "Cantrip logic."}`);
               }}
               style={{
                 background: '#4aa',
                 color: '#000',
                 border: 'none',
                 padding: '4px 12px',
                 borderRadius: '4px',
                 fontSize: '11px',
                 fontWeight: 'bold',
                 cursor: 'pointer'
               }}
            >
              CAST
            </button>
          )}

          {onLearnToggle && (
            <button 
              onClick={lockReason && !isKnown ? undefined : onLearnToggle}
              style={{
                background: (lockReason && !isKnown) ? '#222' : isKnown ? '#55aacc' : 'transparent',
                color: (lockReason && !isKnown) ? '#666' : isKnown ? '#000' : '#55aacc',
                border: `1px solid ${(lockReason && !isKnown) ? '#444' : '#55aacc'}`,
                padding: '4px 8px', borderRadius: '4px', fontSize: '11px', 
                cursor: (lockReason && !isKnown) ? 'not-allowed' : 'pointer'
              }}
              disabled={!!lockReason && !isKnown}
            >
              {isKnown ? 'FORGET' : (lockReason ? `🔒 ${lockReason}` : 'LEARN')}
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div style={{ animation: 'fadeIn 0.2s', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #333' }}>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', paddingBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: '#aaa' }}><strong>Time:</strong> {spell.castingTime}</div>
            <div style={{ fontSize: '11px', color: '#aaa' }}><strong>Range:</strong> {computedRange}</div>
            <div style={{ fontSize: '11px', color: '#aaa' }}><strong>Duration:</strong> {spell.duration}</div>
          </div>

          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#bbb', lineHeight: '1.4' }}>
            {spell.description}
          </p>

          {computedDmg && (
            <div style={{ background: 'rgba(255, 50, 50, 0.1)', border: '1px solid rgba(255,50,50,0.3)', padding: '6px', borderRadius: '4px', textAlign: 'center', fontSize: '12px', color: '#ff6666', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
              <strong>DMG {computedDmg}</strong>
              <button 
                className={styles.rollBtn} 
                onClick={(e) => {
                  e.stopPropagation();
                  const split = spell.damage!.toLowerCase().split('d');
                  const count = parseInt(split[0]) || 1;
                  const sides = parseInt(split[1]) || 20;
                  let rollSum = 0;
                  for(let i=0; i<count; i++) rollSum += Math.floor(Math.random() * sides) + 1;
                  const message = `Rolled ${spell.name} Damage: ${rollSum} (${computedDmg})`;
                  alert(message);
                  useCharacterStore.getState().addLog('roll', message);
                }}
                title="Roll Damage"
              >
                <D20Icon />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
